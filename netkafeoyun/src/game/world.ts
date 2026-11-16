import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FY, FH, CEIL, DESK_INFO, DeskType, clamp, rnd } from './data';
import { FloorNav, Box } from './nav';
import { Screens, ScreenKind } from './screens';

export class Merger {
  geos: THREE.BufferGeometry[] = []; frame = new THREE.Matrix4();
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(); private col = new THREE.Color();
  static boxG = new THREE.BoxGeometry(1, 1, 1); static cylG = new THREE.CylinderGeometry(1, 1, 1, 14); static sphG = new THREE.SphereGeometry(1, 12, 8);
  setFrame(x: number, y: number, z: number, yaw: number) { this.frame.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)); }
  resetFrame() { this.frame.identity(); }
  add(g: THREE.BufferGeometry, color: number, p: [number, number, number], s: [number, number, number], r: [number, number, number] = [0, 0, 0]) {
    const gg = g.clone(); this.e.set(r[0], r[1], r[2]); this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(p[0], p[1], p[2]), this.q, new THREE.Vector3(s[0], s[1], s[2])); this.m.premultiply(this.frame); gg.applyMatrix4(this.m);
    const n = gg.attributes.position.count; const c = new Float32Array(n * 3); this.col.set(color); for (let i = 0; i < n; i++) { c[i * 3] = this.col.r; c[i * 3 + 1] = this.col.g; c[i * 3 + 2] = this.col.b; }
    gg.setAttribute('color', new THREE.BufferAttribute(c, 3)); this.geos.push(gg);
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number, ry = 0, rx = 0, rz = 0) { this.add(Merger.boxG, color, [x, y, z], [w, h, d], [rx, ry, rz]); }
  cyl(r: number, h: number, x: number, y: number, z: number, color: number, rb?: number) { this.add(Merger.cylG, color, [x, y, z], [r, h, r * (rb ?? 1)]); }
  sph(r: number, x: number, y: number, z: number, color: number, sy = 1) { this.add(Merger.sphG, color, [x, y, z], [r, r * sy, r]); }
  build(parent: THREE.Object3D, mat: THREE.Material) {
    if (!this.geos.length) return null; const g = mergeGeometries(this.geos, false)!; const m = new THREE.Mesh(g, mat); parent.add(m); this.geos = []; return m;
  }
}

function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t;
}
export function signTex(text: string, color: string, w = 256, h = 64, bg = 'rgba(8,6,20,0.85)', font = 'bold 40px sans-serif') {
  return canvasTex(w, h, (x) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = color; x.shadowBlur = 14; x.fillStyle = color; x.fillText(text, w / 2, h / 2 + 2); x.shadowBlur = 4; x.fillText(text, w / 2, h / 2 + 2); x.strokeStyle = color; x.lineWidth = 3; x.strokeRect(5, 5, w - 10, h - 10); }, false);
}
function posterTex(title: string, sub: string, c1: string, c2: string, kind = 0) {
  return canvasTex(200, 280, (x) => {
    const g = x.createLinearGradient(0, 0, 200, 280); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 200, 280);
    x.fillStyle = 'rgba(255,255,255,0.12)';
    if (kind === 0) { x.beginPath(); x.arc(100, 120, 60, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.moveTo(40, 200); x.lineTo(100, 70); x.lineTo(160, 200); x.fill(); }
    else if (kind === 1) { for (let i = 0; i < 9; i++) x.fillRect(0, 60 + i * 20, 200, 6 + (i % 3) * 3); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(60, 110, 80, 40); x.fillRect(80, 100, 40, 12); }
    else { for (let i = 0; i < 8; i++) { x.fillRect(i * 28, 0, 14, 280); } x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.arc(100, 130, 50, 0, 7); x.fill(); }
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = 'bold 30px sans-serif'; x.shadowColor = '#000'; x.shadowBlur = 6; x.fillText(title, 100, 50); x.font = '15px sans-serif'; x.fillText(sub, 100, 250);
    x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(4, 4, 192, 272);
  }, false);
}
function menuTex() {
  return canvasTex(256, 200, (x) => {
    x.fillStyle = '#1b1a2c'; x.fillRect(0, 0, 256, 200); x.strokeStyle = '#ffb347'; x.lineWidth = 4; x.strokeRect(4, 4, 248, 192);
    x.fillStyle = '#ffb347'; x.font = 'bold 24px sans-serif'; x.textAlign = 'center'; x.fillText('BÜFE MENÜ', 128, 34);
    const items = [['Çay', 15], ['Kola', 25], ['Enerji', 42], ['Cips', 22], ['Tost', 48], ['Burger', 75]]; x.font = '17px sans-serif';
    items.forEach((it, i) => { x.fillStyle = '#e8e8ff'; x.textAlign = 'left'; x.fillText(String(it[0]), 30, 66 + i * 21); x.textAlign = 'right'; x.fillStyle = '#2fd6c8'; x.fillText(it[1] + ' ₺', 226, 66 + i * 21); });
  }, false);
}
function fanTex() { return canvasTex(64, 64, (x) => { x.fillStyle = '#0a0a10'; x.fillRect(0, 0, 64, 64); x.translate(32, 32); for (let i = 0; i < 7; i++) { x.rotate((Math.PI * 2) / 7); x.fillStyle = '#9aa8c8'; x.beginPath(); x.ellipse(11, 0, 11, 5, 0.5, 0, 7); x.fill(); } x.fillStyle = '#222'; x.beginPath(); x.arc(0, 0, 5, 0, 7); x.fill(); }, false); }
function floorTex(kind: number) {
  return canvasTex(256, 256, (x) => {
    if (kind === 0) { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#3a3f55' : '#2e3247'; x.fillRect(i * 64, j * 64, 64, 64); } x.strokeStyle = '#1b1d2a'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); } }
    else if (kind === 1) { for (let i = 0; i < 8; i++) { x.fillStyle = `hsl(28,${35 + (i % 3) * 5}%,${30 + (i * 7) % 12}%)`; x.fillRect(0, i * 32, 256, 31); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, i * 32 + 31, 256, 1); x.fillRect((i * 83) % 256, i * 32, 1, 31); } }
    else { x.fillStyle = '#2a2850'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${150 + Math.random() * 80},${150 + Math.random() * 80},255,0.06)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } x.strokeStyle = 'rgba(120,200,255,0.18)'; x.lineWidth = 2; x.strokeRect(0, 0, 256, 256); }
  });
}
function glowTex() { return canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }, false); }

export interface Seat { id: number; floor: number; x: number; z: number; fx: number; fz: number; yaw: number; ax: number; az: number; style: number; kind: 'desk' | 'lounge' | 'audience'; occupant: any; chair: THREE.Object3D | null; pull: number; desk?: Desk; side?: number; }
export interface Desk {
  id: number; type: DeskType; floor: number; seat: Seat; owned: boolean; broken: boolean; sev: 'minor' | 'major' | null; wear: number; user: any; reserved: any; label: string; group: THREE.Group;
  screen: THREE.Mesh; fan: THREE.Mesh | null; wheel: THREE.Object3D | null; sale: THREE.Sprite; service: { x: number; z: number }; claimed: any; lockedForTourney: boolean; cx: number; cz: number; kind: ScreenKind;
}
export interface Stair { id: string; x0: number; x1: number; zTop: number; zBot: number; lower: number; cx: number; }
export interface Spot { id: string; floor: number; x: number; z: number; r: number; }

export class Elevator {
  floor = 0; y = 0; target = 0; state: 'closed' | 'opening' | 'open' | 'closing' | 'moving' = 'closed'; door = 0; timer = 0; queue: number[] = []; hold = 0; speed = 0; moving = false;
  cx = -6.6; cz = -8.35;
  onDing: (() => void) | null = null;
  call(f: number) { if (!this.queue.includes(f) && !(this.floor === f && this.isOpen())) this.queue.push(f); if (this.floor === f && (this.state === 'closed' || this.state === 'closing')) this.state = 'opening'; if (this.floor === f && this.state === 'open') this.timer = 0; }
  isOpen(f?: number) { return (f === undefined || this.floor === f) && this.door > 0.7 && (this.state === 'open' || this.state === 'opening') && !this.moving; }
  doorBlocking(f: number) { return !(this.floor === f && this.door > 0.55 && !this.moving); }
  update(dt: number) {
    const dts = Math.min(dt, 0.1);
    switch (this.state) {
      case 'closed': this.door = Math.max(0, this.door - dts * 1.2); if (this.queue.length) { const n = this.queue[0]; if (n === this.floor) { this.queue.shift(); this.state = 'opening'; } else if (this.door < 0.05) { this.target = n; this.state = 'moving'; this.moving = true; } } break;
      case 'opening': this.door = Math.min(1, this.door + dts * 1.1); if (this.door >= 1) { this.state = 'open'; this.timer = 0; } break;
      case 'open': this.timer += dts; this.door = 1; if (this.timer > 3.2 && this.hold <= 0) this.state = 'closing'; if (this.queue[0] === this.floor) { this.queue.shift(); this.timer = 0; } break;
      case 'closing': this.door = Math.max(0, this.door - dts * 1.2); if (this.door <= 0) this.state = 'closed'; if (this.hold > 0 && this.door < 0.9) this.state = 'opening'; break;
      case 'moving': {
        const ty = FY[this.target]; const dist = ty - this.y; const dir = Math.sign(dist); const brake = Math.min(1, Math.abs(dist) / 1.6 + 0.12);
        this.speed = Math.min(this.speed + dts * 1.6, 2.6 * brake); this.y += dir * this.speed * dts;
        if ((ty - this.y) * dir <= 0.02) { this.y = ty; this.floor = this.target; this.speed = 0; this.moving = false; this.state = 'opening'; const i = this.queue.indexOf(this.target); if (i >= 0) this.queue.splice(i, 1); this.onDing?.(); }
        break;
      }
    }
  }
}

export class World {
  fg: THREE.Group[] = []; navs: FloorNav[] = []; desks: Desk[] = []; seats: Seat[] = []; stairs: Stair[] = []; spots: Record<string, Spot> = {}; elev = new Elevator();
  lights: THREE.PointLight[][] = [[], [], []]; rgb: THREE.MeshBasicMaterial[] = []; fans: THREE.Mesh[] = []; glowMats: THREE.Material[] = [];
  queueSpots: { x: number; z: number }[] = []; doorPt = { x: 0, z: 10.9 }; cashierPt = { x: -6.0, z: 4.7 }; buffetPt = { x: -0.8, z: -7.45 }; wcPt = { x: 10.3, z: -8.6 }; regPt = { x: -6.0, z: 6.1 };
  loungeSeats: Seat[] = []; audience: Seat[] = []; teamA: Desk[] = []; teamB: Desk[] = [];
  S: Merger[] = [new Merger(), new Merger(), new Merger()]; GL: Merger[] = [new Merger(), new Merger(), new Merger()];
  doorL!: THREE.Mesh; doorR!: THREE.Mesh; shutterG!: THREE.Group; shutterAmt = 0; shutterTarget = 0; doorOpen = 0; signOpen!: THREE.Mesh; signOpenTex: THREE.Texture[] = []; signMain!: THREE.Mesh;
  elevCar = new THREE.Group(); elevDoors: THREE.Mesh[][] = []; carDoors: THREE.Mesh[] = []; elevLed: THREE.Mesh[] = []; modemLeds: THREE.Mesh[] = [];
  glassMat = new THREE.MeshLambertMaterial({ color: 0xaad8ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  staticMat = new THREE.MeshLambertMaterial({ vertexColors: true }); glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  bounds = { x0: -12, x1: 12, z0: -10, z1: 10 }; deskId = 0; seatId = 0; sprites: THREE.Sprite[] = []; chairs: THREE.Object3D[] = [];
  doorBox: Box; elevDoorBox: Box[] = []; shutterBox: Box; neonMats: THREE.MeshBasicMaterial[] = []; glowTexture = glowTex(); fanTexture = fanTex();
  poweredLights: { mat: THREE.MeshBasicMaterial; base: number }[] = [];

  constructor(public scene: THREE.Scene, public screens: Screens) {
    this.navs = [new FloorNav(-27, -11, 27, 14.2), new FloorNav(-12.6, -10.6, 12.6, 10.6), new FloorNav(-12.6, -10.6, 12.6, 10.6)];
    for (let f = 0; f < 3; f++) { const g = new THREE.Group(); g.position.y = 0; scene.add(g); this.fg.push(g); }
    for (let i = 0; i < 4; i++) this.rgb.push(new THREE.MeshBasicMaterial({ color: 0xff00ff, toneMapped: false }));
    this.doorBox = { x0: -1.6, x1: 1.6, z0: 9.9, z1: 10.3, dyn: () => this.shutterAmt < 0.5 };
    this.shutterBox = this.doorBox;
    this.buildShell(); this.buildStairs(); this.buildElevator(); this.buildFloor0(); this.buildFloor1(); this.buildFloor2(); this.buildLightsAndSigns();
    for (let f = 0; f < 3; f++) { this.S[f].build(this.fg[f], this.staticMat); this.GL[f].build(this.fg[f], this.glowMat); }
  }
  colBox(f: number, x0: number, x1: number, z0: number, z1: number, extra: Partial<Box> = {}) { const b: Box = { x0, x1, z0, z1, ...extra }; this.navs[f].add(b); return b; }
  finalizeNav() { for (const n of this.navs) n.build(0.3); this.assignApproach(); }

  /* ---------------- shell ---------------- */
  wall(f: number, axis: 'x' | 'z', c: number, dirIn: number, a0: number, a1: number, wins: [number, number][], door?: [number, number]) {
    const S = this.S[f], y0 = FY[f]; const interior = [0x4b4a78, 0x3f5f80, 0x5a3d80][f], ext = 0x8a6a5e; const H = CEIL;
    const ops: { s: number; e: number; t: 'w' | 'd' }[] = wins.map(w => ({ s: w[0], e: w[1], t: 'w' as const })); if (door) ops.push({ s: door[0], e: door[1], t: 'd' }); ops.sort((a, b) => a.s - b.s);
    const piece = (s: number, e: number, yb: number, h: number) => {
      const len = e - s, mid = (s + e) / 2, ym = y0 + yb + h / 2;
      // inner layer (0.1) and outer layer (0.2); dirIn: direction from wall toward interior
      const ci = c + dirIn * 0.1, co = c - dirIn * 0.05;
      if (axis === 'x') { S.box(len, h, 0.1, mid, ym, ci, interior); S.box(len, h, 0.2, mid, ym, co, ext); } else { S.box(0.1, h, len, ci, ym, mid, interior); S.box(0.2, h, len, co, ym, mid, ext); }
    };
    let cur = a0; const solids: [number, number][] = [];
    for (const o of ops) { if (o.s > cur) { piece(cur, o.s, 0, H); solids.push([cur, o.s]); } cur = o.e; if (o.t === 'w') { piece(o.s, o.e, 0, 0.95); piece(o.s, o.e, 3.05, H - 3.05); solids.push([o.s, o.e]); const gm = (o.s + o.e) / 2; const gl = new THREE.Mesh(new THREE.PlaneGeometry(o.e - o.s, 2.1), this.glassMat); if (axis === 'x') gl.position.set(gm, y0 + 2.0, c); else { gl.position.set(c, y0 + 2.0, gm); gl.rotation.y = Math.PI / 2; } this.fg[f].add(gl);
        const n = Math.max(1, Math.round((o.e - o.s) / 1.6)); for (let i = 0; i <= n; i++) { const p = o.s + ((o.e - o.s) * i) / n; if (axis === 'x') S.box(0.07, 2.1, 0.12, p, y0 + 2.0, c, 0x2a2a38); else S.box(0.12, 2.1, 0.07, c, y0 + 2.0, p, 0x2a2a38); } } else { piece(o.s, o.e, 3.05, H - 3.05); S.box(o.e - o.s + 0.2, 0.12, 0.35, (o.s + o.e) / 2, y0 + 3.05, c, 0x2a2a38); } }
    if (cur < a1) { piece(cur, a1, 0, H); solids.push([cur, a1]); }
    for (const [s, e] of solids) { if (axis === 'x') this.colBox(f, s, e, c - 0.15, c + 0.15); else this.colBox(f, c - 0.15, c + 0.15, s, e); }
  }
  slabPiece(f: number, x0: number, x1: number, z0: number, z1: number, tex: THREE.Texture, withTop = true) {
    const y = FY[f]; this.S[f].box(x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, y - 0.15, (z0 + z1) / 2, 0xcdd0e0);
    if (!withTop) return;
    const ix0 = Math.max(x0, -12), ix1 = Math.min(x1, 12), iz0 = Math.max(z0, -10), iz1 = Math.min(z1, 10); if (ix1 <= ix0 || iz1 <= iz0) return;
    const g = new THREE.PlaneGeometry(ix1 - ix0, iz1 - iz0); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; const T = 2.4; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (ix1 - ix0) / T + ix0 / T, uv.getY(i) * (iz1 - iz0) / T - iz0 / T);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex })); m.position.set((ix0 + ix1) / 2, y + 0.004, (iz0 + iz1) / 2); this.fg[f].add(m);
  }
  buildShell() {
    const tex = [floorTex(0), floorTex(1), floorTex(2)];
    // ground floor slab
    this.slabPiece(0, -12.3, 12.3, -10.3, 10.3, tex[0]);
    const eh = [-8.2, -5.0], ez = -7.0;
    // floor 1 slab (holes: elevator, stair A)
    this.slabPiece(1, -12.3, eh[0], -10.3, 10.3, tex[1]); this.slabPiece(1, eh[0], eh[1], ez, 10.3, tex[1]); this.slabPiece(1, eh[1], 9.2, -10.3, 10.3, tex[1]);
    this.slabPiece(1, 9.2, 11.2, -10.3, -3, tex[1]); this.slabPiece(1, 9.2, 11.2, 7.2, 10.3, tex[1]); this.slabPiece(1, 11.2, 12.3, -10.3, 10.3, tex[1]);
    // floor 2 slab (holes: elevator, stair B)
    this.slabPiece(2, -12.3, -11.2, -10.3, 10.3, tex[2]); this.slabPiece(2, -11.2, -9.2, -10.3, -3, tex[2]); this.slabPiece(2, -11.2, -9.2, 7.2, 10.3, tex[2]); this.slabPiece(2, -9.2, eh[0], -10.3, 10.3, tex[2]);
    this.slabPiece(2, eh[0], eh[1], ez, 10.3, tex[2]); this.slabPiece(2, eh[1], 12.3, -10.3, 10.3, tex[2]);
    // roof (slab above floor 2)
    this.S[2].box(24.6, 0.3, 20.6, 0, FY[2] + CEIL + 0.15, 0, 0xb9bccd); this.S[2].box(25, 0.5, 21, 0, FY[2] + CEIL + 0.55, 0, 0x6a5a56);
    // roof ceiling lights are in lights section
    const fw: [number, number][] = [[-11.4, -7.6], [-6.4, -2.6], [2.6, 6.4], [7.6, 11.4]];
    const lw: [number, number][] = [[-8.8, -5.2], [-3.8, -0.2], [1.2, 4.8], [6.2, 9.2]];
    for (let f = 0; f < 3; f++) {
      this.wall(f, 'x', 10.15, -1, -12.3, 12.3, f === 0 ? fw : [...fw, [-1.6, 1.6]], f === 0 ? [-1.6, 1.6] : undefined);
      this.wall(f, 'x', -10.15, 1, -12.3, 12.3, f === 0 ? [[-3, -0.5], [0.5, 3]] : []);
      this.wall(f, 'z', -12.15, 1, -10.3, 10.3, lw);
      this.wall(f, 'z', 12.15, -1, -10.3, 10.3, f === 0 ? [[-9, -5], [-1.5, 2.5]] : [[-9, -5], [-1.5, 2.5], [4.5, 8]]);
      // floor 0 front door gap: near-end lintels done in wall(); baseboards & ceiling trims
      const y = FY[f];
      this.S[f].box(24, 0.12, 0.05, 0, y + 0.06, -9.97, 0x20203a); this.S[f].box(0.05, 0.12, 20, -11.97, y + 0.06, 0, 0x20203a); this.S[f].box(0.05, 0.12, 20, 11.97, y + 0.06, 0, 0x20203a);
      // ceiling light panels
      const gl = this.GL[f]; const lc = [0xfff0cf, 0xe8f2ff, 0xffe2f4][f];
      for (let ix = -9; ix <= 9; ix += 4.5) for (let iz = -7; iz <= 7; iz += 4.7) gl.box(1.5, 0.05, 0.5, ix, y + CEIL - 0.03, iz, lc);
      // neon strips along walls
      const n1 = [0x2fd6c8, 0xff9a3f, 0xff3fa4][f], n2 = [0xff3fa4, 0x9a86ff, 0x3fa6ff][f];
      gl.box(23.6, 0.06, 0.05, 0, y + 3.7, -9.95, n1); gl.box(0.05, 0.06, 19.6, -11.95, y + 3.7, 0, n2); gl.box(0.05, 0.06, 19.6, 11.95, y + 3.7, 0, n1);
      gl.box(9, 0.06, 0.05, -7, y + 3.7, 9.95, n2); gl.box(9, 0.06, 0.05, 7, y + 3.7, 9.95, n2);
    }
  }
  buildStairs() {
    const defs: Stair[] = [{ id: 'A', x0: 9.2, x1: 11.2, zTop: -3, zBot: 7.2, lower: 0, cx: 10.2 }, { id: 'B', x0: -11.2, x1: -9.2, zTop: -3, zBot: 7.2, lower: 1, cx: -10.2 }];
    for (const st of defs) {
      this.stairs.push(st); const f = st.lower, S = this.S[f], n = 24, len = st.zBot - st.zTop, y0 = FY[f]; const w = st.x1 - st.x0;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n; const zc = st.zBot - (t0 + 0.5) * len; const h = FH * t1;
        S.box(w, h, len / n + 0.01, (st.x0 + st.x1) / 2, y0 + h / 2, zc, i % 2 ? 0x8a8aa0 : 0x9a9ab0);
        S.box(w, 0.02, 0.03, (st.x0 + st.x1) / 2, y0 + h + 0.005, zc + len / n / 2 - 0.02, 0xffd36a);
      }
      const ang = Math.atan2(FH, len), rl = Math.hypot(FH, len);
      for (const sx of [st.x0 - 0.06, st.x1 + 0.06]) {
        S.box(0.06, 0.06, rl, sx, y0 + FH / 2 + 1.0, (st.zBot + st.zTop) / 2, 0x2fd6c8, 0, ang);
        for (let i = 0; i <= 8; i++) { const t = i / 8; S.box(0.04, 1.0, 0.04, sx, y0 + FH * t + 0.5, st.zBot - t * len, 0x30303c); }
      }
      // under-stair wall plates & colliders
            const strips: [number, number][] = st.id === 'A' ? [[st.x0 - 0.2, st.x0], [st.x1, 12]] : [[-12, st.x0], [st.x1, st.x1 + 0.2]];
      for (const fl of [f, f + 1]) for (const s of strips) this.colBox(fl, s[0], s[1], st.zTop, 7.45);
      this.colBox(f + 1, st.x0 - 0.2, st.x1 + 0.2, 7.2, 7.5); this.colBox(f, st.x0, st.x1, st.zTop, 6.4, { stairBody: true });
      // rail visual on upper floor around the hole
      this.S[f + 1].box(w + 0.4, 0.9, 0.05, (st.x0 + st.x1) / 2, FY[f + 1] + 0.45, 7.3, 0x30303c); this.GL[f + 1].box(w + 0.4, 0.04, 0.06, (st.x0 + st.x1) / 2, FY[f + 1] + 0.92, 7.3, 0x2fd6c8);
      for (const sx of [st.x0 - 0.1, st.x1 + 0.1]) this.S[f + 1].box(0.05, 0.9, 10.5, sx, FY[f + 1] + 0.45, 2.3, 0x30303c);
      // landing signs
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: signTex('↑ MERDİVEN', '#ffd36a', 256, 64), toneMapped: false })); lab.position.set(st.cx, FY[f] + 3.2, 9.9); lab.rotation.y = Math.PI; this.fg[f].add(lab);
    }
  }
  buildElevator() {
    const x0 = -8.2, x1 = -5.0, zb = -10, zf = -7.0, cx = (x0 + x1) / 2;
    for (let f = 0; f < 3; f++) {
      const S = this.S[f], y = FY[f];
      S.box(0.2, CEIL, 3.0, x0 - 0.1, y + CEIL / 2, (zb + zf) / 2, 0x6a6a7a); S.box(0.2, CEIL, 3.0, x1 + 0.1, y + CEIL / 2, (zb + zf) / 2, 0x6a6a7a);
      this.colBox(f, x0 - 0.2, x0, zb, zf); this.colBox(f, x1, x1 + 0.2, zb, zf);
      S.box(x1 - x0 + 0.4, 0.9, 0.3, cx, y + CEIL - 0.45, zf, 0x4a4a58); S.box(0.35, CEIL, 0.3, x0 - 0.1, y + CEIL / 2, zf, 0x4a4a58); S.box(0.35, CEIL, 0.3, x1 + 0.1, y + CEIL / 2, zf, 0x4a4a58);
      const eb: Box = { x0: x0, x1: x1, z0: zf - 0.1, z1: zf + 0.1, dyn: () => this.elev.doorBlocking(f) }; this.navs[f].add(eb); this.elevDoorBox.push(eb);
      const dm = new THREE.MeshLambertMaterial({ color: 0xb8bcc8 }); const pair: THREE.Mesh[] = [];
      for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(1.55, CEIL - 0.9, 0.08), dm); d.position.set(cx + s * 0.78, y + (CEIL - 0.9) / 2, zf); this.fg[f].add(d); pair.push(d); }
      this.elevDoors.push(pair);
      // call button + indicator
      const bt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.05), new THREE.MeshBasicMaterial({ color: 0x3dff7a })); bt.position.set(x1 + 0.4, y + 1.2, zf + 0.02); this.fg[f].add(bt); this.elevLed.push(bt);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), new THREE.MeshBasicMaterial({ map: signTex('ASANSÖR', '#9ad8ff', 192, 52), toneMapped: false })); sg.position.set(cx, y + CEIL - 0.45, zf + 0.17); this.fg[f].add(sg);
    }
    // car
    const car = this.elevCar; this.fg[0].add(car);
    const cm = new Merger(); cm.box(3.0, 0.14, 2.7, cx, -0.07, -8.35, 0x58586a); cm.box(3.0, 0.1, 2.7, cx, 2.62, -8.35, 0xd0d4e0); cm.box(3.0, 2.6, 0.06, cx, 1.3, -9.7, 0x7a7a90); cm.box(0.06, 2.6, 2.7, x0 + 0.05, 1.3, -8.35, 0x7a7a90); cm.box(0.06, 2.6, 2.7, x1 - 0.05, 1.3, -8.35, 0x7a7a90);
    cm.box(2.2, 0.05, 0.05, cx, 1.0, -9.65, 0xc0c4d0); cm.box(0.05, 0.05, 2.0, x0 + 0.1, 1.0, -8.35, 0xc0c4d0); cm.box(0.05, 0.05, 2.0, x1 - 0.1, 1.0, -8.35, 0xc0c4d0);
    cm.build(car, this.staticMat);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff4d6 })); lamp.position.set(cx, 2.55, -8.3); car.add(lamp);
    const mir = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2), new THREE.MeshLambertMaterial({ color: 0x9fb8d0 })); mir.position.set(cx, 1.5, -9.65); car.add(mir);
    const pm = new THREE.MeshBasicMaterial({ map: signTex('1  2  3', '#ffd36a', 192, 52), toneMapped: false }); const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.18), pm); panel.position.set(x1 - 0.1, 1.5, -8.9); panel.rotation.y = -Math.PI / 2; car.add(panel);
    for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(1.5, CEIL - 1.5, 0.06), new THREE.MeshLambertMaterial({ color: 0xc9cdd8 })); d.position.set(cx + s * 0.76, (CEIL - 1.5) / 2, -7.06); car.add(d); this.carDoors.push(d); }
    this.spots.elevCall0 = { id: 'elevCall', floor: 0, x: -4.5, z: -6.2, r: 1.9 }; this.spots.elevCall1 = { ...this.spots.elevCall0, floor: 1 }; this.spots.elevCall2 = { ...this.spots.elevCall0, floor: 2 };
  }

  /* ---------------- furniture helpers ---------------- */
  makeChair(f: number, x: number, z: number, yaw: number, style: 'gaming' | 'office' | 'vip' | 'racing' | 'aud' | 'quiet', color: number) {
    const m = new Merger(); const dark = 0x23232e;
    if (style === 'racing') { m.box(0.52, 0.1, 0.5, 0, 0.3, 0, dark); m.box(0.52, 0.7, 0.12, 0, 0.62, -0.26, color); m.box(0.08, 0.35, 0.4, -0.27, 0.45, -0.05, color); m.box(0.08, 0.35, 0.4, 0.27, 0.45, -0.05, color); m.box(0.28, 0.16, 0.08, 0, 1.05, -0.28, color); }
    else if (style === 'aud') { m.box(0.5, 0.08, 0.48, 0, 0.42, 0, 0x3a3a60); m.box(0.5, 0.5, 0.08, 0, 0.74, -0.22, color); m.cyl(0.04, 0.38, 0, 0.19, 0, 0x30303c); m.box(0.46, 0.04, 0.4, 0, 0.02, 0, 0x30303c); }
    else {
      const wide = style === 'vip' ? 0.56 : 0.46;
      m.box(wide, 0.08, 0.46, 0, 0.42, 0, style === 'vip' ? 0x2a1c14 : dark); m.box(wide - 0.02, style === 'office' ? 0.46 : 0.62, 0.07, 0, style === 'office' ? 0.74 : 0.82, -0.22, color);
      m.cyl(0.04, 0.34, 0, 0.2, 0, 0x30303c);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; m.box(0.28, 0.03, 0.05, Math.sin(a) * 0.14, 0.04, Math.cos(a) * 0.14, 0x30303c, a + Math.PI / 2); m.sph(0.03, Math.sin(a) * 0.27, 0.025, Math.cos(a) * 0.27, 0x111111); }
      if (style === 'gaming' || style === 'vip') { m.box(0.07, 0.34, 0.14, -wide / 2 - 0.02, 0.62, -0.17, color); m.box(0.07, 0.34, 0.14, wide / 2 + 0.02, 0.62, -0.17, color); m.box(0.3, 0.16, 0.07, 0, 1.22, -0.22, color); }
      m.box(0.05, 0.05, 0.3, -wide / 2 - 0.01, 0.62, 0.0, 0x30303c); m.box(0.05, 0.05, 0.3, wide / 2 + 0.01, 0.62, 0.0, 0x30303c);
    }
    const g = new THREE.Group(); m.build(g, this.staticMat); g.position.set(x, FY[f], z); g.rotation.y = yaw; this.fg[f].add(g); this.chairs.push(g); return g;
  }
  addSeat(f: number, x: number, z: number, fx: number, fz: number, style: number, kind: Seat['kind'], chair: THREE.Object3D | null, ax: number, az: number): Seat {
    const s: Seat = { id: this.seatId++, floor: f, x, z, fx, fz, yaw: Math.atan2(fx, fz), ax, az, style, kind, occupant: null, chair, pull: 0 }; this.seats.push(s); return s;
  }
  lw(cx: number, cz: number, fx: number, fz: number, lx: number, lz: number) { return { x: cx + lx * fz + lz * fx, z: cz - lx * fx + lz * fz }; }

  makeDesk(type: DeskType, f: number, cx: number, cz: number, fx: number, fz: number, sideSign = 1): Desk {
    const info = DESK_INFO[type], S = this.S[f], yaw = Math.atan2(fx, fz); const id = this.deskId++;
    const grp = new THREE.Group(); grp.position.set(cx, FY[f], cz); grp.rotation.y = yaw; this.fg[f].add(grp);
    S.setFrame(cx, FY[f], cz, yaw); const acc = info.color;
    const gl = this.GL[f]; gl.setFrame(cx, FY[f], cz, yaw);
    let screen: THREE.Mesh, fan: THREE.Mesh | null = null, wheel: THREE.Object3D | null = null, kind: ScreenKind = 'idle';
    const mkScreen = (w: number, h: number, x: number, y: number, z: number, mat: THREE.Material) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); s.position.set(x, y, z); s.rotation.y = Math.PI; grp.add(s); return s; };
    if (type === 'racing') {
      S.box(0.95, 0.07, 2.2, 0, 0.035, 0.75, 0x23232e); S.box(0.1, 0.5, 0.1, 0, 0.35, 0.72, 0x3a3a48); S.box(0.5, 0.05, 0.3, 0, 0.1, 0.9, 0x2a2a36);
      S.box(0.09, 0.03, 0.14, -0.11, 0.1, 0.78, 0x888888, 0, -0.5); S.box(0.09, 0.03, 0.14, 0.04, 0.1, 0.78, 0xcc3333, 0, -0.5);
      S.box(0.12, 1.0, 0.1, 0, 0.55, 1.75, 0x2a2a36); S.box(1.5, 0.62, 0.06, 0, 1.18, 1.82, 0x15151c); S.box(0.5, 0.06, 0.4, 0, 0.03, 1.75, 0x23232e);
      gl.box(1.5, 0.03, 0.03, 0, 0.88, 1.78, acc); gl.box(0.95, 0.025, 0.025, 0, 0.075, 0.2, acc);
      screen = mkScreen(1.42, 0.54, 0, 1.18, 1.78, screens(this, 'race')); kind = 'race';
      const w = new THREE.Group(); w.position.set(0, 0.9, 0.56); w.rotation.x = -0.35; const tor = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 22), new THREE.MeshLambertMaterial({ color: 0x1a1a22 })); w.add(tor);
      for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.02), new THREE.MeshLambertMaterial({ color: 0x555566 })); sp.rotation.z = (i * Math.PI) / 3 + Math.PI / 6; w.add(sp); }
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), new THREE.MeshBasicMaterial({ color: 0xff3a3a })); stripe.position.set(0, 0.15, 0); w.add(stripe);
      const wp = new THREE.Group(); wp.add(w); wp.position.set(0, 0, 0); grp.add(wp); wheel = w;
    } else {
      const tw = type === 'vip' ? 1.5 : type === 'old' ? 1.0 : type === 'esport' ? 1.1 : 1.2; const topC = type === 'vip' ? 0x3a2c22 : type === 'old' ? 0x8a7a64 : type === 'quiet' ? 0x8a6a48 : 0x2a2d3a;
      S.box(tw, 0.04, 0.7, 0, 0.74, 0.72, topC); S.box(0.04, 0.72, 0.62, -tw / 2 + 0.05, 0.36, 0.72, 0x20202c); S.box(0.04, 0.72, 0.62, tw / 2 - 0.05, 0.36, 0.72, 0x20202c); S.box(tw - 0.1, 0.4, 0.03, 0, 0.5, 1.02, 0x20202c);
      S.box(0.42, 0.02, 0.15, 0, 0.765, 0.58, type === 'old' ? 0xc8c0a8 : 0x1c1c26); S.box(0.06, 0.025, 0.1, -0.33, 0.77, 0.6, type === 'old' ? 0xc8c0a8 : 0x1c1c26); S.box(0.26, 0.004, 0.22, -0.33, 0.762, 0.6, 0x15151c);
      S.box(0.02, 0.012, 0.35, -0.2, 0.755, 0.9, 0x111111); S.box(0.35, 0.012, 0.02, -0.38, 0.755, 0.95, 0x111111);
      if (type === 'old') {
        S.box(0.46, 0.4, 0.42, 0, 0.98, 0.95, 0xcfc8b0); S.box(0.3, 0.1, 0.3, 0, 0.78, 0.95, 0xcfc8b0); S.box(0.22, 0.42, 0.4, 0.38, 0.96, 0.9, 0xcfc8b0); S.box(0.15, 0.02, 0.01, 0.38, 1.02, 0.69, 0x333333); S.box(0.04, 0.04, 0.01, 0.46, 0.84, 0.69, 0x3dff7a);
        screen = mkScreen(0.34, 0.26, 0, 0.99, 0.739, screens(this, 'old')); kind = 'old';
      } else {
        const sw = type === 'vip' ? 0.98 : type === 'esport' ? 0.64 : 0.6, sh = type === 'vip' ? 0.4 : 0.34, sy = type === 'vip' ? 1.08 : 1.06;
        S.box(0.06, 0.28, 0.06, 0, 0.88, 0.99, 0x1c1c26); S.box(0.28, 0.02, 0.18, 0, 0.77, 0.99, 0x1c1c26); S.box(sw + 0.04, sh + 0.04, 0.03, 0, sy, 0.99, 0x101018);
        screen = mkScreen(sw, sh, 0, sy, 0.973, screens(this, 'idle')); kind = 'idle';
        gl.box(sw, 0.012, 0.012, 0, sy - sh / 2 - 0.02, 0.97, acc);
        S.box(0.22, 0.44, 0.42, 0.55, 0.98, 0.92, 0x16161e); S.box(0.015, 0.4, 0.38, 0.449, 0.98, 0.92, 0x20304a);
        gl.box(0.012, 0.36, 0.012, 0.443, 0.98, 0.72, acc);
        fan = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), new THREE.MeshBasicMaterial({ map: this.fanTexture })); fan.position.set(0.55, 1.0, 0.708); fan.rotation.y = Math.PI; grp.add(fan); this.fans.push(fan);
        const kg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.004, 0.015), this.rgb[id % 4]); kg.position.set(0, 0.778, 0.51); grp.add(kg);
        const tg = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.34, 0.01), this.rgb[(id + 1) % 4]); tg.position.set(0.445, 0.98, 0.72); grp.add(tg);
        // headset on stand
        S.box(0.16, 0.02, 0.1, -0.58, 0.765, 0.8, 0x22222c); S.box(0.03, 0.2, 0.03, -0.58, 0.86, 0.82, 0x22222c); S.box(0.16, 0.025, 0.04, -0.58, 0.97, 0.82, acc); S.box(0.05, 0.08, 0.05, -0.65, 0.92, 0.82, 0x22222c); S.box(0.05, 0.08, 0.05, -0.51, 0.92, 0.82, 0x22222c);
        if (type === 'esport' || type === 'vip') gl.box(tw - 0.1, 0.02, 0.02, 0, 0.7, 0.4, acc);
      }
      if (type === 'quiet') { S.cyl(0.07, 0.12, 0.5, 0.82, 0.55, 0x6a4a3a); S.sph(0.1, 0.5, 0.97, 0.55, 0x3a8a4a, 0.8); }
      if (type === 'vip') { S.cyl(0.05, 0.14, -0.62, 0.84, 0.5, 0xe6b84a); S.sph(0.07, -0.62, 0.95, 0.5, 0xffd36a); S.box(0.5, 0.01, 1.5, 0, 0.012, 0.6, 0x5a1f3a); }
    }
    // chair
    const chStyle = type === 'racing' ? 'racing' : type === 'vip' ? 'vip' : type === 'old' ? 'office' : type === 'quiet' ? 'quiet' : 'gaming';
    const chair = this.makeChair(f, cx, cz, yaw, chStyle as any, type === 'old' ? 0x6a6a74 : acc);
    // seat & approach (side)
    const ap = this.lw(cx, cz, fx, fz, sideSign * 1.0, type === 'racing' ? 0.1 : 0.05);
    const seat = this.addSeat(f, cx, cz, fx, fz, type === 'racing' ? 1 : 0, 'desk', chair, ap.x, ap.z); seat.side = sideSign;
    const sv = this.lw(cx, cz, fx, fz, sideSign * 1.0, 0.3);
    // sale sprite
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex('SATILIK', '#ff6a5a', 160, 48), transparent: true, depthWrite: false })); sp.scale.set(0.8, 0.24, 1); sp.position.set(0, 1.55, 0.7); grp.add(sp); this.sprites.push(sp);
    // collider (table / rig)
    const tb = this.lw(cx, cz, fx, fz, 0, type === 'racing' ? 1.0 : 0.85); const hw = type === 'racing' ? 0.5 : (type === 'vip' ? 0.78 : 0.6), hd = type === 'racing' ? 1.2 : 0.55;
    const ax = Math.abs(fz) > 0.5 ? [hw, hd] : [hd, hw]; this.colBox(f, tb.x - ax[0], tb.x + ax[0], tb.z - ax[1], tb.z + ax[1]);
    S.resetFrame(); gl.resetFrame();
    const desk: Desk = { id, type, floor: f, seat, owned: false, broken: false, sev: null, wear: rnd(0, 0.3), user: null, reserved: null, label: info.short + ' #' + (id + 1), group: grp, screen, fan, wheel, sale: sp, service: sv, claimed: null, lockedForTourney: false, cx, cz, kind };
    seat.desk = desk; this.desks.push(desk); return desk;
  }

  buildFloor0() {
    const S = this.S[0], GL = this.GL[0], f = 0;
    // reception counter
    S.box(6.0, 1.1, 1.0, -6.5, 0.55, 6.1, 0x3a2c4a); S.box(6.1, 0.06, 1.1, -6.5, 1.13, 6.1, 0xe8e0d0); GL.box(6.0, 0.05, 0.03, -6.5, 0.9, 6.62, 0x2fd6c8); GL.box(6.0, 0.05, 0.03, -6.5, 0.2, 6.62, 0xff3fa4);
    this.colBox(f, -9.5, -3.5, 5.6, 6.6);
    S.box(0.5, 0.06, 0.4, -6.0, 1.19, 6.0, 0x22222c); S.box(0.4, 0.3, 0.05, -6.0, 1.38, 5.85, 0x22222c, 0, -0.3); GL.box(0.3, 0.2, 0.01, -6.0, 1.38, 5.9, 0x7affc0, 0, -0.3); S.box(0.2, 0.1, 0.15, -5.4, 1.2, 6.2, 0xbababa);
    S.box(0.14, 0.04, 0.14, -7.2, 1.18, 6.3, 0xffd36a); S.box(0.5, 0.03, 0.3, -7.8, 1.16, 6.0, 0xeeeeee);
    // back shelves behind counter
    S.box(5.8, 2.2, 0.35, -6.4, 1.1, 2.9, 0x4a3828); for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) S.box(0.5, 0.3, 0.25, -8.9 + j * 0.8, 0.6 + i * 0.5, 3.0, [0xd94f6a, 0x4f7bd9, 0x4fd9a2, 0xd9c34f][(i + j) % 4]);
    this.colBox(f, -9.4, -3.4, 2.7, 3.1);
    // queue marks
    this.queueSpots = [{ x: -6.2, z: 7.4 }, { x: -5.2, z: 7.4 }, { x: -4.2, z: 7.4 }, { x: -3.2, z: 7.4 }, { x: -2.2, z: 8.2 }, { x: -2.2, z: 9.0 }];
    this.queueSpots.forEach((q) => GL.box(0.5, 0.01, 0.5, q.x, 0.012, q.z, 0x6a5a1a));
    // rug at door
    S.box(3.4, 0.015, 2.2, 0, 0.008, 8.9, 0x7a2a3a); S.box(3.0, 0.016, 1.8, 0, 0.01, 8.9, 0x9a3a4a);
    // gaming divider
    S.box(5.8, 1.2, 0.05, -5.5, 0.6, -2.9, 0x2a2a3a); GL.box(5.8, 0.04, 0.06, -5.5, 1.22, -2.9, 0x2fd6c8);
    // desks
    const olds = [3.4, 1.5, -0.4, -2.3, -4.2, -6.1];
    olds.forEach((z) => this.makeDesk('old', f, -10.2, z, -1, 0, 1));
    [-7.5, -5.5, -3.5].forEach((x) => this.makeDesk('gaming', f, x, -1.2, 0, -1, 1));
    [-7.5, -5.5, -3.5].forEach((x) => this.makeDesk('gaming', f, x, -4.6, 0, 1, 1));
    [4.4, 6.9].forEach((x) => this.makeDesk('vip', f, x, 2.2, 0, -1, 1)); [4.4, 6.9].forEach((x) => this.makeDesk('vip', f, x, -3.2, 0, 1, 1));
    S.box(6.4, 0.02, 7.4, 5.65, 0.011, -0.5, 0x4a1f3a); GL.box(6.2, 0.04, 0.05, 5.65, 2.6, -0.5, 0xe6b84a);
    for (const px of [2.6, 8.8]) { S.box(0.1, 1.2, 0.1, px, 0.6, -0.5, 0x2a2a38); } S.box(6.4, 0.04, 0.04, 5.65, 1.2, -0.5, 0xe6b84a);
    // buffet
    S.box(5.5, 1.05, 0.9, -0.75, 0.52, -6.35, 0x5a3d28); S.box(5.6, 0.06, 1.0, -0.75, 1.08, -6.35, 0xd0d4d8); GL.box(5.5, 0.04, 0.03, -0.75, 0.9, -5.9, 0xffb347);
    this.colBox(f, -3.5, 2.0, -6.8, -5.9);
    S.box(0.55, 0.4, 0.4, -2.6, 1.31, -6.35, 0x2a2a30); S.box(0.1, 0.1, 0.1, -2.6, 1.56, -6.3, 0xff4a3a); S.box(0.5, 0.25, 0.4, -1.3, 1.24, -6.35, 0x8a8a96); S.box(0.5, 0.25, 0.4, -0.6, 1.24, -6.35, 0x8a8a96); S.box(0.35, 0.1, 0.35, 0.3, 1.16, -6.35, 0xd8d8e0); S.cyl(0.12, 0.3, 1.0, 1.25, -6.35, 0xb0b4c0);
    S.box(1.1, 2.0, 0.7, -2.3, 1.0, -9.6, 0xe8ecf2); S.box(0.04, 0.5, 0.05, -1.82, 1.2, -9.2, 0x555566); GL.box(0.5, 0.04, 0.02, -2.3, 2.05, -9.22, 0x7ae0ff);
    S.box(2.6, 1.0, 0.5, 0.2, 0.5, -9.7, 0x4a3828); S.box(2.6, 0.04, 0.5, 0.2, 1.52, -9.7, 0x4a3828); for (let i = 0; i < 6; i++) S.box(0.3, 0.3, 0.3, -0.8 + i * 0.4, 1.7, -9.7, [0xd94f6a, 0x4f7bd9, 0xd9c34f][i % 3]);
    S.box(1.4, 0.9, 0.5, 1.5, 0.45, -9.0, 0x5a4a3a);
    // storage room
    S.box(0.2, CEIL, 3, 4.0, CEIL / 2, -8.5, 0x4b4a78); this.colBox(f, 3.9, 4.1, -10, -7);
    S.box(0.2, CEIL, 3, 8.6, CEIL / 2, -8.5, 0x4b4a78); this.colBox(f, 8.5, 8.7, -10, -7);
    S.box(1.4, CEIL, 0.2, 4.7, CEIL / 2, -7, 0x4b4a78); this.colBox(f, 4.0, 5.4, -7.1, -6.9); S.box(2.0, CEIL, 0.2, 7.6, CEIL / 2, -7, 0x4b4a78); this.colBox(f, 6.6, 8.6, -7.1, -6.9); S.box(1.2, 0.9, 0.2, 6.0, 3.65, -7, 0x4b4a78);
    for (let i = 0; i < 3; i++) { S.box(0.3, 2.0, 2.4, 4.4 + i * 0.01, 1.0, -8.6, 0x5a4a3a); S.box(0.4, 0.35, 0.5, 4.8 + (i % 2) * 0.6, 0.18, -9.5 + i * 0.5, 0xb88a4a); }
    S.box(0.3, 2.0, 2.4, 8.3, 1.0, -8.6, 0x5a4a3a); for (let j = 0; j < 4; j++) S.box(0.4, 0.4, 0.5, 8.0, 0.22 + j * 0.5, -8.3 + (j % 2) * 0.5, 0xb88a4a); S.box(1.0, 0.5, 0.6, 6.5, 0.25, -9.6, 0xb88a4a); S.box(0.8, 0.5, 0.6, 5.5, 0.25, -9.6, 0xa87a3a);
    this.colBox(f, 4.1, 4.7, -10, -7.4); this.colBox(f, 8.0, 8.5, -10, -7.4); this.colBox(f, 5.0, 8.0, -10, -9.1);
    // restroom
    S.box(0.8, CEIL, 0.2, 9.0, CEIL / 2, -7, 0x3a4f7a); S.box(1.4, CEIL, 0.2, 11.3, CEIL / 2, -7, 0x3a4f7a);
    this.colBox(f, 8.6, 9.4, -7.1, -6.9); this.colBox(f, 10.6, 12, -7.1, -6.9);
    S.box(1.2, CEIL - 3.0, 0.2, 10.0, 3.55, -7, 0x3a4f7a); S.box(1.5, 2.4, 0.04, 11.2, 1.2, -8.6, 0x6a8ab0); S.box(1.5, 2.4, 0.04, 9.3, 1.2, -9.0, 0x6a8ab0);
    for (const x of [9.8, 11.6]) { S.box(0.4, 0.4, 0.5, x, 0.2, -9.6, 0xf2f2f2); S.box(0.4, 0.6, 0.12, x, 0.7, -9.85, 0xe8e8e8); }
    S.box(0.9, 0.12, 0.5, 11.55, 0.9, -8.1, 0xf2f2f2); S.box(0.6, 0.8, 0.02, 11.55, 1.5, -7.95, 0x9fc0e0); this.colBox(f, 9.1, 11.7, -9.9, -9.2); this.colBox(f, 11.1, 12, -8.4, -7.8);
    const wcSign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({ map: signTex('WC', '#9ad8ff', 128, 48), toneMapped: false })); wcSign.position.set(10.0, 3.15, -6.88); wcSign.rotation.y = Math.PI; this.fg[0].add(wcSign);
    const dp = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.3), new THREE.MeshBasicMaterial({ map: signTex('DEPO', '#ffb347', 128, 48), toneMapped: false })); dp.position.set(6.0, 3.3, -6.88); dp.rotation.y = Math.PI; this.fg[0].add(dp);
    // admin desk
    S.box(3.6, 0.9, 0.9, 5.6, 0.45, 9.2, 0x24243a); S.box(3.7, 0.05, 1.0, 5.6, 0.93, 9.2, 0x15151c); GL.box(3.6, 0.04, 0.03, 5.6, 0.7, 8.72, 0x3fa6ff); this.colBox(f, 3.8, 7.4, 8.7, 9.7);
    for (const mx of [4.6, 5.6, 6.6]) { S.box(0.62, 0.38, 0.03, mx, 1.35, 9.35, 0x101018, mx === 5.6 ? 0 : (mx - 5.6) * 0.5); }
    const cam = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.32), this.screens.mats.cctv); cam.position.set(5.6, 1.35, 9.32 - 0.0); cam.rotation.y = Math.PI; this.fg[0].add(cam);
    S.box(0.5, 0.04, 0.2, 5.6, 0.97, 8.9, 0x15151c); S.box(0.15, 0.1, 0.15, 6.6, 0.98, 8.95, 0xeeeeee); S.box(0.3, 0.02, 0.4, 4.3, 0.96, 9.0, 0xf0e8d0);
    const as = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.34), new THREE.MeshBasicMaterial({ map: signTex('YÖNETİM', '#3fa6ff', 192, 52), toneMapped: false })); as.position.set(5.6, 2.2, 9.9); as.rotation.y = Math.PI; this.fg[0].add(as);
    // modem rack
    S.box(0.7, 2.0, 0.6, 8.4, 1.0, 9.5, 0x1a1a24); this.colBox(f, 8.0, 8.8, 9.2, 9.8);
    for (let i = 0; i < 6; i++) { const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x3dff7a })); led.position.set(8.2 + (i % 3) * 0.12, 1.7 - Math.floor(i / 3) * 0.2, 9.19); this.fg[0].add(led); this.modemLeds.push(led); }
    S.box(0.6, 0.08, 0.02, 8.4, 1.45, 9.19, 0x3a3a48); S.box(0.6, 0.08, 0.02, 8.4, 1.25, 9.19, 0x3a3a48);
    // fuse box
    S.box(0.5, 0.7, 0.14, -3.9, 1.5, -9.88, 0x6a6a74); GL.box(0.06, 0.06, 0.02, -3.78, 1.7, -9.8, 0xff4a3a);
    // plants & decor in lobby
    for (const [px, pz] of [[-11.2, 8.8], [2.4, 3.4], [-1.9, 9.1]]) { S.cyl(0.25, 0.4, px, 0.2, pz, 0x7a4a3a); S.sph(0.42, px, 0.8, pz, 0x2f8a4a, 1.2); this.colBox(f, px - 0.25, px + 0.25, pz - 0.25, pz + 0.25); }
    // water cooler
    S.cyl(0.18, 0.9, 11.4, 0.45, 5.2, 0xdde4ee); S.cyl(0.15, 0.4, 11.4, 1.1, 5.2, 0x7ac0ff); this.colBox(f, 11.2, 11.6, 5.0, 5.4);
    // posters
    const poster = (t: THREE.Texture, x: number, y: number, z: number, ry: number, w = 1.0, h = 1.4, fl = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t })); p.position.set(x, FY[fl] + y, z); p.rotation.y = ry; this.fg[fl].add(p); };
    poster(posterTex('RACING', 'Gaz fulle!', '#ff7a5a', '#4a1a6a', 1), -11.95, 2.2, 4.2, Math.PI / 2); poster(posterTex('E-SPOR', 'Turnuva her hafta', '#2fd6c8', '#2a1a6a', 0), -11.95, 2.2, 0.6, Math.PI / 2); poster(posterTex('GAMING', 'Seviye atla', '#ff3fa4', '#1a2a6a', 2), -11.95, 2.2, -3.3, Math.PI / 2);
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.9), new THREE.MeshBasicMaterial({ map: menuTex(), toneMapped: false })); menu.position.set(-0.75, 2.6, -9.82); this.fg[0].add(menu);
    const buf = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), new THREE.MeshBasicMaterial({ map: signTex('BÜFE', '#ffb347', 160, 52), toneMapped: false })); buf.position.set(-0.75, 3.55, -6.0); this.fg[0].add(buf);
    const ks = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), new THREE.MeshBasicMaterial({ map: signTex('KASA', '#2fd6c8', 160, 52), toneMapped: false })); ks.position.set(-6.5, 2.6, 5.0); ks.rotation.y = Math.PI; this.fg[0].add(ks);
    const vs = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.55), new THREE.MeshBasicMaterial({ map: signTex('VIP', '#e6b84a', 160, 64, 'rgba(8,6,20,0.85)', 'bold 46px sans-serif'), toneMapped: false })); vs.position.set(5.65, 3.2, -0.5); this.fg[0].add(vs);
    const gs = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5), new THREE.MeshBasicMaterial({ map: signTex('GAMING', '#2fd6c8', 192, 56), toneMapped: false })); gs.position.set(-5.5, 2.6, -2.91); this.fg[0].add(gs);
    // spots
    this.spots.register = { id: 'register', floor: 0, x: -6.0, z: 6.1, r: 3.0 }; this.spots.buffet = { id: 'buffet', floor: 0, x: -0.8, z: -6.35, r: 2.8 }; this.spots.admin = { id: 'admin', floor: 0, x: 5.6, z: 9.0, r: 2.5 };
    this.spots.modem = { id: 'modem', floor: 0, x: 8.4, z: 9.5, r: 2.0 }; this.spots.fuse = { id: 'fuse', floor: 0, x: -3.9, z: -9.7, r: 2.1 }; this.spots.door = { id: 'door', floor: 0, x: 0.0, z: 8.4, r: 2.2 };
  }
  buildFloor1() {
    const f = 1, S = this.S[1], GL = this.GL[1];
    [-2.8, -0.3, 2.2, 4.7].forEach((x) => this.makeDesk('racing', f, x, -5.0, 0, -1, 1));
    GL.box(11, 0.03, 0.03, 1, FY[1] + 0.02, -8.3, 0xff5a4a); S.box(11, 0.012, 4.6, 1, FY[1] + 0.008, -6.2, 0x1a1a22);
    [-7.0, -4.6, -2.2, 0.2, 2.6, 5.0].forEach((x) => this.makeDesk('quiet', f, x, 8.5, 0, 1, 1));
    // lounges
    const lounge = (cx: number, cz: number) => {
      const yb = FY[f];
      S.box(2.4, 0.4, 0.9, cx, yb + 0.2, cz + 1.5, 0x6a3a5a); S.box(2.4, 0.5, 0.2, cx, yb + 0.65, cz + 1.9, 0x6a3a5a); S.box(0.2, 0.55, 0.9, cx - 1.1, yb + 0.5, cz + 1.5, 0x5a2a4a); S.box(0.2, 0.55, 0.9, cx + 1.1, yb + 0.5, cz + 1.5, 0x5a2a4a);
      S.box(1.2, 0.05, 0.6, cx, yb + 0.4, cz - 0.5, 0x2a2a3a); S.box(0.06, 0.4, 0.06, cx - 0.5, yb + 0.2, cz - 0.7, 0x2a2a3a); S.box(0.06, 0.4, 0.06, cx + 0.5, yb + 0.2, cz - 0.3, 0x2a2a3a); S.cyl(0.07, 0.1, cx + 0.2, yb + 0.47, cz - 0.5, 0xf2f2f2);
      for (const sx of [-1, 1]) { const ax = cx + sx * 2.5; S.box(0.8, 0.4, 0.8, ax, yb + 0.2, cz, 0x3a5a6a); S.box(0.15, 0.55, 0.8, ax + sx * 0.4, yb + 0.55, cz, 0x3a5a6a); }
      S.box(2.8, 0.012, 2.0, cx, yb + 0.008, cz + 0.5, 0x3a2a5a); GL.box(2.6, 0.02, 0.02, cx, yb + 0.02, cz + 1.0, 0xff9a3f);
      this.colBox(f, cx - 1.2, cx + 1.2, cz + 1.0, cz + 2.0); this.colBox(f, cx - 0.6, cx + 0.6, cz - 0.8, cz - 0.2); this.colBox(f, cx - 3.0, cx - 2.1, cz - 0.4, cz + 0.4); this.colBox(f, cx + 2.1, cx + 3.0, cz - 0.4, cz + 0.4);
      const mk = (x: number, z: number, fx: number, fz: number, ax: number, az: number) => { const s = this.addSeat(f, x, z, fx, fz, 2, 'lounge', null, ax, az); this.loungeSeats.push(s); };
      mk(cx - 0.55, cz + 1.5, 0, -1, cx - 0.55, cz + 0.5); mk(cx + 0.55, cz + 1.5, 0, -1, cx + 0.55, cz + 0.5);
      mk(cx - 2.5, cz, 1, 0, cx - 1.7, cz + 0.9); mk(cx + 2.5, cz, -1, 0, cx + 1.7, cz + 0.9);
    };
    lounge(-3.6, 0.6); lounge(3.8, 0.6);
    // seats' approach: sofa approach from front sides (past the table) set after nav; handled by assignApproach
    // vending & decor
    S.box(0.9, 1.9, 0.7, 11.2, FY[1] + 0.95, 8.8, 0x2a3a6a); GL.box(0.5, 1.2, 0.02, 10.95, FY[1] + 1.1, 8.43, 0x7ae0ff); this.colBox(f, 10.7, 11.7, 8.4, 9.2);
    for (const [px, pz] of [[-11.2, -8.8], [10.8, -8.8], [-8.9, 9.0], [11.2, -4.6]]) { S.cyl(0.25, 0.4, px, FY[1] + 0.2, pz, 0x7a4a3a); S.sph(0.42, px, FY[1] + 0.8, pz, 0x2f8a4a, 1.2); this.colBox(f, px - 0.25, px + 0.25, pz - 0.25, pz + 0.25); }
    S.box(2.0, 0.9, 1.0, -9.0, FY[1] + 0.45, -9.0, 0x3a2c22); S.box(0.1, 0.1, 3, 0, FY[1] + 3.6, -9.8, 0x222);
    const pst = (t: THREE.Texture, x: number, y: number, z: number, ry: number) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), new THREE.MeshLambertMaterial({ map: t })); p.position.set(x, FY[1] + y, z); p.rotation.y = ry; this.fg[1].add(p); };
    pst(posterTex('TURBO', 'Pist rekoru', '#ff5a4a', '#2a1a4a', 1), 8.0, 2.2, -9.83, 0); pst(posterTex('DRIFT', 'Gece yarışı', '#ffb347', '#3a1a6a', 0), -2.0, 2.4, -9.83, 0); pst(posterTex('LOUNGE', 'Dinlen & izle', '#9a86ff', '#1a2a5a', 2), 11.95, 2.2, 0, -Math.PI / 2);
    const rs = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.55), new THREE.MeshBasicMaterial({ map: signTex('YARIŞ ALANI', '#ff5a4a', 256, 64), toneMapped: false })); rs.position.set(1, FY[1] + 3.2, -9.8); this.fg[1].add(rs);
    const ls = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: signTex('SALON', '#ff9a3f', 192, 56), toneMapped: false })); ls.position.set(0, FY[1] + 3.3, 3.2); ls.rotation.y = Math.PI; this.fg[1].add(ls);
  }
  buildFloor2() {
    const f = 2, S = this.S[2], GL = this.GL[2], yb = FY[2];
    [-4, -2, 0, 2, 4].forEach((x) => this.teamA.push(this.makeDesk('esport', f, x, -6.4, 0, 1, 1)));
    [-4, -2, 0, 2, 4].forEach((x) => this.teamB.push(this.makeDesk('esport', f, x, -2.2, 0, -1, 1)));
    // stage
    S.box(13, 0.12, 7.6, 0, yb + 0.06, -5.6, 0x1c1a38); GL.box(13, 0.03, 0.04, 0, yb + 0.13, -1.8, 0xff3fa4); GL.box(13, 0.03, 0.04, 0, yb + 0.13, -9.4, 0x3fa6ff); GL.box(0.04, 0.03, 7.6, -6.5, yb + 0.13, -5.6, 0x2fd6c8); GL.box(0.04, 0.03, 7.6, 6.5, yb + 0.13, -5.6, 0x2fd6c8);
    this.colBox(f, -6.5, 6.5, -9.9, -9.6);
    // big screen
    S.box(8.4, 2.7, 0.2, 0, yb + 2.5, -9.85, 0x101018); const bs = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 2.35), this.screens.mats.big); bs.position.set(0, yb + 2.5, -9.74); this.fg[2].add(bs);
    GL.box(8.5, 0.05, 0.05, 0, yb + 3.88, -9.7, 0xff3fa4); GL.box(8.5, 0.05, 0.05, 0, yb + 1.12, -9.7, 0x2fd6c8);
    // audience (chairs as obstacles)
    const rows = [1.4, 3.2, 5.0]; const xs = [-4.9, -3.5, -2.1, -0.7, 0.7, 2.1, 3.5, 4.9];
    rows.forEach((z) => xs.forEach((x) => {
      const ch = this.makeChair(f, x, z, Math.PI, 'aud', 0xd94f6a); const s = this.addSeat(f, x, z, 0, -1, 0, 'audience', ch, x, z + 0.9); this.audience.push(s); this.colBox(f, x - 0.25, x + 0.25, z - 0.25, z + 0.25);
    }));
    // console
    S.box(1.6, 1.0, 1.2, 10.6, yb + 0.5, -5.4, 0x24243a); S.box(1.7, 0.05, 1.3, 10.6, yb + 1.02, -5.4, 0x15151c); GL.box(1.6, 0.04, 0.03, 9.78, yb + 0.7, -5.4, 0xff3fa4); this.colBox(f, 9.8, 11.4, -6.0, -4.8);
    S.box(0.04, 0.4, 0.7, 10.3, yb + 1.3, -5.4, 0x101018, 0, 0, -0.2); const cs = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.34), this.screens.mats.big); cs.position.set(10.27, yb + 1.3, -5.4); cs.rotation.y = -Math.PI / 2 - 0.0; cs.rotation.y = -Math.PI / 2; this.fg[2].add(cs);
    const ts = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ map: signTex('TURNUVA MASASI', '#ff3fa4', 256, 56, 'rgba(8,6,20,0.85)', 'bold 30px sans-serif'), toneMapped: false })); ts.position.set(11.9, yb + 2.2, -5.4); ts.rotation.y = -Math.PI / 2; this.fg[2].add(ts);
    for (const [px, pz] of [[-11.2, 8.8], [11.2, 8.8], [11.2, -8.8]]) { S.cyl(0.25, 0.4, px, yb + 0.2, pz, 0x7a4a3a); S.sph(0.42, px, yb + 0.8, pz, 0x2f8a4a, 1.2); this.colBox(f, px - 0.25, px + 0.25, pz - 0.25, pz + 0.25); }
    // banners
    for (const bx of [-6, -2, 2, 6]) { const bn = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), new THREE.MeshLambertMaterial({ map: posterTex('TAKIM', 'NK ARENA', ['#ff3fa4', '#2fd6c8', '#ffb347', '#9a86ff'][(bx + 6) / 4 | 0], '#14102a', 2) })); bn.position.set(bx, yb + 2.6, 9.85); bn.rotation.y = Math.PI; this.fg[2].add(bn); }
    const es = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.55), new THREE.MeshBasicMaterial({ map: signTex('E-SPOR ARENA', '#ff3fa4', 320, 64), toneMapped: false })); es.position.set(0, yb + 3.65, 9.8); es.rotation.y = Math.PI; this.fg[2].add(es);
    this.spots.console = { id: 'console', floor: 2, x: 10.5, z: -5.4, r: 2.8 };
  }
  buildLightsAndSigns() {
    const lc = [0xffe6c0, 0xd8e8ff, 0xffd8ee];
    for (let f = 0; f < 3; f++) for (const [x, z] of [[-6, -3], [6, -3], [-6, 5], [6, 5]]) { const l = new THREE.PointLight(lc[f], 14, 17, 1.6); l.position.set(x, FY[f] + 3.4, z); this.fg[f].add(l); this.lights[f].push(l); }
    // front exterior neon sign + shutter + doors
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 1.15), new THREE.MeshBasicMaterial({ map: signTex('NET KAFE', '#ff3fa4', 512, 100, 'rgba(10,6,24,0.95)', 'bold 70px sans-serif'), toneMapped: false })); sign.position.set(0, 4.0 + 0.0, 10.45); this.fg[0].add(sign); this.signMain = sign;
    const sub = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.4), new THREE.MeshBasicMaterial({ map: signTex('İNTERNET • OYUN • BÜFE', '#2fd6c8', 512, 64, 'rgba(10,6,24,0.95)', 'bold 30px sans-serif'), toneMapped: false })); sub.position.set(0, 3.4, 10.4); this.fg[0].add(sub);
    this.signOpenTex = [signTex('AÇIK', '#3dff7a', 128, 56), signTex('KAPALI', '#ff5a4a', 128, 56)];
    this.signOpen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.4), new THREE.MeshBasicMaterial({ map: this.signOpenTex[1], toneMapped: false })); this.signOpen.position.set(-2.1, 1.9, 10.32); this.fg[0].add(this.signOpen);
    const dm = new THREE.MeshLambertMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    this.doorL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.9, 0.05), dm); this.doorR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.9, 0.05), dm); this.doorL.position.set(-0.8, 1.45, 10.15); this.doorR.position.set(0.8, 1.45, 10.15); this.fg[0].add(this.doorL, this.doorR);
    this.shutterG = new THREE.Group(); this.shutterG.position.set(0, 3.05, 10.4); this.fg[0].add(this.shutterG);
    const st = canvasTex(64, 128, (x) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#6a6a76' : '#7c7c8a'; x.fillRect(0, i * 8, 64, 8); } }, false);
    const sm = new THREE.Mesh(new THREE.BoxGeometry(3.7, 3.05, 0.08), new THREE.MeshLambertMaterial({ map: st })); sm.position.y = -1.525; this.shutterG.add(sm);
    this.shutterG.scale.y = 0.02; this.shutterG.visible = false;
    // glow pools
    const gp = (x: number, z: number, c: number, s: number, f = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: this.glowTexture, color: c, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, FY[f] + 0.03, z); this.fg[f].add(m); };
    gp(-5.5, -2.9, 0x2fd6c8, 7); gp(5.6, -0.5, 0xe6b84a, 7); gp(-6.5, 6.4, 0xff3fa4, 5); gp(-0.8, -5.7, 0xffb347, 5); gp(1, -6.0, 0xff5a4a, 9, 1); gp(0, -5.6, 0xff3fa4, 12, 2); gp(0, 0, 0xff3fa4, 6, 2); gp(-3.6, 1.4, 0xff9a3f, 6, 1); gp(3.8, 1.4, 0xff9a3f, 6, 1);
    // light shafts near windows ground floor + dust
  }

  assignApproach() {
    // ensure every seat's approach point is walkable on the nav grid
    for (const s of this.seats) {
      const nav = this.navs[s.floor];
      if (nav.isBlocked(s.ax, s.az)) {
        const cands: [number, number][] = [];
        for (const d of [0.9, 1.1, 0.7, 1.3]) { cands.push([s.x + s.fz * d, s.z - s.fx * d], [s.x - s.fz * d, s.z + s.fx * d], [s.x - s.fx * d, s.z - s.fz * d], [s.x + s.fx * d, s.z + s.fz * d]); }
        for (const c of cands) if (!nav.isBlocked(c[0], c[1])) { s.ax = c[0]; s.az = c[1]; break; }
      }
      if (s.desk) { const d = s.desk; d.service = { x: s.ax, z: s.az }; }
    }
  }

  /* ---------------- runtime ---------------- */
  setFloorVisible(f: number, v: boolean) { this.fg[f].visible = v; }
  groundY(x: number, z: number) { return (z > 13.5 && z < 22) ? -0.08 : 0; }
  updateStairsFor(c: { x: number; z: number; y: number; floor: number; onStair: boolean; stairId?: string }) {
    for (const st of this.stairs) {
      const inX = c.x >= st.x0 && c.x <= st.x1;
      if (!c.onStair && inX) {
        if (c.floor === st.lower && c.z < st.zBot - 0.05 && c.z > 6.2 && Math.abs(c.y - FY[st.lower]) < 0.35) { c.onStair = true; c.stairId = st.id; }
        else if (c.floor === st.lower + 1 && c.z > st.zTop + 0.02 && c.z < st.zTop + 1.2 && Math.abs(c.y - FY[st.lower + 1]) < 0.35) { c.onStair = true; c.stairId = st.id; c.floor = st.lower; }
      }
      if (c.onStair && c.stairId === st.id) {
        const t = clamp((st.zBot - c.z) / (st.zBot - st.zTop), 0, 1); c.y = FY[st.lower] + FH * t;
        if (c.z <= st.zTop) { c.floor = st.lower + 1; c.onStair = false; c.y = FY[st.lower + 1]; }
        else if (c.z >= st.zBot) { c.onStair = false; c.y = FY[st.lower]; }
      }
    }
  }
  floorOfY(y: number) { return y > 6.6 ? 2 : y > 2.2 ? 1 : 0; }

  update(t: number, dt: number, st: { open: boolean; night: number; doorNear: boolean; power: boolean; lag: boolean }) {
    for (const f of this.fans) f.rotation.z -= dt * (st.power ? 14 : 0);
    const h = (t * 0.15) % 1;
    for (let i = 0; i < 4; i++) this.rgb[i].color.setHSL((h + i * 0.22) % 1, 1, st.power ? 0.55 : 0.04);
    this.elev.update(dt);
    const e = this.elev, cx = -6.6;
    this.elevCar.position.y = e.y; for (const d of this.carDoors) d.position.x = cx + (d.position.x > cx ? 1 : -1) * (0.76 + 0.7 * e.door);
    for (let f = 0; f < 3; f++) { const open = e.floor === f && !e.moving ? e.door : 0; this.elevDoors[f][0].position.x = cx - 0.78 - 0.72 * open; this.elevDoors[f][1].position.x = cx + 0.78 + 0.72 * open; (this.elevLed[f].material as THREE.MeshBasicMaterial).color.setHex(e.queue.includes(f) || (e.floor === f && e.state !== 'closed') ? 0xffb347 : 0x3dff7a); }
    // door slide & shutter
    this.doorOpen = clamp(this.doorOpen + (st.doorNear && this.shutterAmt < 0.5 ? dt * 2.6 : -dt * 2), 0, 1);
    this.doorL.position.x = -0.8 - 1.5 * this.doorOpen; this.doorR.position.x = 0.8 + 1.5 * this.doorOpen;
    this.shutterAmt += clamp(this.shutterTarget - this.shutterAmt, -dt * 0.7, dt * 0.7); const closedK = this.shutterAmt;
    this.shutterG.visible = closedK > 0.03; this.shutterG.scale.y = Math.max(0.02, closedK);
    // neon flicker
    const fl = Math.sin(t * 17) > 0.97 || Math.sin(t * 3.3) > 0.995; (this.signMain.material as THREE.MeshBasicMaterial).color.setScalar(fl ? 0.35 : st.power ? 1 : 0.15);
    (this.signOpen.material as THREE.MeshBasicMaterial).map = this.signOpenTex[st.open ? 0 : 1];
    for (let i = 0; i < this.modemLeds.length; i++) { const m = this.modemLeds[i].material as THREE.MeshBasicMaterial; const on = Math.sin(t * (6 + i * 2.1) + i) > -0.2; m.color.setHex(!st.power ? 0x111111 : st.lag ? (on ? 0xff3a3a : 0x330000) : (on ? 0x3dff7a : 0x063a14)); }
    for (let f = 0; f < 3; f++) for (const l of this.lights[f]) l.intensity = st.power ? 14 : 2.5;
    this.glowMat.color.setScalar(st.power ? 1 : 0.35);
  }
}
const screens = (w: World, k: ScreenKind) => w.screens.mats[k];
export function setDeskScreen(d: Desk, w: World, kind: ScreenKind) { if (d.kind === kind) return; d.kind = kind; d.screen.material = w.screens.mats[kind]; }
