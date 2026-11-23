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

/* ── Chest mark: the original TREND logo + wordmark ── */
async function logoTexture(THREE: typeof THREE_NS) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 256);
  try {
    const img = new Image();
    img.src = "/brand/trend-logo.png";
    await img.decode();
    const h = 120, w = (img.width / img.height) * h;
    g.drawImage(img, 128 - w / 2, 40, w, h);
  } catch { /* wordmark alone */ }
  g.fillStyle = "#1a222b";
  g.font = "700 30px 'Segoe UI', Arial, sans-serif";
  g.textAlign = "center";
  (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "8px";
  g.fillText("TREND", 132, 205);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ── Floating glass UI tiles (bag, search, chart, cart, sparkle) ── */
function tileTexture(THREE: typeof THREE_NS, kind: "bag" | "search" | "chart" | "cart" | "spark") {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 256);
  const grd = g.createLinearGradient(0, 0, 256, 256);
  grd.addColorStop(0, "rgba(255,255,255,0.55)"); grd.addColorStop(1, "rgba(190,215,255,0.22)");
  g.fillStyle = grd;
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 5;
  g.beginPath(); g.roundRect(12, 12, 232, 232, 46); g.fill(); g.stroke();
  g.strokeStyle = "#ffffff"; g.fillStyle = "#ffffff";
  g.shadowColor = "#7ff3ff"; g.shadowBlur = 16;
  g.lineWidth = 14; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath();
  if (kind === "bag") { g.roundRect(70, 100, 116, 100, 14); g.moveTo(98, 100); g.arc(128, 100, 30, Math.PI, 0); }
  if (kind === "search") { g.arc(115, 115, 42, 0, Math.PI * 2); g.moveTo(146, 146); g.lineTo(186, 186); }
  if (kind === "chart") { for (const [x, h] of [[80, 40], [112, 64], [144, 88], [176, 112]]) { g.moveTo(x, 190); g.lineTo(x, 190 - h); } }
  if (kind === "cart") { g.moveTo(58, 72); g.lineTo(86, 72); g.lineTo(108, 160); g.lineTo(182, 160); g.lineTo(198, 98); g.lineTo(94, 98); g.stroke(); g.beginPath(); g.arc(116, 192, 10, 0, 7); g.arc(172, 192, 10, 0, 7); g.fill(); }
  if (kind === "spark") { g.moveTo(128, 64); g.quadraticCurveTo(136, 120, 192, 128); g.quadraticCurveTo(136, 136, 128, 192); g.quadraticCurveTo(120, 136, 64, 128); g.quadraticCurveTo(120, 120, 128, 64); g.fill(); }
  g.stroke();
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
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.15, 6.4);
  camera.lookAt(0, 1.05, 0);

  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd8ff, 1.8); rim.position.set(-4, 2, -3); scene.add(rim);
  const under = new THREE.PointLight(0x7ff3ff, 6, 4, 2); under.position.set(0, 0.1, 0.4); scene.add(under);
  scene.add(new THREE.HemisphereLight(0xeef4ff, 0x7d8ca4, 0.6));

  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xf5f6f9, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, sheenColor: new THREE.Color(0xd8dcff), envMapIntensity: 1.15 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141a24, roughness: 0.45, metalness: 0.4 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x8ff4ff, transparent: true, opacity: 0.95, toneMapped: false });

  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 256; faceCanvas.height = 160;
  const faceCtx = faceCanvas.getContext("2d")!;
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x04060b, roughness: 0.03, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 1.7, envMapIntensity: 1.6 });

  const root = new THREE.Group();
  root.rotation.y = -0.32;
  scene.add(root);
  const bot = new THREE.Group();
  root.add(bot);

  const add = (parent: THREE_NS.Object3D, geo: THREE_NS.BufferGeometry, mat: THREE_NS.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  };

  /* Head — large, rounded, with a big dark visor and headphone ears */
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.78;
  bot.add(headPivot);
  add(headPivot, new THREE.SphereGeometry(0.62, 64, 48), ceramic, 0, 0, 0, 1.1, 0.95, 1);
  add(headPivot, new THREE.SphereGeometry(0.628, 64, 40, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.62, 1.2), glass, 0, -0.02, 0, 1.1, 0.95, 1);
  for (const s of [-1, 1]) {
    const cup = add(headPivot, new THREE.CylinderGeometry(0.2, 0.2, 0.12, 48), ceramic, s * 0.66, -0.02, 0);
    cup.rotation.z = Math.PI / 2;
    const ring = add(headPivot, new THREE.TorusGeometry(0.15, 0.022, 12, 48), glowMat, s * 0.73, -0.02, 0);
    ring.rotation.y = Math.PI / 2;
    const core = add(headPivot, new THREE.CylinderGeometry(0.12, 0.12, 0.02, 40), black, s * 0.735, -0.02, 0);
    core.rotation.z = Math.PI / 2;
  }

  /* Neck */
  add(bot, new THREE.CylinderGeometry(0.11, 0.14, 0.14, 24), black, 0, 1.13, 0);

  /* Teardrop body that floats (no legs) */
  const torso = new THREE.Group();
  torso.position.y = 0.72;
  bot.add(torso);
  const prof: THREE_NS.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24; // 0 bottom tip → 1 top
    const r = Math.sin(Math.pow(t, 0.75) * Math.PI * 0.92) * 0.42 * (0.35 + 0.65 * t) + 0.02;
    prof.push(new THREE.Vector2(r, -0.58 + t * 0.95));
  }
  prof.push(new THREE.Vector2(0.001, 0.4));
  add(torso, new THREE.LatheGeometry(prof, 64), ceramic, 0, 0, 0, 1.05, 1, 0.9);
  // Side panels (black) for the industrial look
  for (const s of [-1, 1]) {
    const p = add(torso, new THREE.CapsuleGeometry(0.05, 0.28, 6, 16), black, s * 0.3, 0.02, 0.12);
    p.rotation.z = s * -0.25;
  }
  // Chest logo plate
  const logoMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1, map: await logoTexture(THREE) });
  add(torso, new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32, 1, true, -0.38, 0.76), logoMat, 0, 0.08, 0, 1.0, 1, 0.83);
  // Underside glow
  add(torso, new THREE.SphereGeometry(0.05, 16, 12), glowMat, 0, -0.56, 0);

  /* Arms */
  const mkArm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.44, 1.0, 0);
    bot.add(shoulder);
    add(shoulder, new THREE.SphereGeometry(0.12, 24, 16), black);
    add(shoulder, new THREE.CapsuleGeometry(0.085, 0.2, 8, 20), ceramic, 0, -0.18, 0);
    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    shoulder.add(elbow);
    add(elbow, new THREE.SphereGeometry(0.075, 20, 14), black);
    add(elbow, new THREE.CapsuleGeometry(0.08, 0.18, 8, 20), ceramic, 0, -0.16, 0);
    const hand = new THREE.Group();
    hand.position.y = -0.33;
    elbow.add(hand);
    add(hand, new THREE.SphereGeometry(0.075, 18, 12), ceramic, 0, 0, 0, 1.1, 0.8, 0.7);
    for (let f = -1.5; f <= 1.5; f++) add(hand, new THREE.CapsuleGeometry(0.018, 0.07, 4, 8), ceramic, f * 0.034, -0.09, 0.01);
    add(hand, new THREE.CapsuleGeometry(0.02, 0.05, 4, 8), ceramic, side * 0.08, -0.03, 0.02);
    shoulder.rotation.z = side * 0.12;
    return { shoulder, elbow };
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  /* Hologram base: glowing rings + soft light column */
  const ringMat = (o: number) => new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: o, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const rings: THREE_NS.Mesh[] = [];
  for (const [r, o, w] of [[0.42, 0.9, 0.012], [0.66, 0.6, 0.008], [0.92, 0.35, 0.006]] as const) {
    const m = add(root, new THREE.TorusGeometry(r, w, 8, 96), ringMat(o), 0, -0.05, 0);
    m.rotation.x = Math.PI / 2;
    rings.push(m);
  }
  const disc = document.createElement("canvas"); disc.width = disc.height = 128;
  const dg = disc.getContext("2d")!;
  const rg = dg.createRadialGradient(64, 64, 2, 64, 64, 64);
  rg.addColorStop(0, "rgba(140,240,255,.85)"); rg.addColorStop(0.5, "rgba(120,200,255,.25)"); rg.addColorStop(1, "rgba(120,200,255,0)");
  dg.fillStyle = rg; dg.fillRect(0, 0, 128, 128);
  const pad = add(root, new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(disc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 0, -0.06, 0);
  pad.rotation.x = -Math.PI / 2;
  const col = document.createElement("canvas"); col.width = 4; col.height = 128;
  const cg = col.getContext("2d")!;
  const lg = cg.createLinearGradient(0, 128, 0, 0);
  lg.addColorStop(0, "rgba(140,235,255,.45)"); lg.addColorStop(1, "rgba(140,235,255,0)");
  cg.fillStyle = lg; cg.fillRect(0, 0, 4, 128);
  add(root, new THREE.CylinderGeometry(0.42, 0.5, 0.9, 48, 1, true), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(col), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }), 0, 0.38, 0);

  /* Glass UI tiles orbiting softly around the robot */
  const tiles: { m: THREE_NS.Mesh; base: THREE_NS.Vector3; ph: number }[] = [];
  const tileDefs: [Parameters<typeof tileTexture>[1], number, number, number, number][] = [
    ["bag", -1.25, 1.75, 0.2, 0.42], ["search", -1.45, 1.15, 0.35, 0.34], ["chart", -1.2, 0.72, 0.4, 0.36],
    ["spark", 1.2, 2.15, 0.1, 0.32], ["cart", 1.35, 1.45, 0.3, 0.46],
  ];
  for (const [k, x, y, z, s] of tileDefs) {
    const m = add(scene, new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: tileTexture(THREE, k), transparent: true, depthWrite: false, toneMapped: false }), x, y, z);
    m.rotation.y = x < 0 ? 0.35 : -0.35;
    tiles.push({ m, base: m.position.clone(), ph: Math.random() * 6 });
  }

  // A few particles
  const N = 36;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 0.3 + Math.random() * 0.9, a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 2.4; pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  root.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xbaf8ff, size: 0.025, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })));

  /* Animation */
  let look = { x: 0, y: 0 };
  let waveT = -1;
  let mood: Mood = "happy";
  let talking = false;
  let raf = 0;
  let running = true;
  const clock = new THREE.Clock();

  const frame = () => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();

    bot.position.y = 0.32 + Math.sin(t * 1.3) * 0.07; // floating
    bot.rotation.z = Math.sin(t * 0.9) * 0.025;
    root.rotation.y = -0.32 + Math.sin(t * 0.3) * 0.1;
    headPivot.rotation.y += (look.x * 0.5 - headPivot.rotation.y) * 0.07;
    headPivot.rotation.x += (-look.y * 0.28 - headPivot.rotation.x) * 0.07;
    headPivot.rotation.z = mood === "curious" ? 0.12 : mood === "thinking" ? -0.08 : headPivot.rotation.z * 0.9;

    const bp = t % 4.6;
    const blink = bp < 0.1 ? 0.12 : bp < 0.16 ? 0.5 : 1;
    drawFace(faceCtx, talking ? "speaking" : mood, t, blink, look);
    faceTex.needsUpdate = true;

    // Left arm relaxed; right arm presenting (palm up), waves on demand.
    armL.shoulder.rotation.z = -0.22 - Math.sin(t * 1.3) * 0.04;
    armL.shoulder.rotation.x = 0.15;
    armL.elbow.rotation.x = -0.35;
    let rz = 1.05, ex = -1.1;
    if (waveT >= 0) {
      const w = t - waveT;
      if (w > 2.4) waveT = -1;
      rz = 2.4; ex = -0.2 + Math.sin(w * 10) * 0.3;
    }
    armR.shoulder.rotation.z += (rz - armR.shoulder.rotation.z) * 0.1;
    armR.elbow.rotation.x += (ex - armR.elbow.rotation.x) * 0.12;

    rings.forEach((r, i) => { r.scale.setScalar(1 + 0.04 * Math.sin(t * 2 + i)); r.rotation.z = t * (0.2 + i * 0.1); });
    tiles.forEach(({ m, base, ph }) => { m.position.y = base.y + Math.sin(t * 1.1 + ph) * 0.06; });
    const p = pg.attributes.position as THREE_NS.BufferAttribute;
    for (let i = 0; i < N; i++) { let y = p.getY(i) + 0.004; if (y > 2.4) y = 0; p.setY(i, y); }
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
      camera.position.z = w / h < 0.8 ? 8.2 : 6.4;
      // The glass tiles need room; a small companion shows just the robot.
      tiles.forEach(({ m }) => (m.visible = w > 170));
      if (w <= 170) camera.position.z = 5.2;
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
