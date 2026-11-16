import * as THREE from 'three';
import {
  FY, FH, DESK_INFO, PERSONA, MENU, STOCK_INFO, UPGRADES, JOBS, EVENTS, REVIEWS, TEAM_NAMES, DeskType, Persona, Job, StockCat,
  rnd, rint, pick, clamp, randName, fmtTime, fmtMoney,
} from './data';
import { AudioSys } from './audio';
import { Screens } from './screens';
import { World, Desk, Seat, setDeskScreen } from './world';
import { Street } from './street';
import { Char, Customer, Employee, Pedestrian, Order, Step } from './npc';
import { randomLook } from './rig';
import { ViewModel, VMMode } from './viewmodel';

export type ScreenName = 'menu' | 'playing' | 'paused' | 'admin' | 'report' | 'gameover' | 'victory';
const SAVE_KEY = 'netkafe_open_world_save_v2', SET_KEY = 'netkafe_open_world_settings_v2';
const MINSEC = 1.5;

interface Trash { id: number; floor: number; x: number; z: number; type: 'cup' | 'paper' | 'spill'; mesh: THREE.Object3D; claimed: any; removed: boolean; }
interface Goal { id: string; text: string; target: number; progress: number; reward: number; done: boolean; kind: string; }
interface Candidate { id: number; job: Job; name: string; skill: number; wage: number; }
export interface Review { name: string; stars: number; text: string; day: number; time: string; }
interface Interact { key: string; text: string; x: number; z: number; floor: number; r: number; hold: number; prio: number; run: () => void; mode: VMMode; face?: boolean; }

class Player extends Char {
  kind = 'player'; vx = 0; vz = 0; pitch = 0; tray: Order[] = []; bobT = 0; lastStep = 0;
}

function emptyStats() { return { customers: 0, lost: 0, income: { masa: 0, bufe: 0, bahsis: 0, turnuva: 0, odul: 0, diger: 0 } as Record<string, number>, expenses: { kira: 0, elektrik: 0, maas: 0, bakim: 0, stok: 0, yatirim: 0, ceza: 0 } as Record<string, number>, orders: 0, repairs: 0, cleaned: 0, caught: 0, escaped: 0, satSum: 0, satN: 0, reviews: [] as Review[], invest: [] as string[], tourney: 0, turned: 0 }; }

export class Game {
  canvas: HTMLCanvasElement; renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; cctvCam: THREE.PerspectiveCamera;
  audio = new AudioSys(); screens!: Screens; world!: World; street!: Street; vm = new ViewModel(); player!: Player;
  customers: Customer[] = []; employees: Employee[] = []; peds: Pedestrian[] = []; orders: Order[] = []; trash: Trash[] = []; queue: Customer[] = []; allChars: Char[] = [];
  time = 0; frame = 0; screen: ScreenName = 'menu'; prevScreen: ScreenName = 'playing'; mini: any = null; hold = { key: '', t: 0 }; prompt: Interact | null = null;
  state: any; stats = emptyStats(); goals: Goal[] = []; candidates: Candidate[] = []; reviews: Review[] = []; history: any[] = []; toasts: { id: number; text: string; kind: string; t: number }[] = []; toastId = 0;
  eventsActive: Record<string, number> = {}; sched: { t: number; id: string }[] = []; banner: { text: string; icon: string; good: boolean; t: number } | null = null; tourney: any = null; minPerSec = MINSEC;
  keys = new Set<string>(); touch = { x: 0, z: 0, run: false, on: false }; yaw = 0; pitch = 0; locked = false; needLock = false; dragLook = false; sens = 1; listeners = new Set<() => void>(); snap: any = {};
  regBusy = 0; regTimer = 0; hasCashier = false; reach = 0; interactHeld = false; spawnAcc = 0; elecAcc = 0; cleanCounter = 0; trashAcc = 0; honkT = 0; cheatBuf = ''; cheatTimer: any = null; cheatMsg = '';
  idCounter = 100; orderId = 1; trashId = 1; empId = 1; lastEmit = 0; adminTab = 0; camIdx = 0; cctvCanvas: HTMLCanvasElement | null = null; cctvAcc = 0; cctvRT: THREE.WebGLRenderTarget; cctvBuf = new Uint8Array(320 * 180 * 4);
  keyAcc = 0; mumbleAcc = 0; elevKeyLock = false; admin: any = null; steam: { s: THREE.Sprite; life: number; v: THREE.Vector3 }[] = []; vmSteam: { s: THREE.Sprite; life: number }[] = []; dust!: THREE.Points; beams: THREE.Mesh[] = []; trayTilt = { x: 0, z: 0 }; lastVel = { x: 0, z: 0 };
  tourneyDay = 3; victoryShown = false; tempPeds: Pedestrian[] = []; musicLights: any[] = []; lastDayReport: any = null; inspectEnd = 0; sunTime = 0; dayStartMoney = 0; wasOutdoors = 0; fpsAcc = 0; fpsN = 0; fps = 60;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); this.renderer.autoClear = false; this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color(0x9ccdf2); this.scene.fog = new THREE.Fog(0x9ccdf2, 30, 160);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 400); this.cctvCam = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 300); this.cctvCam.layers.enable(1);
    this.cctvRT = new THREE.WebGLRenderTarget(320, 180);
    this.screens = new Screens(); this.world = new World(this.scene, this.screens); this.street = new Street(this.scene, this.world); this.world.finalizeNav();
    this.world.elev.onDing = () => { const p = this.player; if (p && (p.floor === this.world.elev.floor || p.inElev)) this.audio.elevDing(); };
    this.player = new Player(this, { ...randomLook('customer'), shirt: 0x23274a, pants: 0x1d1d26, style: 0, hair: 0x2b1d14, female: false, uniform: false, scale: 1 });
    this.player.rig.root.traverse((o) => o.layers.set(1)); this.player.place(0, -1.2, 4.6, 0); this.player.radius = 0.32;
    this.buildAtmos(); this.initPeds(); this.loadSettings(); this.bindEvents(); this.resize();
    this.state = this.freshState('normal'); this.applyOwned(); this.refreshCandidates();
    requestAnimationFrame(this.loop);
  }

  /* ============ setup & state ============ */
  freshState(mode: 'normal' | 'sandbox') {
    return { mode, day: 1, money: mode === 'sandbox' ? 8000 : 1800, rep: 28, buzz: 0, phase: 'prep', open: false, time: 540, stock: { drink: 14, snack: 10, food: 6 }, upg: {} as Record<string, number>, owned: [] as number[], emps: [] as any[], power: true, blackout: false, crowd: 0, rain: 0, cheated: false, totalCust: 0, totalIncome: 0, weather: 0, maint: 0 };
  }
  applyOwned() {
    const w = this.world; const starters: DeskType[] = ['old', 'old', 'old', 'old', 'gaming', 'gaming'];
    if (!this.state.owned.length) { const cnt: Record<string, number> = {}; for (const d of w.desks) { cnt[d.type] = (cnt[d.type] || 0); const i = starters.filter((t) => t === d.type).length; if (cnt[d.type] < i) { this.state.owned.push(d.id); cnt[d.type]++; } } }
    for (const d of w.desks) { d.owned = this.state.owned.includes(d.id); d.broken = false; d.sev = null; d.user = null; d.reserved = null; d.claimed = null; d.lockedForTourney = false; }
  }
  upg(id: string) { return this.state.upg[id] || 0; }
  event(id: string) { return (this.eventsActive[id] ?? -1) > this.state.time || (this.eventsActive[id] !== undefined && id === 'lag' && this.eventsActive[id] > 0); }
  get s() { return this.state; }
  loadSettings() { try { const s = JSON.parse(localStorage.getItem(SET_KEY) || '{}'); this.audio.muted = !!s.muted; this.audio.musicOn = s.music !== false; this.audio.vol = s.vol ?? 0.8; this.sens = s.sens ?? 1; } catch { /* ignore */ } }
  saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify({ muted: this.audio.muted, music: this.audio.musicOn, vol: this.audio.vol, sens: this.sens })); } catch { /* ignore */ } this.audio.apply(); this.emit(true); }
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
  save() {
    try {
      const st = this.state; const data = { v: 2, state: { ...st, phase: 'prep', open: false, time: 540, power: true, blackout: false, crowd: 0 }, emps: this.employees.map((e) => ({ id: e.id, job: e.job, name: e.name, skill: e.skill, wage: e.wage, ot: (e as any).overtime })), candidates: this.candidates, reviews: this.reviews.slice(0, 30), history: this.history.slice(-10), tourneyDay: this.tourneyDay, victoryShown: this.victoryShown };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data)); this.toast('💾 İlerleme kaydedildi', 'good'); return true;
    } catch { this.toast('Kayıt başarısız', 'bad'); return false; }
  }
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false; const d = JSON.parse(raw); this.resetWorldEntities();
      this.state = { ...this.freshState(d.state.mode), ...d.state }; this.state.emps = []; this.candidates = d.candidates || []; this.reviews = d.reviews || []; this.history = d.history || []; this.tourneyDay = d.tourneyDay ?? 3; this.victoryShown = !!d.victoryShown;
      for (const d2 of this.world.desks) { d2.owned = this.state.owned.includes(d2.id); d2.broken = false; d2.wear = rnd(0, 0.3); }
      for (const e of d.emps || []) this.spawnEmployee(e.job, e.name, e.skill, e.wage, e.id, (e as any).ot, true);
      if (!this.candidates.length) this.refreshCandidates(); this.startDay(); return true;
    } catch { return false; }
  }
  resetWorldEntities() {
    for (const c of [...this.customers]) c.dispose(); for (const e of this.employees) e.dispose(); for (const t of this.trash) this.world.fg[t.floor].remove(t.mesh);
    this.customers = []; this.employees = []; this.orders = []; this.trash = []; this.queue = []; this.player.tray = []; this.eventsActive = {}; this.tourney = null;
    for (const s of this.world.seats) { s.occupant = null; (s as any).reserved = null; s.pull = 0; }
    for (const p of this.tempPeds) { p.dispose(); this.peds = this.peds.filter((x) => x !== p); } this.tempPeds = [];
  }
  newGame(mode: 'normal' | 'sandbox') {
    this.resetWorldEntities(); this.state = this.freshState(mode); this.reviews = []; this.history = []; this.tourneyDay = 3; this.victoryShown = false; this.applyOwned(); this.refreshCandidates();
    this.player.place(0, -1.2, 4.6, 0); this.yaw = 0; this.pitch = 0; this.startDay();
  }
  refreshCandidates() {
    this.candidates = []; (Object.keys(JOBS) as Job[]).forEach((j) => { for (let i = 0; i < 3; i++) { const skill = rint(1, 3); this.candidates.push({ id: this.idCounter++, job: j, name: randName(), skill, wage: Math.round((JOBS[j].base * (0.8 + skill * 0.2)) / 5) * 5 }); } });
  }
  makeGoals() {
    const d = this.state.day, owned = this.state.owned.length; const g: Goal[] = [];
    const pool: Goal[] = [
      { id: 'cust', kind: 'cust', text: 'Müşteriye hizmet et', target: Math.round(8 + owned * 1.0 + d), progress: 0, reward: 150, done: false },
      { id: 'inc', kind: 'inc', text: 'Günlük gelir hedefi (₺)', target: Math.round((500 + owned * 90 + d * 60) / 50) * 50, progress: 0, reward: 200, done: false },
      { id: 'ord', kind: 'ord', text: 'Sipariş teslim et', target: 3 + Math.floor(d / 2), progress: 0, reward: 120, done: false },
      { id: 'fix', kind: 'fix', text: 'Arızalı bilgisayarı tamir et', target: 2, progress: 0, reward: 120, done: false },
      { id: 'clean', kind: 'clean', text: 'Çöp ve dökülmüş içecek temizle', target: 4, progress: 0, reward: 100, done: false },
      { id: 'sat', kind: 'sat', text: 'Ortalama memnuniyet %70 üstü (en az 6 müşteri)', target: 70, progress: 0, reward: 180, done: false },
      { id: 'thief', kind: 'thief', text: 'Hiçbir hırsız kaçmasın', target: 0, progress: 0, reward: 150, done: false },
    ];
    const chosen = ['cust', 'inc']; const rest = pool.filter((p) => !chosen.includes(p.id)); chosen.push(pick(rest.filter((r) => r.id !== 'thief' || d > 2)).id);
    for (const id of chosen) g.push({ ...pool.find((p) => p.id === id)! }); this.goals = g;
  }
  startDay() {
    const st = this.state; st.phase = 'prep'; st.open = false; st.time = 540; st.power = true; st.blackout = false; st.weather = 0; this.stats = emptyStats(); this.eventsActive = {}; this.elecAcc = 0; this.dayStartMoney = st.money; st.maint = 0;
    for (const c of [...this.customers]) { c.dispose(); } this.customers = []; this.queue = []; this.orders = []; this.player.tray = []; this.mini = null; for (const t of [...this.trash]) this.world.fg[t.floor].remove(t.mesh); this.trash = [];
    for (const s of this.world.seats) { s.occupant = null; (s as any).reserved = null; if (s.chair) { s.pull = 0; s.chair.position.set(s.x, FY[s.floor], s.z); s.chair.rotation.y = s.yaw; } }
    for (const d of this.world.desks) { d.user = null; d.reserved = null; d.claimed = null; d.lockedForTourney = false; d.broken = false; d.sev = null; }
    for (const d of this.world.desks) if (d.owned && Math.random() < 0.05 + d.wear * 0.25 + (st.day > 1 ? 0.05 : 0)) { d.broken = true; d.sev = Math.random() < 0.6 ? 'minor' : 'major'; }
    const nt = 2 + rint(0, 2); for (let i = 0; i < nt; i++) this.spawnRandomTrash();
    for (const e of this.employees) { e.state = 'idle'; e.setRoute([]); e.target = null; e.carrying = null; const p = e.post(); e.place(0, p.x + rnd(-0.3, 0.3), p.z, 0); }
    this.makeGoals(); this.sched = []; const n = 3 + (st.day > 3 ? 1 : 0); const ids: [string, number, number][] = [['rush', 3, 1], ['lag', 2, 1], ['blackout', 1.4, 2], ['streamer', 1.6, 1], ['sale', 1, 1], ['rain', 2, 1], ['festival', 1.2, 3], ['inspect', 1.4, 2], ['sponsor', 1.5, 1]];
    const used = new Set<string>(); for (let i = 0; i < n; i++) { const pool = ids.filter(([id, , minD]) => !used.has(id) && st.day >= minD); const tot = pool.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot, pickId = pool[0][0]; for (const p of pool) { r -= p[1]; if (r <= 0) { pickId = p[0]; break; } } used.add(pickId); this.sched.push({ t: pickId === 'sale' ? 600 : rnd(660, 1290), id: pickId }); }
    this.sched.sort((a, b) => a.t - b.t);
    // tournament
    this.tourney = null; const esOwned = this.world.desks.filter((d) => d.owned && d.type === 'esport').length;
    if (st.day >= this.tourneyDay) { if (esOwned >= 2) { this.tourney = { status: 'announced', start: 1200, players: [] as Customer[], spec: [] as Customer[], round: 0, rt: 0, sa: 0, sb: 0, cheerT: 0, q: 0, a: pick(TEAM_NAMES), b: pick(TEAM_NAMES), spawned: false, spawnedSpec: false, rounds: 3, result: '' }; while (this.tourney.b === this.tourney.a) this.tourney.b = pick(TEAM_NAMES); this.tourneyDay = st.day + 3; this.toast('🏆 Bugün 20:00\'de E-spor turnuvası var! 2. katı hazırla.', 'good'); } else if (st.day === this.tourneyDay) { this.toast('🏆 Turnuva için en az 2 E-spor masası satın al (2. kat).', 'info'); } }
    this.screens.big.live = false; this.screens.big.k = 0; this.screens.big.msg = this.tourney ? '20:00 TURNUVA' : 'Turnuva yok'; this.screens.big.sa = 0; this.screens.big.sb = 0;
    this.world.shutterTarget = 0; this.world.signOpen && 0; this.street.fest = 0; this.player.tray = [];
    this.banner = { text: 'Gün ' + st.day + ' — Hazırlık', icon: '🌅', good: true, t: 6 }; this.setScreen('playing'); this.emit(true);
    if (st.mode !== 'sandbox' || true) this.toast('Güne hazırlan: stok, arızalar, çalışanlar. Hazır olunca kapıdaki tabelaya E ile kafeyi aç.', 'info');
  }
  openShop() {
    const st = this.state; if (st.phase !== 'prep') return; st.phase = 'open'; st.open = true; st.time = 600; this.audio.shutter(); this.audio.good();
    this.banner = { text: 'Kafe AÇIK! İyi şanslar', icon: '🔓', good: true, t: 5 }; this.toast('Kafe açıldı. Müşteriler geliyor!', 'good'); this.emit(true);
  }
  closeEarly() { const st = this.state; if (st.phase === 'open') { st.phase = 'closing'; st.open = false; this.toast('Kafe kapatılıyor, müşteriler çıkış yapıyor.', 'info'); this.beginClosing(); } }
  beginClosing() { for (const c of this.customers) { if (c.state === 'queue' || c.state === 'enter') { this.removeFromQueue(c); c.leaveNow(false); c.sat -= 0; } } this.closingT = 0; }
  closingT = 0;

  /* ============ events, ui ============ */
  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };
  getSnap = () => this.snap;
  emit(force = false) {
    const now = performance.now(); if (!force && now - this.lastEmit < 140) return; this.lastEmit = now; const st = this.state, p = this.player;
    const stars = st.rep / 20; const avg = this.stats.satN ? this.stats.satSum / this.stats.satN : 0; const inc = Object.values(this.stats.income).reduce((a, b) => a + b, 0), exp = Object.values(this.stats.expenses).reduce((a, b) => a + b, 0);
    const pr = this.prompt;
    this.snap = {
      screen: this.screen, phase: st.phase, time: fmtTime(st.time), minutes: st.time, day: st.day, money: Math.round(st.money), rep: st.rep, stars, sat: avg, liveSat: this.liveSat(), queue: this.queue.length, mode: st.mode,
      orders: this.orders.filter((o) => o.state !== 'delivered' && o.state !== 'cancelled').map((o) => ({ id: o.id, item: MENU[o.item].name, icon: MENU[o.item].icon, table: o.table, frac: clamp(1 - (this.time - o.t0) / o.patience, 0, 1), state: o.state, mine: p.tray.includes(o) })),
      goals: this.goals.map((g) => ({ ...g })), prompt: pr ? { text: pr.text, hold: pr.hold, key: pr.key, progress: this.hold.key === pr.key + pr.text ? this.hold.t / Math.max(0.01, pr.hold) : 0 } : null,
      toasts: this.toasts.map((t) => ({ id: t.id, text: t.text, kind: t.kind })), banner: this.banner && this.banner.t > 0 ? { ...this.banner } : null, weather: st.rain > 0.3 ? 'rain' : 'clear', floor: p.floor, carrying: p.tray.length,
      needLock: this.needLock, muted: this.audio.muted, music: this.audio.musicOn, vol: this.audio.vol, sens: this.sens, mini: !!this.mini, income: Math.round(inc), expenses: Math.round(exp), power: st.power, hasSave: this.hasSave(), touch: this.touch.on, dragLook: this.dragLook,
      tournament: this.tourney ? { status: this.tourney.status, a: this.tourney.a, b: this.tourney.b, round: this.tourney.round } : null, cheat: this.cheatMsg, report: this.lastDayReport, inElev: p.inElev, events: Object.keys(this.eventsActive).filter((k) => this.event(k)).map((k) => ({ id: k, name: EVENTS[k].name, icon: EVENTS[k].icon, good: EVENTS[k].good })),
      lockable: !this.dragLook, hasCashier: this.hasCashier, fps: this.fps,
    };
    this.listeners.forEach((l) => l());
  }
  liveSat() { const a = this.customers.filter((c) => c.state === 'play' || c.state === 'queue' || c.state === 'payQueue'); return a.length ? a.reduce((s, c) => s + c.sat, 0) / a.length : -1; }
  toast(text: string, kind = 'info') { this.toasts.push({ id: this.toastId++, text, kind, t: 5 }); if (this.toasts.length > 5) this.toasts.shift(); this.emit(true); }
  setScreen(s: ScreenName) {
    const was = this.screen; this.screen = s; if (s === 'admin' || s === 'paused' || s === 'menu' || s === 'report' || s === 'gameover' || s === 'victory') { if (document.pointerLockElement) { this.expectUnlock = true; document.exitPointerLock(); } }
    if (s === 'playing' && was !== 'playing') { this.audio.init(); }
    this.emit(true);
  }
  expectUnlock = false; noLockT = 0;
  lock() { this.audio.init(); if (this.touch.on) return; try { const p: any = this.canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => { this.dragLook = true; this.needLock = false; this.emit(true); }); } catch { this.dragLook = true; } }
  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e, true)); window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.interactHeld = false; });
    document.addEventListener('pointerlockchange', () => {
      const l = document.pointerLockElement === this.canvas; this.locked = l;
      if (l) { this.needLock = false; this.dragLook = false; }
      else if (this.screen === 'playing') { if (this.expectUnlock) this.expectUnlock = false; else { this.setScreen('paused'); } }
      this.emit(true);
    });
    document.addEventListener('pointerlockerror', () => { this.dragLook = true; this.needLock = false; this.emit(true); });
    document.addEventListener('mousemove', (e) => {
      if (this.screen !== 'playing' || this.mini && false) return;
      if (this.locked || (this.dragLook && (e.buttons & 1))) { const s = 0.0022 * this.sens; this.yaw -= e.movementX * s; this.pitch = clamp(this.pitch - e.movementY * s, -1.4, 1.4); }
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.audio.init();
      if (this.screen === 'playing') { if (!this.locked && !this.dragLook && !this.touch.on) this.lock(); else if (e.button === 0) { this.pressInteract(); this.interactHeld = true; } }
    });
    window.addEventListener('mouseup', () => { this.interactHeld = false; });
    window.addEventListener('touchstart', () => { if (!this.touch.on) { this.touch.on = true; this.emit(true); } }, { passive: true });
  }
  resize() { const w = window.innerWidth, h = window.innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  onKey(e: KeyboardEvent, down: boolean) {
    const tgt = e.target as HTMLElement; if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (down) {
      if (e.key === 'Escape') { if (this.screen === 'admin') { this.setScreen('playing'); this.needLock = !this.locked && !this.touch.on; this.emit(true); } else if (this.screen === 'playing') { if (this.mini) this.cancelMini(); else this.setScreen('paused'); } else if (this.screen === 'paused') { this.resume(); } return; }
      if (this.screen !== 'playing') return;
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) { this.cheatBuf = (this.cheatBuf + e.key.toUpperCase()).slice(-24); clearTimeout(this.cheatTimer); this.cheatTimer = setTimeout(() => this.checkCheat(), 900); }
      if (k === 'e' && !e.repeat) { this.pressInteract(); this.interactHeld = true; }
      if (k === ' ' && !e.repeat) { if (this.mini) this.miniHit(); e.preventDefault(); }
      if (k === 'm') { this.audio.setMuted(!this.audio.muted); this.saveSettings(); }
      if (this.player.inElev && ['1', '2', '3'].includes(k)) { this.world.elev.call(parseInt(k) - 1); this.toast('Asansör: ' + (parseInt(k) === 1 ? 'Zemin' : parseInt(k) - 1 + '. Kat') + ' seçildi', 'info'); this.audio.click(); }
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'Tab'].includes(k.toLowerCase()) || k === ' ') e.preventDefault();
    } else if (k === 'e') this.interactHeld = false;
    if (down) this.keys.add(k); else this.keys.delete(k);
  }
  checkCheat() {
    const b = this.cheatBuf; this.cheatBuf = ''; this.runCheat(b);
  }
  runCheat(raw: string) {
    const b = raw.toUpperCase().replace(/\s/g, ''); let m = b.match(/PARA(\d{1,7})$/);
    if (m) { const n = parseInt(m[1]); this.state.money += n; this.state.cheated = true; this.stats.income.diger += n; this.cheatMsg = `Hile: +${n.toLocaleString('tr-TR')} ₺ eklendi`; this.toast('💰 Hile kodu: +' + fmtMoney(n), 'good'); this.audio.cash(); }
    else if (/STOK$/.test(b)) { this.state.stock = { drink: 40, snack: 40, food: 30 }; this.toast('📦 Hile: stoklar dolduruldu', 'good'); this.cheatMsg = 'Hile: stok'; }
    else if (/TAMIR$/.test(b)) { for (const d of this.world.desks) if (d.broken) this.repairDesk(d, 'cheat'); this.toast('🔧 Hile: tüm bilgisayarlar tamir edildi', 'good'); this.cheatMsg = 'Hile: tamir'; }
    else if (/TEMIZ$/.test(b)) { for (const t of [...this.trash]) this.cleanTrash(t, null); this.toast('🧹 Hile: kafe tertemiz', 'good'); this.cheatMsg = 'Hile: temiz'; }
    else if (/ITIBAR$/.test(b)) { this.state.rep = Math.min(100, this.state.rep + 20); this.toast('⭐ Hile: itibar arttı', 'good'); this.cheatMsg = 'Hile: itibar'; }
    else { this.cheatMsg = ''; return false; }
    setTimeout(() => { this.cheatMsg = ''; this.emit(true); }, 3000); this.emit(true); return true;
  }
  resume() { this.setScreen('playing'); this.needLock = true; this.lock(); this.emit(true); }
  openAdmin() { this.setScreen('admin'); }
  closeAdmin() { this.setScreen('playing'); this.needLock = !this.touch.on; this.lock(); }

  /* ============ atmosphere ============ */
  buildAtmos() {
    const mkTex = () => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d')!; const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); };
    this.smokeTex = mkTex();
    for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff })); s.scale.set(0.2, 0.2, 1); s.visible = false; this.scene.add(s); this.steam.push({ s, life: 0, v: new THREE.Vector3() }); }
    for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, opacity: 0, depthWrite: false })); s.scale.set(0.07, 0.07, 1); s.visible = false; this.vm.scene.add(s); this.vmSteam.push({ s, life: 0 }); }
    // dust
    const N = 260, p = new Float32Array(N * 3); const zones = [[-11, -4, 1, 3.6, -8, 8], [-2, 2, 1, 3, 4, 9], [-6, 6, FY[2] + 1.2, FY[2] + 3.6, -9, -1]];
    for (let i = 0; i < N; i++) { const z = zones[i % 3]; p.set([rnd(z[0], z[1]), rnd(z[2], z[3]), rnd(z[4], z[5])], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff2d0, size: 0.016, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false })); this.scene.add(this.dust);
    const bm = (c: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const z of [-7, -2, 3, 7.5]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.6, 6.5, 12, 1, true), bm(0xfff0c0)); b.position.set(-9.2, 1.7, z); b.rotation.z = -0.55; this.scene.add(b); this.beams.push(b); (b as any).day = true; }
    for (const x of [-4, 0, 4]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.3, 3.6, 14, 1, true), bm([0xff3fa4, 0x2fd6c8, 0xffb347][(x + 4) / 4])); b.position.set(x, FY[2] + 2.2, -4.0); this.scene.add(b); this.beams.push(b); (b as any).day = false; }
  }
  smokeTex!: THREE.Texture;
  emitSteam(x: number, y: number, z: number) { const s = this.steam.find((q) => q.life <= 0); if (!s) return; s.life = 1.6; s.s.position.set(x + rnd(-0.05, 0.05), y, z + rnd(-0.05, 0.05)); s.v.set(rnd(-0.03, 0.03), rnd(0.2, 0.32), rnd(-0.03, 0.03)); s.s.visible = true; }
  updateAtmos(dt: number) {
    for (const s of this.steam) { if (s.life <= 0) continue; s.life -= dt; s.s.position.addScaledVector(s.v, dt); const k = clamp(s.life / 1.6, 0, 1); (s.s.material as THREE.SpriteMaterial).opacity = k * 0.35; s.s.scale.setScalar(0.12 + (1 - k) * 0.35); if (s.life <= 0) s.s.visible = false; }
    for (const s of this.vmSteam) { if (s.life <= 0) continue; s.life -= dt; s.s.position.y += 0.1 * dt; const k = clamp(s.life / 1.2, 0, 1); (s.s.material as THREE.SpriteMaterial).opacity = k * 0.4; s.s.scale.setScalar(0.05 + (1 - k) * 0.12); if (s.life <= 0) s.s.visible = false; }
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < pos.count; i++) { pos.setY(i, pos.getY(i) + Math.sin(this.time * 0.3 + i) * 0.0015); pos.setX(i, pos.getX(i) + Math.cos(this.time * 0.2 + i * 1.3) * 0.0012); } pos.needsUpdate = true;
    const dayK = 1 - this.street.nightK; for (const b of this.beams) (b.material as THREE.MeshBasicMaterial).opacity = (b as any).day ? 0.07 * dayK * (1 - this.street.rainK * 0.7) : (this.world.fg[2].visible && this.state.power ? 0.06 + Math.sin(this.time * 2 + b.position.x) * 0.015 : 0);
    const hot = this.orders.some((o) => o.state === 'making' || o.state === 'ready'); if (hot && Math.random() < dt * 5) this.emitSteam(-1.3 + rnd(-0.3, 0.3), 1.45, -6.35);
    if (this.player.tray.length && Math.random() < dt * 3) { const s = this.vmSteam.find((q) => q.life <= 0); if (s) { s.life = 1.2; const t = this.vm.tray.position; s.s.position.set(t.x - 0.08 + rnd(-0.02, 0.02), t.y + 0.14, t.z + 0.02); s.s.visible = true; } }
  }

  /* ============ characters & routes ============ */
  initPeds() {
    for (let i = 0; i < 10; i++) { const p = new Pedestrian(this); const side = i % 2; p.side = side; p.lane = i; p.dir = Math.random() < 0.5 ? -1 : 1; p.place(0, rnd(-36, 36), side === 0 ? 12.0 + (i % 3) * 0.3 : 23.0 + (i % 3) * 0.3, rnd(0, 6)); p.pickNext(); this.peds.push(p); }
  }
  plan(from: { floor: number; x: number; z: number }, to: { floor: number; x: number; z: number }, useElev = false): Step[] {
    const steps: Step[] = []; let cf = from.floor, cx = from.x, cz = from.z; const w = this.world; let guard = 0;
    while (cf !== to.floor && guard++ < 4) {
      const up = to.floor > cf;
      if (useElev) { steps.push({ t: 'walk', floor: cf, x: -6.6, z: -5.5 }); steps.push({ t: 'elev', from: cf, to: to.floor }); cf = to.floor; cx = -6.6; cz = -5.5; continue; }
      const lower = up ? cf : cf - 1; const st = w.stairs[lower];
      if (up) { steps.push({ t: 'walk', floor: cf, x: st.cx, z: st.zBot + 1.0 }); steps.push({ t: 'stair', id: st.id, up: true }); cx = st.cx; cz = st.zTop - 1.0; }
      else { steps.push({ t: 'walk', floor: cf, x: st.cx, z: st.zTop - 1.2 }); steps.push({ t: 'stair', id: st.id, up: false }); cx = st.cx; cz = st.zBot + 1.0; }
      cf += up ? 1 : -1;
    }
    steps.push({ t: 'walk', floor: to.floor, x: to.x, z: to.z }); void cx; void cz; return steps;
  }
  preferElev(c: Char) { const v = (c as any).persona === 'vip' ? 0.55 : 0.3; return Math.random() < v && c.kind === 'customer'; }
  routeToExit(c: Char, _fast = false): Step[] {
    const side = (c as any).exitSide || 1; const steps = this.plan(c, { floor: 0, x: 0, z: 11.0 }, c.floor !== 0 && this.preferElev(c)); steps.push({ t: 'walk', floor: 0, x: side * 25, z: 12.0 + rnd(-0.3, 0.3) }); return steps;
  }
  addToQueue(c: Customer) { if (!this.queue.includes(c)) this.queue.push(c); }
  removeFromQueue(c: Customer) { this.queue = this.queue.filter((q) => q !== c); }
  countFreeFor(c: Customer) { return this.freeDesks(c).length; }
  freeDesks(c: Customer | null) { return this.world.desks.filter((d) => d.owned && !d.broken && !d.user && !d.reserved && !d.lockedForTourney && (!c || PERSONA[c.persona].prefs.length === 0 || true)); }
  assignDesk(c: Customer): Desk | null {
    const P = PERSONA[c.persona]; const free = this.freeDesks(c); if (!free.length) return null;
    let choice: Desk | null = null;
    for (const t of P.prefs) { const cand = free.filter((d) => d.type === t && DESK_INFO[t].rate * 0.5 <= c.budget * 1.2); if (cand.length) { choice = pick(cand); break; } }
    if (!choice && c.persona !== 'vip' && c.persona !== 'streamer') { const cand = free.filter((d) => d.type !== 'vip' && d.type !== 'racing' && DESK_INFO[d.type].rate * 0.5 <= c.budget); if (cand.length) { choice = pick(cand); c.sat -= 10; } }
    if (!choice && (c.persona === 'vip' || c.persona === 'streamer')) { const cand = free.filter((d) => d.type === 'gaming' || d.type === 'esport' || d.type === 'racing'); if (cand.length) { choice = pick(cand); c.sat -= 22; } }
    if (!choice) return null;
    const rate = DESK_INFO[choice.type].rate; const maxMin = (c.budget / rate) * 60; c.sessionLeft = clamp(Math.min(c.sessionLeft, maxMin), 20, 400); c.sessionTotal = c.sessionLeft;
    choice.reserved = c; c.desk = choice; return choice;
  }
  serveCandidate(): Customer | null {
    for (const c of this.queue) { if (!c.arrived || c.busyMoving) continue; if (c.state === 'payQueue') return c; if (c.state === 'queue' && !c.noDesk) return c; }
    return null;
  }
  serve(c: Customer, byPlayer: boolean) {
    if (c.state === 'payQueue') { this.collectPayment(c); return true; }
    if (c.state !== 'queue') return false;
    const d = this.assignDesk(c);
    if (!d) { c.noDesk = true; c.setBubble('⛔', 1, '#7a2030'); setTimeout(() => { c.noDesk = false; if (c.state === 'queue') c.setBubble(null); }, 4000); if (byPlayer) this.toast('Boş uygun masa yok! ' + c.name + ' bekliyor.', 'warn'); return false; }
    this.removeFromQueue(c); c.checkedIn = true; c.state = 'toSeat'; c.stateT = 0; c.setBubble(null); c.patience = c.patienceMax; this.stats.customers++; this.state.totalCust++;
    c.goto(this.plan(c, { floor: d.floor, x: d.seat.ax, z: d.seat.az }, this.preferElev(c))); this.audio.pop(); this.progressGoal('cust', 1); if (byPlayer) this.toast(`✅ ${c.name} → ${d.label}`, 'good'); return true;
  }
  collectPayment(c: Customer, forced = false, partialAngry = false) {
    if (c.paid) return; c.paid = true; this.removeFromQueue(c); const amt = Math.round(c.owed * (partialAngry ? 1 : 1)); if (c.persona === 'streamer') { this.addIncome(300, 'odul'); this.addRep(4); this.toast('🌟 Yayıncı kafeni anlattı! +300₺ +itibar', 'good'); }
    this.addIncome(amt, 'masa'); if (amt > 0) this.audio.cash(); c.spent += amt;
    if (!forced && c.state === 'payQueue') c.setBubble(null);
    this.finalizeCustomer(c); c.state = 'leave'; c.stateT = 0; c.setBubble(null); c.angry = c.angry || (c.sat < 25); c.walkSpeed = c.angry ? 1.9 : c.walkSpeed; c.goto(this.routeToExit(c)); this.regBusy = Math.max(this.regBusy, 0.6);
  }
  finalizeCustomer(c: Customer) {
    if (c.reviewDone) return; c.reviewDone = true; const stars = clamp(Math.round(c.sat / 20), 1, 5); this.stats.satSum += c.sat; this.stats.satN++;
    const causes = Object.entries(c.causes).sort((a, b) => b[1] - a[1]); let text = '';
    if (stars <= 2 && causes.length) text = pick((REVIEWS as any)[causes[0][0]] || REVIEWS.ok); else if (stars === 3) text = causes.length && causes[0][1] > 12 ? pick((REVIEWS as any)[causes[0][0]]) : pick(REVIEWS.ok); else if (stars >= 4) text = pick(REVIEWS.great); else text = pick(REVIEWS.ok);
    const rv: Review = { name: c.name, stars, text, day: this.state.day, time: fmtTime(this.state.time) }; this.reviews.unshift(rv); this.reviews = this.reviews.slice(0, 40); this.stats.reviews.unshift(rv);
    this.addRep((stars - 3) * 0.55 * (1 - this.state.rep / 160)); if (stars >= 4) this.state.buzz = Math.min(3, this.state.buzz + 0.25); if (stars <= 2) this.state.buzz = Math.max(-1, this.state.buzz - 0.2);
  }
  addRep(v: number) { this.state.rep = clamp(this.state.rep + v, 0, 100); }
  addIncome(v: number, cat: string) { if (v <= 0) return; this.state.money += v; this.state.totalIncome += v; this.stats.income[cat] = (this.stats.income[cat] || 0) + v; this.progressGoal('inc', v); }
  spend(v: number, cat: string, label: string) { const cost = Math.round(v); if (this.state.money < cost) { this.toast('Yetersiz bakiye! (' + fmtMoney(cost) + ' gerekli)', 'bad'); this.audio.bad(); return false; } this.state.money -= cost; if (cat !== 'yatirim') this.stats.expenses[cat] = (this.stats.expenses[cat] || 0) + cost; else { this.stats.expenses.yatirim += cost; this.stats.invest.push(label); } return true; }
  deskRevenue(d: Desk, minutes: number) { const rate = DESK_INFO[d.type].rate / 60; return rate * minutes * (1 + 0.08 * this.upg('pc') + 0.06 * this.upg('monitor') + 0.05 * this.upg('net') + (d.type === 'vip' ? this.upg('decor') * 0.04 : 0)); }
  releaseDesk(c: Customer) { const d = c.desk; if (d) { if (d.user === c) d.user = null; if (d.reserved === c) d.reserved = null; c.desk = null; } }
  thiefAlert(c: Customer) { const p = this.player; const near = Math.hypot(c.x - p.x, c.z - p.z) < 16 && c.floor === p.floor; if (near || this.upg('sec') > 0) { this.toast('🚨 HIRSIZ! ' + c.name + ' ödemeden kaçıyor! (E ile yakala)', 'bad'); this.audio.alarm(); c.setBubble('🏃', 1, '#7a2030'); } else this.toast('Birisi ödeme yapmadan kaçıyor olabilir...', 'warn'); }
  thiefEscaped(c: Customer) { if (c.paid) return; c.paid = true; this.stats.escaped++; this.stats.lost++; this.addRep(-2.2); this.finalizeCustomer(c); this.toast('😠 Hırsız kaçtı! ' + fmtMoney(c.owed) + ' kayıp, itibar düştü.', 'bad'); this.audio.bad(); c.setBubble(null); this.goals.forEach((g) => { if (g.kind === 'thief') g.progress = 1; }); }
  catchThief(c: Customer) {
    if (c.state !== 'flee') return; c.state = 'caught'; c.stateT = 0; c.setBubble(null); this.stats.caught++; const fine = Math.round(c.owed * 1.3); c.paid = true; this.addIncome(fine, 'diger'); this.addRep(1.2); this.finalizeCustomer(c); c.sat = 15;
    this.toast('✅ Hırsız yakalandı! Ödeme + ceza: ' + fmtMoney(fine), 'good'); this.audio.good(); this.audio.cash();
  }

  /* ============ orders ============ */
  createOrder(c: Customer) {
    const P = PERSONA[c.persona]; const opts = P.items.filter((i) => this.state.stock[MENU[i].cat] > 0 && MENU[i].price <= c.budget - c.spent - c.owed); if (!opts.length) { c.ordersLeft = 0; return; }
    const item = pick(opts); this.state.stock[MENU[item].cat]--; const o: Order = { id: this.orderId++, cust: c, item, state: 'open', t0: this.time, patience: 70 + (c.persona === 'student' ? -15 : 10), claimed: null, quality: 1, table: c.desk ? c.desk.label : '?' };
    c.order = o; c.ordersLeft--; this.orders.push(o); this.audio.pop(); this.emit(true);
  }
  cancelOrder(o: Order) {
    if (o.state === 'delivered' || o.state === 'cancelled') return; o.state = 'cancelled'; o.cust.order = null; o.cust.sat -= 16; o.cust.cause('food', 18); o.cust.setBubble(null); this.addRep(-0.25); this.orders = this.orders.filter((x) => x !== o); this.player.tray = this.player.tray.filter((x) => x !== o); if (this.mini && this.mini.order === o) this.mini = null;
    this.toast('⌛ ' + o.cust.name + ' siparişinden vazgeçti', 'warn');
  }
  deliverOrder(o: Order, by: 'player' | 'employee', skill = 1) {
    if (o.state === 'delivered' || o.state === 'cancelled') return; o.state = 'delivered'; const c = o.cust; const price = MENU[o.item].price; const waitFrac = (this.time - o.t0) / o.patience;
    this.addIncome(price, 'bufe'); const tip = Math.round(price * 0.12 * o.quality * (1 + 0.2 * this.upg('headset') + 0.15 * this.upg('buffet')) * (c.sat > 60 ? 1 : 0) * (waitFrac < 0.5 ? 1.4 : 0.8)); if (tip > 0) this.addIncome(tip, 'bahsis');
    c.spent += price; c.order = null; c.setBubble(null); c.sat = clamp(c.sat + 10 + o.quality * 4 - waitFrac * 6, 0, 100); c.eatT = 7 + rnd(0, 4); this.orders = this.orders.filter((x) => x !== o); this.player.tray = this.player.tray.filter((x) => x !== o);
    this.stats.orders++; this.progressGoal('ord', 1); this.audio.cash(); this.toast(`🍽️ ${MENU[o.item].name} teslim → ${o.table}${tip ? ' (+' + tip + '₺ bahşiş)' : ''}`, 'good'); void by; void skill;
  }
  afterEat(c: Customer) { const d = c.desk; if (!d) return; if (Math.random() < 0.55) this.spawnTrash(d.floor, d.service.x + rnd(-0.2, 0.2), d.service.z + rnd(-0.2, 0.2), Math.random() < 0.12 ? 'spill' : 'cup'); }
  findOrderFor(e: Employee) { return this.orders.find((o) => o.state === 'open' && !o.claimed && o.cust.desk) || null; }

  /* ============ trash / repairs ============ */
  spawnTrash(floor: number, x: number, z: number, type: 'cup' | 'paper' | 'spill') {
    const nav = this.world.navs[floor]; if (nav.isBlocked(x, z) && type !== 'spill') { const c = nav.nearestFreeCell(nav.cx(x), nav.cz(z), 4); if (c < 0) return; x = nav.minX + ((c % nav.w) + 0.5) * nav.cell; z = nav.minZ + (((c / nav.w) | 0) + 0.5) * nav.cell; }
    if (this.trash.length > 22) return; let mesh: THREE.Object3D;
    if (type === 'cup') { mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.12, 8), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 })); mesh.position.y = 0.06; mesh.rotation.z = rnd(-1.2, 1.2); }
    else if (type === 'paper') { mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), new THREE.MeshLambertMaterial({ color: 0xcfcfd8 })); mesh.position.y = 0.07; }
    else { mesh = new THREE.Mesh(new THREE.CircleGeometry(0.4, 14).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x6a3a1a, transparent: true, opacity: 0.8 })); mesh.position.y = 0.012; }
    const g = new THREE.Group(); g.add(mesh); g.position.set(x, FY[floor], z); this.world.fg[floor].add(g);
    this.trash.push({ id: this.trashId++, floor, x, z, type, mesh: g, claimed: null, removed: false });
  }
  spawnRandomTrash() {
    const f = pick([0, 0, 0, 1, 2].filter((x) => x < 3)); const nav = this.world.navs[f]; for (let i = 0; i < 12; i++) { const x = rnd(-10, 10), z = rnd(-8, 8.5); if (!nav.isBlocked(x, z)) { this.spawnTrash(f, x, z, pick(['cup', 'paper', 'paper', 'spill'])); return; } }
  }
  cleanTrash(t: Trash, by: Employee | null) { if (t.removed) return; t.removed = true; this.world.fg[t.floor].remove(t.mesh); this.trash = this.trash.filter((x) => x !== t); this.stats.cleaned++; this.progressGoal('clean', 1); this.audio.sweep(); if (!by) this.reach = 0.01; }
  findTrashFor(e: Employee) { let best: Trash | null = null, bd = 1e9; for (const t of this.trash) { if (t.claimed && t.claimed !== e && !t.claimed.removed && (t.claimed as any).target === t) continue; const d = Math.abs(t.floor - e.floor) * 25 + Math.hypot(t.x - e.x, t.z - e.z); if (d < bd) { bd = d; best = t; } } return best; }
  dirtNear(floor: number) { let n = 0; for (const t of this.trash) if (t.floor === floor) n += t.type === 'spill' ? 1.4 : 1; return n; }
  findBrokenFor(e: Employee) { return this.world.desks.find((d) => d.owned && d.broken && d.sev === 'minor' && !d.claimed) || null; }
  repairDesk(d: Desk, by: string) {
    if (!d.broken) return; d.broken = false; d.sev = null; d.wear = Math.max(0, d.wear * 0.5 - 0.05); d.claimed = null; this.stats.repairs++; this.progressGoal('fix', 1);
    const u = d.user as Customer | null; if (u) { u.sat = clamp(u.sat + 12, 0, 100); u.angry = false; u.patience = u.patienceMax; u.setBubble(null); }
    this.audio.good(); if (by !== 'cheat') this.toast('🔧 ' + d.label + ' tamir edildi' + (by === 'tech' ? ' (teknisyen)' : ''), 'good'); this.emit(true);
  }

  /* ============ goals, events ============ */
  progressGoal(kind: string, v: number) {
    for (const g of this.goals) { if (g.kind !== kind || g.done) continue; g.progress += v; if (g.progress >= g.target) { g.done = true; this.state.money += g.reward; this.stats.income.odul += g.reward; this.addRep(0.8); this.toast(`🎯 Hedef tamam: ${g.text} (+${g.reward}₺)`, 'good'); this.audio.good(); } }
  }
  triggerEvent(id: string) {
    const ev = EVENTS[id]; const st = this.state; this.eventsActive[id] = st.time + ev.dur; this.banner = { text: ev.name + ' — ' + ev.desc, icon: ev.icon, good: ev.good, t: 8 }; this.toast(ev.icon + ' ' + ev.name, ev.good ? 'good' : 'bad');
    switch (id) {
      case 'lag': this.eventsActive.lag = st.time + (EVENTS.lag.dur * (1 - this.upg('net') * 0.25)); this.audio.bad(); break;
      case 'blackout': st.power = false; st.blackout = true; this.audio.bad(); this.audio.thunder(); this.eventsActive.blackout = st.time + EVENTS.blackout.dur * (1 - this.upg('net') * 0.0); break;
      case 'streamer': this.spawnCustomer('streamer', true); break;
      case 'rain': st.weather = 1; this.audio.thunder(); break;
      case 'festival': this.street.fest = 1; for (let i = 0; i < 8; i++) { const p = new Pedestrian(this); p.side = i % 2; p.lane = i + 20; p.place(0, rnd(-30, 30), p.side === 0 ? 12.2 : 23.2, rnd(0, 6)); p.pickNext(); this.peds.push(p); this.tempPeds.push(p); } break;
      case 'sponsor': this.addIncome(200, 'odul'); st.stock.drink += 12; st.stock.snack += 6; this.audio.cash(); break;
      case 'inspect': this.inspectEnd = st.time + ev.dur; break;
      default: break;
    }
  }
  endEvent(id: string) {
    const st = this.state; delete this.eventsActive[id];
    if (id === 'blackout') { st.power = true; st.blackout = false; this.toast('💡 Elektrikler geldi', 'good'); }
    if (id === 'rain') { st.weather = 0; }
    if (id === 'festival') { this.street.fest = 0; for (const p of this.tempPeds) { p.dispose(); this.peds = this.peds.filter((x) => x !== p); } this.tempPeds = []; }
    if (id === 'lag') this.toast('📶 İnternet düzeldi', 'good');
    if (id === 'inspect') {
      const clean = this.trash.length <= 2 && !this.world.desks.some((d) => d.owned && d.broken);
      if (clean) { this.addIncome(400, 'odul'); this.addRep(3); this.toast('📋 Denetim başarılı! +400₺ ödül, itibar arttı', 'good'); this.audio.good(); } else { const f = Math.round(300 * (this.state.mode === 'sandbox' ? 0.25 : 1)); this.state.money -= f; this.stats.expenses.ceza += f; this.addRep(-3); this.toast('📋 Denetim başarısız: ' + fmtMoney(f) + ' ceza! Temizlik ve arızalara dikkat.', 'bad'); this.audio.bad(); }
    }
  }
  resolveEvent(id: string) { if (this.event(id)) this.endEvent(id); }

  /* ============ tournament ============ */
  tourneyUpdate(dt: number) {
    const T = this.tourney; if (!T || T.status === 'done') return; const st = this.state; const es = this.world.desks.filter((d) => d.owned && d.type === 'esport');
    const sb = this.screens.big;
    if (T.status === 'announced' && st.time >= 1080) { T.status = 'prep'; for (const d of es) d.lockedForTourney = true; this.toast('🏆 Turnuva hazırlığı! Takımlar 2. kata geliyor.', 'info'); }
    if (T.status === 'prep') {
      if (!T.spawned && st.time >= 1085) {
        T.spawned = true; const free = es.filter((d) => !d.user && !d.reserved); const n = Math.max(2, Math.min(10, Math.floor(free.length / 2) * 2)); const A = this.world.teamA.filter((d) => d.owned), B = this.world.teamB.filter((d) => d.owned);
        const seatsList: Desk[] = []; for (let i = 0; i < Math.max(A.length, B.length); i++) { if (A[i]) seatsList.push(A[i]); if (B[i]) seatsList.push(B[i]); } const use = seatsList.filter((d) => !d.user && !d.reserved).slice(0, n);
        use.forEach((d, i) => { const c = new Customer(this, 'esports'); c.tourney = true; c.owed = 0; c.sessionLeft = 99999; c.sessionTotal = 99999; c.ordersLeft = 0; this.customerSetup(c, i * 1.4); d.reserved = c; c.desk = d; c.checkedIn = true; c.state = 'toSeat'; c.goto(this.plan(c, { floor: 2, x: d.seat.ax, z: d.seat.az }, false)); T.players.push(c); }); if (!use.length) { T.status = 'done'; this.toast('Turnuva için uygun masa bulunamadı, iptal.', 'bad'); }
      }
      if (!T.spawnedSpec && st.time >= 1105) {
        T.spawnedSpec = true; const n = clamp(Math.round(st.rep / 7 + es.length), 4, 20); const seats = this.world.audience.slice().sort(() => Math.random() - 0.5).slice(0, n);
        seats.forEach((s: Seat, i: number) => { const c = new Customer(this, 'spectator'); c.tourney = true; c.owed = 0; c.sessionLeft = 99999; c.ordersLeft = 0; this.customerSetup(c, i * 0.7); (s as any).reserved = c; c.seat = s; c.state = 'watch'; c.checkedIn = true; c.paid = true; c.goto(this.plan(c, { floor: 2, x: s.ax, z: s.az }, Math.random() < 0.25)); T.spec.push(c); this.addIncome(40, 'turnuva'); });
      }
      const seatedN = T.players.filter((c: Customer) => c.seated).length; const ready = seatedN >= 2 && seatedN >= Math.ceil(T.players.length * 0.7);
      sb.msg = ready ? 'Konsoldan başlat!' : 'Takımlar geliyor...'; sb.title = T.a + '  vs  ' + T.b; T.ready = ready;
      if (st.time > 1290) { T.status = 'done'; this.cancelTourney(); }
    }
    if (T.status === 'live') {
      T.rt += dt; T.cheerT = Math.max(0, T.cheerT - dt); const round = Math.min(T.rounds, 1 + Math.floor(T.rt / 32)); if (round !== T.round) { T.round = round; sb.round = round; }
      const tick = Math.floor(T.rt / 4); if (tick !== T.tick && T.rt < T.rounds * 32) { T.tick = tick; const w = Math.random() < 0.5 + (T.q - 0.5) * 0.1; if (w) T.sa++; else T.sb++; sb.sa = T.sa; sb.sb = T.sb; T.cheerT = 3; this.audio.cheer(0.6); for (const c of T.spec) c.nextAct = Math.random(); sb.msg = (w ? T.a : T.b) + ' skor yaptı!'; }
      sb.live = true; sb.k = 1;
      if (T.rt >= T.rounds * 32) { T.status = 'ending'; T.rt = 0; const aw = T.sa >= T.sb; sb.msg = (aw ? T.a : T.b) + ' KAZANDI!'; T.cheerT = 8; this.audio.cheer(1.4); for (const c of T.players) c.setAct('cheer', 6); }
    }
    if (T.status === 'ending') {
      T.rt += dt; T.cheerT = 5; this.screens.big.live = false;
      if (T.rt > 8) {
        T.status = 'done'; const rev = Math.round(T.spec.length * 55 + T.players.length * 35 + 300 * T.q); this.addIncome(rev, 'turnuva'); this.addRep(2 + 4 * T.q); this.stats.tourney++; this.toast(`🏆 Turnuva tamamlandı! Gelir ${fmtMoney(rev)}, ün +${(2 + 4 * T.q).toFixed(1)}`, 'good'); this.audio.good();
        for (const c of [...T.players, ...T.spec]) { c.paid = true; c.sat = 90; c.reviewDone = false; c.angry = false; if (c.seated) { c.state = 'standing'; c.standUp(); } else if (c.state === 'toSeat' || c.state === 'watch') { c.leaveNow(); } c.stateT = 0; this.finalizeCustomer(c); }
        for (const d of es) d.lockedForTourney = false; sb.msg = 'Teşekkürler!';
      }
    }
  }
  cancelTourney() {
    const T = this.tourney; this.toast('🏆 Turnuva başlatılmadı! İptal edildi, itibar düştü.', 'bad'); this.addRep(-3); for (const c of [...T.players, ...T.spec]) { c.paid = true; c.angry = true; c.sat = 10; this.finalizeCustomer(c); if (c.seated) { c.state = 'standing'; c.standUp(); } else c.leaveNow(true); }
    for (const d of this.world.desks) d.lockedForTourney = false; this.screens.big.msg = 'Turnuva iptal'; this.screens.big.live = false;
  }
  startTourney() {
    const T = this.tourney; if (!T || T.status !== 'prep') return; if (!T.ready) { this.toast('Takımlar henüz yerlerine oturmadı.', 'warn'); return; }
    const es = this.world.desks.filter((d) => d.owned && d.type === 'esport'); const work = es.filter((d) => !d.broken).length / Math.max(1, es.length); const clean = this.trash.filter((t) => t.floor === 2).length <= 1 ? 1 : 0.4; const stock = this.state.stock.snack >= 6 ? 1 : 0.4;
    T.q = clamp(work * 0.5 + clean * 0.25 + stock * 0.25, 0, 1); if (stock === 1) this.state.stock.snack -= 6; T.status = 'live'; T.rt = 0; T.tick = -1; T.sa = 0; T.sb = 0; T.round = 1; this.screens.big.sa = 0; this.screens.big.sb = 0; this.screens.big.round = 1; this.screens.big.rounds = T.rounds; this.screens.big.title = T.a + '  vs  ' + T.b; this.screens.big.msg = 'Maç başladı!';
    this.audio.cheer(1); this.toast(`🏆 Turnuva başladı! Hazırlık kalitesi: %${Math.round(T.q * 100)}`, 'good');
  }

  /* ============ staff ============ */
  spawnEmployee(job: Job, name: string, skill: number, wage: number, id?: number, ot = false, atPost = false) {
    const e = new Employee(this, job, name, skill, wage, id ?? this.empId++); (e as any).overtime = !!ot; (e as any).done = 0; const p = e.post(); if (atPost) e.place(0, p.x + rnd(-0.2, 0.2), p.z, 0); else { e.place(0, 0.4, 10.9, Math.PI); e.go(0, p.x, p.z); }
    this.employees.push(e); this.state.emps.push({ id: e.id, job, name, skill, wage }); return e;
  }
  hire(cid: number) {
    const c = this.candidates.find((x) => x.id === cid); if (!c) return; const same = this.employees.filter((e) => e.job === c.job).length; if (same >= (c.job === 'cashier' ? 1 : 2)) { this.toast('Bu görev için daha fazla çalışan alamazsın (' + JOBS[c.job].name + ')', 'warn'); return; }
    if (!this.spend(c.wage, 'maas', 'İşe alım')) return; this.candidates = this.candidates.filter((x) => x !== c); this.spawnEmployee(c.job, c.name, c.skill, c.wage); this.toast('👋 ' + c.name + ' işe alındı (' + JOBS[c.job].name + ')', 'good'); this.audio.good(); this.emit(true);
  }
  fire(id: number) { const e = this.employees.find((x) => x.id === id); if (!e) return; this.employees = this.employees.filter((x) => x !== e); this.state.emps = this.state.emps.filter((x: any) => x.id !== id); if (e.carrying) { e.carrying.claimed = null; if (e.carrying.state === 'making') e.carrying.state = 'open'; } e.dispose(); this.toast(e.name + ' işten çıkarıldı', 'warn'); this.emit(true); }
  toggleOvertime(id: number) { const e = this.employees.find((x) => x.id === id) as any; if (!e) return; e.overtime = !e.overtime; e.speedMul = e.overtime ? 1.3 : 1; this.toast(e.name + (e.overtime ? ': fazla mesai açıldı (+%40 maaş, +%30 hız)' : ': normal mesai'), 'info'); this.emit(true); }

  /* ============ store ============ */
  price(p: number) { return Math.round(p * (this.event('sale') ? 0.75 : 1)); }
  buyDesk(id: number) {
    const d = this.world.desks.find((x) => x.id === id); if (!d || d.owned) return; const p = this.price(DESK_INFO[d.type].price); if (!this.spend(p, 'yatirim', DESK_INFO[d.type].name + ' (' + d.label + ')')) return;
    d.owned = true; this.state.owned.push(d.id); this.audio.cash(); this.audio.good(); this.toast('🛒 ' + d.label + ' satın alındı!', 'good'); if (this.state.phase === 'prep') this.save(); this.emit(true);
  }
  buyUpgrade(id: string) {
    const u = UPGRADES.find((x) => x.id === id)!; const lvl = this.upg(id); if (lvl >= u.costs.length) return; const p = this.price(u.costs[lvl]); if (!this.spend(p, 'yatirim', u.name + ' Sv.' + (lvl + 1))) return;
    this.state.upg[id] = lvl + 1; this.audio.cash(); this.audio.good(); this.toast(`⬆️ ${u.name} Seviye ${lvl + 1}`, 'good'); this.emit(true);
  }
  buyStock(cat: StockCat) { const s = STOCK_INFO[cat]; if (!this.spend(s.cost * s.batch, 'stok', s.name)) return; this.state.stock[cat] += s.batch; this.audio.pop(); this.toast(`📦 +${s.batch} ${s.name}`, 'good'); this.emit(true); }
  doMaintenance() { const owned = this.world.desks.filter((d) => d.owned); const cost = owned.length * 25; if (this.state.maint) { this.toast('Bugün zaten bakım yapıldı.', 'info'); return; } if (!this.spend(cost, 'bakim', 'Bakım')) return; this.state.maint = 1; for (const d of owned) d.wear *= 0.25; this.toast('🛠️ Genel bakım yapıldı: arıza ihtimali azaldı', 'good'); this.audio.good(); this.emit(true); }

  /* ============ customers spawning ============ */
  customerSetup(c: Customer, delay = 0) {
    const side = Math.random() < 0.5 ? -1 : 1; c.exitSide = side; c.place(0, side * 24, 12.1 + rnd(-0.3, 0.3), side > 0 ? -Math.PI / 2 : Math.PI / 2); if (delay) { c.frozen = true; c.delayT = delay; }
    this.customers.push(c);
  }
  pickPersona(): Persona {
    const st = this.state, h = (st.time / 60) % 24; const w: [Persona, number][] = [['student', (h > 14 && h < 20 ? 4 : 2.5)], ['regular', h > 17 ? 3.5 : 2], ['quick', 2]];
    if (this.world.desks.some((d) => d.owned && d.type === 'racing')) w.push(['racer', 1.6]); if (this.world.desks.some((d) => d.owned && d.type === 'vip') && st.rep >= 22) w.push(['vip', 1.0 + this.upg('decor') * 0.5 + (h > 18 ? 0.8 : 0)]);
    if (this.world.desks.some((d) => d.owned && d.type === 'esport')) w.push(['esports', 1.3]); if (st.day >= 2) w.push(['thief', 0.35 + (1 - st.rep / 100) * 0.7 - this.upg('sec') * 0.12]);
    const tot = w.reduce((a, b) => a + Math.max(0.05, b[1]), 0); let r = Math.random() * tot; for (const [p, ww] of w) { r -= Math.max(0.05, ww); if (r <= 0) return p; } return 'student';
  }
  spawnCustomer(persona?: Persona, force = false) {
    const st = this.state; const active = this.customers.filter((c) => !c.tourney).length; const cap = this.world.desks.filter((d) => d.owned).length * 1.5 + 5;
    if (!force && (this.queue.length >= 6 || active > cap)) { this.stats.turned++; this.addRep(-0.04); return; }
    const p = persona || this.pickPersona(); const c = new Customer(this, p); if (p === 'thief') { c.isThief = true; }
    if (st.mode === 'sandbox') c.patience = c.patienceMax = c.patienceMax * 1.2; this.customerSetup(c); this.addToQueue(c); c.state = 'enter'; c.queueTarget = -1; c.rig.look = null;
    if (p === 'vip' || p === 'streamer') this.audio.ding();
  }
  arrivalRate() {
    const st = this.state, h = (st.time / 60) % 24; let hourF = h < 12 ? 0.7 : h < 15 ? 1.0 : h < 19 ? 1.4 : h < 22 ? 1.5 : 0.9; const owned = this.world.desks.filter((d) => d.owned).length;
    let r = (1.6 + st.rep / 100 * 3.6 + owned * 0.17 + st.buzz * 0.5 + this.upg('decor') * 0.25) * hourF; if (this.event('rush')) r *= 2.2; if (this.event('festival')) r *= 1.5; if (st.rain > 0.5) r *= 1.2; if (!st.power) r *= 0.2; if (st.mode === 'sandbox') r *= 0.9; return r; // customers per game hour
  }

  /* ============ minigame ============ */
  startMini(o: Order) {
    if (this.state.stock && o.state !== 'open') return; o.state = 'making'; o.claimed = this.player; this.mini = { order: o, step: 0, pos: 0, dir: 1, speed: 1.15, zone: [0.38, 0.62], hits: 0, flash: 0, msg: '', steps: ['Malzemeleri hazırla', 'Pişir / doldur', 'Tepsiye diz'], t: 0 };
    this.emit(true);
  }
  cancelMini() { if (!this.mini) return; const o = this.mini.order; if (o.state === 'making') { o.state = 'open'; o.claimed = null; } this.mini = null; this.emit(true); }
  miniHit() {
    const m = this.mini; if (!m) return; const hit = m.pos >= m.zone[0] && m.pos <= m.zone[1]; if (hit) { m.hits++; this.audio.good(); m.msg = 'Harika!'; } else { this.audio.bad(); m.msg = 'Iskaladın'; } this.audio.sweep(); m.flash = 0.5; m.step++;
    if (m.step >= 3) { const o: Order = m.order; o.quality = 0.7 + m.hits * 0.15; o.state = 'ready'; o.claimed = this.player; this.player.tray.push(o); this.mini = null; this.audio.ding(); this.toast(`🍽️ ${MENU[o.item].name} hazır! Tepsiyle ${o.table} masasına götür.`, 'good'); }
    else { m.speed += 0.35; const w = 0.2 - m.step * 0.02; const c = rnd(0.25, 0.75); m.zone = [c - w, c + w]; }
    this.emit(true);
  }

  /* ============ interactions ============ */
  pressInteract() {
    if (this.screen !== 'playing') return; this.audio.init(); if (this.mini) { this.miniHit(); return; }
    const pr = this.prompt; if (!pr) { this.reach = 0.01; return; } this.reach = 0.01;
    if (pr.hold <= 0) { pr.run(); this.interactHeld = false; this.hold = { key: '', t: 0 }; }
  }
  buildInteracts(): Interact[] {
    const L: Interact[] = []; const w = this.world, st = this.state, p = this.player; const fl = p.floor; const sp = w.spots; const tray = p.tray;
    const near = (x: number, z: number, r: number) => Math.hypot(p.x - x, p.z - z) < r;
    const add = (i: Interact) => L.push(i);
    if (fl === 0) {
      const cand = this.serveCandidate(); const waiting = this.queue.length;
      if (waiting) add({ key: 'reg', text: cand ? (cand.state === 'payQueue' ? `Ödeme al: ${cand.name}` : `Müşteriyi karşıla: ${cand.name} (${PERSONA[cand.persona].label})`) : 'Kasa: sıradakiler henüz gelmedi / uygun masa yok', x: sp.register.x, z: sp.register.z, floor: 0, r: sp.register.r, hold: 0, prio: 5, mode: 'type', run: () => { if (cand) { this.regBusy = 0.7; this.serve(cand, true); } } });
      else add({ key: 'reg', text: 'Kasa — sırada müşteri yok', x: sp.register.x, z: sp.register.z, floor: 0, r: sp.register.r, hold: 0, prio: 1, mode: 'type', run: () => { } });
      const open = this.orders.filter((o) => o.state === 'open' && !o.claimed && o.cust.desk);
      add({ key: 'buf', text: open.length ? `Sipariş hazırla: ${MENU[open[0].item].name} → ${open[0].table}` : tray.length ? 'Büfe — tepsin dolu, masaya götür' : 'Büfe — bekleyen sipariş yok', x: sp.buffet.x, z: sp.buffet.z, floor: 0, r: sp.buffet.r, hold: 0, prio: open.length ? 6 : 1, mode: 'cook', run: () => { if (open.length && tray.length < 2) this.startMini(open[0]); else if (tray.length >= 2) this.toast('Tepsin dolu!', 'warn'); } });
      add({ key: 'adm', text: 'Yönetim masası — Panel, kameralar, mağaza', x: sp.admin.x, z: sp.admin.z, floor: 0, r: sp.admin.r, hold: 0, prio: 4, mode: 'type', run: () => this.openAdmin() });
      if (st.phase === 'prep') add({ key: 'door', text: 'KAFEYİ AÇ (tabelayı çevir)', x: sp.door.x, z: sp.door.z, floor: 0, r: sp.door.r, hold: 0, prio: 7, mode: 'idle', run: () => this.openShop() });
      else if (st.phase === 'open') add({ key: 'door', text: st.time >= 1200 ? 'Günü erken bitir (kafeyi kapat)' : 'Kapı — kafe açık (22:00 sonrası erken kapatılabilir)', x: sp.door.x, z: sp.door.z, floor: 0, r: sp.door.r, hold: 0, prio: 2, mode: 'idle', run: () => { if (st.time >= 1200) this.closeEarly(); else this.toast('Erken kapatma 20:00 sonrası açılır.', 'info'); } });
      if (this.event('lag')) add({ key: 'modem', text: 'Modemi yeniden başlat (basılı tut)', x: sp.modem.x, z: sp.modem.z, floor: 0, r: sp.modem.r, hold: 2.6, prio: 8, mode: 'work', run: () => { this.resolveEvent('lag'); this.audio.good(); } });
      if (st.blackout) add({ key: 'fuse', text: 'Sigorta kutusunu aç (basılı tut)', x: sp.fuse.x, z: sp.fuse.z, floor: 0, r: sp.fuse.r, hold: 2.4, prio: 8, mode: 'work', run: () => { this.resolveEvent('blackout'); this.audio.good(); } });
    }
    if (fl === 2 && this.tourney) { const T = this.tourney; const s2 = sp.console; if (T.status === 'prep') add({ key: 'con', text: T.ready ? 'TURNUVAYI BAŞLAT' : 'Turnuva konsolu — takımlar oturmayı bekliyor', x: s2.x, z: s2.z, floor: 2, r: s2.r, hold: 0, prio: 7, mode: 'type', run: () => this.startTourney() }); else add({ key: 'con', text: 'Turnuva konsolu', x: s2.x, z: s2.z, floor: 2, r: s2.r, hold: 0, prio: 1, mode: 'type', run: () => this.toast(T.status === 'live' ? 'Maç devam ediyor!' : 'Turnuva yok / bitti.', 'info') }); }
    if (!p.inElev && (near(sp.elevCall0.x, sp.elevCall0.z, 2.2))) add({ key: 'elev', text: 'Asansörü çağır', x: sp.elevCall0.x, z: sp.elevCall0.z, floor: fl, r: 2.2, hold: 0, prio: 3, mode: 'idle', run: () => { this.world.elev.call(fl); this.audio.click(); this.toast('Asansör çağrıldı', 'info'); } });
    for (const d of w.desks) {
      if (d.floor !== fl) continue; const x = d.cx + d.seat.fx * 0.9, z = d.cz + d.seat.fz * 0.9;
      if (!d.owned) add({ key: 'buy' + d.id, text: `Satın al: ${d.label} — ${fmtMoney(this.price(DESK_INFO[d.type].price))}`, x, z, floor: fl, r: 1.7, hold: 0, prio: 2, mode: 'idle', face: true, run: () => this.buyDesk(d.id) });
      else if (d.broken) add({ key: 'fix' + d.id, text: `Tamir et (basılı tut): ${d.label} — ${d.sev === 'major' ? 'büyük arıza' : 'küçük arıza'}`, x, z, floor: fl, r: 1.9, hold: d.sev === 'major' ? 3.6 : 2.2, prio: 6, mode: 'work', face: true, run: () => this.repairDesk(d, 'player') });
      else { const u = d.user as Customer | null; const o = u && tray.find((t) => t.cust === u); if (o) add({ key: 'del' + d.id, text: `Siparişi teslim et: ${MENU[o.item].name} → ${u!.name}`, x, z, floor: fl, r: 2.2, hold: 0, prio: 9, mode: 'tray', run: () => this.deliverOrder(o, 'player', 1) }); }
    }
    for (const t of this.trash) if (t.floor === fl) add({ key: 'tr' + t.id, text: t.type === 'spill' ? 'Dökülen içeceği sil (basılı tut)' : 'Çöpü topla (basılı tut)', x: t.x, z: t.z, floor: fl, r: 1.7, hold: t.type === 'spill' ? 1.3 : 0.7, prio: 3, mode: 'clean', face: true, run: () => this.cleanTrash(t, null) });
    for (const c of this.customers) if (c.state === 'flee' && c.floor === fl) add({ key: 'thief' + c.name, text: `YAKALA: ${c.name}!`, x: c.x, z: c.z, floor: fl, r: 1.9, hold: 0, prio: 20, mode: 'reach' as VMMode, run: () => this.catchThief(c) });
    return L;
  }
  updatePrompt(dt: number) {
    if (this.screen !== 'playing' || this.mini) { this.prompt = null; return; }
    const p = this.player; const L = this.buildInteracts(); let best: Interact | null = null, bs = 1e9; const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    for (const i of L) {
      if (i.floor !== p.floor) continue; const dx = i.x - p.x, dz = i.z - p.z; const d = Math.hypot(dx, dz); if (d > i.r) continue;
      if (i.face && d > 0.9 && (dx * fx + dz * fz) / d < 0.25) continue; const sc = d - i.prio * 0.6; if (sc < bs) { bs = sc; best = i; }
    }
    this.prompt = best; const key = best ? best.key + best.text : '';
    if (best && best.hold > 0 && this.interactHeld) {
      if (this.hold.key !== key) this.hold = { key, t: 0 }; this.hold.t += dt; this.holdMode = best.mode; this.emit(true);
      if (this.hold.t >= best.hold) { best.run(); this.hold = { key: '', t: 0 }; this.interactHeld = false; }
    } else { this.hold = { key, t: 0 }; this.holdMode = null; }
  }
  holdMode: VMMode | null = null;

  /* ============ main sim ============ */
  loop = (now: number) => {
    requestAnimationFrame(this.loop); const dt = Math.min(0.05, (now - (this.lastNow || now)) / 1000); this.lastNow = now; this.time += dt; this.frame++;
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc > 1) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    try { this.step(dt); } catch (e) { console.error(e); }
    this.render(dt);
  };
  lastNow = 0;
  step(dt: number) {
    const running = this.screen === 'playing' || this.screen === 'admin';
    const st = this.state; this.screens.update(this.time, dt);
    if (running) this.simulate(dt);
    else { this.street.update(dt, [], () => { }); }
    if (this.screen === 'playing') { if (!this.locked && !this.dragLook && !this.touch.on) { this.noLockT += dt; if (this.noLockT > 0.7 && !this.needLock) { this.needLock = true; this.emit(true); } } else { this.noLockT = 0; if (this.needLock) { this.needLock = false; this.emit(true); } } } else this.noLockT = 0;
    // toasts decay
    for (const t of this.toasts) t.t -= dt; const n = this.toasts.length; this.toasts = this.toasts.filter((t) => t.t > 0); if (this.banner) this.banner.t -= dt; if (n !== this.toasts.length) this.emit(true); else this.emit();
    void st;
  }
  simulate(dt: number) {
    const st = this.state, w = this.world, p = this.player; const playing = this.screen === 'playing';
    // time
    if (st.phase === 'open') { st.time += dt * this.minPerSec; if (st.time >= 1440) { st.time = 1440; st.phase = 'closing'; st.open = false; this.toast('🕛 Gece yarısı! Kafe kapanıyor.', 'info'); this.beginClosing(); } }
    if (st.phase === 'closing') { this.closingT += dt; const left = this.customers.filter((c) => !c.tourney || c.state !== 'gone').length; if ((left === 0 && this.closingT > 3) || this.closingT > 70) { this.finishDay(); return; } if (this.closingT > 8) for (const c of this.customers) if ((c.state === 'play') && c.sessionLeft > 0 && !c.tourney) { c.sessionLeft = 0; } }
    st.rain += ((st.weather > 0 ? 1 : 0) - st.rain) * Math.min(1, dt * 0.35);
    // events schedule
    if (st.phase === 'open') { while (this.sched.length && this.sched[0].t <= st.time) { this.triggerEvent(this.sched.shift()!.id); } }
    for (const id of Object.keys(this.eventsActive)) { if (this.eventsActive[id] <= st.time && st.phase !== 'prep') this.endEvent(id); }
    if (st.phase === 'prep') { /* time frozen */ }
    // spawn
    if ((st.phase === 'open') && st.time < 1380) { this.spawnAcc += dt * this.minPerSec / 60 * this.arrivalRate(); if (this.spawnAcc >= 1) { this.spawnAcc -= 1; this.spawnCustomer(); } }
    st.crowd = this.customers.filter((c) => c.seated).length / Math.max(1, w.desks.filter((d) => d.owned).length);
    // desks: wear, breakdown, screens
    const mins = dt * this.minPerSec * (st.phase === 'prep' ? 0 : 1);
    const pcF = Math.pow(0.8, this.upg('pc')) * (1 - 0.08 * this.upg('kb')) * (st.mode === 'sandbox' ? 0.5 : 1) * (st.maint ? 0.45 : 1);
    for (const d of w.desks) {
      d.sale.visible = !d.owned; (d.sale.material as THREE.SpriteMaterial).opacity = 0.9;
      const kind = !d.owned || !st.power ? 'off' : d.broken ? 'broken' : d.user ? ({ old: 'old', gaming: 'fps', vip: 'rpg', racing: 'race', quiet: 'rpg', esport: 'moba' } as any)[d.type] : 'idle'; setDeskScreen(d, w, kind);
      if (d.fan) d.fan.visible = true; if (d.type === 'racing' && d.wheel && !d.user) d.wheel.rotation.z *= 0.9;
      if (!d.owned || d.broken || mins <= 0) continue; const occ = d.user ? 1 : 0; if (occ) d.wear = Math.min(1.5, d.wear + mins * 0.00018);
      if (Math.random() < DESK_INFO[d.type].fail * (1 + d.wear * 1.6) * pcF * mins * (occ ? 1.7 : 0.12) * (st.phase === 'open' ? 1 : 0.3)) { d.broken = true; d.sev = Math.random() < 0.62 ? 'minor' : 'major'; this.audio.buzz(d.floor === p.floor ? 1 : 0.2); if (d.user) this.toast(`💥 ${d.label} bozuldu! ${(d.user as Customer).name} sinirli...`, 'bad'); else this.toast(`💥 ${d.label} arızalandı`, 'warn'); this.emit(true); }
    }
    // random trash
    if (st.phase === 'open') { this.trashAcc += dt; if (this.trashAcc > 38 - Math.min(18, this.customers.length * 1.2)) { this.trashAcc = 0; this.spawnRandomTrash(); } if (st.rain > 0.5 && Math.random() < dt * 0.04) this.spawnTrash(0, rnd(-1.5, 1.5), rnd(8.5, 9.5), 'spill'); }
    // electricity
    const activePcs = w.desks.filter((d) => d.owned && (d.user || d.reserved)).length; if (st.power && st.phase !== 'prep') this.elecAcc += dt * this.minPerSec / 60 * (7 + w.desks.filter((d) => d.owned).length * 0.35 + activePcs * 0.9 + this.upg('ac') * 6);
    // register
    this.regBusy = Math.max(0, this.regBusy - dt); this.hasCashier = this.employees.some((e) => e.job === 'cashier');
    const cash = this.employees.find((e) => e.job === 'cashier');
    if (cash && Math.hypot(cash.x - w.cashierPt.x, cash.z - w.cashierPt.z) < 0.8 && !cash.busyMoving) { const cand = this.serveCandidate(); if (cand) { this.regTimer += dt * (0.7 + 0.35 * cash.skill) * ((cash as any).overtime ? 1.3 : 1); this.regBusy = Math.max(this.regBusy, 0.3); if (this.regTimer >= 2.4) { this.regTimer = 0; this.serve(cand, false); (cash as any).done++; } } else this.regTimer = 0; } else this.regTimer = 0;
    // player
    if (playing) this.updatePlayer(dt); else { p.rig.speed = 0; }
    this.updatePrompt(dt);
    // mini
    if (this.mini) { const m = this.mini; m.t += dt; m.pos += m.dir * m.speed * dt; if (m.pos > 1) { m.pos = 1; m.dir = -1; } if (m.pos < 0) { m.pos = 0; m.dir = 1; } m.flash = Math.max(0, m.flash - dt); const sp = w.spots.buffet; if (Math.hypot(p.x - sp.x, p.z - sp.z) > 4.5 || m.order.state === 'cancelled') this.cancelMini(); if (this.frame % 4 === 0) this.emit(true); }
    // chars
    this.allChars = [p, ...this.customers, ...this.employees, ...this.peds];
    const vis = this.visibleFloors(); const pf = p.floor;
    for (const c of this.customers) c.update(dt, this.allChars); for (const e of this.employees) e.update(dt, this.allChars); for (const pd of this.peds) pd.update(dt, this.allChars);
    for (const c of this.allChars) { c.visibleNow = c.floor === 0 ? vis[0] || c.z > 10 || c.z < -10 : vis[c.floor] && (Math.abs(c.floor - pf) <= 1 || this.outsideBuilding()); c.rig.root.visible = c.kind === 'player' ? false : (c.floor === 0 && (c.z > 10.3 || Math.abs(c.x) > 12.3 || c.z < -10.3)) ? true : vis[c.floor]; }
    // customers cleanup
    for (const c of this.customers) {
      if (c.state === 'gone') { if (!c.reviewDone && !c.paid && c.checkedIn) { c.paid = true; this.finalizeCustomer(c); } if (!c.checkedIn && !c.tourney) { this.stats.lost++; this.finalizeCustomer(c); } this.removeFromQueue(c); this.releaseDesk(c); if (c.order) { c.order.state = 'cancelled'; this.orders = this.orders.filter((o) => o !== c.order); } c.dispose(); }
    }
    this.customers = this.customers.filter((c) => !c.removed);
    // seat lock for sitting desks
    for (const c of this.customers) if (c.desk && c.seated && c.state === 'play') { c.desk.user = c; }
    this.tourneyUpdate(dt);
    // hide tourney players leaving etc handled by customers
    // inspection
    // world & street
    const blockers: { x: number; z: number }[] = []; for (const c of this.allChars) if (c.floor === 0 && c.z > 12.8 && c.z < 22.5) blockers.push({ x: c.x, z: c.z }); // characters on road
    this.street.update(dt, blockers, () => { const d = Math.hypot(p.x - 6, p.z - 17); if (d < 25) this.audio.honk(); });
    const near = this.allChars.some((c) => c.floor === 0 && !c.sitting && Math.abs(c.x) < 2.8 && c.z > 8.2 && c.z < 12.6);
    w.update(this.time, dt, { open: st.open, night: this.street.nightK, doorNear: near, power: st.power, lag: this.event('lag') });
    w.shutterTarget = st.phase === 'report' ? 1 : 0;
    this.street.setSky(st.time, st.rain, st.power, this.camera.position); this.street.fest = this.event('festival') ? 1 : 0;
    for (let f = 0; f < 3; f++) for (const l of w.lights[f]) { if (!st.power) { l.color.setHex(0xff3a2a); l.intensity = 2.2 + Math.sin(this.time * 4) * 1.2; } else l.color.setHex([0xffe6c0, 0xd8e8ff, 0xffd8ee][f]); }
    this.street.hemi.intensity *= st.power ? 1 : 0.62;
    this.updateAtmos(dt); this.updateAudio(dt);
    if (st.phase === 'report') return;
    // goals live
    for (const g of this.goals) { if (g.kind === 'sat' && !g.done && this.stats.satN >= 6) { g.progress = Math.round(this.stats.satSum / this.stats.satN); if (g.progress >= g.target && st.phase !== 'open') { } } }
  }
  outsideBuilding() { const p = this.player; return !(p.x > -12.5 && p.x < 12.5 && p.z > -10.5 && p.z < 10.5); }
  visibleFloors(): boolean[] { const p = this.player; if (this.outsideBuilding()) return [true, true, true]; const f = p.floor; return [true, f >= 0, f >= 1 || this.world.elev.moving && false]; }
  updateAudio(dt: number) {
    const p = this.player, st = this.state, w = this.world; const outdoors = this.outsideBuilding() ? 1 : (p.z > 8.5 && p.floor === 0 && Math.abs(p.x) < 2 ? 0.5 : 0);
    const pcs = w.desks.filter((d) => d.owned && d.user).length + 2; const cook = this.orders.some((o) => o.state === 'making') || this.mini ? 1 : 0;
    const em = w.elev.moving && Math.hypot(p.x + 6.6, p.z + 8) < 14 ? 1 : 0;
    this.audio.ambient(dt, { pcs, rain: st.rain, outdoors, elevMove: em, cook: cook && p.floor === 0 && p.z < -2 ? 1 : 0, traffic: 1, power: st.power ? 1 : 0.3 });
    this.keyAcc -= dt; if (this.keyAcc <= 0) { this.keyAcc = 0.11; let n = 0, nd = 99; for (const c of this.customers) if (c.seated && c.rig.act === 'type' && c.floor === p.floor) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < 11) { n++; nd = Math.min(nd, d); } } if (n && Math.random() < Math.min(0.9, n * 0.12)) this.audio.key(clamp(1.1 - nd / 11, 0.15, 1)); }
    this.mumbleAcc -= dt; if (this.mumbleAcc <= 0) { this.mumbleAcc = rnd(0.9, 2.2); const n = this.customers.filter((c) => c.floor === p.floor && Math.hypot(c.x - p.x, c.z - p.z) < 9).length; if (n && Math.random() < 0.7) this.audio.mumble(clamp(n * 0.2, 0.15, 0.9)); if (this.tourney && this.tourney.cheerT > 0 && p.floor === 2) this.audio.clap(0.7); }
    if (w.desks.some((d) => d.owned && d.broken && d.floor === p.floor && Math.hypot(d.cx - p.x, d.cz - p.z) < 8) && Math.random() < dt * 0.6) this.audio.buzz(0.6);
  }
  onFootstep = (c: Char) => { const p = this.player; if (c.floor !== p.floor) return; const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < 9) this.audio.step(clamp(1 - d / 9, 0.05, 0.6) * (c.v > 3 ? 1.4 : 1)); };

  updatePlayer(dt: number) {
    const p = this.player, k = this.keys; let ix = 0, iz = 0;
    if (k.has('w') || k.has('arrowup')) iz += 1; if (k.has('s') || k.has('arrowdown')) iz -= 1; if (k.has('a') || k.has('arrowleft')) ix -= 1; if (k.has('d') || k.has('arrowright')) ix += 1;
    ix += this.touch.x; iz += this.touch.z; const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
    if (this.mini) { ix = 0; iz = 0; }
    const sprint = (k.has('shift') || this.touch.run) && len > 0.1; const carry = p.tray.length > 0; const base = sprint ? 5.7 : 3.1; const spd = base * (carry ? 0.88 : 1) * (this.state.mode === 'sandbox' ? 1 : 1);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    const tx = (fx * iz + rx * ix) * spd, tz = (fz * iz + rz * ix) * spd; const ac = 26;
    p.vx += clamp(tx - p.vx, -ac * dt, ac * dt); p.vz += clamp(tz - p.vz, -ac * dt, ac * dt);
    const ax = (p.vx - this.lastVel.x) / Math.max(dt, 1e-3), az = (p.vz - this.lastVel.z) / Math.max(dt, 1e-3); this.lastVel.x = p.vx; this.lastVel.z = p.vz;
    p.x += p.vx * dt; p.z += p.vz * dt; p.collide(); p.updateLevel();
    // car push safety
    const speed = Math.hypot(p.vx, p.vz); p.v = speed; p.bobT += dt * speed * 1.75; p.yaw = this.yaw; p.syncRoot();
    if (speed > 0.8 && Math.floor(p.bobT / Math.PI) !== p.lastStep) { p.lastStep = Math.floor(p.bobT / Math.PI); this.audio.step(sprint ? 0.9 : 0.6); }
    // tray tilt: local accel
    const lax = ax * rx + az * rz, laz = ax * fx + az * fz; this.trayTilt.x = clamp(laz * 0.012, -0.25, 0.25); this.trayTilt.z = clamp(-lax * 0.012, -0.25, 0.25);
    // ground y smoothing
    p.y = p.y; this.reach = this.reach > 0 ? this.reach + dt * 2.6 : 0; if (this.reach >= 1) this.reach = 0;
  }
  vmMode(): VMMode { if (this.mini) return 'cook'; if (this.holdMode && this.interactHeld) return this.holdMode; if (this.player.tray.length) return 'tray'; return 'idle'; }

  finishDay() {
    const st = this.state; st.phase = 'report'; const w = this.world; const owned = w.desks.filter((d) => d.owned); const sbx = st.mode === 'sandbox' ? 0.25 : 1;
    const floorsUsed = new Set(owned.map((d) => d.floor)).size; const rent = Math.round((280 + floorsUsed * 90 + Math.min(st.day, 20) * 10) * sbx);
    const elec = Math.round(this.elecAcc * sbx * 1); const wages = Math.round(this.employees.reduce((a, e) => a + e.wage * ((e as any).overtime ? 1.4 : 1), 0) * sbx); const maint = Math.round(owned.length * 10 * sbx);
    const spoil = Math.floor(st.stock.food * 0.15); st.stock.food -= spoil; this.stats.expenses.kira += rent; this.stats.expenses.elektrik += elec; this.stats.expenses.maas += wages; this.stats.expenses.bakim += maint;
    st.money -= rent + elec + wages + maint; st.buzz *= 0.7; const gain = Math.round(this.upg('decor') * 0.5 + 0.0); this.addRep(gain);
    const inc = Object.values(this.stats.income).reduce((a, b) => a + b, 0); const exp = Object.values(this.stats.expenses).reduce((a, b) => a + b, 0); const avg = this.stats.satN ? this.stats.satSum / this.stats.satN : 0;
    this.lastDayReport = { day: st.day, income: this.stats.income, expenses: this.stats.expenses, totalIncome: Math.round(inc), totalExpense: Math.round(exp), net: Math.round(inc - exp), money: Math.round(st.money), customers: this.stats.customers, lost: this.stats.lost + this.stats.turned, avgSat: Math.round(avg), rep: st.rep, reviews: this.stats.reviews.slice(0, 6), goals: this.goals.map((g) => ({ ...g })), invest: this.stats.invest, orders: this.stats.orders, repairs: this.stats.repairs, cleaned: this.stats.cleaned, caught: this.stats.caught, escaped: this.stats.escaped, spoil, tourney: this.stats.tourney, tips: [] as string[] };
    const tips: string[] = []; if (st.stock.drink < 6 || st.stock.snack < 4 || st.stock.food < 3) tips.push('Stok azalıyor — Mağaza sekmesinden stok al.'); if (avg < 60 && this.stats.satN > 3) tips.push('Memnuniyet düşük: arızaları ve çöpleri hızlı gider.'); if (st.money > 3000 && this.employees.length < 2) tips.push('Biriken paranı çalışan veya yükseltmeye yatır.'); if (this.stats.lost + this.stats.turned > 5) tips.push('Çok müşteri kaçtı: daha fazla masa veya kasiyer gerekebilir.'); if (st.money < 400) tips.push('Nakit kritik: giderleri kontrol et.');
    this.lastDayReport.tips = tips; this.history.push({ day: st.day, net: this.lastDayReport.net, income: Math.round(inc), customers: this.stats.customers }); for (const c of [...this.customers]) c.dispose(); this.customers = []; this.queue = [];
    this.world.shutterTarget = 1; this.audio.shutter();
    if (st.mode === 'normal' && st.money < -800) { this.setScreen('gameover'); return; }
    if (!this.victoryShown && st.rep >= 90 && st.money >= 20000) { this.victoryShown = true; this.setScreen('victory'); return; }
    this.setScreen('report');
  }
  nextDay() { this.state.day++; this.refreshCandidates(); this.save(); this.startDay(); this.needLock = !this.touch.on; this.lock(); }
  continueAfterVictory() { this.setScreen('report'); }

  /* ============ admin data ============ */
  adminSnap() {
    const st = this.state, w = this.world; const statusOf = (d: Desk) => !d.owned ? 'Satılık' : d.broken ? 'Arızalı' : d.user ? 'Dolu' : d.reserved ? 'Rezerve' : d.lockedForTourney ? 'Turnuva' : 'Boş';
    return {
      desks: w.desks.map((d) => ({ id: d.id, label: d.label, type: d.type, floor: d.floor, status: statusOf(d), owned: d.owned, broken: d.broken, sev: d.sev, price: this.price(DESK_INFO[d.type].price), user: d.user ? (d.user as Customer).name : '', wear: Math.round(d.wear * 100), rate: DESK_INFO[d.type].rate })),
      customers: this.customers.filter((c) => !c.tourney || c.state !== 'gone').map((c) => ({ name: c.name, persona: PERSONA[c.persona].label, icon: PERSONA[c.persona].icon, state: this.stateLabel(c), wait: c.state === 'queue' || c.state === 'payQueue' ? Math.round(c.patienceMax - c.patience) : 0, sat: Math.round(c.sat), desk: c.desk ? c.desk.label : '', left: Math.max(0, Math.round(c.sessionLeft)) })),
      reviews: this.reviews.slice(0, 12), stock: st.stock, upgrades: UPGRADES.map((u) => ({ id: u.id, name: u.name, icon: u.icon, desc: u.desc, level: this.upg(u.id), max: u.costs.length, cost: this.upg(u.id) < u.costs.length ? this.price(u.costs[this.upg(u.id)]) : 0 })),
      employees: this.employees.map((e) => ({ id: e.id, name: e.name, job: JOBS[e.job].name, icon: JOBS[e.job].icon, skill: e.skill, wage: Math.round(e.wage * ((e as any).overtime ? 1.4 : 1)), state: this.empLabel(e), overtime: !!(e as any).overtime, done: (e as any).done || 0 })),
      candidates: this.candidates.map((c) => ({ ...c, jobName: JOBS[c.job].name, icon: JOBS[c.job].icon, desc: JOBS[c.job].desc })), history: this.history.slice(-7), orders: this.orders.map((o) => ({ id: o.id, item: MENU[o.item].name, table: o.table, state: o.state })),
      income: this.stats.income, expenses: this.stats.expenses, elec: Math.round(this.elecAcc), prep: { lowStock: st.stock.drink < 6 || st.stock.snack < 4 || st.stock.food < 3, broken: w.desks.filter((d) => d.owned && d.broken).length, trash: this.trash.length, emps: this.employees.length }, maint: st.maint, camIdx: this.camIdx,
      cams: CAMS.map((c) => c.name), sale: this.event('sale'), mode: st.mode, tourneyInfo: this.tourney ? { status: this.tourney.status, a: this.tourney.a, b: this.tourney.b, ready: this.tourney.ready } : null,
      rentEst: Math.round((280 + new Set(w.desks.filter((d) => d.owned).map((d) => d.floor)).size * 90 + Math.min(st.day, 20) * 10) * (st.mode === 'sandbox' ? 0.25 : 1)), wageEst: Math.round(this.employees.reduce((a, e) => a + e.wage * ((e as any).overtime ? 1.4 : 1), 0) * (st.mode === 'sandbox' ? 0.25 : 1)),
    };
  }
  stateLabel(c: Customer) { return ({ enter: 'Giriyor', queue: 'Kasada bekliyor', toSeat: 'Masaya gidiyor', play: c.desk?.broken ? 'Arıza! Bekliyor' : c.order ? 'Sipariş bekliyor' : c.eatT > 0 ? 'Yemek yiyor' : 'Oynuyor', standing: 'Kalkıyor', payQueue: 'Ödeme için bekliyor', leave: 'Ayrılıyor', sneak: 'Şüpheli davranıyor', flee: 'KAÇIYOR!', caught: 'Yakalandı', wc: 'Tuvalette', chill: 'Dinleniyor', watch: 'Turnuva izliyor', wait: 'Bekliyor', gone: '-' } as any)[c.state] || c.state; }
  empLabel(e: Employee) { return e.state === 'idle' ? 'Beklemede' : e.state === 'walk' ? 'Göreve gidiyor' : e.state === 'work' ? 'Çalışıyor' : e.state === 'serve' || e.state === 'hand' ? 'Servis yapıyor' : e.state; }
  setCam(i: number) { this.camIdx = (i + CAMS.length) % CAMS.length; this.cctvAcc = 1; this.audio.click(); this.emit(true); }
  attachCCTV(c: HTMLCanvasElement | null) { this.cctvCanvas = c; }

  /* ============ render ============ */
  render(dt: number) {
    const p = this.player, r = this.renderer, cam = this.camera; const st = this.state;
    // camera
    const eye = 1.62; const bob = Math.sin(p.bobT) * 0.028 * Math.min(1, p.v / 3) + Math.sin(this.time * 1.5) * 0.004; const bobX = Math.cos(p.bobT * 0.5) * 0.02 * Math.min(1, p.v / 3);
    cam.position.set(p.x + Math.cos(this.yaw) * bobX * 0.0, p.y + eye + bob + (this.screen === 'menu' ? 0 : 0), p.z);
    cam.rotation.order = 'YXZ'; cam.rotation.y = this.yaw + Math.PI; cam.rotation.x = this.pitch; cam.rotation.z = Math.sin(p.bobT * 0.5) * 0.0045 * Math.min(1, p.v / 3);
    const fovT = 72 + (p.v > 4.5 ? 4 : 0); cam.fov += (fovT - cam.fov) * Math.min(1, dt * 5); cam.updateProjectionMatrix();
    if (this.screen === 'menu') { const t = this.time * 0.07; cam.position.set(-24 + Math.sin(t) * 6, 5.2, 24.3); cam.lookAt(2, 2.6, 9); }
    // floors visibility
    const vis = this.visibleFloors(); this.world.fg.forEach((g, i) => { g.visible = vis[i]; });
    this.dust.visible = vis[0] || vis[2];
    r.clear(); r.render(this.scene, cam);
    if (this.screen === 'playing' || this.screen === 'admin' || this.screen === 'paused') {
      r.clearDepth(); this.vm.sync(cam); const usesTray = p.tray.length > 0;
      this.vm.update(dt, { speed: p.v, sprint: p.v > 4.5, t: this.time, mode: this.screen === 'playing' ? this.vmMode() : 'idle', reach: this.reach, tiltX: usesTray ? this.trayTilt.x : 0, tiltZ: usesTray ? this.trayTilt.z : 0, trayItems: p.tray.length, bob: p.bobT });
      this.vm.sync(cam); r.render(this.vm.scene, cam);
    }
    if (this.screen === 'admin' && this.cctvCanvas) { this.cctvAcc += dt; if (this.cctvAcc > 0.1) { this.cctvAcc = 0; this.renderCCTV(); } }
  }
  renderCCTV() {
    const r = this.renderer, c = CAMS[this.camIdx], cam = this.cctvCam; cam.position.set(c.pos[0], c.pos[1], c.pos[2]); cam.lookAt(c.look[0], c.look[1], c.look[2]); cam.fov = c.fov || 68; cam.updateProjectionMatrix();
    const prevVis = this.world.fg.map((g) => g.visible); this.world.fg.forEach((g) => (g.visible = true)); const chars = this.allChars; const pv = chars.map((x) => x.rig.root.visible); chars.forEach((x) => { x.rig.root.visible = true; }); this.player.rig.update(0.016);
    const ap = this.player.rig; ap.speed = this.player.v; ap.carry = this.player.tray.length > 0; ap.act = ap.carry ? 'carry' : 'none';
    const vmv = this.vm.scene.visible; const sunv = this.beams.map((b) => b.visible); this.beams.forEach((b) => (b.visible = false));
    r.setRenderTarget(this.cctvRT); r.clear(); r.render(this.scene, cam); r.setRenderTarget(null);
    this.world.fg.forEach((g, i) => (g.visible = prevVis[i])); chars.forEach((x, i) => { x.rig.root.visible = pv[i]; }); this.beams.forEach((b, i) => (b.visible = sunv[i])); this.vm.scene.visible = vmv;
    r.readRenderTargetPixels(this.cctvRT, 0, 0, 320, 180, this.cctvBuf);
    const cv = this.cctvCanvas!; const ctx = cv.getContext('2d')!; if (cv.width !== 320) { cv.width = 320; cv.height = 180; } const img = ctx.createImageData(320, 180); const s = this.cctvBuf, d = img.data;
    for (let y = 0; y < 180; y++) { const sy = (179 - y) * 320 * 4, dy = y * 320 * 4; for (let x = 0; x < 320 * 4; x += 4) { const g = s[sy + x] * 0.25 + s[sy + x + 1] * 0.6 + s[sy + x + 2] * 0.15; d[dy + x] = g * 0.55 + s[sy + x] * 0.45; d[dy + x + 1] = Math.min(255, g * 0.55 + s[sy + x + 1] * 0.45 + 12); d[dy + x + 2] = g * 0.55 + s[sy + x + 2] * 0.45; d[dy + x + 3] = 255; } }
    ctx.putImageData(img, 0, 0); ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < 180; y += 3) ctx.fillRect(0, y, 320, 1);
  }
}

export const CAMS: { name: string; pos: [number, number, number]; look: [number, number, number]; fov?: number }[] = [
  { name: 'Zemin • Oyun Salonu', pos: [-2.2, 3.7, 1.8], look: [-7.2, 0.6, -3.8], fov: 74 },
  { name: 'Zemin • Giriş & Kasa', pos: [6.8, 3.7, 3.4], look: [-3.0, 0.7, 8.2], fov: 72 },
  { name: 'Zemin • Büfe & VIP', pos: [-1.0, 3.7, 3.6], look: [3.8, 0.7, -5.2], fov: 74 },
  { name: 'Kat 1 • Yarış & Salon', pos: [-1.0, FY[1] + 3.7, 9.3], look: [1.0, FY[1] + 0.6, -4.0], fov: 78 },
  { name: 'Kat 2 • Turnuva Alanı', pos: [0, FY[2] + 3.7, 9.3], look: [0, FY[2] + 0.9, -5.0], fov: 78 },
  { name: 'Dış • Cadde', pos: [-3.5, 5.6, 10.8], look: [5, 0.5, 17], fov: 70 },
];
void FH;
