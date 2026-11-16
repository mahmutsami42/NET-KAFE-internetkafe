import * as THREE from 'three';
import { clamp, damp, rnd, pick, smooth } from './data';

const V = THREE.Vector3, Q = THREE.Quaternion;
const DOWN = new V(0, -1, 0);
export const L1 = 0.29, L2 = 0.27, THIGH = 0.45, SHIN = 0.44, HIPS_H = 0.95;

export interface Look { skin: number; hair: number; style: number; shirt: number; pants: number; shoes: number; scale: number; female: boolean; uniform: boolean; iris: number; cap?: number; coat?: boolean; }
const SKINS = [0xf2c9a5, 0xe0a97c, 0xc68a5e, 0x9c6a45, 0x70472d, 0xf6d6bd];
const HAIRS = [0x15110f, 0x2b1d14, 0x4a2f1b, 0x7a5230, 0xb8873c, 0x7b2d2d, 0x2a2f5a, 0x1f6a6a];
const SHIRTS = [0xd94f6a, 0x4f7bd9, 0x4fd9a2, 0xd9c34f, 0x8a5fd9, 0xeeeeee, 0x2e2e3a, 0xe8803a, 0x3aa6e8, 0x7bd94f, 0xc24fd9];
const PANTS = [0x2b3350, 0x1d1d26, 0x4a5a78, 0x5a4636, 0x3a3a3a, 0x24424a];
export function randomLook(kind: 'customer' | 'emp' | 'ped' = 'customer'): Look {
  const female = Math.random() < 0.42;
  const l: Look = {
    skin: pick(SKINS), hair: pick(HAIRS), style: female ? pick([1, 1, 2, 0, 5]) : pick([0, 0, 0, 3, 4, 5]), shirt: pick(SHIRTS), pants: pick(PANTS), shoes: pick([0x111111, 0xeeeeee, 0x8a2a2a, 0x2a4a8a]),
    scale: rnd(0.93, 1.05), female, uniform: kind === 'emp', iris: pick([0x4a2f1b, 0x3a6a9a, 0x3a7a4a, 0x2a1a10]),
  };
  if (kind === 'emp') { l.shirt = 0x14a89a; l.pants = 0x1d1d26; l.shoes = 0x111111; l.style = female ? 2 : 0; l.cap = 0x14a89a; }
  else if (Math.random() < 0.15 && !female) l.cap = pick([0xd94f6a, 0x2e2e3a, 0x4f7bd9]);
  return l;
}

const geoCache: Record<string, THREE.BufferGeometry> = {};
const G = (key: string, mk: () => THREE.BufferGeometry) => geoCache[key] || (geoCache[key] = mk());
const matCache: Record<string, THREE.Material> = {};
export const M = (color: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}, key = '') => {
  const k = color + key; return (matCache[k] as THREE.MeshLambertMaterial) || (matCache[k] = new THREE.MeshLambertMaterial({ color, ...extra }));
};
const eyeTex: Record<number, THREE.CanvasTexture> = {};
function eyeTexture(iris: number) {
  if (eyeTex[iris]) return eyeTex[iris];
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d')!;
  x.fillStyle = '#f4f4f4'; x.fillRect(0, 0, 128, 64);
  x.fillStyle = '#' + iris.toString(16).padStart(6, '0'); x.beginPath(); x.arc(32, 32, 12, 0, 7); x.fill();
  x.fillStyle = '#050505'; x.beginPath(); x.arc(32, 32, 6, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.beginPath(); x.arc(28, 27, 2.4, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (eyeTex[iris] = t);
}

/** capsule hanging down from pivot (top at y=0) */
const hang = (r: number, len: number) => G(`hang${r}_${len}`, () => { const g = new THREE.CapsuleGeometry(r, len - r * 2, 4, 10); g.translate(0, -len / 2, 0); return g; });

const IDX = { hipsY: 0, hipsZ: 1, hipsRY: 2, spX: 3, spY: 4, spZ: 5, hdX: 6, hdY: 7, hdZ: 8, aLx: 9, aLz: 10, eL: 11, aRx: 12, aRz: 13, eR: 14, tLx: 15, tLz: 16, kL: 17, tRx: 18, tRz: 19, kR: 20, brow: 21, mouth: 22, mopen: 23, browY: 24 };
const N = 25;

const _a = new V(), _b = new V(), _c = new V(), _d = new V(), _e = new V(), _p = new V();
/** two bone IK: shoulder->target. writes elbow & hand (clamped) */
export function ik2(sh: THREE.Vector3, tg: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3, elbow: THREE.Vector3, hand: THREE.Vector3) {
  _a.subVectors(tg, sh); let d = _a.length(); const dir = _b.copy(_a).normalize();
  d = clamp(d, Math.abs(l1 - l2) + 0.03, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d); const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _p.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  elbow.copy(sh).addScaledVector(dir, a).addScaledVector(_p, h);
  hand.copy(sh).addScaledVector(dir, d);
}

export class Rig {
  root = new THREE.Group();
  hips = new THREE.Group(); spine = new THREE.Group(); neck = new THREE.Group(); head = new THREE.Group();
  sh: THREE.Group[] = []; fore: THREE.Group[] = []; hand: THREE.Group[] = [];
  thigh: THREE.Group[] = []; shin: THREE.Group[] = []; foot: THREE.Group[] = [];
  eyes: THREE.Mesh[] = []; brows: THREE.Mesh[] = []; mouth!: THREE.Mesh; mopen!: THREE.Mesh; chest!: THREE.Mesh;
  tray = new THREE.Group(); blob!: THREE.Mesh; held = new THREE.Group();
  // inputs
  speed = 0; turn = 0; sitK = 0; sitStyle = 0; act = 'none'; emo = 'neutral'; carry = false; look: THREE.Vector3 | null = null; glance = 0; talk = 0;
  // state
  t = rnd(0, 100); phase = rnd(0, 6); blinkT = rnd(1, 4); blinking = 0; steer = 0; stepped = false; private lastHalf = 0;
  pose = new Float32Array(N); tgt = new Float32Array(N);
  wL = 0; wR = 0; hL = new V(); hR = new V(); private tL = new V(); private tR = new V();
  private gazeYaw = 0; private gazePitch = 0; private seed = rnd(0, 10); private eyeT = 0; private eyeYaw = 0; private eyePitch = 0; private idleLook = rnd(0, 5); private idleYaw = 0;
  private qa = new Q(); private qb = new Q(); private eu = new THREE.Euler(0, 0, 0, 'ZXY');
  private shPos = [new V(0.2, 0.47, 0), new V(-0.2, 0.47, 0)];

  constructor(public look0: Look) {
    const l = look0; const skin = M(l.skin), shirt = M(l.shirt), pants = M(l.pants), shoe = M(l.shoes);
    const r = this.root; r.scale.setScalar(l.scale);
    const blobG = G('blob', () => new THREE.CircleGeometry(0.38, 16).rotateX(-Math.PI / 2));
    this.blob = new THREE.Mesh(blobG, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    this.blob.position.y = 0.03; this.blob.renderOrder = 1; r.add(this.blob);
    r.add(this.hips); this.hips.position.y = HIPS_H;
    const pelvis = new THREE.Mesh(G('pelvis', () => new THREE.CapsuleGeometry(0.12, 0.1, 4, 10).rotateZ(Math.PI / 2)), pants); pelvis.scale.set(1.05, 1, 0.95); this.hips.add(pelvis);
    this.hips.add(this.spine); this.spine.position.y = 0.06;
    this.chest = new THREE.Mesh(G('chest', () => new THREE.CapsuleGeometry(0.15, 0.24, 4, 12)), shirt); this.chest.position.y = 0.25; this.chest.scale.set(l.female ? 1.15 : 1.32, 1, 0.82); this.spine.add(this.chest);
    if (l.uniform) {
      const apron = new THREE.Mesh(G('apron', () => new THREE.BoxGeometry(0.28, 0.34, 0.02)), M(0x1d1d26)); apron.position.set(0, 0.2, 0.13); this.spine.add(apron);
      const tag = new THREE.Mesh(G('tag', () => new THREE.BoxGeometry(0.07, 0.035, 0.01)), M(0xffffff)); tag.position.set(0.1, 0.38, 0.13); this.spine.add(tag);
      const logo = new THREE.Mesh(G('logo', () => new THREE.CircleGeometry(0.035, 10)), new THREE.MeshBasicMaterial({ color: 0xff3fa4 })); logo.position.set(-0.1, 0.38, 0.135); this.spine.add(logo);
    }
    this.spine.add(this.neck); this.neck.position.y = 0.5;
    const neckM = new THREE.Mesh(G('neck', () => new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8)), skin); neckM.position.y = 0.0; this.neck.add(neckM);
    this.neck.add(this.head); this.head.position.y = 0.14;
    const hm = new THREE.Mesh(G('head', () => new THREE.SphereGeometry(0.125, 20, 16)), skin); hm.scale.set(0.92, 1.08, 0.98); this.head.add(hm);
    const surf = (x: number, y: number) => 0.125 * 0.98 * Math.sqrt(Math.max(0.01, 1 - (x / (0.125 * 0.92)) ** 2 - (y / (0.125 * 1.08)) ** 2));
    const eg = G('eye', () => new THREE.SphereGeometry(0.026, 14, 10)); const et = eyeTexture(l.iris);
    const em = new THREE.MeshLambertMaterial({ map: et });
    for (const s of [1, -1]) {
      const e = new THREE.Mesh(eg, em); e.position.set(s * 0.045, 0.018, surf(s * 0.045, 0.018) - 0.006); this.head.add(e); this.eyes.push(e);
      const b = new THREE.Mesh(G('brow', () => new THREE.BoxGeometry(0.052, 0.01, 0.01)), M(l.hair)); b.position.set(s * 0.047, 0.066, surf(s * 0.047, 0.066) + 0.001); this.head.add(b); this.brows.push(b);
    }
    const nose = new THREE.Mesh(G('nose', () => new THREE.SphereGeometry(0.017, 8, 6)), skin); nose.position.set(0, -0.012, surf(0, -0.012) + 0.004); this.head.add(nose);
    this.mouth = new THREE.Mesh(G('mouth', () => new THREE.TorusGeometry(0.02, 0.0045, 6, 12, Math.PI)), M(0x7a2a2a)); this.mouth.position.set(0, -0.046, surf(0, -0.046) + 0.002); this.head.add(this.mouth);
    this.mopen = new THREE.Mesh(G('mopen', () => new THREE.SphereGeometry(0.016, 8, 6)), M(0x3a0f12)); this.mopen.position.set(0, -0.055, surf(0, -0.055) + 0.001); this.mopen.scale.set(1, 0.01, 0.4); this.head.add(this.mopen);
    for (const s of [1, -1]) { const ear = new THREE.Mesh(G('ear', () => new THREE.SphereGeometry(0.02, 6, 6)), skin); ear.position.set(s * 0.113, 0, 0); ear.scale.set(0.5, 1, 0.8); this.head.add(ear); }
    // hair
    const hairM = M(l.hair);
    const cap = (m: THREE.Material, rr = 0.133) => { const c = new THREE.Mesh(G('cap' + rr, () => new THREE.SphereGeometry(rr, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.53)), m); c.scale.set(0.93, 1.08, 1); c.rotation.x = -0.28; c.position.set(0, 0.012, -0.008); return c; };
    if (l.cap !== undefined) {
      const capM = M(l.cap); this.head.add(cap(capM, 0.137));
      const visor = new THREE.Mesh(G('visor', () => new THREE.BoxGeometry(0.15, 0.01, 0.09)), capM); visor.position.set(0, 0.055, 0.13); visor.rotation.x = 0.12; this.head.add(visor);
      if (l.style === 1 || l.style === 2) { const pt = new THREE.Mesh(G('ptail', () => new THREE.CapsuleGeometry(0.03, 0.14, 4, 8)), hairM); pt.position.set(0, -0.03, -0.14); pt.rotation.x = 0.25; this.head.add(pt); }
    } else if (l.style !== 3) {
      this.head.add(cap(hairM));
      if (l.style === 1) { const back = new THREE.Mesh(G('hback', () => new THREE.BoxGeometry(0.25, 0.3, 0.08)), hairM); back.position.set(0, -0.09, -0.085); this.head.add(back); }
      if (l.style === 2) { const pt = new THREE.Mesh(G('ptail', () => new THREE.CapsuleGeometry(0.03, 0.14, 4, 8)), hairM); pt.position.set(0, -0.03, -0.14); pt.rotation.x = 0.25; this.head.add(pt); }
      if (l.style === 5) { const af = new THREE.Mesh(G('afro', () => new THREE.SphereGeometry(0.15, 12, 10)), hairM); af.position.set(0, 0.03, -0.02); af.scale.set(1, 0.85, 1); this.head.add(af); }
    }
    // arms
    for (const s of [1, -1]) {
      const sh = new THREE.Group(); sh.position.copy(this.shPos[s === 1 ? 0 : 1]); if (l.female) sh.position.x *= 0.88; this.spine.add(sh); this.sh.push(sh);
      const up = new THREE.Mesh(hang(0.047, L1), shirt); sh.add(up);
      const sj = new THREE.Mesh(G('sj', () => new THREE.SphereGeometry(0.058, 10, 8)), shirt); sh.add(sj);
      const fo = new THREE.Group(); fo.position.y = -L1; sh.add(fo); this.fore.push(fo);
      const fm = new THREE.Mesh(hang(0.04, L2), l.uniform ? skin : skin); fo.add(fm);
      const hd = new THREE.Group(); hd.position.y = -L2; fo.add(hd); this.hand.push(hd);
      const palm = new THREE.Mesh(G('palm', () => new THREE.SphereGeometry(0.045, 10, 8)), skin); palm.scale.set(0.9, 1.25, 0.55); palm.position.y = -0.05; hd.add(palm);
      const th = new THREE.Mesh(G('thumb', () => new THREE.CapsuleGeometry(0.014, 0.04, 3, 6)), skin); th.position.set(-s * 0.04, -0.035, 0.015); th.rotation.z = s * 0.5; hd.add(th);
    }
    // legs
    for (const s of [1, -1]) {
      const th = new THREE.Group(); th.position.set(s * 0.09, -0.02, 0); this.hips.add(th); this.thigh.push(th);
      th.add(new THREE.Mesh(hang(0.075, THIGH), pants));
      const sn = new THREE.Group(); sn.position.y = -THIGH; th.add(sn); this.shin.push(sn);
      sn.add(new THREE.Mesh(hang(0.058, SHIN), pants));
      const ft = new THREE.Group(); ft.position.y = -SHIN; sn.add(ft); this.foot.push(ft);
      const fm = new THREE.Mesh(G('foot', () => new THREE.BoxGeometry(0.1, 0.07, 0.26)), shoe); fm.position.set(0, -0.025, 0.06); ft.add(fm);
    }
    // tray
    const tray = this.tray; tray.visible = false; tray.position.set(0, 1.0, 0.4); r.add(tray);
    tray.add(new THREE.Mesh(G('tray', () => new THREE.CylinderGeometry(0.25, 0.25, 0.025, 20)), M(0xb9c0cc)));
    const cup = new THREE.Mesh(G('cup', () => new THREE.CylinderGeometry(0.035, 0.028, 0.09, 10)), M(0xf2f2f2)); cup.position.set(-0.08, 0.06, 0.02); tray.add(cup);
    const plate = new THREE.Mesh(G('plate', () => new THREE.CylinderGeometry(0.07, 0.07, 0.015, 12)), M(0xe8d9a0)); plate.position.set(0.08, 0.025, -0.02); tray.add(plate);
    const food = new THREE.Mesh(G('food', () => new THREE.BoxGeometry(0.09, 0.04, 0.07)), M(0xc9843a)); food.position.set(0.08, 0.055, -0.02); tray.add(food);
    this.held.visible = false; this.held.position.set(0, 0, 0); r.add(this.held);
    const hc = new THREE.Mesh(G('hcup', () => new THREE.CylinderGeometry(0.035, 0.028, 0.1, 10)), M(0xf2f2f2)); this.held.add(hc);
  }

  /** returns head world position */
  headWorld(out: THREE.Vector3) { return this.head.getWorldPosition(out); }

  update(dt: number) {
    this.t += dt; const t = this.t, p = this.pose, g = this.tgt, I = IDX; g.fill(0);
    const sp = this.speed, walkAmt = clamp(sp / 1.1, 0, 1), runK = clamp((sp - 2.3) / 2.2, 0, 1);
    this.phase += dt * sp * (3.6 - 1.9 * runK) * (sp > 0.05 ? 1 : 0);
    const ph = this.phase, A = (0.4 + 0.45 * runK) * clamp(sp / 1.5, 0.3, 1) * (walkAmt > 0.05 ? 1 : 0);
    const half = Math.floor(ph / Math.PI); this.stepped = half !== this.lastHalf && sp > 0.4; this.lastHalf = half;
    const sin = Math.sin(ph), cos = Math.cos(ph);
    const sk = smooth(this.sitK), st = this.sitStyle;
    // standing pose
    const breath = Math.sin(t * 1.7 + this.seed) * 0.012;
    const stand = new Float32Array(N), seat = new Float32Array(N);
    stand[I.hipsY] = (-0.02 - 0.05 * runK + 0.022 * Math.cos(2 * ph) * walkAmt) * 1;
    stand[I.hipsRY] = -0.12 * sin * walkAmt + Math.sin(t * 0.45 + this.seed) * 0.03 * (1 - walkAmt);
    stand[I.spX] = 0.03 + 0.22 * runK + breath; stand[I.spY] = 0.2 * sin * walkAmt; stand[I.spZ] = 0.03 * cos * walkAmt + Math.sin(t * 0.45 + this.seed) * 0.025 * (1 - walkAmt) - clamp(this.turn, -3, 3) * 0.035;
    stand[I.tLx] = A * sin + Math.sin(t * 0.45 + this.seed) * 0.03 * (1 - walkAmt); stand[I.tRx] = -A * sin;
    stand[I.tLz] = 0.035; stand[I.tRz] = 0.035;
    stand[I.kL] = 0.05 + (0.5 + 0.9 * runK) * Math.max(0, cos) * (walkAmt > 0.05 ? 1 : 0); stand[I.kR] = 0.05 + (0.5 + 0.9 * runK) * Math.max(0, -cos) * (walkAmt > 0.05 ? 1 : 0);
    stand[I.aLx] = -A * 0.95 * sin; stand[I.aRx] = A * 0.95 * sin; stand[I.aLz] = 0.1 + 0.05 * runK; stand[I.aRz] = 0.1 + 0.05 * runK;
    stand[I.eL] = 0.12 + 0.9 * runK + 0.28 * Math.max(0, -sin) * walkAmt; stand[I.eR] = 0.12 + 0.9 * runK + 0.28 * Math.max(0, sin) * walkAmt;
    // seated pose
    if (st === 1) { seat[I.hipsY] = -0.5; seat[I.hipsZ] = -0.12; seat[I.tLx] = 1.15; seat[I.tRx] = 1.1; seat[I.kL] = 0.85; seat[I.kR] = 0.7; seat[I.spX] = -0.14; }
    else if (st === 2) { seat[I.hipsY] = -0.5; seat[I.hipsZ] = -0.14; seat[I.tLx] = 1.35; seat[I.tRx] = 1.3; seat[I.kL] = 1.1; seat[I.kR] = 1.2; seat[I.spX] = -0.2; seat[I.hdX] = -0.05; }
    else { seat[I.hipsY] = -0.41; seat[I.hipsZ] = -0.05; seat[I.tLx] = 1.5; seat[I.tRx] = 1.5; seat[I.kL] = 1.5; seat[I.kR] = 1.5; seat[I.spX] = 0.1 + breath; }
    seat[I.tLz] = 0.08; seat[I.tRz] = 0.08; seat[I.aLz] = 0.1; seat[I.aRz] = 0.1; seat[I.aLx] = 0.35; seat[I.aRx] = 0.35; seat[I.eL] = 0.9; seat[I.eR] = 0.9;
    seat[I.spZ] = Math.sin(t * 0.4 + this.seed) * 0.02;
    for (let i = 0; i < N; i++) g[i] = stand[i] + (seat[i] - stand[i]) * sk;

    // IK targets / acts
    let hl: THREE.Vector3 | null = null, hr: THREE.Vector3 | null = null; let mOpen = 0, headDown = 0, wiggle = 0;
    const act = this.act; const lt = this.tL, rt = this.tR; let lookTgt: THREE.Vector3 | null = this.look; const tmpLook = _c;
    const T = t + this.seed;
    switch (act) {
      case 'type': {
        const tap = (k: number) => 0.012 * Math.max(0, Math.sin(T * 16 + k)) * (Math.sin(T * 0.7 + k) > -0.3 ? 1 : 0);
        lt.set(0.11 + Math.sin(T * 3.1) * 0.04, 0.8 + tap(0), 0.55 + Math.sin(T * 2.3) * 0.02); hl = lt;
        rt.set(-0.33 + Math.sin(T * 1.1) * 0.05, 0.795 + tap(2) * 0.4, 0.58 + Math.cos(T * 0.9) * 0.05); hr = rt;
        headDown = 0.08; lookTgt = tmpLook.set(0, 1.2 - 0.38 * (1 - sk) * 0 + 0.05, 1.2).applyMatrix4(this.root.matrixWorld); g[I.mouth] = 0.1; break;
      }
      case 'wheel': {
        const steer = Math.sin(T * 1.3) * 0.45 + Math.sin(T * 3.1) * 0.15; this.steer = steer; const R = 0.15, cy = 0.9, cz = 0.56;
        lt.set(Math.cos(steer) * R, cy + Math.sin(steer) * R, cz); hl = lt;
        rt.set(-Math.cos(steer) * R, cy - Math.sin(steer) * R, cz); hr = rt; headDown = -0.02; g[I.spX] += 0.05;
        lookTgt = tmpLook.set(0, 1.0, 3).applyMatrix4(this.root.matrixWorld); g[I.mouth] = -0.3; break;
      }
      case 'eat': case 'drink': {
        const c = (Math.sin(T * 2.2) + 1) / 2, w = smooth((c - 0.25) * 2.2);
        rt.set(lerpN(-0.2, -0.04, w), lerpN(1.0, 1.42, w), lerpN(0.35, 0.17, w)); hr = rt; lt.set(0.12, 0.95, 0.3); hl = lt; this.held.visible = true;
        mOpen = w > 0.7 ? 0.5 + Math.sin(T * 14) * 0.2 : 0; headDown = 0.04; break;
      }
      case 'phone': { rt.set(-0.11, 1.33 - 0.38 * sk, 0.3); hr = rt; lt.set(0.18, 0.62, 0.25); hl = sk > 0.5 ? lt : null; headDown = 0.3; lookTgt = null; break; }
      case 'cheer': { const w = Math.sin(T * 9) * 0.06; lt.set(0.3 + w, 1.95 - 0.4 * sk, 0.05); rt.set(-0.3 - w, 1.95 - 0.4 * sk, 0.05); hl = lt; hr = rt; g[I.mouth] = -1; mOpen = 0.6; g[I.spX] -= 0.1; wiggle = 1; break; }
      case 'wave': { lt.set(0.18, 1.0, 0.25); rt.set(-0.28 - Math.sin(T * 8) * 0.07, 1.85, 0.1); hr = rt; hl = null; g[I.mouth] = -0.8; break; }
      case 'clap': { const w = (Math.sin(T * 11) + 1) / 2; lt.set(0.02 + w * 0.12, 1.28, 0.3); rt.set(-0.02 - w * 0.12, 1.28, 0.3); hl = lt; hr = rt; g[I.mouth] = -0.7; break; }
      case 'stretch': { const w = smooth((Math.sin(T * 1.2) + 1) / 2); lt.set(0.16, 1.55 + w * 0.5 - 0.4 * sk, 0.0); rt.set(-0.16, 1.55 + w * 0.5 - 0.4 * sk, 0.0); hl = lt; hr = rt; g[I.spX] -= 0.15 * w; mOpen = 0.8 * w; break; }
      case 'impatient': {
        const c = Math.sin(T * 0.6) > 0.3; if (c) { rt.set(-0.1, 1.28, 0.3); hr = rt; lt.set(0.16, 0.95, 0.3); hl = lt; headDown = 0.35; lookTgt = null; }
        g[I.tLx] += Math.max(0, Math.sin(T * 7)) * 0.2 * (1 - sk); g[I.kL] += Math.max(0, Math.sin(T * 7)) * 0.08; g[I.brow] = 0.5; g[I.mouth] = 0.3; g[I.spZ] += Math.sin(T * 1.5) * 0.04; break;
      }
      case 'angry': { const sh = Math.sin(T * 14) * 0.015; lt.set(0.2 + sh, 1.1, 0.32); rt.set(-0.2 - sh, 1.1, 0.32); hl = lt; hr = rt; g[I.brow] = 1; g[I.mouth] = 1; g[I.spX] += 0.1; mOpen = 0.3 + Math.sin(T * 9) * 0.15; g[I.tLx] += Math.max(0, Math.sin(T * 6)) * 0.2 * (1 - sk); wiggle = 1; break; }
      case 'happy': { const b = Math.abs(Math.sin(T * 5)); lt.set(0.3, 1.45 + b * 0.1, 0.18); rt.set(-0.3, 1.45 + b * 0.1, 0.18); hl = lt; hr = rt; g[I.mouth] = -1; g[I.hipsY] += b * 0.03 * (1 - sk); g[I.brow] = -0.2; mOpen = 0.3; break; }
      case 'carry': { lt.set(0.2, 1.0, 0.38); rt.set(-0.2, 1.0, 0.38); hl = lt; hr = rt; g[I.spX] -= 0.03; break; }
      case 'work': { const w = Math.sin(T * 10) * 0.03; rt.set(-0.08 + w, 0.95 + Math.abs(w), 0.48); hr = rt; lt.set(0.15, 0.95, 0.42); hl = lt; g[I.spX] += 0.25; headDown = 0.25; lookTgt = null; break; }
      case 'sweep': { const w = Math.sin(T * 5) * 0.28; lt.set(0.1 + w, 0.9, 0.5); rt.set(-0.1 + w, 0.78, 0.55); hl = lt; hr = rt; g[I.spX] += 0.3; g[I.hdX] += 0.2; break; }
      case 'pay': { const tp = Math.max(0, Math.sin(T * 12)) * 0.015; lt.set(0.12, 0.98 + tp, 0.45); rt.set(-0.12, 0.98 + Math.max(0, Math.sin(T * 12 + 2)) * 0.015, 0.45); hl = lt; hr = rt; g[I.spX] += 0.08; headDown = 0.12; break; }
      case 'talk': { const w = Math.sin(T * 3.3) * 0.5 + Math.sin(T * 5.1) * 0.5; rt.set(-0.25 + w * 0.05, 1.18 + w * 0.06, 0.35); hr = rt; lt.set(0.18, 0.98, 0.3); hl = this.talk > 0.5 ? lt : null; mOpen = 0.35 + Math.max(0, Math.sin(T * 11)) * 0.4; break; }
      case 'wash': { const w = Math.sin(T * 8) * 0.03; lt.set(0.07 + w, 0.98, 0.34); rt.set(-0.07 - w, 0.98, 0.34); hl = lt; hr = rt; g[I.spX] += 0.2; headDown = 0.2; break; }
      case 'handsup': { lt.set(0.26, 1.95, 0.08); rt.set(-0.26, 1.95, 0.08); hl = lt; hr = rt; g[I.brow] = -0.6; g[I.mouth] = 0.7; mOpen = 0.5; wiggle = 1; break; }
      case 'press': { const w = smooth((Math.sin(T * 3) + 1) / 2); rt.set(-0.12, 1.15 + w * 0.05, 0.3 + w * 0.35); hr = rt; break; }
      case 'run': break;
      default: break;
    }
    // rest hands on lap when seated and nothing else
    if (!hl && sk > 0.5) { lt.set(0.2, 0.66, 0.3); hl = lt; }
    if (!hr && sk > 0.5) { rt.set(-0.2, 0.66, 0.3); hr = rt; }

    // emotion
    let brow = g[I.brow], mouth = g[I.mouth];
    switch (this.emo) {
      case 'angry': brow = Math.max(brow, 0.9); mouth = 0.9; break;
      case 'happy': mouth = Math.min(mouth, -0.9); brow = Math.min(brow, -0.15); g[I.browY] = 0.4; break;
      case 'sad': brow = -0.7; mouth = 0.7; break;
      case 'bored': mouth = 0.1; g[I.browY] = -0.4; break;
      case 'surprised': g[I.browY] = 1; mouth = 0.0; mOpen = Math.max(mOpen, 0.7); break;
      case 'worried': brow = -0.5; mouth = 0.4; break;
      default: break;
    }
    g[I.brow] = brow; g[I.mouth] = mouth; g[I.mopen] = mOpen;

    // gaze
    let yaw = 0, pitch = 0;
    if (lookTgt) {
      const lp = _d.copy(lookTgt); this.root.worldToLocal(lp);
      yaw = Math.atan2(lp.x, lp.z); const hb = 1.62 * 1 - 0.41 * sk; pitch = Math.atan2(-(lp.y - hb), Math.hypot(lp.x, lp.z));
      if (Math.abs(yaw) > 2.4) yaw = 0;
    } else {
      this.idleLook -= dt; if (this.idleLook <= 0) { this.idleLook = rnd(1.5, 5); this.idleYaw = rnd(-0.7, 0.7); }
      yaw = this.idleYaw * (1 - walkAmt * 0.8); pitch = Math.sin(T * 0.3) * 0.05;
    }
    this.gazeYaw = damp(this.gazeYaw, clamp(yaw, -1.2, 1.2), 6, dt); this.gazePitch = damp(this.gazePitch, clamp(pitch, -0.5, 0.6), 6, dt);
    g[I.hdY] += this.gazeYaw * 0.8 + this.glance * 1.5; g[I.spY] += this.gazeYaw * 0.2 + this.glance * 0.7; g[I.hdX] += this.gazePitch + headDown; g[I.spX] += headDown * 0.3;
    g[I.hdZ] += Math.sin(T * 0.6) * 0.02 - this.gazeYaw * 0.05;
    // jitter for anger
    if (wiggle) { g[I.spZ] += Math.sin(T * 17) * 0.02; }

    // smoothing
    const kfast = 9;
    for (let i = 0; i < N; i++) { const k = i >= I.brow ? 10 : (i >= I.aLx && i <= I.eR) ? 12 : (i <= I.spZ ? 8 : kfast); p[i] = damp(p[i], g[i], k, dt); }
    // blink
    this.blinkT -= dt; if (this.blinkT <= 0) { this.blinking = 0.15; this.blinkT = rnd(2, 5.5); }
    let bl = 1; if (this.blinking > 0) { this.blinking -= dt; bl = 0.1 + 0.9 * Math.abs(this.blinking / 0.15 - 0.5) * 2; }
    this.eyeT -= dt; if (this.eyeT <= 0) { this.eyeT = rnd(0.4, 2); this.eyeYaw = rnd(-0.25, 0.25); this.eyePitch = rnd(-0.15, 0.15); }

    // apply
    this.hips.position.set(0, HIPS_H + p[I.hipsY], p[I.hipsZ]); this.hips.rotation.set(0, p[I.hipsRY], 0);
    this.spine.rotation.set(p[I.spX], p[I.spY], p[I.spZ]);
    this.neck.rotation.set(p[I.hdX] * 0.35, p[I.hdY] * 0.35, p[I.hdZ] * 0.35); this.head.rotation.set(p[I.hdX] * 0.65, p[I.hdY] * 0.65, p[I.hdZ] * 0.65);
    const breathS = 1 + Math.sin(t * 1.7 + this.seed) * 0.012; this.chest.scale.y = breathS;
    const legs = [[I.tLx, I.tLz, I.kL, 1], [I.tRx, I.tRz, I.kR, -1]];
    for (let i = 0; i < 2; i++) {
      const [tx, tz, kk, s] = legs[i]; this.thigh[i].rotation.set(-p[tx], 0, s * p[tz]); this.shin[i].rotation.set(p[kk], 0, 0);
      this.foot[i].rotation.set(p[tx] - p[kk] + (sk > 0.5 ? 0.0 : 0), 0, 0);
    }
    for (let i = 0; i < 2; i++) {
      const e = this.eyes[i]; e.scale.set(1, bl, 1); e.rotation.set(this.eyePitch + (this.gazePitch - 0) * 0.2, this.eyeYaw * 0.6 + (this.gazeYaw - this.gazeYaw * 0.8) * 0.2, 0);
      const s = i === 0 ? 1 : -1; this.brows[i].rotation.z = s * p[I.brow] * 0.45; this.brows[i].position.y = 0.066 + p[I.browY] * 0.012 - Math.abs(p[I.brow]) * 0.004;
    }
    this.mouth.scale.set(1, p[I.mouth], 1); this.mouth.position.y = -0.046 + (p[I.mouth] < 0 ? 0.012 * -p[I.mouth] : 0);
    const mo = clamp(p[I.mopen], 0, 1); this.mopen.scale.set(1 + mo * 0.3, Math.max(0.01, mo * 1.1), 0.4); this.mopen.visible = mo > 0.04;
    // arms
    this.root.updateMatrixWorld(true);
    const wTL = hl ? 1 : 0, wTR = hr ? 1 : 0;
    this.wL = damp(this.wL, wTL, 9, dt); this.wR = damp(this.wR, wTR, 9, dt);
    if (hl) { if (this.wL < 0.05) this.hL.copy(hl); else this.hL.lerp(hl, 1 - Math.exp(-14 * dt)); }
    if (hr) { if (this.wR < 0.05) this.hR.copy(hr); else this.hR.lerp(hr, 1 - Math.exp(-14 * dt)); }
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1; const px = i === 0 ? I.aLx : I.aRx, pz = i === 0 ? I.aLz : I.aRz, pe = i === 0 ? I.eL : I.eR;
      this.eu.set(-p[px], 0, s * p[pz], 'ZXY'); const qs = this.qa.setFromEuler(this.eu);
      const qe = this.qb.setFromAxisAngle(_e.set(1, 0, 0), -p[pe]);
      const w = i === 0 ? this.wL : this.wR;
      if (w > 0.003) {
        const target = i === 0 ? this.hL : this.hR;
        const tw = _a.copy(target); this.root.localToWorld(tw); this.spine.worldToLocal(tw);
        const shp = this.sh[i].position; const elbow = _b, hand = _c;
        ik2(shp, tw, L1, L2, _p.set(s * 0.5, -1, -0.45), elbow, hand);
        const dirU = _d.subVectors(elbow, shp).normalize(); const qU = new Q().setFromUnitVectors(DOWN, dirU);
        const dirF = new V().subVectors(hand, elbow).normalize().applyQuaternion(qU.clone().invert()); const qF = new Q().setFromUnitVectors(DOWN, dirF);
        qs.slerp(qU, smooth(w)); qe.slerp(qF, smooth(w));
      }
      this.sh[i].quaternion.copy(qs); this.fore[i].quaternion.copy(qe);
      this.hand[i].rotation.set(-0.15 - (w > 0.5 ? 0.2 : 0), 0, 0);
    }
    // held items follow right hand
    if (this.held.visible) { this.held.visible = act === 'eat' || act === 'drink'; const hp = this.hand[1].getWorldPosition(_a); this.root.worldToLocal(hp); this.held.position.copy(hp).add(_b.set(0, -0.0, 0.03)); }
    this.tray.visible = this.carry;
    if (this.carry) { this.tray.position.set(0, 1.0 + Math.sin(ph * 2) * 0.006 * walkAmt, 0.4); this.tray.rotation.set(Math.sin(ph) * 0.02 * walkAmt - this.turn * 0.004, 0, Math.cos(ph) * 0.025 * walkAmt); }
  }
}
function lerpN(a: number, b: number, t: number) { return a + (b - a) * t; }
