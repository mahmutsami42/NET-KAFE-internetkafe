import * as THREE from 'three';
import { Rig, Look, randomLook } from './rig';
import { resolveBoxes, P2 } from './nav';
import { angDiff, clamp, damp, rnd, pick, smooth, FY, PERSONA, Persona, MENU, DESK_INFO, Job, randName, DeskType, rint } from './data';
import type { Seat, Desk } from './world';

export type Step = { t: 'walk'; floor: number; x: number; z: number; free?: boolean; run?: boolean } | { t: 'stair'; id: string; up: boolean } | { t: 'elev'; from: number; to: number };
type G = any;

const bubbleCache: Record<string, THREE.SpriteMaterial> = {};
function bubbleMat(icon: string, bg: string) {
  const k = icon + bg; if (bubbleCache[k]) return bubbleCache[k];
  const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d')!;
  x.fillStyle = bg; x.beginPath(); x.arc(48, 46, 38, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 5; x.stroke();
  x.beginPath(); x.moveTo(36, 78); x.lineTo(48, 94); x.lineTo(60, 78); x.fillStyle = bg; x.fill();
  x.font = '44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(icon, 48, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (bubbleCache[k] = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
}
const barTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4); return new THREE.CanvasTexture(c); })();

export class Char {
  rig: Rig; x = 0; y = 0; z = 0; yaw = 0; floor = 0; onStair = false; stairId = ''; v = 0; radius = 0.3;
  route: Step[] = []; wp: P2[] | null = null; wpI = 0; walkSpeed = 1.45; runMode = false; stuckT = 0; lastX = 0; lastZ = 0; failCount = 0;
  seat: Seat | null = null; sitPhase: 'none' | 'in' | 'seated' | 'out' = 'none'; sitT = 0; sitFrom = { x: 0, z: 0 };
  ev = 0; evT = 0; evSlot: P2 | null = null; evHeld = false; inElev = false;
  bubble: THREE.Sprite | null = null; bar: THREE.Sprite | null = null; bubbleKey = ''; faceTo: { x: number; z: number } | null = null; turnRate = 0;
  heading = 0; removed = false; visibleNow = true; animAcc = 0; kind = 'char'; lookTarget: THREE.Vector3 | null = null; stepVol = 1; arrived = true; frozen = false; speedMul = 1;
  constructor(public g: G, look: Look) {
    this.rig = new Rig(look); this.g.scene.add(this.rig.root);
  }
  get pos() { return this as any; }
  place(floor: number, x: number, z: number, yaw = 0) { this.floor = floor; this.x = x; this.z = z; this.y = floor === 0 ? this.g.world.groundY(x, z) : FY[floor]; this.yaw = yaw; this.syncRoot(); }
  syncRoot() { this.rig.root.position.set(this.x, this.y, this.z); this.rig.root.rotation.y = this.yaw; }
  setRoute(steps: Step[]) { this.route = steps; this.wp = null; this.wpI = 0; this.ev = 0; this.arrived = steps.length === 0; this.stuckT = 0; this.failCount = 0; }
  get busyMoving() { return this.route.length > 0; }
  setBubble(icon: string | null, frac = 1, bg = '#2a2a52', barCol = 0x3dff7a) {
    if (!icon) { if (this.bubble) { this.bubble.visible = false; this.bar!.visible = false; } this.bubbleKey = ''; return; }
    if (!this.bubble) {
      this.bubble = new THREE.Sprite(bubbleMat(icon, bg)); this.bubble.scale.set(0.5, 0.5, 1); this.bubble.position.set(0, 2.3, 0); this.bubble.renderOrder = 10; this.rig.root.add(this.bubble);
      this.bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, color: 0x3dff7a, transparent: true, depthTest: false })); this.bar.center.set(0, 0.5); this.bar.position.set(-0.22, 2.0, 0); this.bar.renderOrder = 11; this.rig.root.add(this.bar);
    }
    const k = icon + bg; if (k !== this.bubbleKey) { this.bubble.material = bubbleMat(icon, bg); this.bubbleKey = k; }
    this.bubble.visible = true; this.bar!.visible = true; this.bar!.scale.set(Math.max(0.001, 0.44 * clamp(frac, 0, 1)), 0.055, 1); (this.bar!.material as THREE.SpriteMaterial).color.setHex(barCol);
  }
  sitDown(seat: Seat) {
    this.seat = seat; seat.occupant = this; this.sitPhase = 'in'; this.sitT = 0; this.sitFrom = { x: this.x, z: this.z }; this.route = []; this.rig.sitStyle = seat.style; this.v = 0;
  }
  standUp() { if (this.seat && this.sitPhase === 'seated') { this.sitPhase = 'out'; this.sitT = 1; this.rig.sitStyle = this.seat.style; } }
  get seated() { return this.sitPhase === 'seated'; }
  get sitting() { return this.sitPhase !== 'none'; }

  /** compute y/floor from position */
  updateLevel() {
    const w = this.g.world, e = w.elev;
    const inShaft = this.x > -8.2 && this.x < -5.0 && this.z < -7.0 && this.z > -10;
    if (inShaft && (this.inElev || Math.abs(this.y - e.y) < 0.6 || e.moving)) {
      if (!this.inElev && Math.abs(this.y - e.y) < 0.6) this.inElev = true;
      if (this.inElev) { this.y = e.y; this.floor = Math.round(e.y / 4.4); this.onStair = false; return; }
    } else this.inElev = false;
    if (this.onStair) { w.updateStairsFor(this); return; }
    w.updateStairsFor(this);
    if (!this.onStair) this.y = this.floor === 0 ? w.groundY(this.x, this.z) : FY[this.floor];
  }
  collide() {
    const nav = this.g.world.navs[this.floor]; const p = { x: this.x, z: this.z };
    resolveBoxes(nav.boxes, p, this.radius, this.onStair);
    if (this.floor === 0 && this.z > 13) resolveBoxes(this.g.street.carBoxes, p, this.radius);
    this.x = p.x; this.z = p.z;
  }
  separate(others: Char[]) {
    for (const o of others) {
      if (o === this || o.removed || o.floor !== this.floor || Math.abs(o.y - this.y) > 1.5) continue;
      if (this.sitting && o.sitting) continue;
      const dx = this.x - o.x, dz = this.z - o.z; const d2 = dx * dx + dz * dz; const R = 0.58;
      if (d2 >= R * R || d2 < 1e-6) { if (d2 < 1e-6) { this.x += rnd(-0.02, 0.02); } continue; }
      const d = Math.sqrt(d2), push = (R - d); let wThis = 0.5, wO = 0.5;
      if (this.sitting || this.frozen) { wThis = 0; wO = 1; } else if (o.sitting || o.frozen) { wThis = 1; wO = 0; }
      if (o.kind === 'player') { wThis = 1; wO = 0; }
      this.x += (dx / d) * push * wThis; this.z += (dz / d) * push * wThis; o.x -= (dx / d) * push * wO; o.z -= (dz / d) * push * wO;
    }
  }
  avoidAdjust(hx: number, hz: number, others: Char[]) {
    let adj = 0;
    for (const o of others) {
      if (o === this || o.removed || o.floor !== this.floor || Math.abs(o.y - this.y) > 1.5 || o.sitting) continue;
      const dx = o.x - this.x, dz = o.z - this.z; const d = Math.hypot(dx, dz); if (d > 1.7 || d < 0.01) continue;
      const dot = (dx * hx + dz * hz) / d; if (dot < 0.4) continue;
      const cross = hx * dz - hz * dx; adj += (cross > 0 ? -1 : 1) * (1.7 - d) * 0.65 * dot;
    }
    return clamp(adj, -1.0, 1.0);
  }
  /** follow current route; returns desired heading dir & speed */
  update(dt: number, others: Char[]) {
    if (this.sitPhase !== 'none') { this.updateSit(dt); this.syncRoot(); this.animate(dt); return; }
    if (this.frozen) { this.v = damp(this.v, 0, 10, dt); this.rig.speed = this.v; this.updateLevel(); this.syncRoot(); this.animate(dt); return; }
    let hx = 0, hz = 0, speed = 0; const step = this.route[0]; let final = false;
    const nav = this.g.world.navs[this.floor];
    if (step) {
      if (step.t === 'walk') {
        if (step.floor !== this.floor && !this.onStair && !this.inElev) { this.route.shift(); }
        else {
          if (!this.wp) {
            if (step.free) this.wp = [{ x: step.x, z: step.z }];
            else { this.wp = nav.path(this.x, this.z, step.x, step.z); }
            if (!this.wp) { this.failCount++; this.route.shift(); this.arrived = this.route.length === 0; if (this.failCount > 2) this.route = []; this.wpI = 0; }
            this.wpI = 0;
          }
          if (this.wp) {
            const t = this.wp[this.wpI]; const dx = t.x - this.x, dz = t.z - this.z; const d = Math.hypot(dx, dz);
            const last = this.wpI === this.wp.length - 1; const nx = this.route[1]; const tol = last ? (nx && nx.t !== 'walk' ? 0.8 : 0.18) : 0.35;
            if (d < tol) { this.wpI++; if (this.wpI >= this.wp.length) { this.route.shift(); this.wp = null; this.arrived = this.route.length === 0; } }
            else { hx = dx / d; hz = dz / d; speed = (step.run || this.runMode) ? this.walkSpeed * 2.9 : this.walkSpeed; final = last && this.route.length === 1; if (final && d < 0.9) speed *= clamp(d / 0.9, 0.3, 1); }
          }
        }
      } else if (step.t === 'stair') {
        const st = this.g.world.stairs.find((s: any) => s.id === step.id)!;
        const tz = step.up ? st.zTop - 1.0 : st.zBot + 1.0;
        const done = step.up ? (this.floor === st.lower + 1 && !this.onStair && this.z < st.zTop - 0.4) : (this.floor === st.lower && !this.onStair && this.z > st.zBot + 0.4);
        if (done) { this.route.shift(); this.wp = null; this.arrived = this.route.length === 0; }
        else { const tx = st.cx; const dx = tx - this.x, dz = tz - this.z; const d = Math.hypot(dx, dz) + 1e-6; hx = dx / d; hz = dz / d; speed = (this.runMode ? this.walkSpeed * 2.4 : this.walkSpeed * 0.9); if (this.onStair || Math.abs(this.x - tx) < 0.5) { hx = Math.abs(this.x - tx) < 0.15 ? 0 : hx * 0.5; hz = Math.sign(dz) * Math.sqrt(Math.max(0.01, 1 - hx * hx)); } }
      } else if (step.t === 'elev') {
        ({ hx, hz, speed } = this.elevStep(step, dt));
      }
    }
    // steering
    const speedBefore = this.v;
    if (speed > 0) {
      let target = Math.atan2(hx, hz); const adj = this.avoidAdjust(hx, hz, others); target += adj;
      const err = angDiff(this.yaw, target); const rate = 9; const dy = clamp(err, -rate * dt, rate * dt); this.yaw += dy; this.turnRate = dy / Math.max(dt, 1e-4);
      const align = clamp(1 - Math.abs(err) / 1.5, 0.05, 1); const want = speed * align * this.speedMul;
      this.v += clamp(want - this.v, -9 * dt, 5 * dt);
    } else {
      this.v += clamp(0 - this.v, -9 * dt, 5 * dt); this.turnRate *= 0.8;
      if (this.faceTo && this.v < 0.3) { const t = Math.atan2(this.faceTo.x - this.x, this.faceTo.z - this.z); const err = angDiff(this.yaw, t); const dy = clamp(err, -6 * dt, 6 * dt); this.yaw += dy; this.turnRate = dy / Math.max(dt, 1e-4); }
    }
    void speedBefore;
    if (this.v > 0.01) { this.x += Math.sin(this.yaw) * this.v * dt; this.z += Math.cos(this.yaw) * this.v * dt; }
    this.collide(); this.separate(others); this.collide(); this.updateLevel();
    // stuck detection
    if (step && speed > 0) { const moved = Math.hypot(this.x - this.lastX, this.z - this.lastZ); if (moved < 0.15 * dt * 60 * 0.02) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt); if (this.stuckT > 2.5 && step.t === 'walk') { this.stuckT = 0; this.wp = null; this.failCount++; if (this.failCount > 4) { this.route.shift(); this.failCount = 0; } } }
    this.lastX = this.x; this.lastZ = this.z;
    this.syncRoot(); this.animate(dt);
  }
  elevStep(step: { from: number; to: number }, dt: number) {
    const e = this.g.world.elev; let hx = 0, hz = 0, speed = 0; this.evT += dt;
    const goto = (x: number, z: number, sp = this.walkSpeed) => { const dx = x - this.x, dz = z - this.z; const d = Math.hypot(dx, dz); if (d < 0.2) return true; hx = dx / d; hz = dz / d; speed = sp * clamp(d / 0.8 + 0.3, 0.3, 1); return false; };
    const release = () => { if (this.evHeld) { e.hold = Math.max(0, e.hold - 1); this.evHeld = false; } };
    const abort = () => { release(); this.route = []; this.arrived = true; this.ev = 0; (this as any).onRouteFail?.(); };
    if (this.ev === 0) { e.call(step.from); this.ev = 1; this.evT = 0; this.faceTo = { x: -6.6, z: -9 }; }
    if (this.ev === 1) {
      speed = 0; if (e.isOpen(step.from)) { this.ev = 2; this.evT = 0; this.evSlot = pick([{ x: -7.4, z: -9.0 }, { x: -6.6, z: -8.2 }, { x: -5.8, z: -9.0 }, { x: -6.6, z: -9.2 }]); e.hold++; this.evHeld = true; this.faceTo = null; }
      else if (this.evT > 5 && this.evT % 6 < dt) e.call(step.from);
      if (this.evT > 70) abort();
    } else if (this.ev === 2) {
      if (goto(this.evSlot!.x, this.evSlot!.z, this.walkSpeed * 0.9)) { this.ev = 3; this.evT = 0; release(); e.call(step.to); this.faceTo = { x: -6.6, z: -5 }; }
      if (this.evT > 14) abort();
    } else if (this.ev === 3) {
      speed = 0; if (e.floor === step.to && e.isOpen(step.to) && this.inElev) { this.ev = 4; this.evT = 0; e.hold++; this.evHeld = true; this.faceTo = null; }
      else if (this.evT > 60) abort();
    } else if (this.ev === 4) {
      if (goto(-6.6 + rnd(-0.3, 0.3) * 0, -5.3, this.walkSpeed)) { release(); this.route.shift(); this.wp = null; this.ev = 0; this.arrived = this.route.length === 0; }
      if (this.evT > 14) abort();
    }
    return { hx, hz, speed };
  }
  updateSit(dt: number) {
    const s = this.seat!; const rig = this.rig;
    if (this.sitPhase === 'in') {
      this.sitT = Math.min(1, this.sitT + dt / 1.5); const t = smooth(this.sitT);
      this.x = this.sitFrom.x + (s.x - this.sitFrom.x) * smooth((this.sitT - 0.15) / 0.85); this.z = this.sitFrom.z + (s.z - this.sitFrom.z) * smooth((this.sitT - 0.15) / 0.85);
      const err = angDiff(this.yaw, s.yaw); this.yaw += clamp(err, -7 * dt, 7 * dt) * (this.sitT > 0.1 ? 1 : 0.2);
      rig.sitK = smooth((this.sitT - 0.3) / 0.7); this.v = 0; rig.speed = 0.0; if (this.sitT < 0.75) rig.speed = 0.0;
      this.chairPull(Math.sin(Math.min(1, this.sitT * 1.1) * Math.PI) * 0.9 * (1 - t * 0.2));
      if (this.sitT >= 1) { this.sitPhase = 'seated'; this.x = s.x; this.z = s.z; this.yaw = s.yaw; rig.sitK = 1; this.chairPull(0); this.onSeated(); }
    } else if (this.sitPhase === 'out') {
      this.sitT = Math.max(0, this.sitT - dt / 1.3); const k = smooth((this.sitT) / 1);
      const q = smooth((1 - this.sitT - 0.15) / 0.85);
      this.x = s.x + (s.ax - s.x) * q; this.z = s.z + (s.az - s.z) * q; rig.sitK = smooth((this.sitT - 0.2) / 0.8); void k; rig.speed = 0; this.v = 0;
      this.chairPull(Math.sin(Math.min(1, (1 - this.sitT) * 1.1) * Math.PI) * 0.9);
      const tgt = Math.atan2(s.ax - s.x, s.az - s.z); if (this.sitT < 0.5) this.yaw += clamp(angDiff(this.yaw, tgt), -7 * dt, 7 * dt);
      if (this.sitT <= 0) { this.sitPhase = 'none'; this.chairPull(0); s.occupant = null; this.seat = null; rig.sitK = 0; this.onStood(); }
    } else { this.x = s.x; this.z = s.z; this.yaw = s.yaw; rig.speed = 0; rig.turn = 0; }
    if (this.sitPhase !== 'none') { this.y = this.floor === 0 ? 0 : FY[this.floor]; }
  }
  chairPull(p: number) { const s = this.seat; if (!s) return; s.pull = p; if (s.chair) { s.chair.position.set(s.x - s.fx * 0.3 * p + s.fz * 0.1 * p, FY[s.floor], s.z - s.fz * 0.3 * p - s.fx * 0.1 * p); s.chair.rotation.y = s.yaw + 1.1 * p * (s.side ?? 1) * -1; } }
  onSeated() { /* override */ } onStood() { /* override */ }
  animate(dt: number) {
    const r = this.rig; if (this.sitPhase === 'none') { r.speed = this.v; r.turn = this.turnRate; }
    if (!this.visibleNow) { this.animAcc += dt; if (this.animAcc < 0.25) return; dt = this.animAcc; this.animAcc = 0; }
    r.update(Math.min(dt, 0.25));
    if (r.stepped && this.sitPhase === 'none') this.g.onFootstep?.(this);
  }
  dispose() { this.removed = true; this.g.scene.remove(this.rig.root); if (this.seat && this.seat.occupant === this) { this.seat.occupant = null; this.chairPull(0); } }
}

export interface Order { id: number; cust: Customer; item: string; state: 'open' | 'making' | 'ready' | 'delivered' | 'cancelled'; t0: number; patience: number; claimed: any; quality: number; table: string; }

type CState = 'enter' | 'queue' | 'toSeat' | 'play' | 'standing' | 'payQueue' | 'leave' | 'sneak' | 'flee' | 'caught' | 'wc' | 'chill' | 'watch' | 'wait' | 'gone';
export class Customer extends Char {
  kind = 'customer'; persona: Persona; name: string; budget: number; patienceMax: number; patience: number; sat = 72; desk: Desk | null = null; state: CState = 'enter'; stateT = 0; sessionLeft = 0; sessionTotal = 0;
  owed = 0; order: Order | null = null; ordersLeft = 0; nextOrderIn = 0; isThief = false; paid = false; causes: Record<string, number> = {}; queueTarget = -1; actT = 0; actName = 'none'; actDur = 0; nextAct = rnd(4, 9);
  eatT = 0; wcDone = false; chillSeat: Seat | null = null; isFleeing = false; glanceT = 0; glanceDir = 0; spent = 0; arrivedAt = 0; checkedIn = false; reviewDone = false; playMinutes = 0; tourney = false; vipStreamer = false; skin = 0; wantsChill = false; exitSide = 1; angry = false;
  constructor(g: G, persona: Persona) {
    super(g, randomLook('customer')); this.persona = persona; const P = PERSONA[persona]; this.name = randName();
    this.budget = rnd(P.budget[0], P.budget[1]); this.patienceMax = rnd(P.patience[0], P.patience[1]) * (g.state.mode === 'sandbox' ? 1.35 : 1); this.patience = this.patienceMax;
    this.sessionTotal = this.sessionLeft = rnd(P.session[0], P.session[1]); this.ordersLeft = Math.random() < P.order ? (persona === 'regular' || persona === 'vip' ? rint(1, 3) : 1) : 0; this.nextOrderIn = rnd(10, 40);
    this.walkSpeed = persona === 'student' || persona === 'quick' ? 1.7 : rnd(1.3, 1.55); this.exitSide = Math.random() < 0.5 ? -1 : 1;
    if (persona === 'vip' || persona === 'streamer') { this.rig.root.scale.multiplyScalar(1.02); }
    if (persona === 'streamer') { /* flashy */ const mats = [this.rig.chest.material as THREE.MeshLambertMaterial]; mats[0] = mats[0].clone(); mats[0].color.setHex(0xffd36a); this.rig.chest.material = mats[0]; }
  }
  cause(k: string, v: number) { this.causes[k] = (this.causes[k] || 0) + v; }
  setAct(a: string, dur = 0) { this.actName = a; this.actT = 0; this.actDur = dur; }
  goto(steps: Step[]) { this.setRoute(steps); }
  onSeated() { if (this.state === 'toSeat') { this.state = 'play'; this.stateT = 0; this.setAct('type'); } else if (this.state === 'chill') { /* resting */ } else if (this.state === 'watch') { this.setAct('clap', 0); } else if (this.state === 'wc') { this.state = 'play'; } }
  onStood() { }
  get desiredQueue() { return this.g.queue.indexOf(this); }
  delayT = 0;
  update(dt: number, others: Char[]) { if (this.delayT > 0) { this.delayT -= dt; if (this.delayT <= 0) this.frozen = false; } this.logic(dt); super.update(dt, others); }

  logic(dt: number) {
    const g = this.g; this.stateT += dt; const r = this.rig; r.emo = this.angry ? 'angry' : this.sat > 80 ? 'happy' : this.sat < 30 ? 'sad' : this.sat < 50 ? 'bored' : 'neutral';
    r.carry = false; r.glance = 0; r.look = null; this.faceTo = this.faceTo;
    switch (this.state) {
      case 'enter': {
        r.act = 'none'; const idx = this.desiredQueue;
        if (idx >= 0 && idx !== this.queueTarget) { this.queueTarget = idx; const q = g.world.queueSpots[Math.min(idx, g.world.queueSpots.length - 1)]; this.setRoute([{ t: 'walk', floor: 0, x: q.x, z: q.z }]); }
        if (this.arrived && !this.busyMoving && this.queueTarget >= 0) { this.state = 'queue'; this.stateT = 0; }
        break;
      }
      case 'queue': case 'payQueue': {
        const idx = this.desiredQueue; if (idx < 0) { break; }
        if (idx !== this.queueTarget) { this.queueTarget = idx; const q = g.world.queueSpots[Math.min(idx, g.world.queueSpots.length - 1)]; this.setRoute([{ t: 'walk', floor: 0, x: q.x, z: q.z }]); }
        this.faceTo = { x: g.world.regPt.x, z: g.world.regPt.z };
        r.look = new THREE.Vector3(g.world.regPt.x, 1.4, g.world.regPt.z);
        const ratio = this.patience / this.patienceMax; r.act = this.arrived ? (ratio < 0.5 ? 'impatient' : 'none') : 'none';
        if (this.arrived && ratio > 0.5 && Math.sin(g.time * 0.5 + this.name.length) > 0.8) r.look = null;
        if (this.state === 'queue') {
          this.patience -= dt * (g.hasCashier ? 0.85 : 1); if (ratio < 0.3) { this.sat -= dt * 0.6; this.cause('wait', dt); }
          if (this.patience <= 0) { this.angry = true; this.sat = Math.min(this.sat, 15); this.cause(g.countFreeFor(this) ? 'wait' : 'full', 20); g.removeFromQueue(this); this.leaveNow(true); }
        } else { this.patience -= dt * 0.5; if (ratio < 0.3) { this.sat -= dt * 0.8; this.cause('wait', dt); } if (this.patience <= -this.patienceMax * 0.5) { g.removeFromQueue(this); this.angry = true; g.collectPayment(this, true); } }
        break;
      }
      case 'toSeat': { r.act = 'none'; if (this.arrived && !this.sitting) { this.sitDown(this.seat || this.desk!.seat); } break; }
      case 'play': this.playLogic(dt); break;
      case 'standing': { r.act = 'none'; if (!this.sitting && this.seat === null) { if (this.leaveAfterStand) { this.leaveAfterStand = false; g.releaseDesk(this); g.collectPayment(this, true, true); } else this.afterStand(); } break; }
      case 'leave': {
        this.frozen = this.angry && this.stateT < 1.3 && this.route.length > 0 && !this.sitting; r.act = this.frozen ? 'angry' : 'none';
        if ((this.arrived && !this.busyMoving && this.stateT > 0.5) || (this.floor === 0 && this.z > 11 && Math.abs(this.x) > 21)) this.state = 'gone';
        break;
      }
      case 'sneak': { r.act = 'none'; r.emo = 'worried'; r.look = new THREE.Vector3(this.x + Math.sin(g.time * 3) * 3, 1.6, this.z + 3); r.glance = Math.sin(this.stateT * 4) * 0.6; if (this.stateT > 1.6) { this.startFlee(); } break; }
      case 'flee': {
        r.emo = 'worried'; r.act = 'none'; this.runMode = true; this.glanceT -= dt; if (this.glanceT <= 0) { this.glanceT = rnd(1.0, 1.8); this.glanceDir = 1; }
        if (this.glanceDir > 0) { r.glance = Math.sin(clamp((1.0 - this.glanceT) * 2.2, 0, 1) * Math.PI) * 0.0 + (this.glanceT > 0.8 ? 0 : Math.sin((0.8 - this.glanceT) / 0.8 * Math.PI) * (this.floor === 0 ? 1 : 1)); if (this.glanceT < 0.0) this.glanceDir = 0; }
        if (this.floor === 0 && this.z > 11 && Math.abs(this.x) > 21) { g.thiefEscaped(this); this.state = 'gone'; }
        if (this.arrived && this.route.length === 0) { this.state = 'gone'; if (!this.paid) g.thiefEscaped(this); }
        break;
      }
      case 'caught': {
        r.act = 'handsup'; r.emo = 'worried'; this.frozen = true; this.runMode = false;
        if (this.stateT > 2.4) { this.frozen = false; this.paid = true; this.state = 'leave'; this.stateT = 0; this.angry = false; this.sat = 20; r.act = 'none'; this.walkSpeed = 1.3; this.goto(g.routeToExit(this)); }
        break;
      }
      case 'wc': {
        if (this.afterWcStand && !this.sitting && !this.seat) { this.afterWcStand = false; this.goto(g.plan(this, { floor: 0, x: g.world.wcPt.x, z: g.world.wcPt.z }, false)); this.eatT = 0; break; }
        const inWc = !this.sitting && !this.afterWcStand && Math.hypot(this.x - g.world.wcPt.x, this.z - g.world.wcPt.z) < 1.0 && !this.busyMoving;
        if (inWc) { r.act = 'wash'; r.look = new THREE.Vector3(11.5, 1.3, -8.0); this.faceTo = { x: 11.5, z: -8.0 }; if (this.eatT <= 0) this.eatT = 4.5; this.eatT -= dt; if (this.eatT <= 0) { this.eatT = 0.0001; this.wcDone = true; this.state = 'toSeat'; this.eatT = 0; this.goto(g.plan(this, { floor: this.desk!.floor, x: this.desk!.seat.ax, z: this.desk!.seat.az }, g.preferElev(this))); } } else r.act = 'none';
        break;
      }
      case 'chill': {
        if (this.chillSeat && !this.seat && this.arrived && !this.sitting) this.sitDown(this.chillSeat);
        if (this.seated) { this.actT += dt; r.act = this.actT < 6 ? 'drink' : 'phone'; if (this.actT > 11 + this.sessionLeft * 0) { r.act = 'none'; this.state = 'standing'; this.standUp(); this.stateT = 0; } }
        break;
      }
      case 'watch': {
        if (this.seat && !this.sitting && this.arrived) this.sitDown(this.seat);
        if (this.seated) { this.actT += dt; r.look = new THREE.Vector3(0, FY[2] + 2.3, -9.7); r.act = g.tourney && g.tourney.cheerT > 0 ? (this.nextAct > 0.5 ? 'cheer' : 'clap') : (Math.sin(g.time * 0.3 + this.name.length * 2) > 0.7 ? 'clap' : 'none'); }
        break;
      }
      case 'wait': { break; }
      default: break;
    }
  }
  leaveNow(angry = false) {
    this.state = 'leave'; this.stateT = 0; this.angry = angry || this.angry; this.setAct('none'); this.walkSpeed = angry ? 2.0 : this.walkSpeed; this.runMode = false;
    this.goto(this.g.routeToExit(this));
  }
  startFlee() { this.state = 'flee'; this.stateT = 0; this.isFleeing = true; this.runMode = true; this.glanceT = 0.6; this.walkSpeed = 1.75 * (1 - this.g.upg('sec') * 0.08); this.goto(this.g.routeToExit(this, true)); this.g.thiefAlert(this); }
  afterStand() {
    const g = this.g; if (this.desk) { g.releaseDesk(this); } if (this.chillSeat) { (this.chillSeat as any).reserved = null; this.chillSeat = null; }
    this.rig.act = 'none';
    if (this.paid && !this.isThief) { this.state = 'leave'; this.stateT = 0; this.goto(g.routeToExit(this)); return; }
    if (this.isThief && !this.paid) { this.state = 'sneak'; this.stateT = 0; return; }
    if (this.wantsChill && g.world.loungeSeats.length) { const free: Seat[] = g.world.loungeSeats.filter((s: Seat) => !s.occupant && !(s as any).reserved); if (free.length) { const s = pick(free); (s as any).reserved = this; this.chillSeat = s; this.seat = null; this.state = 'chill'; this.actT = 0; this.wantsChill = false; this.goto(g.plan(this, { floor: s.floor, x: s.ax, z: s.az }, g.preferElev(this))); this.sitDownPending(s); return; } }
    this.state = 'payQueue'; this.queueTarget = -1; this.patience = Math.max(this.patienceMax * 0.8, 25); g.addToQueue(this);
    this.goto(g.plan(this, { floor: 0, x: g.world.queueSpots[Math.min(g.queue.length - 1, 5)].x, z: g.world.queueSpots[Math.min(g.queue.length - 1, 5)].z }, g.preferElev(this)));
  }
  sitDownPending(s: Seat) { this.seat = null; void s; }
  playLogic(dt: number) {
    const g = this.g, r = this.rig, d = this.desk!; const P = PERSONA[this.persona];
    if (!this.seated) { r.act = 'none'; return; }
    const hot = g.state.crowd > 0.7 && g.upg('ac') < 2;
    const minutes = dt * g.minPerSec; this.sessionLeft -= minutes; this.playMinutes += minutes; if (d.type !== 'racing') r.look = null;
    // satisfaction
    let drain = 0; const ex = P.expect * (d.type === 'vip' ? 1.2 : 1);
    if (d.broken) { drain += 2.4 * ex; this.cause('broken', dt); }
    const dirt = g.dirtNear(this.floor); if (dirt > 1) { drain += Math.min(0.5, dirt * 0.09) * ex; this.cause('dirty', dt * dirt); }
    if (g.event('lag')) { drain += 0.9 * (1 - g.upg('net') * 0.28); this.cause('lag', dt); }
    if (!g.state.power) { drain += 1.4; this.cause('dark', dt); }
    if (hot) { drain += 0.08 * (3 - g.upg('ac')); this.cause('hot', dt); }
    if (this.playMinutes > 90) drain += 0.03 * (3 - g.upg('chair')) * ex;
    const bonus = 0.05 * (g.upg('monitor') + g.upg('kb') + g.upg('headset') + g.upg('pc')) + (d.type === 'vip' ? 0.05 : 0) + g.upg('decor') * 0.03;
    this.sat = clamp(this.sat - drain * dt + (drain < 0.3 ? bonus * dt : 0), 0, 100);
    r.emo = d.broken ? 'angry' : this.sat > 80 ? 'happy' : this.sat < 30 ? 'sad' : 'neutral'; this.angry = d.broken && this.sat < 55;
    // order bubble & timers
    if (this.order) {
      const o = this.order; const fr = 1 - (g.time - o.t0) / o.patience; const it = MENU[o.item];
      if (o.state === 'open' || o.state === 'making') { this.setBubble(it.icon, fr, fr < 0.35 ? '#7a2030' : '#2a2a52', fr < 0.35 ? 0xff4040 : 0x3dff7a); if (fr < 0.5) this.sat -= dt * 0.4; if (fr <= 0) g.cancelOrder(o); }
      else if (o.state === 'ready') this.setBubble('🍽️', fr, '#2a5a3a');
    } else if (!d.broken && !g.state.blackout) {
      if (this.ordersLeft > 0) { this.nextOrderIn -= dt; if (this.nextOrderIn <= 0 && this.eatT <= 0) { this.nextOrderIn = rnd(25, 55); g.createOrder(this); } }
    }
    if (d.broken) { this.setBubble('🔧', 1 - clamp(this.stateT / 60, 0, 1), '#7a3a10', 0xff9a3f); if (!this.order) { } this.patience -= dt; if (this.patience <= -35 || this.sat <= 4) { this.angry = true; this.cause('broken', 40); this.quitAngry(); return; } }
    else if (!this.order) { this.setBubble(null); }
    // act scheduling
    if (this.eatT > 0) { this.eatT -= dt; r.act = this.eatT > 0 ? 'eat' : 'type'; if (this.eatT <= 0) { this.g.afterEat(this); } return; }
    this.actT += dt;
    if (d.broken) { r.act = this.sat < 40 ? 'angry' : 'impatient'; if (Math.sin(g.time * 3 + this.name.length) > 0.99) g.audio.buzz(0.4); return; }
    const base = d.type === 'racing' ? 'wheel' : 'type';
    if (this.actName !== 'none' && this.actName !== base && this.actT < this.actDur) { r.act = this.actName; }
    else {
      this.actName = base; r.act = base; this.nextAct -= dt;
      if (this.nextAct <= 0) { this.nextAct = rnd(7, 16); const o = Math.random(); if (this.sat > 75 && o < 0.35) this.setAct('cheer', 1.6); else if (o < 0.55) this.setAct('stretch', 2.6); else if (o < 0.75) this.setAct('drink', 2.4); else if (o < 0.9) this.setAct('phone', 3); else this.setAct('talk', 2.2); this.rig.talk = Math.random(); }
    }
    if (d.type === 'racing' && r.act === 'wheel') r.look = new THREE.Vector3(this.x + d.seat.fx * 3, FY[this.floor] + 1.0, this.z + d.seat.fz * 3);
    if (d.type === 'racing') d.wheel && (d.wheel.rotation.z = -r.steer * 1.2);
    // wc trip
    if (!this.wcDone && this.sessionLeft < this.sessionTotal * 0.55 && this.sessionTotal > 90 && Math.random() < dt * 0.02 && !d.broken && !this.order && this.floor === d.floor) { this.wcDone = true; this.state = 'wc'; this.standUp(); this.stateT = 0; this.actT = 0; this.afterWcStand = true; }
    // end
    if (this.sessionLeft <= 0 && !this.order) { this.endSession(); }
    if (this.isThief && Math.random() < dt * 0.04) this.rig.glance = 0.5;
  }
  afterWcStand = false; noDesk = false;
  quitAngry() {
    this.state = 'standing'; this.stateT = 0; this.angry = true; this.setBubble(null); this.owed = this.computeOwed() * 0.4; this.standUp(); this.leaveAfterStand = true;
  }
  leaveAfterStand = false;
  computeOwed() { const d = this.desk!; return this.g.deskRevenue(d, this.playMinutes); }
  endSession() {
    this.owed = this.computeOwed(); this.state = 'standing'; this.stateT = 0; this.setBubble(null); this.standUp(); this.wantsChill = this.persona === 'regular' && Math.random() < 0.3 && !this.isThief || (this.persona === 'student' && Math.random() < 0.1);
  }
}
export type EJob = Job;
export class Employee extends Char {
  kind = 'employee'; state = 'idle'; workT = 0; target: any = null; idleT = rnd(2, 6); tray = false; carrying: Order | null = null; sweepT = 0;
  constructor(g: G, public job: Job, public name: string, public skill: number, public wage: number, public id: number) {
    super(g, randomLook('emp')); this.walkSpeed = 1.3 + skill * 0.12; this.rig.root.scale.setScalar(0.97 + Math.random() * 0.06);
  }
  post() { const w = this.g.world; return this.job === 'cashier' ? w.cashierPt : this.job === 'buffet' ? w.buffetPt : this.job === 'cleaner' ? { x: -1.0, z: 3.8 } : { x: 2.4, z: 4.2 }; }
  update(dt: number, others: Char[]) { this.logic(dt); super.update(dt, others); }
  go(floor: number, x: number, z: number) { this.setRoute(this.g.plan(this, { floor, x, z }, false)); }
  logic(dt: number) {
    const g = this.g, r = this.rig; r.carry = false; r.look = null; if (!g.state.open && g.state.phase !== 'closing' && g.state.phase !== 'prep' && g.state.phase !== 'report') { }
    switch (this.job) {
      case 'cashier': {
        const p = g.world.cashierPt; const near = Math.hypot(this.x - p.x, this.z - p.z) < 0.5;
        if (!near && !this.busyMoving && this.floor === 0) this.go(0, p.x, p.z);
        if (near && !this.busyMoving) { this.faceTo = { x: p.x, z: 9 }; r.act = g.regBusy > 0 ? 'pay' : 'none'; if (g.queue.length) r.look = new THREE.Vector3(g.world.queueSpots[0].x, 1.5, g.world.queueSpots[0].z); }
        else r.act = 'none';
        break;
      }
      case 'cleaner': this.cleanerLogic(dt); break;
      case 'tech': this.techLogic(dt); break;
      case 'buffet': this.buffetLogic(dt); break;
    }
  }
  idleAt(p: { x: number; z: number }, dt: number) {
    const near = Math.hypot(this.x - p.x, this.z - p.z) < 0.6; this.rig.act = 'none';
    if (!near && !this.busyMoving) this.go(0, p.x, p.z);
    if (near && !this.busyMoving) { this.idleT -= dt; if (this.idleT <= 0) { this.idleT = rnd(5, 10); this.rig.act = 'talk'; } }
  }
  cleanerLogic(dt: number) {
    const g = this.g, r = this.rig;
    if (this.state === 'idle') {
      const t = g.findTrashFor(this); if (t) { this.target = t; t.claimed = this; this.state = 'walk'; this.setRoute(g.plan(this, { floor: t.floor, x: t.x, z: t.z + 0.2 }, false)); } else this.idleAt(this.post(), dt);
    } else if (this.state === 'walk') {
      if (!this.target || this.target.removed) { this.state = 'idle'; this.setRoute([]); return; }
      if (this.arrived && !this.busyMoving) { this.state = 'work'; this.workT = 0; this.faceTo = { x: this.target.x, z: this.target.z }; }
    } else if (this.state === 'work') {
      r.act = 'sweep'; this.workT += dt; this.sweepT -= dt; if (this.sweepT <= 0) { this.sweepT = 0.5; g.audio.sweep?.(); }
      if (this.workT > 2.6 / (0.6 + this.skill * 0.35)) { g.cleanTrash(this.target, this); this.target = null; this.state = 'idle'; }
    }
  }
  techLogic(dt: number) {
    const g = this.g, r = this.rig;
    if (this.state === 'idle') {
      const d = g.findBrokenFor(this); if (d) { this.target = d; d.claimed = this; this.state = 'walk'; this.setRoute(g.plan(this, { floor: d.floor, x: d.service.x, z: d.service.z }, false)); } else this.idleAt(this.post(), dt);
    } else if (this.state === 'walk') {
      if (!this.target.broken) { this.target.claimed = null; this.state = 'idle'; this.setRoute([]); return; }
      if (this.arrived && !this.busyMoving) { this.state = 'work'; this.workT = 0; const d = this.target as Desk; this.faceTo = { x: d.cx + d.seat.fx * 0.8, z: d.cz + d.seat.fz * 0.8 }; }
    } else if (this.state === 'work') {
      r.act = 'work'; this.workT += dt; if (Math.sin(this.workT * 7) > 0.97) g.audio.wrench?.();
      if (this.workT > 5.5 / (0.6 + this.skill * 0.4)) { const d = this.target as Desk; d.claimed = null; const ok = d.sev === 'minor' || Math.random() < 0.15 * this.skill; if (ok) g.repairDesk(d, 'tech'); else { d.sev = 'major'; g.toast('🔧 ' + this.name + ': Bu arıza benden büyük, sen bak!', 'warn'); } this.target = null; this.state = 'idle'; }
    }
  }
  buffetLogic(dt: number) {
    const g = this.g, r = this.rig;
    if (this.state === 'idle') {
      const o = g.findOrderFor(this); if (o) { this.carrying = o; o.claimed = this; o.state = 'making'; this.state = 'walk'; this.setRoute(g.plan(this, { floor: 0, x: g.world.buffetPt.x, z: g.world.buffetPt.z }, false)); }
      else this.idleAt(g.world.buffetPt, dt);
    } else if (this.state === 'walk') {
      if (!this.carrying || this.carrying.state === 'cancelled') { this.carrying = null; this.state = 'idle'; return; }
      if (this.arrived && !this.busyMoving) { this.state = 'work'; this.workT = 0; this.faceTo = { x: g.world.buffetPt.x, z: -6.0 }; }
    } else if (this.state === 'work') {
      r.act = 'work'; this.workT += dt; const o = this.carrying!; const need = (MENU[o.item].prep * 5.0) / (0.55 + this.skill * 0.4) * (1 - g.upg('buffet') * 0.1);
      if (o.state === 'cancelled') { this.carrying = null; this.state = 'idle'; return; }
      if (this.workT > need) { o.quality = 0.8 + this.skill * 0.1; o.state = 'ready'; this.state = 'serve'; const d = o.cust.desk; if (!d) { g.cancelOrder(o); this.carrying = null; this.state = 'idle'; return; } this.setRoute(g.plan(this, { floor: d.floor, x: d.service.x, z: d.service.z }, g.preferElev(this))); g.audio.ding(); }
    } else if (this.state === 'serve') {
      r.carry = true; r.act = 'carry'; const o = this.carrying!;
      if (o.state === 'cancelled' || !o.cust.desk) { this.carrying = null; this.state = 'idle'; return; }
      if (this.arrived && !this.busyMoving) { const d = o.cust.desk; this.faceTo = { x: d.cx + d.seat.fx * 0.7, z: d.cz + d.seat.fz * 0.7 }; this.workT = 0; this.state = 'hand'; }
    } else if (this.state === 'hand') {
      r.carry = true; r.act = 'carry'; this.workT += dt; if (this.workT > 0.8) { g.deliverOrder(this.carrying!, 'employee', this.skill); this.carrying = null; this.state = 'idle'; r.carry = false; }
    }
    if (this.state === 'serve' || this.state === 'hand') r.carry = true;
  }
}

export class Pedestrian extends Char {
  kind = 'ped'; side = 0; dir = 1; phase = 'walk'; waitT = 0; pTarget = { x: 0, z: 0 }; lane = 0; talkPartner: Pedestrian | null = null; sitting2: boolean = false; benchPt: { x: number; z: number; yaw: number } | null = null; sitT2 = 0; mode = 0;
  constructor(g: G) { super(g, randomLook('ped')); this.walkSpeed = rnd(1.1, 1.6); this.runMode = false; }
  logic(dt: number) {
    const g = this.g, st = g.street; const r = this.rig; r.carry = false;
    if (this.mode === 1) { // stand & chat/phone
      this.waitT -= dt; r.act = this.lane % 2 ? 'phone' : 'talk'; r.talk = 1; if (this.waitT <= 0) { this.mode = 0; this.pickNext(); } return;
    }
    r.act = 'none';
    if (this.phase === 'waitCross') {
      this.faceTo = { x: this.x, z: this.side === 0 ? 17 : 17 }; this.waitT += dt;
      if (st.pedGreen() && (st.phaseT % 29.5) < 24.5 || this.waitT > 40) { this.phase = 'cross'; const tz = this.side === 0 ? st.farZ - 0.3 : st.nearZ + 0.3; this.setRoute([{ t: 'walk', floor: 0, x: this.x, z: tz, free: true }]); this.runMode = false; this.walkSpeed = 1.6; }
      return;
    }
    if (this.arrived && !this.busyMoving) {
      if (this.phase === 'toCross') { this.phase = 'waitCross'; this.waitT = 0; return; }
      if (this.phase === 'cross') { this.side = 1 - this.side; this.phase = 'walk'; this.pickNext(); return; }
      this.pickNext();
    }
  }
  pickNext() {
    const g = this.g, st = g.street; const z = this.side === 0 ? st.nearZ + (this.lane % 2) * 0.55 - 0.3 : st.farZ + (this.lane % 2) * 0.6 - 0.3;
    const o = Math.random();
    if (o < 0.18) { this.mode = 1; this.waitT = rnd(5, 12); return; }
    if (o < 0.5 && Math.abs(this.x - (st.crossX0 + 1.5)) > 3) { const cx = st.crossX0 + 0.5 + (this.lane % 2) * 2; this.phase = 'toCross'; this.setRoute([{ t: 'walk', floor: 0, x: cx, z: this.side === 0 ? st.nearZ + 0.5 : st.farZ - 0.5, free: true }]); return; }
    const tx = clamp(this.x + this.dir * rnd(8, 22), -44, 44); if (Math.abs(tx) >= 43) this.dir *= -1;
    this.phase = 'walk'; this.setRoute([{ t: 'walk', floor: 0, x: tx, z, free: true }]);
  }
  update(dt: number, others: Char[]) {
    this.logic(dt); const st = this.g.street;
    if (this.phase === 'cross') { this.walkSpeed = 1.7; }
    super.update(dt, others); void st;
  }
}

export const deskPrefOrder = (persona: Persona): DeskType[] => PERSONA[persona].prefs;
export const deskName = (t: DeskType) => DESK_INFO[t].name;
