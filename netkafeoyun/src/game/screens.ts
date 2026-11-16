import * as THREE from 'three';

export type ScreenKind = 'old' | 'fps' | 'rpg' | 'race' | 'moba' | 'idle' | 'broken' | 'cctv' | 'off';
export interface BigState { title: string; a: string; b: string; sa: number; sb: number; round: number; rounds: number; msg: string; live: boolean; k: number; }

export class Screens {
  tex: Record<string, THREE.CanvasTexture> = {};
  mats: Record<string, THREE.MeshBasicMaterial> = {};
  private cv: Record<string, [HTMLCanvasElement, CanvasRenderingContext2D]> = {};
  big: BigState = { title: 'NET KAFE ARENA', a: 'Neon Kurtlar', b: 'Mahalle FC', sa: 0, sb: 0, round: 0, rounds: 3, msg: 'Turnuva bekleniyor', live: false, k: 0 };
  private acc = 0; private seed = Math.random() * 100;
  constructor() {
    const kinds: [string, number, number][] = [['old', 160, 100], ['fps', 160, 100], ['rpg', 160, 100], ['race', 160, 100], ['moba', 160, 100], ['idle', 160, 100], ['broken', 160, 100], ['cctv', 160, 100], ['off', 8, 8], ['big', 512, 200]];
    for (const [k, w, h] of kinds) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!; this.cv[k] = [c, x];
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; this.tex[k] = t; this.mats[k] = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
    }
    this.cv.off[1].fillStyle = '#050508'; this.cv.off[1].fillRect(0, 0, 8, 8); this.tex.off.needsUpdate = true;
    this.update(0, 1);
  }
  update(t: number, dt: number) {
    this.acc += dt; if (this.acc < 0.08 && t > 0) return; this.acc = 0;
    this.old(t); this.fps(t); this.rpg(t); this.race(t); this.moba(t); this.idle(t); this.broken(t); this.cctv(t); this.drawBig(t);
    for (const k in this.tex) if (k !== 'off') this.tex[k].needsUpdate = true;
  }
  private old(t: number) {
    const [, x] = this.cv.old; x.fillStyle = '#041a0c'; x.fillRect(0, 0, 160, 100); x.font = '9px monospace'; x.fillStyle = '#3dff7a';
    const lines = ['C:\\> NETKAFE.EXE', 'Baglaniyor... OK', 'Sunucu: 192.168.0.1', 'Oyuncu: ANIL_61', 'Puan: ' + (Math.floor(t * 13) % 9999), 'Seviye 3 - Labirent', '> ileri', '> sola', '> ates!', 'C:\\> _'];
    const off = Math.floor(t * 2) % 3; for (let i = 0; i < 9; i++) x.fillText(lines[(i + off) % lines.length], 6, 12 + i * 10);
    x.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < 100; y += 3) x.fillRect(0, y, 160, 1);
  }
  private fps(t: number) {
    const [, x] = this.cv.fps; const g = x.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, '#1a2a4a'); g.addColorStop(0.5, '#4a5a7a'); g.addColorStop(0.5, '#2a2622'); g.addColorStop(1, '#14100e'); x.fillStyle = g; x.fillRect(0, 0, 160, 100);
    x.fillStyle = '#39455f'; for (let i = 0; i < 5; i++) { const bx = ((i * 47 + t * 6) % 200) - 20; x.fillRect(bx, 30 - (i % 3) * 6, 26, 32 + (i % 3) * 6); }
    x.fillStyle = '#c33'; const ex = 80 + Math.sin(t * 1.7) * 40; x.fillRect(ex - 5, 44, 10, 22); x.fillStyle = '#fc9'; x.fillRect(ex - 3, 38, 6, 7);
    x.strokeStyle = '#7f7'; x.lineWidth = 1; x.beginPath(); x.moveTo(80, 44); x.lineTo(80, 56); x.moveTo(74, 50); x.lineTo(86, 50); x.stroke();
    if (Math.sin(t * 7) > 0.85) { x.fillStyle = 'rgba(255,230,120,0.7)'; x.fillRect(90, 72, 40, 30); }
    x.fillStyle = '#222'; x.fillRect(96, 78, 52, 24); x.fillStyle = '#5a5f6a'; x.fillRect(100, 70, 44, 8);
    x.fillStyle = '#fff'; x.font = 'bold 9px sans-serif'; x.fillText('HP 100', 6, 94); x.fillText('AMMO ' + (30 - Math.floor(t * 3) % 30), 108, 94);
  }
  private rpg(t: number) {
    const [, x] = this.cv.rpg; const g = x.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, '#3b1d6e'); g.addColorStop(1, '#e0764a'); x.fillStyle = g; x.fillRect(0, 0, 160, 100);
    x.fillStyle = '#ffd78a'; x.beginPath(); x.arc(120, 28, 12, 0, 7); x.fill();
    x.fillStyle = '#2a1a4a'; x.beginPath(); x.moveTo(0, 70); for (let i = 0; i <= 8; i++) x.lineTo(i * 20, 52 + Math.sin(i * 1.3 + t * 0.2) * 12); x.lineTo(160, 100); x.lineTo(0, 100); x.fill();
    x.fillStyle = '#19102e'; x.fillRect(0, 78, 160, 22); x.fillStyle = '#e8e8ff'; const px = (t * 22) % 190 - 15; x.fillRect(px, 62, 8, 16); x.fillStyle = '#ffcf7a'; x.fillRect(px + 1, 58, 6, 5);
    x.fillStyle = '#fff'; for (let i = 0; i < 12; i++) x.fillRect((i * 37 + t * 3) % 160, (i * 17) % 40, 1.5, 1.5);
    x.fillStyle = '#e44'; x.fillRect(6, 6, 50, 5); x.fillStyle = '#4ae'; x.fillRect(6, 13, 36, 4);
  }
  private race(t: number) {
    const [, x] = this.cv.race; const g = x.createLinearGradient(0, 0, 0, 50); g.addColorStop(0, '#ff7a5a'); g.addColorStop(1, '#ffd28a'); x.fillStyle = g; x.fillRect(0, 0, 160, 55);
    x.fillStyle = '#4a3a6a'; x.beginPath(); x.moveTo(0, 55); x.lineTo(30, 38); x.lineTo(60, 52); x.lineTo(100, 34); x.lineTo(160, 55); x.fill();
    x.fillStyle = '#2d6a3a'; x.fillRect(0, 55, 160, 45); const curve = Math.sin(t * 0.8) * 30;
    for (let i = 0; i < 14; i++) {
      const z = ((i + (t * 2.2) % 1) / 14); const y = 55 + z * z * 45; const w = 10 + z * z * 150; const cx = 80 + curve * (1 - z) * (1 - z);
      x.fillStyle = (i % 2) ? '#3a3a42' : '#46464f'; x.fillRect(cx - w / 2, y, w, 5 + z * 8); x.fillStyle = (i % 2) ? '#fff' : '#d33'; x.fillRect(cx - w / 2 - 3 - z * 6, y, 3 + z * 6, 5 + z * 8); x.fillRect(cx + w / 2, y, 3 + z * 6, 5 + z * 8);
      if (i % 2) { x.fillStyle = '#ffd'; x.fillRect(cx - 1 - z * 2, y, 2 + z * 3, 4 + z * 6); }
    }
    x.fillStyle = '#e22'; x.fillRect(72 + curve * 0.05, 82, 16, 8); x.fillStyle = '#111'; x.fillRect(70 + curve * 0.05, 88, 20, 3);
    x.fillStyle = '#fff'; x.font = 'bold 10px sans-serif'; x.fillText(String(120 + Math.floor(Math.sin(t) * 30 + 30)) + ' km/s', 100, 14); x.fillText('P' + (1 + Math.floor(t / 7) % 3), 8, 14);
  }
  private moba(t: number) {
    const [, x] = this.cv.moba; x.fillStyle = '#12301f'; x.fillRect(0, 0, 160, 100); x.strokeStyle = '#2f6a45'; x.lineWidth = 6; x.beginPath(); x.moveTo(10, 90); x.lineTo(10, 10); x.lineTo(150, 10); x.moveTo(10, 90); x.lineTo(150, 90); x.lineTo(150, 10); x.moveTo(10, 90); x.lineTo(150, 10); x.stroke();
    x.fillStyle = '#4ac'; x.fillRect(4, 84, 12, 12); x.fillStyle = '#c44'; x.fillRect(144, 4, 12, 12);
    for (let i = 0; i < 5; i++) { x.fillStyle = '#3af'; const a = t * 0.6 + i; x.beginPath(); x.arc(40 + i * 12 + Math.sin(a) * 10, 70 - i * 10 + Math.cos(a) * 6, 3, 0, 7); x.fill(); x.fillStyle = '#f55'; x.beginPath(); x.arc(120 - i * 10 + Math.cos(a * 1.2) * 9, 28 + i * 9 + Math.sin(a) * 6, 3, 0, 7); x.fill(); }
    x.fillStyle = '#fff'; x.font = 'bold 8px sans-serif'; x.fillText('12 / 9 / 14', 56, 98);
  }
  private idle(t: number) {
    const [, x] = this.cv.idle; x.fillStyle = '#0a0e1a'; x.fillRect(0, 0, 160, 100);
    const px = 10 + Math.abs(((t * 18) % 200) - 100) * 0.9, py = 10 + Math.abs(((t * 11) % 140) - 70) * 0.9; x.fillStyle = '#2fd6c8'; x.font = 'bold 12px sans-serif'; x.fillText('NET KAFE', px, py + 12); x.fillStyle = '#ff3fa4'; x.fillText('●', px - 14, py + 12);
  }
  private broken(t: number) {
    const [, x] = this.cv.broken; x.fillStyle = Math.sin(t * 9) > 0 ? '#0a3a9a' : '#101c60'; x.fillRect(0, 0, 160, 100); x.fillStyle = '#fff'; x.font = 'bold 12px monospace'; x.fillText(':( HATA', 10, 24); x.font = '8px monospace'; x.fillText('SISTEM CALISMIYOR 0x7B', 10, 40); x.fillText('Teknisyen cagirin...', 10, 52);
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(${(i * 90) % 255},255,${(i * 50) % 255},0.5)`; x.fillRect(0, (Math.sin(t * 5 + i * 2) * 0.5 + 0.5) * 95, 160, 2 + (i % 3)); }
    if (Math.sin(t * 13) > 0.6) { x.fillStyle = '#fff'; x.fillRect((t * 80) % 160, 0, 14, 100); }
  }
  private cctv(t: number) {
    const [, x] = this.cv.cctv; x.fillStyle = '#0b1a14'; x.fillRect(0, 0, 160, 100); x.strokeStyle = '#2f8f5a'; x.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const ox = (i % 2) * 80, oy = Math.floor(i / 2) * 50; x.strokeRect(ox + 3, oy + 3, 74, 44); x.fillStyle = '#3dff7a'; x.font = '7px monospace'; x.fillText('CAM 0' + (i + 1), ox + 6, oy + 12); x.fillStyle = Math.sin(t * 3 + i) > 0 ? '#f33' : '#600'; x.fillRect(ox + 66, oy + 7, 4, 4); x.fillStyle = 'rgba(80,255,150,0.15)'; x.fillRect(ox + 4, oy + ((t * 20 + i * 11) % 44) + 3, 72, 2); }
  }
  private drawBig(t: number) {
    const [, x] = this.cv.big; const b = this.big; const g = x.createLinearGradient(0, 0, 512, 200); g.addColorStop(0, '#1b0f3a'); g.addColorStop(1, '#0c2a4a'); x.fillStyle = g; x.fillRect(0, 0, 512, 200);
    x.strokeStyle = 'rgba(80,200,255,0.15)'; x.lineWidth = 1; for (let i = 0; i < 20; i++) { x.beginPath(); x.moveTo(i * 28 + ((t * 10) % 28), 0); x.lineTo(i * 28 - 40 + ((t * 10) % 28), 200); x.stroke(); }
    x.textAlign = 'center'; x.fillStyle = '#ff3fa4'; x.font = 'bold 22px sans-serif'; x.fillText(b.title, 256, 30);
    if (b.live || b.k > 0) {
      x.fillStyle = '#2fd6c8'; x.font = 'bold 20px sans-serif'; x.fillText(b.a, 110, 78); x.fillStyle = '#ffb347'; x.fillText(b.b, 402, 78);
      x.fillStyle = '#fff'; x.font = 'bold 72px sans-serif'; x.fillText(String(b.sa), 110, 150); x.fillText(String(b.sb), 402, 150); x.fillText(':', 256, 142);
      x.font = 'bold 16px sans-serif'; x.fillStyle = '#e8e8ff'; x.fillText('TUR ' + b.round + ' / ' + b.rounds, 256, 80);
      if (b.live) { x.fillStyle = Math.sin(t * 5) > 0 ? '#f33' : '#900'; x.beginPath(); x.arc(220, 108, 6, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.fillText('CANLI', 256, 113); }
    } else { x.fillStyle = '#e8e8ff'; x.font = 'bold 26px sans-serif'; x.fillText('NET KAFE', 256, 92); x.fillStyle = '#2fd6c8'; x.fillText('E-SPOR ARENASI', 256, 128); }
    x.fillStyle = '#ffe36a'; x.font = 'bold 17px sans-serif'; x.fillText(b.msg, 256, 184); x.textAlign = 'left';
  }
}
