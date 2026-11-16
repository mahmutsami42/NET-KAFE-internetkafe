import * as THREE from 'three';
import { World, Merger, signTex } from './world';
import { clamp, rnd, pick, smooth, lerp } from './data';
import type { Box } from './nav';

interface Car { g: THREE.Group; dir: number; x: number; z: number; len: number; v: number; vmax: number; wheels: THREE.Mesh[]; blocked: number; honkT: number; box: Box; }

function windowTex(lit: boolean, base: string, seed: number) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d')!;
  x.fillStyle = lit ? '#000' : base; x.fillRect(0, 0, 128, 128); let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const on = rand() > 0.45; const col = on ? ['#ffd88a', '#ffe9b0', '#9ad8ff', '#ffb27a'][Math.floor(rand() * 4)] : (lit ? '#000' : '#2a3a52');
    x.fillStyle = col; x.fillRect(i * 64 + 12, j * 64 + 12, 40, 40);
    if (!lit) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(i * 64 + 12, j * 64 + 50, 40, 2); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export class Street {
  hemi = new THREE.HemisphereLight(0xbfd8ff, 0x404060, 1.4); sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
  cars: Car[] = []; carBoxes: Box[] = []; tl: { r: THREE.Mesh; y: THREE.Mesh; g: THREE.Mesh }[] = []; pl: { r: THREE.Mesh; g: THREE.Mesh }[] = [];
  winMats: THREE.MeshLambertMaterial[] = []; lampGlows: THREE.Sprite[] = []; stars!: THREE.Points; moon!: THREE.Sprite; sunSprite!: THREE.Sprite;
  rain!: THREE.LineSegments; rainPos!: Float32Array; rainSpd!: Float32Array; rainRect: number[][] = [[-46, 10.6, 46, 44], [-46, -12, -12.6, 10.3]];
  wetMats: THREE.MeshLambertMaterial[] = []; wetGlow: THREE.Mesh[] = []; roadMat!: THREE.MeshLambertMaterial; phaseT = 0; nightK = 0; rainK = 0; musicLights: THREE.Mesh[] = [];
  carMatsLit: THREE.MeshBasicMaterial[] = []; headBeams: THREE.Mesh[] = [];
  readonly crossX0 = 5.0; readonly crossX1 = 8.0; readonly nearZ = 12.3; readonly farZ = 23.6;
  festivalBanner: THREE.Group | null = null; fest = 0;

  constructor(public scene: THREE.Scene, public world: World) {
    scene.add(this.hemi); this.sun.position.set(-30, 60, 40); scene.add(this.sun);
    this.build(); this.buildRain(); this.buildSky();
  }
  addBox(x0: number, x1: number, z0: number, z1: number) { this.world.navs[0].add({ x0, x1, z0, z1 }); }
  build() {
    const sc = this.scene, S = new Merger(), GL = new Merger();
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3a6a46 })); grass.position.y = -0.1; sc.add(grass);
    // pavements
    const padTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; x.fillStyle = '#8a8a98'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#6a6a78'; x.lineWidth = 2; x.strokeRect(0, 0, 128, 128); x.strokeRect(0, 0, 64, 64); x.strokeRect(64, 64, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
    const pad = (x0: number, x1: number, z0: number, z1: number, repeatS = 1) => { const t = padTex.clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / 2 * repeatS, (z1 - z0) / 2 * repeatS); const m = new THREE.MeshLambertMaterial({ map: t }); this.wetMats.push(m); const me = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), m); me.position.set((x0 + x1) / 2, 0.002, (z0 + z1) / 2); sc.add(me); };
    pad(-50, 50, 10.3, 13.5); pad(-50, 50, 22, 28); pad(-50, -12.3, -12.5, -10.3); pad(12.3, 50, -12.5, 10.3, 1);
    S.box(100, 0.3, 0.2, 0, 0.0, 13.6, 0x9a9aa8); S.box(100, 0.3, 0.2, 0, 0.0, 21.9, 0x9a9aa8);
    // road
    const rc = document.createElement('canvas'); rc.width = 512; rc.height = 256; const rx = rc.getContext('2d')!; rx.fillStyle = '#34343c'; rx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 2500; i++) { rx.fillStyle = `rgba(${Math.random() * 90},${Math.random() * 90},${Math.random() * 100},0.1)`; rx.fillRect(Math.random() * 512, Math.random() * 256, 2, 2); }
    rx.fillStyle = '#e8e0b0'; for (let i = 0; i < 8; i++) rx.fillRect(i * 64 + 8, 124, 36, 8);
    const rt = new THREE.CanvasTexture(rc); rt.colorSpace = THREE.SRGBColorSpace; rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(100 / 8, 1);
    this.roadMat = new THREE.MeshLambertMaterial({ map: rt }); const road = new THREE.Mesh(new THREE.PlaneGeometry(100, 8.4).rotateX(-Math.PI / 2), this.roadMat); road.position.set(0, -0.078, 17.75); sc.add(road);
    // crosswalk
    for (let i = 0; i < 9; i++) S.box(3.0, 0.01, 0.5, 6.5, -0.07, 14.0 + i * 0.95, 0xe8e8e8, 0);
    // stop lines
    S.box(0.3, 0.01, 4.0, 4.3, -0.07, 15.5, 0xe8e8e8); S.box(0.3, 0.01, 4.0, 8.7, -0.07, 20.0, 0xe8e8e8);
    // park (left)
    const park = new THREE.Mesh(new THREE.PlaneGeometry(40, 22.3).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3f7a4a })); park.position.set(-32.3, 0.001, -1.4); sc.add(park);
    S.box(40, 0.01, 2.0, -32.3, 0.012, 4, 0xb8a888); S.box(2.0, 0.01, 22, -26, 0.012, -1.4, 0xb8a888);
    // fountain
    S.cyl(2.2, 0.5, -26, 0.25, 4, 0x8a8a98); S.cyl(1.9, 0.52, -26, 0.26, 4, 0x4a8ac0); S.cyl(0.35, 1.3, -26, 0.9, 4, 0x9a9aa8); S.cyl(0.9, 0.12, -26, 1.5, 4, 0x9a9aa8); this.addBox(-28.2, -23.8, 1.8, 6.2);
    // apartments
    const aptDefs: [number, number, number, number, number, string][] = [
      [15, 35, -18, 8, 24, '#8a6a5a'], [36, 56, -18, 8, 32, '#6a7a8a'], [-50, -30, -28, -14, 26, '#7a6a8a'], [-28, -6, -30, -14, 34, '#8a7a6a'], [-4, 20, -30, -14, 28, '#6a8a8a'], [22, 50, -30, -14, 38, '#8a6a7a'],
      [-50, -28, 28, 46, 30, '#7a7a8a'], [-26, -8, 28, 46, 22, '#8a7a5a'], [-6, 14, 28, 46, 36, '#6a6a8a'], [16, 34, 28, 46, 26, '#8a6a6a'], [36, 54, 28, 46, 33, '#6a8a7a'],
    ];
    aptDefs.forEach(([x0, x1, z0, z1, h, col], i) => {
      const w = x1 - x0, d = z1 - z0; const mk = (len: number, seed: number) => {
        const tex = windowTex(false, col, seed), em = windowTex(true, col, seed); tex.repeat.set(len / 6, h / 6.4); em.repeat.set(len / 6, h / 6.4); tex.anisotropy = 4;
        const m = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 0 }); this.winMats.push(m); return m;
      };
      const mx = mk(d, i * 7 + 1), mz = mk(w, i * 7 + 3), roof = new THREE.MeshLambertMaterial({ color: 0x4a4a54 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mx, mx, roof, roof, mz, mz]); b.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); sc.add(b); this.addBox(x0, x1, z0, z1);
    });
    // far skyline
    for (let i = 0; i < 26; i++) { const w = rnd(8, 18), h = rnd(30, 80); const ang = (i / 26) * Math.PI * 2; const r = rnd(95, 130); const px = Math.cos(ang) * r, pz = Math.sin(ang) * r + 10; if (Math.abs(px) < 60 && pz > -50 && pz < 70) continue; S.box(w, h, w, px, h / 2, pz, 0x2a3048 + (i % 3) * 0x050505); for (let k = 0; k < 6; k++) GL.box(w * 0.7, 0.8, 0.1, px, rnd(6, h - 3), pz + (pz > 10 ? -w / 2 - 0.1 : w / 2 + 0.1), 0xffd88a); }
    // shops on far side
    const shops: [string, string, number][] = [['MARKET', '#3dff7a', -42], ['ECZANE', '#ff5a5a', -30], ['FIRIN', '#ffb347', -17], ['KEBAP', '#ff7a3a', -2], ['KIRTASİYE', '#9ad8ff', 9], ['TEKEL', '#ff3fa4', 24], ['CAFE 24', '#2fd6c8', 40]];
    shops.forEach(([t, c, x]) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.0), new THREE.MeshBasicMaterial({ map: signTex(t, c, 320, 64), toneMapped: false })); s.position.set(x, 3.6, 27.9); s.rotation.y = Math.PI; sc.add(s); GL.box(4.5, 2.6, 0.05, x, 1.4, 27.95, 0xffe2a8); S.box(5.2, 0.15, 1.3, x, 3.0, 27.3, 0x6a2a3a); S.box(5, 0.9, 0.3, x, 0.45, 27.7, 0x2a2a38); });
    // lamps & trees & benches
    for (let x = -44; x <= 44; x += 11) for (const z of [13.2, 22.3]) {
      S.cyl(0.07, 5.2, x, 2.6, z, 0x2a2a34); S.box(0.1, 0.1, 1.2, x, 5.2, z + (z < 17 ? 0.55 : -0.55), 0x2a2a34); GL.box(0.5, 0.1, 0.3, x, 5.12, z + (z < 17 ? 1.1 : -1.1), 0xfff2c0);
      this.addBox(x - 0.12, x + 0.12, z - 0.12, z + 0.12);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.world.glowTexture, color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.set(4, 4, 1); sp.position.set(x, 5.1, z + (z < 17 ? 1.1 : -1.1)); sc.add(sp); this.lampGlows.push(sp);
      const wet = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.world.glowTexture, color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); wet.position.set(x, -0.06, z < 17 ? 17 : 18.5); sc.add(wet); this.wetGlow.push(wet);
    }
    const tree = (x: number, z: number, s = 1) => { S.cyl(0.18 * s, 2.4 * s, x, 1.2 * s, z, 0x5a3d2a); S.sph(1.4 * s, x, 3.2 * s, z, 0x2f7a3f, 0.9); S.sph(1.0 * s, x + 0.8 * s, 2.8 * s, z + 0.3, 0x3a8a4a); S.sph(1.0 * s, x - 0.7 * s, 3.4 * s, z - 0.4, 0x2a6a38); this.addBox(x - 0.3, x + 0.3, z - 0.3, z + 0.3); };
    for (let i = 0; i < 9; i++) tree(-46 + i * 4.2 + rnd(-1, 1), rnd(-10, 8) * (i % 2 ? 1 : 0.4) - 1, rnd(0.9, 1.3));
    for (const x of [-40, -22, 14, 28]) tree(x, 13.0, 0.8); for (const x of [-36, -10, 12, 32, 44]) tree(x, 25.2, 0.9);
    const bench = (x: number, z: number, ry: number) => { S.box(1.6, 0.08, 0.5, x, 0.5, z, 0x7a5a3a, ry); S.box(1.6, 0.5, 0.06, x, 0.8, z + (ry ? 0 : (z > 17 ? 0.22 : -0.22)), 0x7a5a3a, ry); S.box(0.08, 0.5, 0.45, x - 0.7, 0.25, z, 0x2a2a34, ry); S.box(0.08, 0.5, 0.45, x + 0.7, 0.25, z, 0x2a2a34, ry); this.addBox(x - 0.85, x + 0.85, z - 0.3, z + 0.3); };
    bench(-8, 11.0, 0); bench(8.4, 11.0, 0); bench(-18, 23.2, 0); bench(-22, 7, 0); bench(-34, 7, 0); bench(-30, -6, 0); bench(24, 24.8, 0);
    // bins and dumpster
    for (const x of [-12, 12.6, 20]) { S.cyl(0.25, 0.8, x, 0.4, 13.0, 0x3a5a4a); this.addBox(x - 0.25, x + 0.25, 12.75, 13.25); }
    S.box(2.2, 1.3, 1.1, 6, 0.65, -11.2, 0x2a5a3a); this.addBox(4.9, 7.1, -11.75, -10.65);
    // world boundaries (invisible)
    this.addBox(-52, 52, 44.5, 46); this.addBox(-52, 52, -34, -13); this.addBox(-52, -50, -34, 46); this.addBox(50, 52, -34, 46);
    this.addBox(12.3, 15, -12.5, 10.3); this.addBox(-50, -48.5, -12.5, 28); this.addBox(-50, 50, 28.0, 30);
    // traffic lights
    const mkTL = (x: number, z: number, face: number) => {
      S.cyl(0.07, 3.6, x, 1.8, z, 0x2a2a34); S.box(0.34, 0.95, 0.3, x, 3.6, z, 0x15151c);
      const mk = (y: number, c: number) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); m.position.set(x + face * 0.16, y, z); m.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2; sc.add(m); return m; };
      this.tl.push({ r: mk(3.9, 0xff2020), y: mk(3.6, 0xffb020), g: mk(3.3, 0x20ff50) }); this.addBox(x - 0.1, x + 0.1, z - 0.1, z + 0.1);
    };
    mkTL(3.3, 13.2, -1); mkTL(9.7, 22.3, 1);
    const mkPL = (x: number, z: number, face: number) => {
      S.cyl(0.05, 2.4, x, 1.2, z, 0x2a2a34); S.box(0.3, 0.5, 0.2, x, 2.5, z, 0x15151c);
      const mk = (y: number, c: number) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); m.position.set(x, y, z + face * 0.11); m.rotation.y = face > 0 ? 0 : Math.PI; sc.add(m); return m; };
      this.pl.push({ r: mk(2.62, 0xff2020), g: mk(2.4, 0x20ff50) }); this.addBox(x - 0.1, x + 0.1, z - 0.1, z + 0.1);
    };
    mkPL(4.4, 13.2, 1); mkPL(8.6, 13.2, 1); mkPL(4.4, 22.3, -1); mkPL(8.6, 22.3, -1);
    S.build(sc, this.world.staticMat); GL.build(sc, this.world.glowMat);
    // cars
    const defs = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2]]; defs.forEach(([lane, i]) => this.spawnCar(lane as number, (i as number) * 28 - 40 + rnd(-6, 6)));
    // festival banner
    const fb = new THREE.Group(); const bn = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.4), new THREE.MeshBasicMaterial({ map: signTex('MAHALLE ŞENLİĞİ', '#ffd36a', 512, 64, 'rgba(120,20,60,0.95)'), toneMapped: false, side: THREE.DoubleSide })); bn.position.set(0, 6.5, 17.7); fb.add(bn); fb.visible = false; sc.add(fb); this.festivalBanner = fb;
  }
  spawnCar(lane: number, x: number) {
    const kind = pick(['sedan', 'sedan', 'taxi', 'van', 'sedan', 'hatch']); const len = kind === 'van' ? 4.8 : kind === 'hatch' ? 3.8 : 4.4;
    const col = kind === 'taxi' ? 0xf2c230 : pick([0xd94f6a, 0x3a6ad9, 0xeeeeee, 0x2a2a30, 0x4fd9a2, 0x8a3ad9, 0xe8803a, 0x9a9aa8]);
    const g = new THREE.Group(); const bm = new THREE.MeshLambertMaterial({ color: col }), gm = new THREE.MeshLambertMaterial({ color: 0x1a2a3a }), dk = new THREE.MeshLambertMaterial({ color: 0x15151a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(len, 0.7, 1.8), bm); body.position.y = 0.6; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(kind === 'van' ? len * 0.85 : len * 0.52, kind === 'van' ? 1.1 : 0.62, 1.64), bm); cab.position.set(kind === 'van' ? -0.2 : -0.2, kind === 'van' ? 1.5 : 1.25, 0); g.add(cab);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(cab.geometry.parameters.width + 0.02, cab.geometry.parameters.height * 0.6, 1.66), gm); gl.position.copy(cab.position); gl.position.y += 0.04; g.add(gl);
    const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 12).rotateX(Math.PI / 2); const wheels: THREE.Mesh[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = new THREE.Mesh(wg, dk); w.position.set(sx * len * 0.31, 0.36, sz * 0.9); g.add(w); wheels.push(w); }
    const hl = new THREE.MeshBasicMaterial({ color: 0xfff2c0, toneMapped: false }), tlm = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
    for (const sz of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.34), hl); h.position.set(len / 2, 0.65, sz); g.add(h); const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.34), tlm); t.position.set(-len / 2, 0.65, sz); g.add(t); }
    if (kind === 'taxi') { const ts = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.7), new THREE.MeshBasicMaterial({ color: 0xffffcc })); ts.position.set(-0.2, 1.66, 0); g.add(ts); }
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(6, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.world.glowTexture, color: 0xfff2c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.set(len / 2 + 2.8, 0.05, 0); g.add(beam); this.headBeams.push(beam);
    this.scene.add(g);
    const dir = lane === 0 ? 1 : -1; const z = lane === 0 ? 15.4 : 20.1; g.rotation.y = dir > 0 ? 0 : Math.PI;
    const box: Box = { x0: 0, x1: 0, z0: 0, z1: 0 }; this.carBoxes.push(box);
    this.cars.push({ g, dir, x, z, len, v: 0, vmax: rnd(6, 8.5), wheels, blocked: 0, honkT: 0, box });
  }
  buildRain() {
    const N = 2000; this.rainPos = new Float32Array(N * 6); this.rainSpd = new Float32Array(N);
    for (let i = 0; i < N; i++) { const r = this.rainRect[i < 1500 ? 0 : 1]; const x = rnd(r[0], r[2]), z = rnd(r[1], r[3]), y = rnd(0, 20); this.rainPos.set([x, y, z, x, y + 0.7, z], i * 6); this.rainSpd[i] = rnd(16, 24); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaac8ff, transparent: true, opacity: 0.45, depthWrite: false })); this.rain.frustumCulled = false; this.rain.visible = false; this.scene.add(this.rain);
  }
  buildSky() {
    const N = 500, p = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = rnd(0, Math.PI * 2), e = rnd(0.12, 1.3); p.set([Math.cos(a) * Math.cos(e) * 250, Math.sin(e) * 250, Math.sin(a) * Math.cos(e) * 250], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); this.scene.add(this.stars);
    const mk = (c: number, s: number) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.world.glowTexture, color: c, transparent: true, depthWrite: false, fog: false })); sp.scale.set(s, s, 1); this.scene.add(sp); return sp; };
    this.moon = mk(0xcfe0ff, 40); this.sunSprite = mk(0xfff0b0, 70);
  }
  pedGreen() { const p = this.phaseT % 29.5; return p >= 19 && p < 28; }
  carPhase() { const p = this.phaseT % 29.5; return p < 15 ? 'g' : p < 17.5 ? 'y' : 'r'; }

  /** minutes: game time. */
  setSky(min: number, rain: number, power: boolean, cam: THREE.Vector3) {
    const h = (min / 60) % 24; const day = smooth((h - 6) / 2) * (1 - smooth((h - 18) / 2.5)); // 0..1
    const dusk = clamp(1 - Math.abs(h - 19) / 1.8, 0, 1) * (1 - rain * 0.5); this.nightK = 1 - day; this.rainK = rain;
    const night = new THREE.Color(0x151a3e), dayC = new THREE.Color(0x9ccdf2), duskC = new THREE.Color(0xff9a6a), grey = new THREE.Color(0x6a7388);
    const c = night.clone().lerp(dayC, day).lerp(duskC, dusk * 0.7).lerp(grey, rain * 0.55 * (0.4 + day));
    (this.scene.background as THREE.Color).copy(c); (this.scene.fog as THREE.Fog).color.copy(c); (this.scene.fog as THREE.Fog).far = lerp(110, 190, day) * (1 - rain * 0.35);
    this.hemi.intensity = lerp(1.25, 1.9, day) * (1 - rain * 0.12); this.hemi.color.set(day > 0.4 ? 0xcfe2ff : 0x8a9cd8); this.hemi.groundColor.set(0x40405a);
    this.sun.intensity = lerp(0.45, 2.0, day) * (1 - rain * 0.5); this.sun.color.set(day > 0.3 ? (dusk > 0.3 ? 0xffb080 : 0xfff0d8) : 0x8aa0ff);
    const a = ((h - 6) / 14) * Math.PI; this.sun.position.set(Math.cos(a) * 80, Math.max(12, Math.sin(a) * 80), 30);
    this.sunSprite.position.set(cam.x + Math.cos(a) * 200, Math.sin(a) * 120 + 10, cam.z + 60); this.sunSprite.visible = day > 0.05 && Math.sin(a) > 0; (this.sunSprite.material as THREE.SpriteMaterial).opacity = day * (1 - rain);
    this.moon.position.set(cam.x - 80, 140, cam.z - 120); (this.moon.material as THREE.SpriteMaterial).opacity = (1 - day) * (1 - rain * 0.8);
    this.stars.position.copy(cam); (this.stars.material as THREE.PointsMaterial).opacity = (1 - day) * (1 - rain);
    const nk = 1 - day; for (const m of this.winMats) m.emissiveIntensity = (0.15 + nk * 0.95) * (power ? 1 : 0.5);
    for (const s of this.lampGlows) (s.material as THREE.SpriteMaterial).opacity = clamp(nk * 1.3 + rain * 0.3, 0, 1) * 0.9 * (power ? 1 : 0.6);
    for (const w of this.wetGlow) (w.material as THREE.MeshBasicMaterial).opacity = rain * nk * 0.55;
    for (const b of this.headBeams) (b.material as THREE.MeshBasicMaterial).opacity = clamp(nk + rain * 0.5, 0, 1) * 0.4;
    for (const m of this.wetMats) m.color.setScalar(1 - rain * 0.35); this.roadMat.color.setScalar(1 - rain * 0.4);
    this.rain.visible = rain > 0.05; (this.rain.material as THREE.LineBasicMaterial).opacity = 0.15 + rain * 0.35;
    if (this.festivalBanner) this.festivalBanner.visible = this.fest > 0;
  }

  update(dt: number, blockers: { x: number; z: number }[], onHonk: () => void) {
    this.phaseT += dt; const cp = this.carPhase(), pg = this.pedGreen();
    for (const t of this.tl) { (t.r.material as THREE.MeshBasicMaterial).color.setHex(cp === 'r' ? 0xff2020 : 0x300808); (t.y.material as THREE.MeshBasicMaterial).color.setHex(cp === 'y' ? 0xffb020 : 0x302208); (t.g.material as THREE.MeshBasicMaterial).color.setHex(cp === 'g' ? 0x20ff50 : 0x083014); }
    for (const p of this.pl) { (p.r.material as THREE.MeshBasicMaterial).color.setHex(!pg ? 0xff2020 : 0x300808); (p.g.material as THREE.MeshBasicMaterial).color.setHex(pg ? 0x20ff50 : 0x083014); }
    for (const c of this.cars) {
      let target = c.vmax; const front = c.x + c.dir * c.len / 2; const line = c.dir > 0 ? 4.3 : 8.7; const dl = (line - front) * c.dir;
      if (cp !== 'g' && dl > -0.3 && dl < 14) { if (cp === 'r' || dl > 4.0) target = Math.min(target, clamp((dl - 0.6) * 1.1, 0, c.vmax)); }
      for (const o of this.cars) { if (o === c || o.dir !== c.dir) continue; const gap = (o.x - c.x) * c.dir - (o.len + c.len) / 2; if (gap > -1 && gap < 10) target = Math.min(target, clamp((gap - 1.5) * 1.2, 0, c.vmax)); }
      let stop = false;
      for (const b of blockers) { if (Math.abs(b.z - c.z) < 1.45) { const ahead = (b.x - c.x) * c.dir - c.len / 2; if (ahead > -0.2 && ahead < 5 + c.v * 0.6) { target = 0; stop = true; } } }
      if (stop) { c.blocked += dt; c.honkT -= dt; if (c.blocked > 2.2 && c.honkT <= 0) { c.honkT = 4; onHonk(); } } else c.blocked = 0;
      c.v += clamp(target - c.v, -10 * dt, 3.2 * dt); c.x += c.dir * c.v * dt;
      if (c.x > 62 && c.dir > 0) c.x = -62 - rnd(0, 25); if (c.x < -62 && c.dir < 0) c.x = 62 + rnd(0, 25);
      c.g.position.set(c.x, -0.05, c.z); for (const w of c.wheels) w.rotation.z -= (c.v * dt) / 0.36 * c.dir;
      c.box.x0 = c.x - c.len / 2; c.box.x1 = c.x + c.len / 2; c.box.z0 = c.z - 0.95; c.box.z1 = c.z + 0.95;
    }
    if (this.rain.visible) {
      const p = this.rainPos; const N = this.rainSpd.length; for (let i = 0; i < N; i++) { const o = i * 6; let y = p[o + 1] - this.rainSpd[i] * dt; if (y < 0) { y = 18 + Math.random() * 3; } p[o + 1] = y; p[o + 4] = y + 0.7; }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
  }
}
