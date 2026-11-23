import type * as THREE_NS from "three";

/**
 * TREND AI — the store's 3D companion robot.
 *
 * Industrial-design brief: compact humanoid, pearl-white glossy ceramic shell,
 * matte-black structure, soft-silver accents, a dark glass face display whose
 * ice-cyan "digital light" eyes carry the expressions, a small TREND mark on
 * the chest, faint cyan rings at the joints, and only restrained hologram
 * details (floor light rings, a few particles). Studio-lit with PBR materials.
 *
 * three.js is passed in (dynamically imported by the caller) so it never
 * lands in the main bundle.
 */
export type Mood = "neutral" | "happy" | "curious" | "listening" | "thinking" | "speaking" | "excited" | "confirm";

export type RobotHandle = {
  setSize: (w: number, h: number) => void;
  lookAt: (nx: number, ny: number) => void; // -1..1 screen coords
  wave: () => void;
  talk: (on: boolean) => void;
  setMood: (m: Mood) => void;
  dispose: () => void;
};

const CYAN = "#7ff3ff";

/* ── Face display: drawn on a canvas, used as the glass's emissive map ── */
function drawFace(ctx: CanvasRenderingContext2D, mood: Mood, t: number, blink: number, gaze: { x: number; y: number }) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 18;
  ctx.fillStyle = CYAN;
  ctx.strokeStyle = CYAN;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const gx = gaze.x * 14, gy = gaze.y * 8;
  const cy = H * 0.47 + gy;
  const lx = W * 0.36 + gx, rx = W * 0.64 + gx;
  const pill = (x: number, y: number, w: number, h: number) => {
    const r = Math.min(w, h) / 2;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, Math.max(2, h), r);
    ctx.fill();
  };
  const arc = (x: number, y: number, w: number, up: boolean) => {
    ctx.lineWidth = 11;
    ctx.beginPath();
    if (up) ctx.arc(x, y + w * 0.25, w * 0.5, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(x, y - w * 0.25, w * 0.5, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  };
  const eyeH = 46 * blink;

  switch (mood) {
    case "happy":
      arc(lx, cy, 52, true); arc(rx, cy, 52, true);
      break;
    case "excited": {
      const s = 1 + 0.08 * Math.sin(t * 10);
      for (const x of [lx, rx]) {
        ctx.save(); ctx.translate(x, cy); ctx.scale(s, s);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? 9 : 27, a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      break;
    }
    case "curious":
      pill(lx, cy, 30, eyeH * 1.15);
      pill(rx, cy + 4, 30, eyeH * 0.62);
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(rx - 18, cy - 38); ctx.lineTo(rx + 18, cy - 44); ctx.stroke();
      break;
    case "thinking": {
      pill(lx + 10, cy - 10, 28, eyeH * 0.55);
      pill(rx + 10, cy - 10, 28, eyeH * 0.55);
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(t * 5 - i * 0.8));
        ctx.beginPath(); ctx.arc(W * 0.42 + i * 22, H * 0.82, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "listening":
      pill(lx, cy, 30, eyeH);
      pill(rx, cy, 30, eyeH);
      for (let i = 0; i < 5; i++) {
        const h = 8 + 22 * Math.abs(Math.sin(t * 6 + i * 1.3));
        pill(W * 0.4 + i * 13, H * 0.84, 6, h);
      }
      break;
    case "speaking": {
      pill(lx, cy, 30, eyeH);
      pill(rx, cy, 30, eyeH);
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let x = -34; x <= 34; x += 2) {
        const env = 1 - Math.abs(x) / 34;
        const y = Math.sin(x * 0.35 + t * 18) * 10 * env * (0.6 + 0.4 * Math.sin(t * 7));
        if (x === -34) ctx.moveTo(W / 2 + x, H * 0.82 + y); else ctx.lineTo(W / 2 + x, H * 0.82 + y);
      }
      ctx.stroke();
      break;
    }
    case "confirm":
      arc(lx, cy, 46, true);
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(rx - 20, cy); ctx.lineTo(rx - 5, cy + 15); ctx.lineTo(rx + 22, cy - 16); ctx.stroke();
      break;
    default:
      pill(lx, cy, 30, eyeH);
      pill(rx, cy, 30, eyeH);
  }
  ctx.restore();
}

/* ── Chest mark ── */
function logoTexture(THREE: typeof THREE_NS) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, 256, 128);
  g.shadowColor = CYAN; g.shadowBlur = 10;
  g.fillStyle = "#bdf8ff";
  g.font = "700 46px 'Segoe UI', Arial, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.letterSpacing = "6px";
  g.fillText("TREND", 128, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function buildRobotAsync(THREE: typeof THREE_NS, canvas: HTMLCanvasElement): Promise<RobotHandle> {
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 1.2, 6.1);
  camera.lookAt(0, 1.05, 0);

  // Studio lighting: warm key, cool rim, soft fill.
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fe9ff, 1.4); rim.position.set(-4, 3, -3); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xeef4ff, 0x8a96a8, 0.55));

  // Materials
  const ceramic = new THREE.MeshPhysicalMaterial({
    color: 0xf3f4f7, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06,
    sheen: 0.35, sheenColor: new THREE.Color(0xd9d4ff), sheenRoughness: 0.5, envMapIntensity: 1.1,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x0d1016, roughness: 0.55, metalness: 0.35 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.28, metalness: 1 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x8ff4ff, transparent: true, opacity: 0.9, toneMapped: false });

  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 256; faceCanvas.height = 160;
  const faceCtx = faceCanvas.getContext("2d")!;
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x05070b, roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02,
    emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 1.6, envMapIntensity: 1.4,
  });

  const root = new THREE.Group();
  root.rotation.y = -0.42; // three-quarter, turned toward the viewer
  scene.add(root);
  const bot = new THREE.Group();
  root.add(bot);

  const add = (parent: THREE_NS.Object3D, geo: THREE_NS.BufferGeometry, mat: THREE_NS.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  };
  const ring = (parent: THREE_NS.Object3D, r: number, y: number, rotX = Math.PI / 2) => {
    const m = add(parent, new THREE.TorusGeometry(r, 0.008, 8, 48), glow, 0, y, 0);
    m.rotation.x = rotX;
    return m;
  };

  /* Head */
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.86;
  bot.add(headPivot);
  add(headPivot, new THREE.SphereGeometry(0.5, 64, 48), ceramic, 0, 0, 0, 1.08, 0.9, 0.96);
  // Dark glass face: a front patch of a slightly larger sphere.
  add(headPivot, new THREE.SphereGeometry(0.507, 64, 40, Math.PI / 2 - 0.78, 1.56, Math.PI / 2 - 0.5, 1.0), glass, 0, 0.01, 0, 1.08, 0.9, 0.96);
  // Ear pods
  for (const s of [-1, 1]) {
    const pod = add(headPivot, new THREE.CylinderGeometry(0.13, 0.13, 0.07, 40), silver, s * 0.54, 0, 0);
    pod.rotation.z = Math.PI / 2;
    const lr = add(headPivot, new THREE.TorusGeometry(0.1, 0.01, 8, 40), glow, s * 0.58, 0, 0);
    lr.rotation.y = Math.PI / 2;
  }
  // Crown seam
  const seam = add(headPivot, new THREE.TorusGeometry(0.46, 0.006, 6, 64), black, 0, 0.18, -0.04, 1.08, 1, 0.96);
  seam.rotation.x = Math.PI / 2 - 0.25;

  /* Neck */
  add(bot, new THREE.CylinderGeometry(0.09, 0.12, 0.2, 24), black, 0, 1.43, 0);
  ring(bot, 0.105, 1.42);

  /* Torso */
  const torso = new THREE.Group();
  torso.position.y = 0.98;
  bot.add(torso);
  add(torso, new THREE.CapsuleGeometry(0.33, 0.34, 12, 40), ceramic, 0, 0.02, 0, 1.18, 1, 0.82);
  // Chest glass plate with the TREND mark
  const logoMat = new THREE.MeshPhysicalMaterial({ color: 0x06080c, roughness: 0.08, clearcoat: 1, emissive: 0xffffff, emissiveMap: logoTexture(THREE), emissiveIntensity: 0.9 });
  const plate = add(torso, new THREE.CapsuleGeometry(0.055, 0.2, 6, 20), logoMat, 0, 0.1, 0.262, 1, 1, 0.35);
  plate.rotation.z = Math.PI / 2;
  // Waist: black band + glow line
  add(torso, new THREE.CylinderGeometry(0.31, 0.27, 0.1, 40), black, 0, -0.34, 0, 1.1, 1, 0.8);
  const wr = ring(torso, 0.3, -0.31); wr.scale.set(1.1, 0.8, 1);
  // Pelvis
  add(torso, new THREE.SphereGeometry(0.25, 40, 24), ceramic, 0, -0.5, 0, 1.15, 0.7, 0.85);

  /* Arms */
  const mkArm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.46, 1.22, 0);
    bot.add(shoulder);
    add(shoulder, new THREE.SphereGeometry(0.1, 24, 16), black);
    add(shoulder, new THREE.CapsuleGeometry(0.075, 0.24, 8, 20), ceramic, 0, -0.2, 0);
    const elbow = new THREE.Group();
    elbow.position.y = -0.38;
    shoulder.add(elbow);
    add(elbow, new THREE.SphereGeometry(0.07, 20, 14), black);
    ring(elbow, 0.074, 0);
    add(elbow, new THREE.CapsuleGeometry(0.068, 0.2, 8, 20), ceramic, 0, -0.17, 0);
    const hand = new THREE.Group();
    hand.position.y = -0.34;
    elbow.add(hand);
    add(hand, new THREE.SphereGeometry(0.058, 18, 12), silver, 0, 0.02, 0);
    add(hand, new THREE.CapsuleGeometry(0.062, 0.05, 6, 16), ceramic, 0, -0.06, 0, 1, 1, 0.75);
    for (let f = -1; f <= 1; f++) add(hand, new THREE.CapsuleGeometry(0.016, 0.05, 4, 8), black, f * 0.035, -0.135, 0.01);
    add(hand, new THREE.CapsuleGeometry(0.017, 0.04, 4, 8), black, side * 0.065, -0.07, 0.02);
    shoulder.rotation.z = side * 0.1;
    return { shoulder, elbow };
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  /* Legs */
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.15, 0.5, 0);
    bot.add(hip);
    add(hip, new THREE.SphereGeometry(0.085, 20, 14), black);
    add(hip, new THREE.CapsuleGeometry(0.085, 0.16, 8, 20), ceramic, 0, -0.15, 0);
    add(hip, new THREE.SphereGeometry(0.068, 18, 12), black, 0, -0.3, 0);
    ring(hip, 0.072, -0.3);
    add(hip, new THREE.CapsuleGeometry(0.08, 0.12, 8, 20), ceramic, 0, -0.43, 0);
    add(hip, new THREE.SphereGeometry(0.11, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), black, 0, -0.56, 0.04, 1, 0.55, 1.45);
  }

  /* Floor: soft contact shadow + restrained light rings */
  const sh = document.createElement("canvas"); sh.width = sh.height = 128;
  const sg = sh.getContext("2d")!;
  const grd = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, "rgba(20,30,45,.55)"); grd.addColorStop(1, "rgba(20,30,45,0)");
  sg.fillStyle = grd; sg.fillRect(0, 0, 128, 128);
  const shadow = add(root, new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }), 0, -0.07, 0);
  shadow.rotation.x = -Math.PI / 2;
  const floorRingMat = new THREE.MeshBasicMaterial({ color: 0x8ff4ff, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false });
  const fr1 = add(root, new THREE.TorusGeometry(0.62, 0.006, 6, 96), floorRingMat, 0, -0.06, 0); fr1.rotation.x = Math.PI / 2;
  const fr2 = add(root, new THREE.TorusGeometry(0.82, 0.004, 6, 96), floorRingMat.clone(), 0, -0.06, 0); fr2.rotation.x = Math.PI / 2;
  (fr2.material as THREE_NS.MeshBasicMaterial).opacity = 0.25;

  // A few drifting particles
  const N = 28;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 0.5 + Math.random() * 0.6, a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 2.3; pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dots = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xaaf6ff, size: 0.022, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
  root.add(dots);

  /* Animation */
  let look = { x: 0, y: 0 };
  let waveT = -1;
  let mood: Mood = "neutral";
  let talking = false;
  let raf = 0;
  let running = true;
  const clock = new THREE.Clock();

  const frame = () => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();

    bot.position.y = Math.sin(t * 1.4) * 0.025;
    root.rotation.y = -0.42 + Math.sin(t * 0.35) * 0.12;
    headPivot.rotation.y += (look.x * 0.55 - headPivot.rotation.y) * 0.07;
    headPivot.rotation.x += (-look.y * 0.3 - headPivot.rotation.x) * 0.07;
    headPivot.rotation.z = mood === "curious" ? 0.14 : mood === "thinking" ? -0.08 : headPivot.rotation.z * 0.9;
    torso.rotation.y = Math.sin(t * 0.7) * 0.04;

    const blinkPhase = t % 4.6;
    const blink = blinkPhase < 0.1 ? 0.12 : blinkPhase < 0.16 ? 0.5 : 1;
    drawFace(faceCtx, talking ? "speaking" : mood, t, blink, look);
    faceTex.needsUpdate = true;

    // Left arm: relaxed sway. Right arm: greeting pose, waves on demand.
    armL.shoulder.rotation.z = -0.12 - Math.sin(t * 1.4) * 0.03;
    armL.elbow.rotation.z = -0.08;
    armL.shoulder.rotation.x = Math.sin(t * 0.9) * 0.04;
    let rz = 0.55, ez = 1.25;
    if (waveT >= 0) {
      const w = t - waveT;
      if (w > 2.4) waveT = -1;
      rz = 2.35; ez = 0.55 + Math.sin(w * 10) * 0.35;
    }
    armR.shoulder.rotation.z += (rz - armR.shoulder.rotation.z) * 0.1;
    armR.elbow.rotation.z += (ez - armR.elbow.rotation.z) * 0.14;
    armR.shoulder.rotation.x = -0.25;

    fr1.scale.setScalar(1 + 0.03 * Math.sin(t * 2));
    (fr2.material as THREE_NS.MeshBasicMaterial).opacity = 0.18 + 0.12 * Math.sin(t * 1.3);
    const p = pg.attributes.position as THREE_NS.BufferAttribute;
    for (let i = 0; i < N; i++) { let y = p.getY(i) + 0.003; if (y > 2.3) y = 0; p.setY(i, y); }
    p.needsUpdate = true;

    renderer.render(scene, camera);
  };
  frame();

  const onVis = () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running) { running = true; frame(); }
  };
  document.addEventListener("visibilitychange", onVis);

  return {
    setSize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Keep the full body in frame on tall/narrow boxes.
      camera.position.z = w / h < 0.75 ? 7.2 : 6.1;
      camera.updateProjectionMatrix();
    },
    lookAt(nx, ny) { look = { x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) }; },
    wave() { waveT = clock.getElapsedTime(); },
    talk(on) { talking = on; },
    setMood(m) { mood = m; },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => {
        const m = o as THREE_NS.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE_NS.Material | THREE_NS.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose?.();
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
