import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from './game/game';
import { fmtMoney, DESK_INFO, JOBS } from './game/data';

let game: Game | null = null;
const FLOORS = ['Zemin Kat', '1. Kat', '2. Kat'];
const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');

function Btn({ children, onClick, tone = 'cyan', disabled, small, className }: { children: any; onClick?: () => void; tone?: 'cyan' | 'pink' | 'amber' | 'gray' | 'green' | 'red'; disabled?: boolean; small?: boolean; className?: string }) {
  const t = { cyan: 'from-cyan-500 to-teal-500 text-slate-900', pink: 'from-fuchsia-500 to-pink-500 text-white', amber: 'from-amber-400 to-orange-500 text-slate-900', gray: 'from-slate-600 to-slate-700 text-slate-100', green: 'from-emerald-400 to-green-500 text-slate-900', red: 'from-rose-500 to-red-600 text-white' }[tone];
  return <button disabled={disabled} onClick={() => { game?.audio.click(); onClick?.(); }} className={cx('rounded-lg bg-gradient-to-b font-bold shadow-lg transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110', t, small ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm', className)}>{children}</button>;
}
const Glass = ({ children, className }: { children: any; className?: string }) => <div className={cx('rounded-xl border border-white/10 bg-slate-950/70 backdrop-blur-md shadow-xl', className)}>{children}</div>;

function Stars({ v }: { v: number }) { return <span className="text-amber-300 tracking-tight">{'★'.repeat(Math.round(v))}<span className="text-slate-600">{'★'.repeat(5 - Math.round(v))}</span></span>; }

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null); const [ready, setReady] = useState(false);
  useEffect(() => { if (!game && canvasRef.current) { game = new Game(canvasRef.current); (window as any).__game = game; } setReady(true); }, []);
  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-950 text-slate-100 select-none" style={{ fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif' }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {ready && game && <UI g={game} />}
    </div>
  );
}

function UI({ g }: { g: Game }) {
  const s = useSyncExternalStore(g.subscribe, g.getSnap);
  const [help, setHelp] = useState(false); const [settings, setSettings] = useState(false);
  if (!s.screen) return null;
  const playing = s.screen === 'playing';
  return (
    <>
      {(playing || s.screen === 'admin' || s.screen === 'paused') && <HUD g={g} s={s} />}
      {s.mini && playing && <Mini g={g} />}
      {s.screen === 'menu' && <Menu g={g} s={s} onHelp={() => setHelp(true)} onSettings={() => setSettings(true)} />}
      {s.screen === 'paused' && <Pause g={g} s={s} onHelp={() => setHelp(true)} />}
      {s.screen === 'admin' && <Admin g={g} s={s} />}
      {s.screen === 'report' && <Report g={g} s={s} />}
      {s.screen === 'gameover' && <End g={g} s={s} win={false} />}
      {s.screen === 'victory' && <End g={g} s={s} win />}
      {playing && s.needLock && !s.touch && <div onClick={() => g.lock()} className="absolute inset-0 z-30 flex cursor-pointer items-center justify-center bg-black/55"><Glass className="px-8 py-6 text-center"><div className="text-2xl font-black text-cyan-300">Devam etmek için tıkla</div><div className="mt-2 text-sm text-slate-300">{s.dragLook ? 'Bakmak için fareyi basılı tutup sürükle' : 'Fare kilitlenecek • ESC: duraklat'}</div></Glass></div>}
      {playing && s.touch && <Touch g={g} />}
      {(help || (s.screen === 'menu' && settings)) && null}
      {help && <Help onClose={() => setHelp(false)} />}
      {settings && s.screen === 'menu' && <Settings g={g} s={s} onClose={() => setSettings(false)} />}
    </>
  );
}

function Menu({ g, s, onHelp, onSettings }: { g: Game; s: any; onHelp: () => void; onSettings: () => void }) {
  const [first, setFirst] = useState(() => !localStorage.getItem('nk_tut'));
  const start = (m: 'normal' | 'sandbox') => { g.audio.init(); g.newGame(m); g.lock(); if (first) { localStorage.setItem('nk_tut', '1'); setFirst(false); onHelp(); } };
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-slate-950/80 via-indigo-950/60 to-fuchsia-950/50 p-4">
      <div className="w-full max-w-xl text-center">
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.5em] text-cyan-300">Mahalle işletme simülasyonu</div>
        <h1 className="text-5xl font-black leading-tight sm:text-6xl" style={{ textShadow: '0 0 18px #ff3fa4, 0 0 40px #ff3fa488' }}><span className="text-pink-400">NET KAFE</span><br /><span className="text-cyan-300 text-3xl sm:text-4xl" style={{ textShadow: '0 0 18px #2fd6c8' }}>AÇIK DÜNYA</span></h1>
        <Glass className="mx-auto mt-8 flex max-w-sm flex-col gap-3 p-5">
          <Btn onClick={() => start('normal')} tone="pink">▶ Yeni Oyun (Normal)</Btn>
          <Btn onClick={() => start('sandbox')} tone="cyan">☕ Rahat Mod (Sandbox)</Btn>
          <Btn onClick={() => { g.audio.init(); if (g.load()) g.lock(); }} tone="amber" disabled={!s.hasSave}>💾 Kayıtlı İşletmeye Devam Et</Btn>
          <div className="flex gap-2"><Btn className="flex-1" onClick={onHelp} tone="gray">Nasıl Oynanır</Btn><Btn className="flex-1" onClick={onSettings} tone="gray">Ayarlar</Btn></div>
        </Glass>
        <p className="mt-4 text-xs text-slate-300/80">Normal: kira, elektrik, maaş baskısı • Rahat: giderler %25, daha cömert başlangıç, iflas yok.</p>
      </div>
    </div>
  );
}

function Settings({ g, s, onClose }: { g: Game; s: any; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <Glass className="w-full max-w-sm p-5">
        <h2 className="mb-3 text-xl font-black text-cyan-300">Ayarlar</h2>
        <SettingsBody g={g} s={s} />
        <Btn onClick={onClose} className="mt-4 w-full">Kapat</Btn>
      </Glass>
    </div>
  );
}
function SettingsBody({ g, s }: { g: Game; s: any }) {
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center justify-between"><span>🔊 Ses</span><input type="checkbox" checked={!s.muted} onChange={(e) => { g.audio.init(); g.audio.setMuted(!e.target.checked); g.saveSettings(); }} className="h-5 w-5 accent-cyan-400" /></label>
      <label className="flex items-center justify-between"><span>🎵 Müzik (telifsiz, üretilen)</span><input type="checkbox" checked={s.music} onChange={(e) => { g.audio.init(); g.audio.setMusic(e.target.checked); g.saveSettings(); }} className="h-5 w-5 accent-cyan-400" /></label>
      <label className="block"><div className="flex justify-between"><span>Ses seviyesi</span><span>{Math.round(s.vol * 100)}%</span></div><input type="range" min={0} max={1} step={0.05} value={s.vol} onChange={(e) => { g.audio.setVol(parseFloat(e.target.value)); g.saveSettings(); }} className="w-full accent-cyan-400" /></label>
      <label className="block"><div className="flex justify-between"><span>Fare hassasiyeti</span><span>{s.sens.toFixed(1)}x</span></div><input type="range" min={0.3} max={2.5} step={0.1} value={s.sens} onChange={(e) => { g.sens = parseFloat(e.target.value); g.saveSettings(); }} className="w-full accent-cyan-400" /></label>
    </div>
  );
}

function Help({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [['W A S D / Oklar', 'Yürü'], ['Shift', 'Koş'], ['Fare', 'Etrafa bak (otomatik kilitlenir)'], ['E / Sol tık', 'Etkileşim (basılı tut: tamir, temizlik, modem)'], ['Boşluk / E', 'Sipariş hazırlarken yeşil bölgede bas'], ['1 2 3', 'Asansörde kat seç'], ['M', 'Sesi aç/kapat'], ['ESC', 'Duraklat / paneli kapat'], ['A, sonra PARA3000', 'Hile: +3000 ₺ (PARA10000 de olur)']];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-auto bg-black/70 p-4">
      <Glass className="w-full max-w-2xl p-6">
        <h2 className="mb-3 text-2xl font-black text-pink-400">Nasıl Oynanır?</h2>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-200">
          <li><b>Hazırlık:</b> Yönetim masasında stok, çalışan ve arızaları kontrol et. Kapıdaki tabelaya <b>E</b> ile kafeyi aç.</li>
          <li><b>Kasa:</b> Müşteriler sıraya girer. Kasaya gel, <b>E</b> ile karşıla (masa atanır) ve çıkışta ödemeyi al.</li>
          <li><b>Büfe:</b> Müşterinin başındaki 🍔 balonuna bak, büfede siparişi 3 adımda hazırla, tepsiyle masaya götür.</li>
          <li><b>Arıza & temizlik:</b> 🔧 balonlu masayı tamir et, yerdeki çöpleri temizle. Kirli ve bozuk kafe itibar kaybettirir.</li>
          <li><b>Hırsız:</b> Ödemeden kaçana yetiş ve <b>E</b> ile yakala. Önüne çıkan arabalar seni görünce durur.</li>
          <li><b>Büyüme:</b> Gün sonunda rapor gelir. Kazancınla masa, yükseltme ve çalışan al. 2. katta turnuva düzenle!</li>
        </ol>
        <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">{rows.map(([k, v]) => <div key={k} className="flex gap-2"><kbd className="rounded bg-slate-800 px-2 py-0.5 text-xs font-bold text-cyan-300">{k}</kbd><span className="text-slate-300">{v}</span></div>)}</div>
        <Btn onClick={onClose} className="mt-5 w-full" tone="pink">Anladım, başlayalım</Btn>
      </Glass>
    </div>
  );
}

function Pause({ g, s, onHelp }: { g: Game; s: any; onHelp: () => void }) {
  const [code, setCode] = useState(''); const [confirm, setConfirm] = useState(false);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
      <Glass className="w-full max-w-md p-5">
        <h2 className="mb-3 text-2xl font-black text-cyan-300">Duraklatıldı</h2>
        <div className="flex flex-col gap-2">
          <Btn onClick={() => g.resume()} tone="green">▶ Devam Et</Btn>
          <Btn onClick={() => g.save()} tone="amber">💾 İlerlemeyi Kaydet</Btn>
          <Btn onClick={onHelp} tone="gray">❔ Kontroller / Yardım</Btn>
        </div>
        <div className="my-4 border-t border-white/10 pt-3"><SettingsBody g={g} s={s} /></div>
        <div className="rounded-lg bg-slate-900/80 p-3"><div className="mb-1 text-xs font-bold text-pink-300">HİLE KODU</div>
          <form onSubmit={(e) => { e.preventDefault(); g.runCheat(code); setCode(''); }} className="flex gap-2"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PARA3000" className="flex-1 rounded bg-slate-800 px-3 py-1.5 text-sm uppercase outline-none ring-1 ring-white/10 focus:ring-cyan-400" /><Btn small tone="pink">Uygula</Btn></form>
          <div className="mt-1 text-[11px] text-slate-400">PARA3000, PARA10000 • STOK • TAMIR • TEMIZ • ITIBAR (oyun sırasında doğrudan da yazabilirsin)</div></div>
        <div className="mt-4 flex gap-2">
          <Btn className="flex-1" tone="gray" onClick={() => { g.save(); g.setScreen('menu'); }}>Ana Menü</Btn>
          {!confirm ? <Btn className="flex-1" tone="red" onClick={() => setConfirm(true)}>Yeniden Başla</Btn> : <Btn className="flex-1" tone="red" onClick={() => { g.newGame(g.state.mode); g.lock(); }}>Emin misin? Evet</Btn>}
        </div>
      </Glass>
    </div>
  );
}

function HUD({ g, s }: { g: Game; s: any }) {
  const open = s.phase === 'open', prep = s.phase === 'prep';
  const satCol = s.liveSat < 0 ? 'text-slate-400' : s.liveSat > 70 ? 'text-emerald-300' : s.liveSat > 45 ? 'text-amber-300' : 'text-rose-400';
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute left-1/2 top-2 flex -translate-x-1/2 flex-wrap justify-center gap-2 px-2">
        <Glass className="flex items-center gap-4 whitespace-nowrap px-4 py-2 text-sm">
          <div title="Para" className="font-black text-emerald-300">💰 {fmtMoney(s.money)}</div>
          <div title="İtibar"><Stars v={s.stars} /> <span className="text-xs text-slate-400">{Math.round(s.rep)}</span></div>
          <div title="Anlık müşteri memnuniyeti" className={satCol}>😊 {s.liveSat < 0 ? '—' : Math.round(s.liveSat) + '%'}</div>
          <div title="Kasa sırası">🧍 {s.queue}</div>
          <div className="border-l border-white/10 pl-4"><span className="font-bold text-cyan-300">Gün {s.day}</span> • <span className="font-mono font-bold">{s.time}</span> {s.weather === 'rain' ? '🌧️' : s.minutes % 1440 > 1170 || s.minutes % 1440 < 360 ? '🌙' : s.minutes > 1050 ? '🌇' : '☀️'}</div>
          <div className={cx('rounded px-2 py-0.5 text-xs font-black', open ? 'bg-emerald-500/20 text-emerald-300' : prep ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300')}>{open ? 'AÇIK' : prep ? 'HAZIRLIK' : s.phase === 'closing' ? 'KAPANIYOR' : 'KAPALI'}</div>
          {s.mode === 'sandbox' && <div className="text-xs text-cyan-300">RAHAT MOD</div>}
        </Glass>
      </div>
      {s.events.length > 0 && <div className="absolute left-1/2 top-14 flex -translate-x-1/2 gap-2">{s.events.map((e: any) => <div key={e.id} className={cx('rounded-full px-3 py-1 text-xs font-bold', e.good ? 'bg-emerald-500/25 text-emerald-200' : 'bg-rose-500/30 text-rose-200 animate-pulse')}>{e.icon} {e.name}</div>)}</div>}
      {s.banner && <div className="absolute left-1/2 top-24 max-w-xl -translate-x-1/2 px-3"><Glass className={cx('px-5 py-3 text-center text-sm font-semibold', s.banner.good ? 'text-emerald-200' : 'text-rose-200')}><span className="mr-2 text-xl">{s.banner.icon}</span>{s.banner.text}</Glass></div>}
      <div className="absolute left-2 top-2 hidden w-60 space-y-2 md:block">
        <Glass className="p-3 text-xs"><div className="mb-1 font-black uppercase tracking-wider text-pink-300">Günün Hedefleri</div>
          {s.goals.map((gl: any) => <div key={gl.id} className="mb-1.5"><div className="flex justify-between gap-2"><span className={gl.done ? 'text-emerald-300 line-through' : ''}>{gl.text}</span><span className="text-amber-300">+{gl.reward}₺</span></div><div className="mt-0.5 h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full bg-gradient-to-r from-cyan-400 to-pink-400" style={{ width: Math.min(100, (gl.kind === 'thief' ? (gl.progress ? 0 : 100) : (gl.progress / Math.max(1, gl.target)) * 100)) + '%' }} /></div><div className="text-right text-[10px] text-slate-400">{gl.kind === 'thief' ? (gl.progress ? 'başarısız' : 'devam') : `${Math.round(gl.progress)} / ${gl.target}`}</div></div>)}
          <div className="mt-1 flex justify-between border-t border-white/10 pt-1 text-slate-300"><span>Bugün gelir</span><span className="text-emerald-300">{fmtMoney(s.income)}</span></div></Glass>
        {s.tournament && <Glass className="p-3 text-xs"><div className="font-black text-fuchsia-300">🏆 TURNUVA</div><div>{s.tournament.a} vs {s.tournament.b}</div><div className="text-slate-300">{({ announced: 'Saat 20:00 — hazırlan (2. kat)', prep: '2. kat konsolundan başlat!', live: 'Maç devam ediyor • Tur ' + s.tournament.round, ending: 'Final!', done: 'Tamamlandı' } as any)[s.tournament.status]}</div></Glass>}
      </div>
      <div className="absolute right-2 top-2 w-56 space-y-1.5">
        {s.orders.length > 0 && <Glass className="p-3 text-xs"><div className="mb-1 font-black uppercase tracking-wider text-amber-300">Açık Siparişler</div>
          {s.orders.slice(0, 6).map((o: any) => <div key={o.id} className="mb-1"><div className="flex items-center justify-between"><span>{o.icon} {o.item} <span className="text-slate-400">• {o.table}</span></span><span className={cx('text-[10px]', o.mine ? 'text-emerald-300' : o.state === 'making' ? 'text-sky-300' : 'text-slate-400')}>{o.mine ? 'tepside' : o.state === 'open' ? 'bekliyor' : o.state === 'making' ? 'hazırlanıyor' : 'hazır'}</span></div><div className="h-1 overflow-hidden rounded bg-slate-800"><div className={cx('h-full', o.frac < 0.35 ? 'bg-rose-500' : 'bg-emerald-400')} style={{ width: o.frac * 100 + '%' }} /></div></div>)}</Glass>}
      </div>
      <div className="absolute bottom-3 left-3 flex w-72 flex-col-reverse gap-1.5">
        {s.toasts.map((t: any) => <div key={t.id} className={cx('rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur', t.kind === 'good' ? 'border-emerald-400/40 bg-emerald-950/80 text-emerald-100' : t.kind === 'bad' ? 'border-rose-400/40 bg-rose-950/80 text-rose-100' : t.kind === 'warn' ? 'border-amber-400/40 bg-amber-950/80 text-amber-100' : 'border-cyan-400/30 bg-slate-950/80 text-slate-100')}>{t.text}</div>)}
      </div>
      <div className="absolute bottom-3 right-3 text-right text-[11px] text-slate-300/80"><div>{FLOORS[s.floor]}{s.inElev ? ' • Asansör: 1/2/3' : ''}{s.carrying ? ` • 🍽️ Tepsi (${s.carrying})` : ''}</div><div className="opacity-70">WASD yürü • Shift koş • E etkileşim • ESC duraklat</div></div>
      {s.cheat && <div className="absolute left-1/2 top-40 -translate-x-1/2 rounded bg-pink-600/80 px-4 py-1 text-sm font-bold">{s.cheat}</div>}
      {s.screen === 'playing' && <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 ring-2 ring-black/30" />}
      {s.prompt && s.screen === 'playing' && !s.mini && <div className="absolute left-1/2 top-[58%] -translate-x-1/2"><Glass className="flex items-center gap-3 px-4 py-2 text-sm"><kbd className="rounded bg-cyan-400 px-2 py-0.5 text-xs font-black text-slate-900">E</kbd><span className="max-w-md">{s.prompt.text}</span>{s.prompt.hold > 0 && <div className="h-2 w-24 overflow-hidden rounded bg-slate-700"><div className="h-full bg-pink-400" style={{ width: Math.min(100, s.prompt.progress * 100) + '%' }} /></div>}</Glass></div>}
      {prep && s.screen === 'playing' && <div className="absolute bottom-16 left-1/2 -translate-x-1/2"><Glass className="px-4 py-2 text-center text-xs text-amber-200">☀️ Hazırlık: yönetim masasında stok/çalışanları kontrol et, arızaları ve çöpleri gider, hazır olunca <b>kapıdaki tabelaya E</b>.</Glass></div>}
    </div>
  );
}

function Mini({ g }: { g: Game }) {
  const bar = useRef<HTMLDivElement>(null); const zone = useRef<HTMLDivElement>(null); const info = useRef<HTMLDivElement>(null);
  useEffect(() => { let id = 0; const tick = () => { const m = g.mini; if (m && bar.current && zone.current && info.current) { bar.current.style.left = m.pos * 100 + '%'; zone.current.style.left = m.zone[0] * 100 + '%'; zone.current.style.width = (m.zone[1] - m.zone[0]) * 100 + '%'; info.current.textContent = (m.steps[Math.min(2, m.step)]) + (m.msg && m.flash > 0 ? ' — ' + m.msg : ''); } id = requestAnimationFrame(tick); }; id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id); }, [g]);
  const m = g.mini; if (!m) return null;
  return (
    <div className="absolute inset-x-0 bottom-28 z-20 flex justify-center px-4"><Glass className="w-full max-w-md p-4 text-center">
      <div className="text-xs font-bold uppercase tracking-widest text-amber-300">Sipariş hazırlanıyor • {m.order.table}</div>
      <div ref={info} className="my-2 text-lg font-black text-white">…</div>
      <div className="relative h-8 overflow-hidden rounded-lg bg-slate-800 ring-1 ring-white/20"><div ref={zone} className="absolute top-0 h-full bg-emerald-400/60" /><div ref={bar} className="absolute top-0 h-full w-1.5 bg-white shadow-[0_0_8px_#fff]" /></div>
      <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-300"><kbd className="rounded bg-cyan-400 px-2 py-0.5 font-black text-slate-900">BOŞLUK</kbd> / <kbd className="rounded bg-cyan-400 px-2 py-0.5 font-black text-slate-900">E</kbd> / tık: yeşil bölgede bas • Adım {Math.min(3, m.step + 1)}/3 • ESC iptal</div>
    </Glass></div>
  );
}

function Touch({ g }: { g: Game }) {
  const stick = useRef<HTMLDivElement>(null); const start = useRef<{ x: number; y: number } | null>(null); const look = useRef<{ x: number; y: number } | null>(null);
  return (
    <div className="absolute inset-0 z-20">
      <div className="absolute inset-y-0 right-0 w-1/2" onPointerDown={(e) => { look.current = { x: e.clientX, y: e.clientY }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }} onPointerMove={(e) => { if (!look.current) return; g.yaw -= (e.clientX - look.current.x) * 0.006 * g.sens; g.pitch = Math.max(-1.3, Math.min(1.3, g.pitch - (e.clientY - look.current.y) * 0.006 * g.sens)); look.current = { x: e.clientX, y: e.clientY }; }} onPointerUp={() => { look.current = null; }} />
      <div ref={stick} className="absolute bottom-6 left-6 h-32 w-32 rounded-full border-2 border-white/30 bg-white/10" onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }} onPointerMove={(e) => { if (!start.current) return; const r = stick.current!.getBoundingClientRect(); const dx = (e.clientX - (r.left + 64)) / 56, dy = (e.clientY - (r.top + 64)) / 56; const l = Math.hypot(dx, dy) || 1; const k = Math.min(1, l); g.touch.x = (dx / l) * k; g.touch.z = (-dy / l) * k; }} onPointerUp={() => { start.current = null; g.touch.x = 0; g.touch.z = 0; }} />
      <div className="absolute bottom-8 right-6 flex flex-col gap-3"><button className="h-16 w-16 rounded-full bg-cyan-400/80 text-xl font-black text-slate-900" onPointerDown={() => { g.pressInteract(); g.interactHeld = true; }} onPointerUp={() => { g.interactHeld = false; }}>E</button><button className="h-12 w-16 rounded-full bg-pink-500/70 text-xs font-bold" onPointerDown={() => { g.touch.run = !g.touch.run; }}>KOŞ</button></div>
    </div>
  );
}

const TABS = ['Genel', 'Masalar', 'Müşteriler', 'Yorumlar', 'Finans & Stok', 'Çalışanlar', 'Mağaza', 'Güvenlik'];
function Admin({ g, s }: { g: Game; s: any }) {
  const [tab, setTab] = useState(0); const [a, setA] = useState<any>(() => g.adminSnap());
  useEffect(() => { const id = setInterval(() => setA(g.adminSnap()), 350); setA(g.adminSnap()); return () => clearInterval(id); }, [g]);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-2 sm:p-6">
      <Glass className="flex h-full max-h-[760px] w-full max-w-6xl flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
          <div className="flex items-center gap-3"><span className="text-lg font-black text-cyan-300">🖥️ YÖNETİM PANELİ</span><span className="text-xs text-slate-400">Gün {s.day} • {s.time} • {fmtMoney(s.money)}</span></div>
          <Btn small tone="pink" onClick={() => g.closeAdmin()}>✕ Kapat (ESC)</Btn>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-white/10 px-3 py-2">{TABS.map((t, i) => <button key={t} onClick={() => { g.audio.click(); setTab(i); }} className={cx('rounded-md px-3 py-1.5 text-xs font-bold transition', tab === i ? 'bg-cyan-400 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}>{t}{i === 1 && a.prep.broken > 0 ? ` (${a.prep.broken}🔧)` : ''}</button>)}</div>
        <div className="min-h-0 flex-1 overflow-auto p-4 text-sm">
          {tab === 0 && <General g={g} s={s} a={a} />}{tab === 1 && <Desks g={g} a={a} />}{tab === 2 && <Customers a={a} />}{tab === 3 && <Reviews s={s} a={a} />}
          {tab === 4 && <Finance g={g} s={s} a={a} />}{tab === 5 && <Staff g={g} a={a} />}{tab === 6 && <Shop g={g} a={a} s={s} />}{tab === 7 && <Security g={g} a={a} />}
        </div>
      </Glass>
    </div>
  );
}
const Card = ({ title, children, className }: { title?: string; children: any; className?: string }) => <div className={cx('rounded-lg border border-white/10 bg-slate-900/70 p-3', className)}>{title && <div className="mb-2 text-xs font-black uppercase tracking-wider text-pink-300">{title}</div>}{children}</div>;
function General({ g, s, a }: any) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card title="Güne Hazırlık" className="md:col-span-2">
        <ul className="space-y-1.5">
          <li className={a.prep.lowStock ? 'text-amber-300' : 'text-emerald-300'}>{a.prep.lowStock ? '⚠️' : '✅'} Stok: İçecek {a.stock.drink} • Atıştırmalık {a.stock.snack} • Yiyecek {a.stock.food}</li>
          <li className={a.prep.broken ? 'text-rose-300' : 'text-emerald-300'}>{a.prep.broken ? '🔧' : '✅'} Arızalı bilgisayar: {a.prep.broken}</li>
          <li className={a.prep.trash > 3 ? 'text-amber-300' : 'text-emerald-300'}>{a.prep.trash > 3 ? '🧹' : '✅'} Yerdeki çöp / leke: {a.prep.trash}</li>
          <li className={a.prep.emps ? 'text-emerald-300' : 'text-slate-300'}>{a.prep.emps ? '✅' : '👥'} Çalışan sayısı: {a.prep.emps}</li>
          {a.tourneyInfo && <li className="text-fuchsia-300">🏆 Turnuva: {a.tourneyInfo.a} vs {a.tourneyInfo.b} — {a.tourneyInfo.status === 'announced' ? '20:00' : a.tourneyInfo.status}</li>}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {s.phase === 'prep' && <Btn tone="green" onClick={() => { g.openShop(); g.closeAdmin(); }}>🔓 Kafeyi Aç</Btn>}
          {s.phase === 'open' && s.minutes >= 1200 && <Btn tone="red" onClick={() => { g.closeEarly(); g.closeAdmin(); }}>🔒 Günü Erken Bitir</Btn>}
          <Btn tone="amber" disabled={!!a.maint} onClick={() => g.doMaintenance()}>🛠️ Genel Bakım ({a.desks.filter((d: any) => d.owned).length * 25}₺)</Btn>
          <Btn tone="gray" onClick={() => g.save()}>💾 Kaydet</Btn>
        </div>
      </Card>
      <Card title="Günün Hedefleri">{s.goals.map((gl: any) => <div key={gl.id} className="mb-2"><div className={cx('flex justify-between', gl.done && 'text-emerald-300')}><span>{gl.done ? '✅ ' : '🎯 '}{gl.text}</span><span className="text-amber-300">+{gl.reward}₺</span></div><div className="text-xs text-slate-400">{gl.kind === 'thief' ? 'Hırsız kaçmasın' : `${Math.round(gl.progress)} / ${gl.target}`}</div></div>)}</Card>
      <Card title="Kafe Durumu"><div className="space-y-1"><div>İtibar: <Stars v={s.stars} /> ({Math.round(s.rep)}/100)</div><div>Bugünkü memnuniyet: <b>{s.sat ? Math.round(s.sat) + '%' : '—'}</b></div><div>Kasada bekleyen: <b>{s.queue}</b></div><div>Açık sipariş: <b>{a.orders.length}</b></div><div>Tahmini günlük kira: <b>{fmtMoney(a.rentEst)}</b> • maaşlar: <b>{fmtMoney(a.wageEst)}</b></div></div></Card>
      <Card title="Arızalı Bilgisayarlar" className="md:col-span-2">{a.desks.filter((d: any) => d.broken).length === 0 ? <div className="text-emerald-300">Arıza yok 👍</div> : <div className="flex flex-wrap gap-2">{a.desks.filter((d: any) => d.broken).map((d: any) => <span key={d.id} className="rounded bg-rose-900/60 px-2 py-1 text-xs">🔧 {d.label} ({FLOORS[d.floor]}) • {d.sev === 'major' ? 'büyük' : 'küçük'}</span>)}</div>}</Card>
    </div>
  );
}
function Desks({ g, a }: any) {
  const col = (d: any) => d.status === 'Arızalı' ? 'bg-rose-900/70 border-rose-400' : d.status === 'Dolu' ? 'bg-sky-900/60 border-sky-400' : d.status === 'Boş' ? 'bg-emerald-900/50 border-emerald-500' : d.status === 'Satılık' ? 'bg-slate-800 border-slate-600 opacity-70' : 'bg-amber-900/50 border-amber-400';
  return (
    <div className="space-y-4">{[0, 1, 2].map((f) => <div key={f}><div className="mb-1 text-xs font-black text-cyan-300">{FLOORS[f]}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{a.desks.filter((d: any) => d.floor === f).map((d: any) => <div key={d.id} className={cx('rounded-lg border p-2 text-xs', col(d))}><div className="font-bold">{DESK_INFO[d.type as keyof typeof DESK_INFO].icon} {d.label}</div><div>{d.status}{d.user ? ' • ' + d.user : ''}</div><div className="text-slate-400">{d.owned ? `Aşınma %${d.wear} • ${d.rate}₺/sa` : fmtMoney(d.price)}</div>{!d.owned && <Btn small className="mt-1 w-full" onClick={() => g.buyDesk(d.id)}>Satın al</Btn>}</div>)}</div></div>)}
      <div className="text-[11px] text-slate-400">🟩 Boş • 🟦 Dolu • 🟥 Arızalı • 🟨 Rezerve/Turnuva • ⬛ Satılık</div></div>
  );
}
function Customers({ a }: any) {
  return <div><div className="mb-2 text-xs text-slate-400">Kafedeki müşteriler ({a.customers.length})</div><div className="overflow-auto rounded-lg border border-white/10"><table className="w-full text-xs"><thead className="bg-slate-800 text-left"><tr><th className="p-2">Müşteri</th><th>Tür</th><th>Durum</th><th>Masa</th><th>Memnuniyet</th><th>Bekleme</th><th>Kalan</th></tr></thead><tbody>{a.customers.map((c: any, i: number) => <tr key={i} className="border-t border-white/5"><td className="p-2">{c.icon} {c.name}</td><td>{c.persona}</td><td className={c.state.includes('KAÇ') || c.state.includes('Arıza') ? 'text-rose-300' : ''}>{c.state}</td><td>{c.desk || '-'}</td><td className={c.sat > 70 ? 'text-emerald-300' : c.sat > 40 ? 'text-amber-300' : 'text-rose-300'}>%{c.sat}</td><td>{c.wait ? c.wait + ' sn' : '-'}</td><td>{c.left ? c.left + ' dk' : '-'}</td></tr>)}{a.customers.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-400">Şu an kimse yok.</td></tr>}</tbody></table></div></div>;
}
function Reviews({ s, a }: any) {
  return <div className="space-y-2"><div className="flex items-center gap-4 rounded-lg bg-slate-900/70 p-3"><div className="text-4xl font-black text-amber-300">{s.stars.toFixed(1)}</div><div><Stars v={s.stars} /><div className="text-xs text-slate-400">İtibar {Math.round(s.rep)}/100</div></div></div>
    {a.reviews.length === 0 && <div className="text-slate-400">Henüz yorum yok.</div>}{a.reviews.map((r: any, i: number) => <div key={i} className="rounded-lg border border-white/10 bg-slate-900/60 p-3"><div className="flex justify-between"><b>{r.name}</b><Stars v={r.stars} /></div><div className="text-slate-200">“{r.text}”</div><div className="text-[10px] text-slate-500">Gün {r.day} • {r.time}</div></div>)}</div>;
}
function Finance({ g, s, a }: any) {
  const inc = Object.entries(a.income) as [string, number][], exp = Object.entries(a.expenses) as [string, number][]; const names: any = { masa: 'Masa geliri', bufe: 'Büfe', bahsis: 'Bahşiş', turnuva: 'Turnuva', odul: 'Ödül/hedef', diger: 'Diğer', kira: 'Kira', elektrik: 'Elektrik', maas: 'Maaş', bakim: 'Bakım', stok: 'Stok alımı', yatirim: 'Yatırım', ceza: 'Ceza' };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card title="Bugünkü Gelir">{inc.map(([k, v]) => <div key={k} className="flex justify-between"><span>{names[k]}</span><span className="text-emerald-300">{fmtMoney(v)}</span></div>)}<div className="mt-1 flex justify-between border-t border-white/10 pt-1 font-bold"><span>Toplam</span><span className="text-emerald-300">{fmtMoney(s.income)}</span></div></Card>
      <Card title="Bugünkü Gider (Gün sonu: kira, elektrik, maaş, bakım)">{exp.map(([k, v]) => <div key={k} className="flex justify-between"><span>{names[k]}</span><span className="text-rose-300">{fmtMoney(v)}</span></div>)}<div className="flex justify-between"><span>Elektrik (biriken)</span><span className="text-rose-300">{fmtMoney(a.elec)}</span></div><div className="flex justify-between"><span>Tahmini kira + maaş</span><span className="text-rose-300">{fmtMoney(a.rentEst + a.wageEst)}</span></div></Card>
      <Card title="Stok" className="md:col-span-2"><div className="grid gap-2 sm:grid-cols-3">{(['drink', 'snack', 'food'] as const).map((k) => { const info = { drink: ['İçecek', '🥤', 6, 12], snack: ['Atıştırmalık', '🍟', 8, 12], food: ['Yiyecek', '🍔', 20, 10] }[k]; return <div key={k} className="rounded-lg bg-slate-800/70 p-3"><div className="text-lg">{info[1]} {info[0]}</div><div className={cx('text-3xl font-black', a.stock[k] < 5 ? 'text-rose-400' : 'text-emerald-300')}>{a.stock[k]}</div><div className="text-[11px] text-slate-400">Birim {info[2]}₺ • Paket {info[3]} adet</div><Btn small className="mt-2 w-full" onClick={() => g.buyStock(k)}>+{info[3]} al ({fmtMoney((info[2] as number) * (info[3] as number))})</Btn></div>; })}</div><div className="mt-2 text-[11px] text-slate-400">Yiyecek stoğu her gün sonu %15 bozulur.</div></Card>
      {a.history.length > 0 && <Card title="Son Günler" className="md:col-span-2"><div className="flex items-end gap-2">{a.history.map((h: any) => <div key={h.day} className="text-center text-[10px]"><div className={cx('w-10 rounded-t', h.net >= 0 ? 'bg-emerald-500' : 'bg-rose-500')} style={{ height: Math.min(90, Math.abs(h.net) / 12 + 6) }} /><div>G{h.day}</div><div>{h.net}₺</div></div>)}</div></Card>}
    </div>
  );
}
function Staff({ g, a }: any) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title="Çalışanlarım">{a.employees.length === 0 && <div className="text-slate-400">Henüz çalışanın yok. Sağdan işe al.</div>}{a.employees.map((e: any) => <div key={e.id} className="mb-2 rounded-lg bg-slate-800/70 p-2"><div className="flex justify-between"><b>{e.icon} {e.name}</b><span className="text-amber-300">{'★'.repeat(e.skill)}</span></div><div className="text-xs text-slate-300">{e.job} • {e.state} • {fmtMoney(e.wage)}/gün • yaptığı iş: {e.done}</div><div className="mt-1 flex gap-2"><Btn small tone={e.overtime ? 'amber' : 'gray'} onClick={() => g.toggleOvertime(e.id)}>{e.overtime ? '⏱️ Fazla mesai AÇIK' : '⏱️ Fazla mesai'}</Btn><Btn small tone="red" onClick={() => g.fire(e.id)}>İşten çıkar</Btn></div></div>)}</Card>
      <Card title="İş Başvuruları (günlük yenilenir)">{a.candidates.map((c: any) => <div key={c.id} className="mb-1.5 flex items-center justify-between gap-2 rounded bg-slate-800/60 p-2 text-xs"><div><div className="font-bold">{c.icon} {c.name} <span className="text-amber-300">{'★'.repeat(c.skill)}</span></div><div className="text-slate-400">{c.jobName} • {c.desc}</div></div><Btn small tone="green" onClick={() => g.hire(c.id)}>İşe al {fmtMoney(c.wage)}/gün</Btn></div>)}{a.candidates.length === 0 && <div className="text-slate-400">Başvuru kalmadı. Yarın yenilenir.</div>}</Card>
    </div>
  );
}
function Shop({ g, a, s }: any) {
  return (
    <div className="space-y-4">
      {a.sale && <div className="rounded bg-emerald-600/30 p-2 text-center font-bold text-emerald-200">🏷️ Bayi kampanyası: tüm fiyatlar %25 indirimli!</div>}
      <div><div className="mb-2 text-xs font-black uppercase tracking-wider text-pink-300">Yükseltmeler</div><div className="grid gap-2 md:grid-cols-2">{a.upgrades.map((u: any) => <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/70 p-3"><div><div className="font-bold">{u.icon} {u.name} <span className="text-xs text-cyan-300">Sv. {u.level}/{u.max}</span></div><div className="text-xs text-slate-400">{u.desc}</div></div>{u.level < u.max ? <Btn small disabled={s.money < u.cost} onClick={() => g.buyUpgrade(u.id)}>{fmtMoney(u.cost)}</Btn> : <span className="text-xs font-bold text-emerald-300">MAKS</span>}</div>)}</div></div>
      <div><div className="mb-2 text-xs font-black uppercase tracking-wider text-pink-300">Masa & Ekipman Satın Al</div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(Object.keys(DESK_INFO) as (keyof typeof DESK_INFO)[]).map((t) => { const un = a.desks.filter((d: any) => d.type === t && !d.owned); const own = a.desks.filter((d: any) => d.type === t && d.owned).length; const inf = DESK_INFO[t]; return <div key={t} className="rounded-lg border border-white/10 bg-slate-900/70 p-3"><div className="font-bold">{inf.icon} {inf.name}</div><div className="text-xs text-slate-400">{inf.desc}</div><div className="mt-1 text-xs">Sahip: {own} • Satılık: {un.length} • {inf.rate}₺/saat • Arıza: {inf.fail > 0.0006 ? 'yüksek' : inf.fail > 0.0003 ? 'orta' : 'düşük'}</div>{un.length > 0 ? <Btn small className="mt-2 w-full" disabled={s.money < un[0].price} onClick={() => g.buyDesk(un[0].id)}>Satın al — {fmtMoney(un[0].price)} ({un[0].label}, {FLOORS[un[0].floor]})</Btn> : <div className="mt-2 text-xs text-emerald-300">Hepsi alındı ✔</div>}</div>; })}</div></div>
      <div className="text-[11px] text-slate-400">İpucu: Masaya yaklaşıp E ile de satın alabilirsin. Üst katlar masa aldıkça canlanır.</div>
    </div>
  );
}
function Security({ g, a }: any) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { g.attachCCTV(ref.current); g.cctvAcc = 1; return () => g.attachCCTV(null); }, [g]);
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
      <div className="relative overflow-hidden rounded-lg border border-emerald-500/40 bg-black"><canvas ref={ref} width={320} height={180} className="aspect-video w-full" style={{ imageRendering: 'auto', filter: 'contrast(1.05) saturate(0.9)' }} />
        <div className="pointer-events-none absolute left-3 top-2 font-mono text-xs text-emerald-300">● REC • {a.cams[a.camIdx]}</div><div className="pointer-events-none absolute bottom-2 right-3 font-mono text-xs text-emerald-300">KAM {a.camIdx + 1}/{a.cams.length}</div></div>
      <div className="space-y-2"><div className="text-xs font-black uppercase tracking-wider text-pink-300">Kamera / Kat Seçimi</div>
        {a.cams.map((c: string, i: number) => <button key={c} onClick={() => g.setCam(i)} className={cx('block w-full rounded-md px-3 py-2 text-left text-xs font-bold', a.camIdx === i ? 'bg-emerald-400 text-slate-900' : 'bg-slate-800 hover:bg-slate-700')}>{i + 1}. {c}</button>)}
        <div className="flex gap-2"><Btn small tone="gray" className="flex-1" onClick={() => g.setCam(a.camIdx - 1)}>◀ Önceki</Btn><Btn small tone="gray" className="flex-1" onClick={() => g.setCam(a.camIdx + 1)}>Sonraki ▶</Btn></div>
        <div className="text-[11px] text-slate-400">Güvenlik sistemi yükseltmesi hırsız uyarısını ve yakalama şansını artırır.</div></div>
    </div>
  );
}

function Report({ g, s }: { g: Game; s: any }) {
  const r = s.report; if (!r) return null; const names: any = { masa: 'Masa geliri', bufe: 'Büfe', bahsis: 'Bahşiş', turnuva: 'Turnuva', odul: 'Ödül/hedef', diger: 'Diğer', kira: 'Kira', elektrik: 'Elektrik', maas: 'Maaşlar', bakim: 'Bakım', stok: 'Stok alımı', yatirim: 'Yatırımlar', ceza: 'Ceza' };
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-auto bg-black/70 p-3">
      <Glass className="my-auto w-full max-w-4xl p-5">
        <div className="mb-3 flex items-end justify-between"><h2 className="text-2xl font-black text-pink-400">📊 Gün {r.day} Raporu</h2><div className={cx('text-3xl font-black', r.net >= 0 ? 'text-emerald-300' : 'text-rose-400')}>{r.net >= 0 ? '+' : ''}{fmtMoney(r.net)}</div></div>
        <div className="grid gap-3 md:grid-cols-3">
          <Card title="Gelirler">{Object.entries(r.income).filter(([, v]) => (v as number) > 0).map(([k, v]) => <div key={k} className="flex justify-between"><span>{names[k]}</span><span className="text-emerald-300">{fmtMoney(v as number)}</span></div>)}<div className="mt-1 flex justify-between border-t border-white/10 pt-1 font-bold"><span>Toplam</span><span>{fmtMoney(r.totalIncome)}</span></div></Card>
          <Card title="Giderler">{Object.entries(r.expenses).filter(([, v]) => (v as number) > 0).map(([k, v]) => <div key={k} className="flex justify-between"><span>{names[k]}</span><span className="text-rose-300">{fmtMoney(v as number)}</span></div>)}<div className="mt-1 flex justify-between border-t border-white/10 pt-1 font-bold"><span>Toplam</span><span>{fmtMoney(r.totalExpense)}</span></div></Card>
          <Card title="Kafe"><div className="space-y-1 text-sm"><div>Kasa bakiyesi: <b className={r.money >= 0 ? 'text-emerald-300' : 'text-rose-400'}>{fmtMoney(r.money)}</b></div><div>Hizmet verilen: <b>{r.customers}</b> • Kaçan/vazgeçen: <b>{r.lost}</b></div><div>Memnuniyet: <b>%{r.avgSat}</b> • İtibar: <Stars v={r.rep / 20} /></div><div>Sipariş: {r.orders} • Tamir: {r.repairs} • Temizlik: {r.cleaned}</div><div>Hırsız: {r.caught} yakalandı, {r.escaped} kaçtı{r.tourney ? ' • 🏆 Turnuva tamamlandı' : ''}</div>{r.spoil > 0 && <div className="text-amber-300">Bozulan yiyecek: {r.spoil}</div>}</div></Card>
          <Card title="Hedefler" className="md:col-span-1">{r.goals.map((gl: any) => <div key={gl.id} className={gl.done ? 'text-emerald-300' : 'text-slate-400'}>{gl.done ? '✅' : '❌'} {gl.text} {gl.done ? `(+${gl.reward}₺)` : ''}</div>)}</Card>
          <Card title="Son Yorumlar" className="md:col-span-2">{r.reviews.length === 0 ? <div className="text-slate-400">Bugün yorum yok.</div> : r.reviews.slice(0, 4).map((v: any, i: number) => <div key={i} className="mb-1 text-xs"><Stars v={v.stars} /> <b>{v.name}:</b> <span className="text-slate-300">“{v.text}”</span></div>)}</Card>
          <Card title="Yatırımlar & Öneriler" className="md:col-span-3"><div className="text-xs">{r.invest.length ? '🛒 Bugünkü yatırımlar: ' + r.invest.join(', ') : '🛒 Bugün yatırım yapılmadı.'}</div>{r.tips.map((t: string, i: number) => <div key={i} className="mt-1 text-xs text-amber-200">💡 {t}</div>)}</Card>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><Btn tone="gray" onClick={() => g.save()}>💾 Kaydet</Btn><Btn tone="green" onClick={() => g.nextDay()}>☀️ Sonraki Gün ({s.day + 1}) →</Btn></div>
      </Glass>
    </div>
  );
}

function End({ g, s, win }: { g: Game; s: any; win: boolean }) {
  const r = s.report;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4">
      <Glass className="w-full max-w-md p-6 text-center">
        <div className="text-5xl">{win ? '🏆' : '📉'}</div>
        <h2 className={cx('mt-2 text-3xl font-black', win ? 'text-amber-300' : 'text-rose-400')}>{win ? 'Mahallenin Efsanesi!' : 'İflas Ettin'}</h2>
        <p className="mt-2 text-sm text-slate-300">{win ? `${s.day}. günde 5 yıldızlık itibar ve ${fmtMoney(s.money)} kasayla NET KAFE mahallenin en ünlü yeri oldu.` : `${s.day}. günde borçlar çok büyüdü ve kafeyi kapatmak zorunda kaldın (${fmtMoney(s.money)}). Rahat modla tekrar deneyebilirsin.`}</p>
        {r && <div className="mt-2 text-xs text-slate-400">Son gün net: {fmtMoney(r.net)} • Memnuniyet %{r.avgSat}</div>}
        <div className="mt-5 flex flex-col gap-2">{win && <Btn tone="green" onClick={() => g.continueAfterVictory()}>Oynamaya Devam Et</Btn>}<Btn tone="pink" onClick={() => { g.newGame(g.state.mode); g.lock(); }}>🔄 Yeniden Başla</Btn><Btn tone="gray" onClick={() => g.setScreen('menu')}>Ana Menü</Btn>{!win && g.hasSave() && <Btn tone="amber" onClick={() => { if (g.load()) g.lock(); }}>💾 Son Kayda Dön</Btn>}</div>
      </Glass>
    </div>
  );
}
void JOBS;
