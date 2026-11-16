export interface Box { x0: number; x1: number; z0: number; z1: number; stairBody?: boolean; dyn?: () => boolean; }
export interface P2 { x: number; z: number; }

export function resolveBoxes(boxes: Box[], p: { x: number; z: number }, r: number, onStair = false) {
  for (let it = 0; it < 2; it++) {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.stairBody && onStair) continue;
      if (b.dyn && !b.dyn()) continue;
      const cx = Math.max(b.x0, Math.min(p.x, b.x1));
      const cz = Math.max(b.z0, Math.min(p.z, b.z1));
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r;
      } else {
        const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z;
        const m = Math.min(l, rr, t, bt);
        if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r;
      }
    }
  }
}

export class FloorNav {
  boxes: Box[] = [];
  cell = 0.35;
  w: number; h: number;
  blocked: Uint8Array;
  private g: Float32Array; private came: Int32Array; private closed: Uint8Array;
  constructor(public minX: number, public minZ: number, public maxX: number, public maxZ: number) {
    this.w = Math.ceil((maxX - minX) / this.cell); this.h = Math.ceil((maxZ - minZ) / this.cell);
    this.blocked = new Uint8Array(this.w * this.h);
    this.g = new Float32Array(this.w * this.h); this.came = new Int32Array(this.w * this.h); this.closed = new Uint8Array(this.w * this.h);
  }
  add(b: Box) { this.boxes.push(b); }
  build(r = 0.3) {
    this.blocked.fill(0);
    for (const b of this.boxes) {
      if (b.dyn) continue;
      const x0 = Math.floor((b.x0 - r - this.minX) / this.cell), x1 = Math.floor((b.x1 + r - this.minX) / this.cell);
      const z0 = Math.floor((b.z0 - r - this.minZ) / this.cell), z1 = Math.floor((b.z1 + r - this.minZ) / this.cell);
      for (let z = Math.max(0, z0); z <= Math.min(this.h - 1, z1); z++)
        for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) {
          const cx = this.minX + (x + 0.5) * this.cell, cz = this.minZ + (z + 0.5) * this.cell;
          const px = Math.max(b.x0, Math.min(cx, b.x1)), pz = Math.max(b.z0, Math.min(cz, b.z1));
          if ((cx - px) ** 2 + (cz - pz) ** 2 < r * r) this.blocked[z * this.w + x] = 1;
        }
    }
  }
  cx(x: number) { return Math.floor((x - this.minX) / this.cell); }
  cz(z: number) { return Math.floor((z - this.minZ) / this.cell); }
  isBlocked(x: number, z: number) {
    const ix = this.cx(x), iz = this.cz(z);
    if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) return true;
    return this.blocked[iz * this.w + ix] === 1;
  }
  nearestFreeCell(ix: number, iz: number, maxR = 9): number {
    if (ix >= 0 && iz >= 0 && ix < this.w && iz < this.h && !this.blocked[iz * this.w + ix]) return iz * this.w + ix;
    for (let r = 1; r <= maxR; r++) {
      let best = -1, bd = 1e9;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = ix + dx, z = iz + dz;
        if (x < 0 || z < 0 || x >= this.w || z >= this.h || this.blocked[z * this.w + x]) continue;
        const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = z * this.w + x; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
  los(ax: number, az: number, bx: number, bz: number) {
    const d = Math.hypot(bx - ax, bz - az); const n = Math.ceil(d / 0.14);
    for (let i = 1; i < n; i++) { const t = i / n; if (this.isBlocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  path(sx: number, sz: number, gx: number, gz: number): P2[] | null {
    const W = this.w;
    const s = this.nearestFreeCell(this.cx(sx), this.cz(sz)), g = this.nearestFreeCell(this.cx(gx), this.cz(gz));
    if (s < 0 || g < 0) return null;
    const goalExact = !this.isBlocked(gx, gz);
    this.g.fill(1e9); this.closed.fill(0);
    const heap: number[] = [], hf: number[] = [];
    const push = (i: number, f: number) => {
      heap.push(i); hf.push(f); let k = heap.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; [hf[p], hf[k]] = [hf[k], hf[p]]; k = p; }
    };
    const pop = () => {
      const top = heap[0]; const li = heap.pop()!, lf = hf.pop()!;
      if (heap.length) {
        heap[0] = li; hf[0] = lf; let k = 0;
        for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; [hf[m], hf[k]] = [hf[k], hf[m]]; k = m; }
      }
      return top;
    };
    const gxI = g % W, gzI = (g / W) | 0;
    this.g[s] = 0; this.came[s] = -1; push(s, 0);
    let found = false, guard = 0;
    while (heap.length && guard++ < 40000) {
      const cur = pop();
      if (this.closed[cur]) continue; this.closed[cur] = 1;
      if (cur === g) { found = true; break; }
      const cxI = cur % W, czI = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cxI + dx, nz = czI + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
        const ni = nz * W + nx; if (this.blocked[ni] || this.closed[ni]) continue;
        if (dx && dz && (this.blocked[czI * W + nx] || this.blocked[nz * W + cxI])) continue;
        const ng = this.g[cur] + (dx && dz ? 1.414 : 1);
        if (ng < this.g[ni]) { this.g[ni] = ng; this.came[ni] = cur; const hh = Math.hypot(gxI - nx, gzI - nz); push(ni, ng + hh * 1.05); }
      }
    }
    if (!found) return null;
    const cells: P2[] = []; let c = g;
    while (c !== -1) { cells.push({ x: this.minX + ((c % W) + 0.5) * this.cell, z: this.minZ + (((c / W) | 0) + 0.5) * this.cell }); c = this.came[c]; }
    cells.reverse();
    if (goalExact) cells[cells.length - 1] = { x: gx, z: gz };
    // smoothing
    const out: P2[] = []; let cur: P2 = { x: sx, z: sz }; let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.los(cur.x, cur.z, cells[j].x, cells[j].z)) j--;
      out.push(cells[j]); cur = cells[j]; i = j + 1;
    }
    return out;
  }
}
