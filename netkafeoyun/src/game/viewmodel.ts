import * as THREE from 'three';
import { clamp, damp } from './data';
import { ik2 } from './rig';

const V = THREE.Vector3;
const Z = new V(0, 0, 1);
const SKIN = 0xe2ab80, SLEEVE = 0x23274a;

export type VMMode = 'idle' | 'tray' | 'work' | 'clean' | 'type' | 'cook' | 'hold';
export interface VMIn { speed: number; sprint: boolean; t: number; mode: VMMode; reach: number; tiltX: number; tiltZ: number; trayItems: number; bob: number; }

interface Arm { sh: THREE.Vector3; upper: THREE.Group; fore: THREE.Group; fingers: THREE.Group[][]; thumb: THREE.Group; cur: THREE.Vector3; side: number; curl: number; }
export class ViewModel {
  scene = new THREE.Scene(); root = new THREE.Group(); arms: Arm[] = []; tray = new THREE.Group(); trayItems: THREE.Object3D[] = []; wrench = new THREE.Group(); cloth!: THREE.Mesh; trayTiltX = 0; trayTiltZ = 0; vx = 0; vz = 0;
  private _e = new V(); private _h = new V(); private _p = new V(); private _d = new V();
  constructor() {
    this.scene.add(this.root); this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6a90, 1.9)); const dl = new THREE.DirectionalLight(0xfff0e0, 1.4); dl.position.set(-1, 2, 1); this.scene.add(dl);
    const skin = new THREE.MeshLambertMaterial({ color: SKIN }), slv = new THREE.MeshLambertMaterial({ color: SLEEVE }), cuff = new THREE.MeshLambertMaterial({ color: 0xff3fa4 });
    for (const side of [-1, 1]) {
      const upper = new THREE.Group(), fore = new THREE.Group(); this.root.add(upper, fore);
      const um = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 1, 4, 10).rotateX(Math.PI / 2).translate(0, 0, 0.5), slv); upper.add(um); (upper as any).m = um;
      const fm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 1, 4, 10).rotateX(Math.PI / 2).translate(0, 0, 0.5), slv); fore.add(fm); (fore as any).m = fm;
      const cf = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.025, 12).rotateX(Math.PI / 2), cuff); cf.position.z = 0.07; fore.add(cf);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.032, 0.09), skin); palm.position.set(0, 0, -0.03); fore.add(palm);
      const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), skin); wrist.position.z = 0.01; fore.add(wrist);
      const fingers: THREE.Group[][] = [];
      for (let i = 0; i < 4; i++) {
        const k = new THREE.Group(); k.position.set((i - 1.5) * 0.021, 0, -0.075); fore.add(k);
        const f1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.03, 3, 6).rotateX(Math.PI / 2).translate(0, 0, -0.02), skin); k.add(f1);
        const m = new THREE.Group(); m.position.z = -0.045; k.add(m); const f2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.026, 3, 6).rotateX(Math.PI / 2).translate(0, 0, -0.018), skin); m.add(f2);
        fingers.push([k, m]);
      }
      const th = new THREE.Group(); th.position.set(-side * 0.045, 0, -0.03); th.rotation.y = side * 0.5; fore.add(th); const tm = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.04, 3, 6).rotateX(Math.PI / 2).translate(0, 0, -0.03), skin); th.add(tm);
      this.arms.push({ sh: new V(side * 0.3, -0.42, 0.18), upper, fore, fingers, thumb: th, cur: new V(side * 0.22, -0.3, -0.4), side, curl: 0.3 });
    }
    // tray
    const tm = new THREE.MeshLambertMaterial({ color: 0xc4cad6 }); this.tray.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24), tm));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.008, 6, 24).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8e96a6 })); rim.position.y = 0.01; this.tray.add(rim);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.09, 12), new THREE.MeshLambertMaterial({ color: 0xf5f5f5 })); cup.position.set(-0.08, 0.055, 0.02); this.tray.add(cup);
    const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 12), new THREE.MeshLambertMaterial({ color: 0x8a3a1a })); tea.position.set(-0.08, 0.1, 0.02); this.tray.add(tea);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.014, 14), new THREE.MeshLambertMaterial({ color: 0xe8d9a0 })); pl.position.set(0.07, 0.02, -0.03); this.tray.add(pl);
    const fd = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.07), new THREE.MeshLambertMaterial({ color: 0xc9843a })); fd.position.set(0.07, 0.05, -0.03); this.tray.add(fd);
    const cup2 = cup.clone(); cup2.position.set(0.0, 0.055, 0.09); this.tray.add(cup2); this.trayItems = [cup, tea, pl, fd, cup2];
    this.root.add(this.tray); this.tray.visible = false;
    // wrench
    const wm = new THREE.MeshLambertMaterial({ color: 0xb0b6c4 }); const wh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.26), wm); wh.position.z = -0.09; this.wrench.add(wh);
    const wr = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12), wm); wr.position.z = -0.24; this.wrench.add(wr); this.wrench.visible = false; this.root.add(this.wrench);
    this.cloth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.16), new THREE.MeshLambertMaterial({ color: 0x3aa6e8 })); this.cloth.visible = false; this.root.add(this.cloth);
  }
  private aim(g: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, roll = 0) {
    this._d.subVectors(to, from); const len = this._d.length(); this._d.normalize(); g.position.copy(from); g.quaternion.setFromUnitVectors(Z, this._d);
    if (roll) g.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(Z, roll)); return len;
  }
  update(dt: number, i: VMIn) {
    const t = i.t, bob = i.bob, sw = Math.min(1, i.speed / 3);
    const L = this.arms[0], R = this.arms[1]; const tl = new V(), tr = new V(); let curlL = 0.35, curlR = 0.35;
    const idleY = -0.3 + Math.sin(t * 1.7) * 0.004;
    const bx = Math.sin(bob) * 0.012 * sw, by = Math.abs(Math.cos(bob)) * 0.016 * sw;
    const sp = i.sprint ? 1 : 0;
    tl.set(-0.2 + bx - sp * 0.02, idleY + by - sp * 0.04, -0.42 - sp * 0.08); tr.set(0.2 - bx + sp * 0.02, idleY - by * 0.2 - sp * 0.04, -0.42 - sp * 0.08);
    let rollL = 0.1, rollR = -0.1;
    this.tray.visible = false; this.wrench.visible = false; this.cloth.visible = false;
    switch (i.mode) {
      case 'tray': {
        tl.set(-0.2, -0.3 + by * 0.5, -0.5); tr.set(0.2, -0.3 + by * 0.5, -0.5); curlL = curlR = 0.65; this.tray.visible = true; rollL = 0.25; rollR = -0.25; break;
      }
      case 'work': {
        const w = Math.sin(t * 12); tr.set(0.1 + w * 0.012, -0.12 + Math.abs(w) * 0.012, -0.58); tl.set(-0.14, -0.2, -0.52); curlR = 0.7; curlL = 0.5; this.wrench.visible = true; rollR = -0.5 + w * 0.15; break;
      }
      case 'clean': {
        const w = Math.sin(t * 7); tr.set(0.05 + w * 0.12, -0.26, -0.56); tl.set(-0.1 + w * 0.12, -0.26, -0.56); curlL = curlR = 0.6; this.cloth.visible = true; break;
      }
      case 'type': { const w = Math.sin(t * 14) * 0.01; tl.set(-0.14, -0.27 + Math.abs(w), -0.5); tr.set(0.14, -0.27 + Math.abs(Math.sin(t * 11 + 1)) * 0.01, -0.5); curlL = curlR = 0.5; break; }
      case 'cook': { const w = Math.sin(t * 9); tr.set(0.1, -0.2 + Math.abs(w) * 0.04, -0.52 - w * 0.03); tl.set(-0.12, -0.24, -0.5); curlL = curlR = 0.6; break; }
      case 'hold': { tl.set(-0.18, -0.25, -0.5); tr.set(0.18, -0.25, -0.5); curlL = curlR = 0.6; break; }
      default: break;
    }
    if (i.reach > 0) { const k = Math.sin(clamp(i.reach, 0, 1) * Math.PI); tr.lerp(new V(0.06, -0.06, -0.78), k); curlR = 0.35 * (1 - k) + 0.05 * k; rollR += k * 0.3; }
    const targets = [tl, tr], curls = [curlL, curlR], rolls = [rollL, rollR];
    for (let n = 0; n < 2; n++) {
      const a = this.arms[n]; a.cur.x = damp(a.cur.x, targets[n].x, 14, dt); a.cur.y = damp(a.cur.y, targets[n].y, 14, dt); a.cur.z = damp(a.cur.z, targets[n].z, 14, dt);
      a.curl = damp(a.curl, curls[n], 12, dt);
      ik2(a.sh, a.cur, 0.34, 0.34, this._p.set(a.side * 0.6, -1, 0.2), this._e, this._h);
      const lu = this.aim(a.upper, this._e, a.sh); (a.upper as any).m.scale.z = lu; // upper: from elbow toward shoulder
      const lf = this.aim(a.fore, this._h, this._e, rolls[n] * a.side * -1); (a.fore as any).m.scale.z = lf;
      for (const f of a.fingers) { f[0].rotation.x = -a.curl * 1.1; f[1].rotation.x = -a.curl * 1.2; }
      a.thumb.rotation.x = -a.curl * 0.5;
    }
    // tray follows between hands with spring tilt
    this.vx = damp(this.vx, i.tiltX, 6, dt); this.vz = damp(this.vz, i.tiltZ, 6, dt);
    this.trayTiltX += (this.vx * 0.5 - this.trayTiltX) * Math.min(1, dt * 8); this.trayTiltZ += (this.vz * 0.5 - this.trayTiltZ) * Math.min(1, dt * 8);
    const mid = this._d.addVectors(L.cur, R.cur).multiplyScalar(0.5); this.tray.position.set(mid.x, mid.y + 0.03, mid.z - 0.02); this.tray.rotation.set(this.trayTiltX + Math.sin(bob * 2) * 0.01 * sw, 0, this.trayTiltZ + Math.cos(bob) * 0.015 * sw);
    this.trayItems.forEach((o, k) => { o.position.y += Math.sin(t * 5 + k) * 0.0 + (this.trayTiltX * 0.0); o.visible = k < 3 || i.trayItems > 1; });
    this.wrench.position.copy(R.cur).add(this._p.set(0, 0.02, -0.02)); this.wrench.rotation.set(0.1, 0, Math.sin(t * 12) * 0.2);
    this.cloth.position.set((L.cur.x + R.cur.x) / 2, (L.cur.y + R.cur.y) / 2 - 0.045, (L.cur.z + R.cur.z) / 2 - 0.02);
  }
  sync(cam: THREE.Camera) { this.root.position.copy(cam.position); this.root.quaternion.copy(cam.quaternion); this.root.updateMatrixWorld(true); }
}
