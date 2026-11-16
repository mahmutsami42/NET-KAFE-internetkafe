export const FH = 4.4;
export const FY = [0, 4.4, 8.8];
export const CEIL = 4.1;

export const rnd = (a = 1, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const rint = (a: number, b: number) => Math.floor(rnd(a, b + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
export const angDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export type DeskType = 'old' | 'gaming' | 'vip' | 'racing' | 'quiet' | 'esport';
export const DESK_INFO: Record<DeskType, { name: string; short: string; rate: number; price: number; fail: number; comfort: number; color: number; icon: string; desc: string }> = {
  old: { name: 'Eski Bilgisayar', short: 'Eski', rate: 14, price: 450, fail: 0.00075, comfort: 0.7, color: 0x8a8a7a, icon: '🖥️', desc: 'Ucuz ve eski. Düşük gelir, sık arıza.' },
  gaming: { name: 'Gaming Masası', short: 'Gaming', rate: 30, price: 1100, fail: 0.00038, comfort: 1, color: 0x2fd6c8, icon: '🎮', desc: 'Dengeli, popüler orta seviye masa.' },
  vip: { name: 'VIP Masa', short: 'VIP', rate: 62, price: 2300, fail: 0.00022, comfort: 1.4, color: 0xe6b84a, icon: '👑', desc: 'Yüksek gelir ama müşteri beklentisi çok yüksek.' },
  racing: { name: 'Yarış Simülatörü', short: 'Yarış', rate: 52, price: 2800, fail: 0.00042, comfort: 1.2, color: 0xff5a4a, icon: '🏎️', desc: 'Direksiyon setli özel deneyim. Araba tutkunlarını çeker.' },
  quiet: { name: 'Sakin Oyun Masası', short: 'Sakin', rate: 26, price: 900, fail: 0.0003, comfort: 1.1, color: 0x9a86ff, icon: '🪴', desc: 'Pencere kenarı, sakin ve rahat. Düzenli müşterilere uygun.' },
  esport: { name: 'E-spor Masası', short: 'E-spor', rate: 44, price: 1700, fail: 0.00032, comfort: 1.2, color: 0xff3fa4, icon: '🏆', desc: 'Turnuvalar ve takım etkinlikleri için.' },
};

export type Persona = 'student' | 'regular' | 'vip' | 'racer' | 'esports' | 'quick' | 'thief' | 'streamer' | 'spectator';
export interface PersonaInfo { label: string; budget: [number, number]; patience: [number, number]; session: [number, number]; prefs: DeskType[]; order: number; items: string[]; expect: number; icon: string; }
export const PERSONA: Record<Persona, PersonaInfo> = {
  student: { label: 'Sabırsız Öğrenci', budget: [60, 160], patience: [22, 34], session: [40, 100], prefs: ['old', 'gaming', 'quiet'], order: 0.4, items: ['cay', 'cips', 'kola'], expect: 0.9, icon: '🎒' },
  regular: { label: 'Düzenli Müşteri', budget: [180, 420], patience: [45, 70], session: [110, 240], prefs: ['quiet', 'gaming', 'old'], order: 0.8, items: ['cay', 'tost', 'kola', 'burger', 'cips'], expect: 1, icon: '☕' },
  vip: { label: 'VIP Müşteri', budget: [500, 1100], patience: [28, 40], session: [80, 170], prefs: ['vip', 'esport', 'gaming'], order: 0.95, items: ['burger', 'enerji', 'tost'], expect: 1.7, icon: '👑' },
  racer: { label: 'Araba Meraklısı', budget: [220, 480], patience: [35, 55], session: [60, 130], prefs: ['racing', 'gaming'], order: 0.55, items: ['enerji', 'kola', 'cips'], expect: 1.15, icon: '🏎️' },
  esports: { label: 'E-spor Oyuncusu', budget: [200, 450], patience: [35, 55], session: [100, 200], prefs: ['esport', 'gaming', 'vip'], order: 0.7, items: ['enerji', 'burger', 'kola'], expect: 1.2, icon: '🏆' },
  quick: { label: 'Hızlı Müşteri', budget: [40, 120], patience: [16, 24], session: [15, 38], prefs: ['old', 'gaming', 'quiet'], order: 0.12, items: ['cay', 'kola'], expect: 0.8, icon: '⚡' },
  thief: { label: 'Şüpheli Müşteri', budget: [100, 260], patience: [30, 45], session: [40, 110], prefs: ['old', 'gaming', 'quiet'], order: 0.1, items: ['cay'], expect: 1, icon: '🕶️' },
  streamer: { label: 'Ünlü Yayıncı', budget: [900, 1500], patience: [40, 60], session: [90, 160], prefs: ['vip', 'esport', 'racing'], order: 1, items: ['burger', 'enerji'], expect: 2, icon: '🌟' },
  spectator: { label: 'Seyirci', budget: [60, 120], patience: [60, 90], session: [60, 120], prefs: [], order: 0, items: [], expect: 1, icon: '📣' },
};

export const MENU: Record<string, { name: string; price: number; cat: 'drink' | 'snack' | 'food'; icon: string; prep: number }> = {
  cay: { name: 'Çay', price: 15, cat: 'drink', icon: '☕', prep: 0.8 },
  kola: { name: 'Kola', price: 25, cat: 'drink', icon: '🥤', prep: 0.8 },
  enerji: { name: 'Enerji İçeceği', price: 42, cat: 'drink', icon: '⚡', prep: 0.8 },
  cips: { name: 'Cips', price: 22, cat: 'snack', icon: '🍟', prep: 0.9 },
  tost: { name: 'Tost', price: 48, cat: 'food', icon: '🥪', prep: 1.2 },
  burger: { name: 'Hamburger', price: 75, cat: 'food', icon: '🍔', prep: 1.4 },
};
export const STOCK_INFO = {
  drink: { name: 'İçecek', cost: 6, batch: 12, icon: '🥤' },
  snack: { name: 'Atıştırmalık', cost: 8, batch: 12, icon: '🍟' },
  food: { name: 'Yiyecek', cost: 20, batch: 10, icon: '🍔' },
};
export type StockCat = keyof typeof STOCK_INFO;

export interface UpgradeDef { id: string; name: string; icon: string; desc: string; costs: number[]; }
export const UPGRADES: UpgradeDef[] = [
  { id: 'pc', name: 'Bilgisayar Donanımı', icon: '🖥️', desc: 'Arıza ihtimali -%20 / seviye, masa geliri +%8 / seviye.', costs: [1200, 2600, 4800] },
  { id: 'monitor', name: 'Monitörler', icon: '🖵', desc: 'Memnuniyet +, masa geliri +%6 / seviye.', costs: [800, 1800, 3400] },
  { id: 'kb', name: 'Klavye & Mouse', icon: '⌨️', desc: 'Memnuniyet +, arıza -%8 / seviye.', costs: [500, 1100, 2100] },
  { id: 'headset', name: 'Kulaklıklar', icon: '🎧', desc: 'Memnuniyet + ve bahşiş artışı.', costs: [450, 950, 1800] },
  { id: 'chair', name: 'Sandalyeler', icon: '💺', desc: 'Uzun oturumlarda memnuniyet düşüşü azalır.', costs: [650, 1500, 2800] },
  { id: 'net', name: 'İnternet Altyapısı', icon: '📡', desc: 'Yavaşlama olayı etkisi azalır, gelir +%5 / seviye.', costs: [1000, 2300, 4200] },
  { id: 'ac', name: 'Klima Sistemi', icon: '❄️', desc: 'Sıcak/kalabalık sıkıntısı azalır. Elektrik gideri artar.', costs: [900, 2000, 3600] },
  { id: 'decor', name: 'Dekorasyon', icon: '🪩', desc: 'Günlük itibar kazancı ve VIP çekiciliği artar.', costs: [700, 1600, 3000] },
  { id: 'sec', name: 'Güvenlik Sistemi', icon: '📹', desc: 'Hırsızlık uyarısı, yakalama şansı ve kaçak yavaşlaması.', costs: [800, 1900, 3600] },
  { id: 'buffet', name: 'Büfe Ekipmanı', icon: '🍳', desc: 'Sipariş hazırlama hızlanır, bahşiş artar.', costs: [700, 1500, 2700] },
];

export type Job = 'cashier' | 'cleaner' | 'tech' | 'buffet';
export const JOBS: Record<Job, { name: string; base: number; desc: string; icon: string }> = {
  cashier: { name: 'Kasa Görevlisi', base: 230, desc: 'Kasada sırayı eritir, girişleri ve ödemeleri alır.', icon: '💳' },
  cleaner: { name: 'Temizlik Görevlisi', base: 170, desc: 'Çöpleri ve dökülen içecekleri toplar.', icon: '🧹' },
  tech: { name: 'Bilgisayar Teknisyeni', base: 310, desc: 'Küçük arızaları giderir. Büyük arızalar sana kalır.', icon: '🔧' },
  buffet: { name: 'Büfe Çalışanı', base: 250, desc: 'Siparişleri hazırlar ve masalara servis eder.', icon: '🍔' },
};

export const FIRST = ['Ahmet', 'Mehmet', 'Ali', 'Can', 'Emre', 'Burak', 'Mert', 'Kerem', 'Efe', 'Arda', 'Yusuf', 'Berk', 'Onur', 'Cem', 'Deniz', 'Ayşe', 'Elif', 'Zeynep', 'Selin', 'Merve', 'Ece', 'Defne', 'Buse', 'Irmak', 'Naz', 'Seda', 'Gizem', 'Barış', 'Tolga', 'Okan'];
export const LAST = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Koç', 'Polat', 'Erdoğan', 'Güneş'];
export const randName = () => pick(FIRST) + ' ' + pick(LAST);

export const REVIEWS = {
  great: ['Harika bir kafe! Bilgisayarlar çok akıcı, tekrar geleceğim.', 'Mahallenin en iyi net kafesi, personel ilgili.', 'Temiz, rahat ve hızlı. 10 numara!', 'Arkadaşlarla geldik, çok eğlendik.', 'Neon ışıklar çok hoş, ortam muhteşem.'],
  ok: ['Fena değil, idare eder.', 'Normal bir net kafe. Fiyatlar makul.', 'Bir sorun yaşamadım, yine uğrarım.'],
  broken: ['Bilgisayar yarıda bozuldu, çok sinir bozucu!', 'Arızalı makine verdiler, oyunum yarıda kaldı.', 'Ekran sürekli bozuluyordu. Bakım yapın artık!'],
  dirty: ['Her yer çöp dolu, iğrenç.', 'Masanın etrafı kirliydi, bir daha gelmem.', 'Yerler dökülmüş içecek içinde...'],
  wait: ['Kasada çok bekledim, sabrım taştı.', 'Sıra bitmiyor, personel yok mu?', 'Giriş yapmak için yarım saat bekledim!'],
  food: ['Siparişim çok geç geldi, çay soğudu.', 'Yiyecek gelmedi, boşuna bekledim.', 'Büfe çok yavaş, daha hızlı olmalı.'],
  lag: ['İnternet çok yavaştı, oyun sürekli takıldı.', 'Ping 300! Bu ne biçim internet?'],
  full: ['Yer yoktu, ayakta bekledim sonra çıktım.', 'Uygun masa bulamadım.'],
  hot: ['Çok sıcaktı, klima yok mu burada?'],
  dark: ['Elektrik kesildi, bütün oyunum gitti!'],
};

export const TEAM_NAMES = ['Neon Kurtlar', 'Mahalle FC', 'Kırmızı Turbo', 'Gece Kuşları', 'Piksel Avcıları', 'Çılgın Fareler', 'Kalem Ejderha', 'Siber Bozkurt'];

export interface EventDef { id: string; name: string; icon: string; desc: string; good: boolean; dur: number; }
export const EVENTS: Record<string, EventDef> = {
  rush: { id: 'rush', name: 'Yoğun Saat', icon: '🚀', desc: 'Kafe bir anda doldu! Müşteri akışı iki katına çıktı.', good: true, dur: 100 },
  lag: { id: 'lag', name: 'İnternet Yavaşlaması', icon: '🐌', desc: 'Bağlantı çöktü! Giriş katındaki modem rafından modemi yeniden başlat.', good: false, dur: 120 },
  blackout: { id: 'blackout', name: 'Elektrik Kesintisi', icon: '⚡', desc: 'Işıklar gitti! Büfe arkasındaki sigorta kutusunu aç.', good: false, dur: 80 },
  streamer: { id: 'streamer', name: 'Ünlü Yayıncı Geliyor', icon: '🌟', desc: 'Ünlü bir yayıncı kafene uğradı. İyi ağırlarsan ün kazanırsın!', good: true, dur: 30 },
  sale: { id: 'sale', name: 'Ekipman İndirimi', icon: '🏷️', desc: 'Bayi kampanyası: bugün mağaza fiyatları %25 daha ucuz!', good: true, dur: 840 },
  rain: { id: 'rain', name: 'Yağmurlu Hava', icon: '🌧️', desc: 'Yağmur bastırdı. İçeri sığınanlar çoğalacak ama zemin ıslanıyor.', good: true, dur: 260 },
  festival: { id: 'festival', name: 'Mahalle Şenliği', icon: '🎉', desc: 'Mahallede şenlik var, sokaklar kalabalık. Yeni müşteriler yolda!', good: true, dur: 220 },
  inspect: { id: 'inspect', name: 'Belediye Denetimi', icon: '📋', desc: 'Müfettiş geliyor! Kafeyi temiz ve arızasız tut.', good: true, dur: 60 },
  sponsor: { id: 'sponsor', name: 'Sponsor Desteği', icon: '🎁', desc: 'Bir enerji içeceği firması kafene stok ve nakit bıraktı.', good: true, dur: 5 },
};

export const fmtMoney = (n: number) => (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('tr-TR') + ' ₺';
export const fmtTime = (m: number) => { const h = Math.floor(m / 60) % 24; const mm = Math.floor(m % 60); return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
