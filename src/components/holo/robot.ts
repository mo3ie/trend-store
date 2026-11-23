import type * as THREE_NS from "three";

/**
 * Builds the hologram robot scene. three.js is passed in (dynamically imported
 * by the caller) so it never lands in the main bundle.
 *
 * Look: a translucent cyan/violet projection — fresnel rim glow, moving scan
 * lines and a faint flicker — standing on a glowing emitter ring with a light
 * cone, like a hologram projected from the floor.
 */
export type RobotHandle = {
  setSize: (w: number, h: number) => void;
  lookAt: (nx: number, ny: number) => void; // -1..1 screen coords
  wave: () => void;
  talk: (on: boolean) => void;
  dispose: () => void;
};

const VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vView; varying vec3 vWorld;
  void main(){
    vec4 w = modelMatrix * vec4(position,1.0);
    vWorld = w.xyz;
    vN = normalize(normalMatrix * normal);
    vec4 mv = viewMatrix * w;
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

const FRAG = /* glsl */ `
  uniform float uTime; uniform vec3 uColor; uniform float uAlpha;
  varying vec3 vN; varying vec3 vView; varying vec3 vWorld;
  void main(){
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.2);
    float scan = 0.55 + 0.45 * sin(vWorld.y * 60.0 - uTime * 6.0);
    float band = smoothstep(0.0, 0.02, fract(vWorld.y * 1.4 - uTime * 0.35)) * 0.25 + 0.75;
    float flick = 0.92 + 0.08 * sin(uTime * 37.0) * sin(uTime * 13.0);
    float a = (0.18 + fres * 0.95) * scan * band * flick * uAlpha;
    gl_FragColor = vec4(uColor * (0.6 + fres * 1.4), a);
  }`;

export function buildRobot(THREE: typeof THREE_NS, canvas: HTMLCanvasElement): RobotHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 1.05, 6.2);
  camera.lookAt(0, 0.95, 0);

  const mats: THREE_NS.ShaderMaterial[] = [];
  const holo = (hex: number, alpha = 1) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(hex) }, uAlpha: { value: alpha } },
    });
    mats.push(m);
    return m;
  };
  const CYAN = 0x38e8ff, VIOLET = 0xa78bfa;

  const root = new THREE.Group();
  scene.add(root);
  const bot = new THREE.Group();
  bot.position.y = 0.35;
  root.add(bot);

  // Torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 8, 24), holo(CYAN));
  torso.position.y = 0.75;
  bot.add(torso);
  // Chest core
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 20), new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  core.position.set(0, 0.82, 0.4);
  bot.add(core);

  // Head
  const head = new THREE.Group();
  head.position.y = 1.62;
  bot.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 24), holo(CYAN));
  skull.scale.set(1.12, 0.92, 1);
  head.add(skull);
  const visor = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.42, 6, 16), new THREE.MeshBasicMaterial({ color: 0x04121a, transparent: true, opacity: 0.75 }));
  visor.rotation.z = Math.PI / 2;
  visor.position.set(0, 0.02, 0.36);
  visor.scale.set(1, 1, 0.5);
  head.add(visor);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9ffcff, transparent: true, blending: THREE.AdditiveBlending });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), eyeMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.15, 0.03, 0.45);
  eyeR.position.set(0.15, 0.03, 0.45);
  head.add(eyeL, eyeR);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.02), eyeMat);
  mouth.position.set(0, -0.12, 0.44);
  head.add(mouth);
  // Antenna
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 8), holo(VIOLET));
  stalk.position.y = 0.52;
  head.add(stalk);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, blending: THREE.AdditiveBlending }));
  tip.position.y = 0.68;
  head.add(tip);
  // Ears
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 20), holo(VIOLET));
    ear.rotation.z = Math.PI / 2;
    ear.position.set(s * 0.52, 0, 0);
    head.add(ear);
  }

  // Arms (pivot at shoulder)
  const mkArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.55, 1.12, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 6, 12), holo(CYAN));
    arm.position.y = -0.33;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), holo(VIOLET));
    hand.position.y = -0.7;
    pivot.add(hand);
    pivot.rotation.z = side * 0.18;
    bot.add(pivot);
    return pivot;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // Floor emitter + light cone
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.035, 12, 64), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  ring.rotation.x = Math.PI / 2;
  root.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.015, 8, 48), new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
  ring2.rotation.x = Math.PI / 2;
  root.add(ring2);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.72, 2.6, 40, 1, true), holo(CYAN, 0.35));
  cone.position.y = 1.3;
  root.add(cone);

  // Floating particles
  const N = 70;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = Math.random() * 0.8, a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 2.6; pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dots = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9ffcff, size: 0.035, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  root.add(dots);

  let look = { x: 0, y: 0 };
  let waveT = -1;
  let talking = false;
  let raf = 0;
  let running = true;
  const clock = new THREE.Clock();

  const frame = () => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    mats.forEach((m) => (m.uniforms.uTime.value = t));

    bot.position.y = 0.35 + Math.sin(t * 1.6) * 0.06;
    root.rotation.y = Math.sin(t * 0.4) * 0.25;
    head.rotation.y += (look.x * 0.6 - head.rotation.y) * 0.08;
    head.rotation.x += (-look.y * 0.35 - head.rotation.x) * 0.08;
    tip.scale.setScalar(0.8 + 0.4 * (0.5 + 0.5 * Math.sin(t * 5)));
    core.scale.setScalar(0.85 + 0.25 * Math.sin(t * 3));
    ring.scale.setScalar(1 + 0.05 * Math.sin(t * 2.4));
    ring2.rotation.z = t * 0.8;

    // Blink every ~4s
    const bl = (t % 4.2) < 0.12 ? 0.15 : 1;
    eyeL.scale.y = eyeR.scale.y = bl;

    // Talk: mouth opens and closes
    mouth.scale.y = talking ? 1 + Math.abs(Math.sin(t * 14)) * 5 : 1;

    // Idle arm sway + wave
    armL.rotation.z = -0.18 - Math.sin(t * 1.6) * 0.06;
    if (waveT >= 0) {
      const w = t - waveT;
      if (w > 2.2) waveT = -1;
      armR.rotation.z = 2.4 + Math.sin(w * 9) * 0.35;
    } else {
      armR.rotation.z += (0.18 + Math.sin(t * 1.6) * 0.06 - armR.rotation.z) * 0.12;
    }

    const p = pg.attributes.position as THREE_NS.BufferAttribute;
    for (let i = 0; i < N; i++) {
      let y = p.getY(i) + 0.006;
      if (y > 2.6) y = 0;
      p.setY(i, y);
    }
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
      camera.updateProjectionMatrix();
    },
    lookAt(nx, ny) { look = { x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) }; },
    wave() { waveT = clock.getElapsedTime(); },
    talk(on) { talking = on; },
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
      renderer.dispose();
    },
  };
}
