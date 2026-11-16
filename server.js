const express = require('express');
const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');
const { SocksClient } = require('socks');

const app = express();
app.use(express.text({ type: '*/*', limit: '2mb' }));

const PORT = process.env.PORT || 3000;
const PLIK_DANE = path.join(__dirname, 'dane.json');
const PLIK_NICKI = path.join(__dirname, 'nicki.txt');
const PLIK_STARE_NICKI = path.join(__dirname, 'nicki-stare.txt');

// Automatyczne rozmieszczenie plików (gdy wrzucone płasko przez GitHub Upload):
try {
  fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
  fs.mkdirSync(path.join(__dirname, 'skrypty'), { recursive: true });
  for (const f of ['index.html', 'proxy.html']) {
    const src = path.join(__dirname, f);
    const dst = path.join(__dirname, 'public', f);
    if (fs.existsSync(src) && !fs.existsSync(dst)) fs.copyFileSync(src, dst);
  }
  for (const f of ['dynie.js', 'nagrody.js', 'wlasny.js']) {
    const src = path.join(__dirname, f);
    const dst = path.join(__dirname, 'skrypty', f);
    if (fs.existsSync(src) && !fs.existsSync(dst)) fs.copyFileSync(src, dst);
  }
} catch (e) {}

// ─── DOMYŚLNA KONFIGURACJA ───────────────────────────────────────────────────
const DOMYSLNE_NAGRODY = {
  liczbaBotow: 100,          // 100 botów wchodzących po kolei
  komendaTrybu: '',          // np. "/anarchia" lub "/tryb" po zalogowaniu (puste = używa mcKomendaWejscia lub brak)
  lobbyKlikSlot: 10,         // kliknięcie slotu #10 (tryb po samej lewej stronie w GUI WYBÓR TRYBU)
  lobbyHotbarSlot: 4,        // 5. slot w ekwipunku na pasku (indeks 4 w 0-8)
  komendaNagrody: '/darmowenagrody',
  trybSlotu: 'auto',         // 'auto' = szuka klucza po prawej stronie (fallback slot 23), 'reczny' = sztywny slot
  slotKlucza: 23,            // slot klucza po prawej stronie w 5-rzędowym GUI (rząd 3, kolumna 6 = indeks 23)
  opoznieniePoLoginieS: 3,   // ile sekund po /login odczekać przed wejściem na tryb
  opoznienieNaTrybieS: 4,    // ile sekund po wejściu na tryb odczekać przed wpisaniem /darmowenagrody
  odstepMiedzyBotamiS: 4,    // ile sekund przerwy po wyjściu bota przed wejściem kolejnego
  timeoutBotaS: 45,          // maksymalny czas na 1 bota (sekundy)
  interwalGodziny: 5,        // co ile godzin powtarzać cykl (domyślnie 5h)
  interwalMinuty: 10,        // i ile minut (domyślnie 10min -> 5h 10min)
  autoPowtarzaj: true,       // automatyczny restart cyklu co 5h 10min
  wymagajProxy: false,       // czy blokować wejście jeśli brak proxy na liście
};

let konfig = {
  hasloPanelu: 'admin123',
  mcHost: 'rapy.gg',
  mcPort: 25565,
  mcWersja: '1.21.11',
  mcHasloKont: 'HasloBotow123!',
  mcKomendaWejscia: '', // np. "/anarchia" lub "/warp farma" po zalogowaniu
  odstepKolejkiMs: 15000, // odstęp między wchodzeniem kolejnych botów (domyślnie 15s, można zmienić na 60s)
  max: 100,
  proxyLista: [], // { nr, nazwa, host, port, user, pass, test: null }
  sloty: [], // { slot, nick, wlaczony, proxyReczne, proxyNr, skryptNazwa }
  ostatnieLosowanie: null,
  nagrody: { ...DOMYSLNE_NAGRODY },
};

// Generator naturalnie wyglądających nicków graczy Minecraft (3-16 znaków)
const CZLONY_1 = [
  'Kacper', 'Kubus', 'Mati', 'Wojtek', 'Szymon', 'Filip', 'Bartek', 'Dawid', 'Michal', 'Piotrek',
  'Olek', 'Tomek', 'Patryk', 'Kamil', 'Igor', 'Nikodem', 'Hubert', 'Marcel', 'Maks', 'Antek',
  'Dark', 'Shadow', 'Pixel', 'Frost', 'Fire', 'Storm', 'Night', 'Hyper', 'Toxic', 'Silent',
  'Void', 'Ghost', 'Lunar', 'Solar', 'Neon', 'Cyber', 'Blaze', 'Vortex', 'Crystal', 'Blood',
  'Kotlet', 'Pierog', 'Szynka', 'Cebula', 'Kebab', 'Paczek', 'Tost', 'Lisek', 'Wilczek', 'Bober',
  'Rekin', 'Orzel', 'Sokolek', 'Misiek', 'Zaba', 'Smok', 'Golem', 'Creeper', 'Enderman', 'Wither',
  'Mroczny', 'Szybki', 'Zloty', 'Srebrny', 'Dziki', 'Cichy', 'Zimny', 'Ognisty', 'Mlody', 'Stary'
];
const CZLONY_2 = [
  'PL', 'YT', 'TV', 'PvP', 'MC', 'Pro', 'XD', 'Gaming', 'Official', 'Boss',
  'King', 'Master', 'Killer', 'Hunter', 'Slayer', 'Ninja', 'Fox', 'Wolf', 'Bear', 'Dragon',
  'Knight', 'Legend', 'God', 'Hero', 'Play', 'Craft', 'Miner', 'Builder', 'Vip', 'Kox',
  'Ziomek', 'Gracz', 'Wojownik', 'Mistrz', 'krol', 'rycerz', 'strzelec', 'szef', 'byk', 'dzik'
];

function generujNormalnyNick(uzyte = new Set()) {
  for (let proba = 0; proba < 500; proba++) {
    const styl = Math.floor(Math.random() * 6);
    const c1 = CZLONY_1[Math.floor(Math.random() * CZLONY_1.length)];
    const c2 = CZLONY_2[Math.floor(Math.random() * CZLONY_2.length)];
    let nick = '';

    if (styl === 0) {
      // np. KacperPL, ShadowPvP
      nick = `${c1}${c2}`;
    } else if (styl === 1) {
      // np. Mati_2008, Frost_MC
      const suf = Math.random() < 0.5 ? c2 : String(2004 + Math.floor(Math.random() * 12));
      nick = `${c1}_${suf}`;
    } else if (styl === 2) {
      // np. kubus1337, wilczek99
      const num = Math.floor(10 + Math.random() * 989);
      nick = `${c1.toLowerCase()}${num}`;
    } else if (styl === 3) {
      // np. xKamil_, _PixelPro_
      nick = Math.random() < 0.5 ? `x${c1}${c2}` : `_${c1}_`;
    } else if (styl === 4) {
      // np. Bartek_PL12
      const num = Math.floor(1 + Math.random() * 99);
      nick = `${c1}_${c2}${num}`;
    } else {
      // np. MisiekKox21
      const num = Math.floor(11 + Math.random() * 88);
      nick = `${c1}${c2}${num}`;
    }

    nick = nick.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
    if (nick.length >= 4 && !uzyte.has(nick.toLowerCase())) {
      uzyte.add(nick.toLowerCase());
      return nick;
    }
  }
  return 'Gracz_' + Math.floor(1000 + Math.random() * 8999);
}

// Inicjalizacja puli nicków jeśli plik nie istnieje (520 nicków: 20 na startowe sloty + 500 w puli)
if (!fs.existsSync(PLIK_NICKI)) {
  const uzyte = new Set();
  const startowe = [];
  for (let i = 1; i <= 520; i++) {
    startowe.push(generujNormalnyNick(uzyte));
  }
  fs.writeFileSync(PLIK_NICKI, startowe.join('\n') + '\n', 'utf8');
}

function wczytajPuleNickow() {
  if (!fs.existsSync(PLIK_NICKI)) return [];
  return fs.readFileSync(PLIK_NICKI, 'utf8')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function zapiszPuleNickow(lista) {
  fs.writeFileSync(PLIK_NICKI, lista.join('\n') + (lista.length ? '\n' : ''), 'utf8');
}

function wezNickZPuli() {
  const pula = wczytajPuleNickow();
  if (pula.length > 0) {
    const nick = pula.shift();
    zapiszPuleNickow(pula);
    return nick;
  }
  return generujNormalnyNick();
}

function zapiszDane() {
  try {
    fs.writeFileSync(PLIK_DANE, JSON.stringify(konfig, null, 2), 'utf8');
  } catch (e) {
    console.error('Błąd zapisu dane.json:', e.message);
  }
}

function wczytajDane() {
  if (fs.existsSync(PLIK_DANE)) {
    try {
      const wczytane = JSON.parse(fs.readFileSync(PLIK_DANE, 'utf8'));
      konfig = {
        ...konfig,
        ...wczytane,
        nagrody: { ...DOMYSLNE_NAGRODY, ...(wczytane.nagrody || {}) },
      };
    } catch (e) {
      console.error('Błąd odczytu dane.json:', e.message);
    }
  }
  const wymaganeMax = Math.max(konfig.max || 100, (konfig.nagrody && konfig.nagrody.liczbaBotow) || 100);
  if (konfig.max < wymaganeMax) konfig.max = wymaganeMax;
  dopasujSloty();
}

function dopasujSloty() {
  while (konfig.sloty.length < konfig.max) {
    const nr = konfig.sloty.length + 1;
    konfig.sloty.push({
      slot: nr,
      nick: wezNickZPuli(),
      wlaczony: false,
      proxyReczne: false,
      proxyNr: 0,
      skryptNazwa: 'dynie',
    });
  }
  if (konfig.sloty.length > konfig.max) {
    for (let i = konfig.max; i < konfig.sloty.length; i++) {
      rozlaczBota(konfig.sloty[i].slot, 'zmniejszono limit slotów');
    }
    konfig.sloty = konfig.sloty.slice(0, konfig.max);
  }
  zapiszDane();
}

// ─── DZIENNIK LOGÓW ──────────────────────────────────────────────────────────
const dziennik = [];
function log(tresc) {
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  const linia = `[${hh}:${mm}:${ss}] ${tresc}`;
  console.log(linia);
  dziennik.push(linia);
  if (dziennik.length > 250) dziennik.shift();
}

// ─── STAN RUNTIME BOTÓW ──────────────────────────────────────────────────────
// Klucz: numer slotu (1..max)
const runtime = new Map();

function pobierzRuntime(slotNr) {
  if (!runtime.has(slotNr)) {
    runtime.set(slotNr, {
      stan: 'rozłączony',
      online: false,
      bot: null,
      czasWejscia: 0,
      blad: '',
      skryptAktywny: false,
      aktywnySkryptNazwa: '',
      ostatniSpawnEntity: null,
      scianaMap: {}, // klucz "col_row" (0..7, 0..3) -> base64(16384 bajtów)
      maScianeMap: false,
    });
  }
  return runtime.get(slotNr);
}

// ─── OBSŁUGA SKRYPTÓW (DYNIE / WŁASNY) ───────────────────────────────────────
function zaladujModulySkryptow() {
  const dir = path.join(__dirname, 'skrypty');
  const wynik = {};
  if (!fs.existsSync(dir)) return wynik;
  for (const plik of fs.readdirSync(dir)) {
    if (plik.endsWith('.js')) {
      const pelna = path.join(dir, plik);
      delete require.cache[require.resolve(pelna)];
      try {
        const mod = require(pelna);
        const klucz = mod.nazwa || plik.replace('.js', '');
        wynik[klucz] = mod;
      } catch (e) {
        log(`❌ Błąd ładowania skryptu ${plik}: ${e.message}`);
      }
    }
  }
  return wynik;
}

function uruchomSkryptBota(slotNr, nazwaSkryptu) {
  const rt = pobierzRuntime(slotNr);
  const slotObj = konfig.sloty.find(s => s.slot === slotNr);
  if (!rt.bot || !rt.online) {
    return { ok: false, powod: 'Bot nie jest jeszcze w grze' };
  }
  if (rt.skryptAktywny) {
    zatrzymajSkryptBota(slotNr);
  }
  const skrypty = zaladujModulySkryptow();
  const wybrane = nazwaSkryptu || (slotObj && slotObj.skryptNazwa) || 'dynie';
  const mod = skrypty[wybrane];
  if (!mod || typeof mod.start !== 'function') {
    return { ok: false, powod: `Nie znaleziono skryptu: ${wybrane}` };
  }
  try {
    rt.skryptAktywny = true;
    rt.aktywnySkryptNazwa = wybrane;
    rt.stan = `skrypt: ${wybrane}`;
    rt.bot._nieLadujSwiata = false;
    rt.bot.physicsEnabled = true;
    mod.start(rt.bot, log);
    return { ok: true, wiadomosc: `Uruchomiono skrypt "${wybrane}" na #${slotNr} (${slotObj.nick})` };
  } catch (e) {
    rt.skryptAktywny = false;
    log(`❌ Błąd startu skryptu u #${slotNr}: ${e.message}`);
    return { ok: false, powod: e.message };
  }
}

function zatrzymajSkryptBota(slotNr) {
  const rt = pobierzRuntime(slotNr);
  const slotObj = konfig.sloty.find(s => s.slot === slotNr);
  if (!rt.skryptAktywny) return { ok: true, wiadomosc: 'Skrypt już wyłączony' };
  const skrypty = zaladujModulySkryptow();
  const mod = skrypty[rt.aktywnySkryptNazwa];
  try {
    if (mod && typeof mod.stop === 'function' && rt.bot) {
      mod.stop(rt.bot, log);
    } else if (rt.bot) {
      rt.bot._skryptAktywny = false;
      rt.bot.clearControlStates();
    }
  } catch (e) {}
  rt.skryptAktywny = false;
  rt.aktywnySkryptNazwa = '';
  if (rt.online) rt.stan = 'na spawnie';
  return { ok: true, wiadomosc: `Zatrzymano skrypt na #${slotNr} (${slotObj ? slotObj.nick : ''})` };
}

// ─── WYBÓR PROXY DLA SLOTU ───────────────────────────────────────────────────
function wybierzProxyDlaSlotu(slotObj) {
  if (slotObj.proxyReczne && slotObj.proxyNr === -1) return null; // Wymuszone lokalne IP (bez proxy)
  const lista = konfig.proxyLista;
  if (!lista.length) return null;
  if (slotObj.proxyReczne && slotObj.proxyNr > 0) {
    return lista.find(p => p.nr === slotObj.proxyNr) || null;
  }
  // Auto rozkład równomierny: (slot - 1) mod liczba_proxy
  const idx = (slotObj.slot - 1) % lista.length;
  return lista[idx] || null;
}

// ─── URUCHAMIANIE BOTA MINEFLAYER ────────────────────────────────────────────
function polaczBota(slotObj) {
  const rt = pobierzRuntime(slotObj.slot);
  if (rt.bot) {
    try { rt.bot.quit(); } catch (e) {}
    rt.bot = null;
  }

  const proxy = wybierzProxyDlaSlotu(slotObj);
  rt.stan = 'łączenie';
  rt.online = false;
  rt.blad = '';

  const opisProxy = proxy ? `Proxy ${proxy.nr} (${proxy.host}:${proxy.port})` : 'bez proxy (lokalne IP)';
  log(`▶ wpuszczam ${slotObj.nick} (#${slotObj.slot}) przez ${opisProxy} → ${konfig.mcHost}:${konfig.mcPort}`);

  const opcje = {
    host: konfig.mcHost,
    port: Number(konfig.mcPort) || 25565,
    username: slotObj.nick,
    version: konfig.mcWersja || false,
    auth: 'offline',
    hideErrors: true,
    checkTimeoutInterval: 60000,
    viewDistance: 1, // Minimalny zasięg 1 chunk (16 kratek) — serwer nie wysyła graczy/mobów z daleka!
    chat: 'commandsOnly', // Blokuje zwykłe wiadomości czatu graczy już po stronie serwera
    colorsEnabled: false,
    enableServerListing: false,
    particleStatus: 'minimal', // Wyłącza cząsteczki (particles)
    physicsEnabled: false, // Wyłączona fizyka chodzenia bez mapy — zero pakietów ruchu od bota
  };

  if (proxy) {
    opcje.connect = (client) => {
      polaczPrzezProxyUniwersalne(proxy, konfig.mcHost, Number(konfig.mcPort) || 25565, 15000)
        .then(socket => {
          client.setSocket(socket);
          client.emit('connect');
        })
        .catch(err => {
          rt.stan = 'błąd';
          rt.blad = 'Błąd proxy: ' + err.message;
          log(`✗ [${slotObj.nick}] Błąd proxy #${proxy.nr}: ${err.message}`);
          try { client.emit('error', err); } catch (e) {}
        });
    };
  }

  let bot;
  try {
    bot = mineflayer.createBot(opcje);
    bot._nieLadujSwiata = true; // Blokuje pobieranie kolejnych partii chunków (mapy świata) z serwera
    // Działa również na czystym npm install w chmurze (np. Render.com) — odpina ładowanie chunków:
    try {
      bot._client.removeAllListeners('chunk_batch_finished');
      bot._client.removeAllListeners('map_chunk');
      bot._client.removeAllListeners('update_light');
    } catch (e) {}
  } catch (err) {
    rt.stan = 'błąd';
    rt.blad = err.message;
    log(`✗ [${slotObj.nick}] Błąd tworzenia bota: ${err.message}`);
    return;
  }

  rt.bot = bot;

  bot.once('login', () => {
    rt.online = true;
    if (!rt.czasWejscia) rt.czasWejscia = Date.now();
    rt.stan = 'weryfikacja / lobby';
    rt.scianaMap = {};
    rt.maScianeMap = false;
    rt.ostatniSpawnEntity = null;
    log(`[${slotObj.nick}] 🔐 połączono z lobby/weryfikacją`);
  });

  // Automatyczna akceptacja Resource Packa serwerowego (wymagana m.in. przez rapy.gg,
  // aby przenieść bota z czarnej poczekalni Limbo na prawdziwe Lobby z widocznym światem 3D!)
  bot._client.on('add_resource_pack', (d) => {
    try {
      log(`📦 [${slotObj.nick}] Akceptuję paczkę zasobów serwera i przechodzę na Lobby...`);
      bot._client.write('resource_pack_receive', { uuid: d.uuid, result: 3 });
      setTimeout(() => {
        if (!rt.bot) return;
        try {
          bot._client.write('resource_pack_receive', { uuid: d.uuid, result: 4 });
          bot._client.write('resource_pack_receive', { uuid: d.uuid, result: 0 });
        } catch (e) {}
      }, 250);
    } catch (e) {}
  });

  // Przechwytywanie ściany 32 ramek map (8x4 = 1024x512) oraz pojedynczej mapy 128x128,
  // aby wyświetlić ją graczowi na żywo w oknie Podglądu Ekranu!
  bot._client.on('packet', (data, meta) => {
    if (meta.name === 'spawn_entity' && data) {
      rt.ostatniSpawnEntity = { x: data.x, y: data.y, z: data.z };
    } else if (meta.name === 'map' && data && data.columns === 128 && data.rows === 128 && data.data) {
      const buf = Buffer.isBuffer(data.data) ? data.data : Buffer.from(data.data);
      const b64 = buf.toString('base64');
      if (rt.ostatniSpawnEntity && typeof rt.ostatniSpawnEntity.x === 'number' && typeof rt.ostatniSpawnEntity.y === 'number') {
        const col = Math.max(0, Math.min(7, Math.round(3 - rt.ostatniSpawnEntity.x)));
        const row = Math.max(0, Math.min(3, Math.round(66 - rt.ostatniSpawnEntity.y)));
        if (!rt.scianaMap) rt.scianaMap = {};
        rt.scianaMap[`${col}_${row}`] = b64;
        rt.maScianeMap = true;
      } else {
        rt.mapa128 = Array.from(buf);
      }
    }
  });

  // Funkcja automatycznego wyboru trybu w Lobby:
  // 1) wybiera 5. slot na pasku (indeks 4 = slot 40 w ekwipunku)
  // 2) klika prawym przyciskiem myszy (bot.activateItem())
  // 3) w otwartym oknie "WYBÓR TRYBU" klika tryb po samej lewej stronie (slot #10 — Earth SMP)
  const sprobojWybracTrybWLobby = async () => {
    if (!rt.bot || !rt.online || bot._wybranoTryb || bot._trwaWyborTrybu) return;
    const itemSlot5 = bot.inventory && bot.inventory.slots ? bot.inventory.slots[40] : null;
    if (!itemSlot5) return; // Jeszcze w Limbo albo brak kompasu/papieru na 5. slocie

    bot._trwaWyborTrybu = true;
    try {
      bot.setQuickBarSlot(4); // 5. slot w eq (0..8 -> indeks 4)
      await new Promise(r => setTimeout(r, 450));
      if (!rt.bot || !rt.online) return;

      bot.activateItem(); // Prawy przycisk myszy
      // Czekamy chwilę aż otworzy się okno "WYBÓR TRYBU"
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 200));
        if (bot.currentWindow) break;
      }

      if (bot.currentWindow) {
        bot._wybranoTryb = true;
        rt.stan = 'wchodzi na tryb...';
        log(`🧭 [${slotObj.nick}] Wybrano 5. slot w eq → PPM → kliknięto tryb po lewej stronie (slot #10)`);
        await bot.clickWindow(10, 0, 0);
      }
    } catch (e) {
      // Ignorujemy ewentualny błąd pakietu podczas przełączania podserwera
    } finally {
      bot._trwaWyborTrybu = false;
    }
  };

  bot.on('spawn', () => {
    try {
      if (typeof bot.setSettings === 'function') {
        bot.setSettings({
          viewDistance: 1,
          chat: bot._wybranoTryb ? 'disabled' : 'commandsOnly',
          colorsEnabled: false,
          enableServerListing: false,
          particleStatus: 'minimal',
        });
      }
    } catch (e) {}
    const czyPierwszySpawn = !rt.online;
    rt.online = true;
    if (!rt.czasWejscia) rt.czasWejscia = Date.now();
    rt.stan = rt.skryptAktywny ? `skrypt: ${rt.aktywnySkryptNazwa}` : (bot._wybranoTryb ? 'na trybie' : 'na spawnie');
    // Po wejściu na prawdziwy świat (Lobby / Tryb) zdejmujemy ekran mapy z poczekalni
    rt.maScianeMap = false;
    rt.scianaMap = {};

    const p = bot.entity ? bot.entity.position : null;
    const koordy = p ? `${p.x.toFixed(1)}/${p.y.toFixed(0)}/${p.z.toFixed(1)}` : '';
    log(`[${slotObj.nick}] ✅ ${bot._wybranoTryb ? 'na trybie' : 'na spawnie'} ${koordy}`);

    // Jeśli podgląd 3D był otwarty dla tego bota jeszcze przed załadowaniem świata, uruchom kamerę 3D teraz
    if (aktywnyPodglad.slot === slotObj.slot && rt.bot && rt.bot.world && !rt.bot.viewer) {
      try {
        mineflayerViewer(rt.bot, { port: 3001, firstPerson: true, viewDistance: 6 });
        aktywnyPodglad.port = 3001;
      } catch (e) {}
    }

    // Automatyczne kliknięcie 5. slotu w eq -> PPM -> tryb po samej lewej (slot #10) po wejściu na Lobby
    if (!bot._wybranoTryb) {
      setTimeout(sprobojWybracTrybWLobby, 1500);
      setTimeout(sprobojWybracTrybWLobby, 3200);
    }

    if (czyPierwszySpawn && konfig.mcKomendaWejscia) {
      setTimeout(() => {
        if (rt.bot && rt.online) {
          log(`→ [${slotObj.nick}] auto-komenda: ${konfig.mcKomendaWejscia}`);
          rt.bot.chat(konfig.mcKomendaWejscia);
        }
      }, 3500);
    }
  });

  bot.on('messagestr', (msg) => {
    if (bot._wybranoTryb) return; // Po wejściu na tryb całkowicie ignorujemy wiadomości czatu
    const clean = msg.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const m = clean.toLowerCase();

    // Obsługa 4-etapowej inicjalizacji (faza 1/2/4) bez wypisywania czatu z gry w dzienniku
    if (m.includes('trwa inicjalizacja do serwera')) {
      if (bot._ostatniaFaza !== clean) {
        bot._ostatniaFaza = clean;
        // Na anarchia.gg właściwe logowanie przechodzi dopiero po osiągnięciu (faza 4)
        if (m.includes('faza 4') && bot._wymagaLoginu && konfig.mcHasloKont) {
          bot._wymagaLoginu = false;
          setTimeout(() => {
            if (rt.bot) rt.bot.chat(`/login ${konfig.mcHasloKont}`);
          }, 800);
        }
      }
      return;
    }

    // Automatyczne rejestrowanie i logowanie na serwerach Non-Premium
    // (Pomijamy auto-register jeśli serwer wymaga przepisania kodu z mapy/czatu, żeby gracz mógł sam wpisać komendę w panelu)
    const wymagaKodu = m.includes('kod_z_mapy') || m.includes('captcha') || m.includes('kod z mapy') || /<powt[óo]rz has[łl]o>\s+\S+/i.test(clean);
    if (!wymagaKodu && konfig.mcHasloKont && (m.includes('/register') || m.includes('zarejestruj'))) {
      if (!bot._ostatniReg || Date.now() - bot._ostatniReg > 8000) {
        bot._ostatniReg = Date.now();
        setTimeout(() => {
          if (rt.bot) rt.bot.chat(`/register ${konfig.mcHasloKont} ${konfig.mcHasloKont}`);
        }, 1200);
      }
    } else if (konfig.mcHasloKont && (m.includes('/login') || m.includes('zaloguj'))) {
      bot._wymagaLoginu = true;
      if (!bot._ostatniLog || Date.now() - bot._ostatniLog > 8000) {
        bot._ostatniLog = Date.now();
        setTimeout(() => {
          if (rt.bot) rt.bot.chat(`/login ${konfig.mcHasloKont}`);
        }, 1200);
      }
    }
  });

  bot.on('kicked', (reason) => {
    let tekst = '';
    try {
      if (typeof reason === 'string') {
        try {
          const parsed = JSON.parse(reason);
          tekst = wyciagnijTekstJson(parsed);
        } catch {
          tekst = reason;
        }
      } else {
        tekst = wyciagnijTekstJson(reason);
      }
    } catch {
      tekst = String(reason);
    }
    tekst = tekst.replace(/§[0-9a-fk-or]/gi, '').trim();
    rt.blad = tekst || 'Wyrzucony z serwera';
    log(`[${slotObj.nick}] KICK: ${rt.blad}`);
  });

  bot.on('error', (err) => {
    rt.blad = err.message || 'Błąd połączenia';
    log(`⚠️ [${slotObj.nick}] błąd: ${rt.blad}`);
  });

  bot.on('end', () => {
    if (rt.skryptAktywny) zatrzymajSkryptBota(slotObj.slot);
    const bylOnline = rt.online;
    rt.online = false;
    rt.bot = null;
    rt.czasWejscia = 0;
    rt.stan = 'rozłączony';
    if (bylOnline && slotObj.wlaczony) {
      log(`⚠️ [${slotObj.nick}] wypadł — wróci w kolejce`);
    }
  });
}

// Obsługa zarówno formatu JSON (MC <= 1.20.2) jak i NBT (MC 1.20.3+ / 1.21+)
function wyciagnijTekstJson(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

  // Format NBT z protokołu 1.21+ (np. { type: 'compound', value: { ... } })
  if (obj.type && obj.value !== undefined) {
    if (obj.type === 'string') return String(obj.value);
    if (obj.type === 'list' && obj.value && Array.isArray(obj.value.value)) {
      return obj.value.value.map(wyciagnijTekstJson).join('');
    }
    if (obj.type === 'compound' && obj.value && typeof obj.value === 'object') {
      return wyciagnijTekstJson(obj.value);
    }
  }

  let out = '';
  if (obj.text !== undefined) out += wyciagnijTekstJson(obj.text);
  if (obj[''] !== undefined) out += wyciagnijTekstJson(obj['']);
  if (obj.extra !== undefined) {
    if (Array.isArray(obj.extra)) out += obj.extra.map(wyciagnijTekstJson).join('');
    else out += wyciagnijTekstJson(obj.extra);
  }
  if (obj.translate && obj.with) {
    if (Array.isArray(obj.with)) out += obj.with.map(wyciagnijTekstJson).join(' ');
    else out += wyciagnijTekstJson(obj.with);
  }
  return out;
}

function rozlaczBota(slotNr, powod = 'ręczne rozłączenie') {
  const slotObj = konfig.sloty.find(s => s.slot === slotNr);
  if (slotObj) slotObj.wlaczony = false;
  const rt = pobierzRuntime(slotNr);
  if (rt.skryptAktywny) zatrzymajSkryptBota(slotNr);
  if (rt.bot) {
    try { rt.bot.quit(); } catch (e) {}
    rt.bot = null;
  }
  rt.online = false;
  rt.stan = 'rozłączony';
  rt.czasWejscia = 0;
  if (slotObj) log(`■ [${slotObj.nick}] rozłączono (${powod})`);
}

// ─── KOLEJKA WCHODZENIA BOTÓW ────────────────────────────────────────────────
let ostatnieWejscieMs = 0;

setInterval(() => {
  const teraz = Date.now();
  const odstep = Number(konfig.odstepKolejkiMs) || 15000;
  if (teraz - ostatnieWejscieMs < odstep) return;

  // Szukamy pierwszego włączonego slotu, który jest rozłączony
  const oczekujacy = konfig.sloty.find(s => {
    if (!s.wlaczony) return false;
    const rt = pobierzRuntime(s.slot);
    return !rt.online && rt.stan === 'rozłączony';
  });

  if (oczekujacy) {
    ostatnieWejscieMs = teraz;
    polaczBota(oczekujacy);
  }
}, 1000);

// ─── PARSER PROXY (SOCKS5 + HTTP CONNECT) ────────────────────────────────────
// Obsługuje formaty:
// 1) host:port@user@pass (np. Proxy-Seller eksport)
// 2) host:port:user:pass
// 3) user:pass@host:port
// 4) socks5://user:pass@host:port lub http://user:pass@host:port
// 5) host:port
function parsujLinieProxy(linia) {
  let s = linia.trim();
  if (!s) return null;
  s = s.replace(/^(socks5h?|https?):\/\//i, '');

  // Format: host:port@user@pass
  if (/^[^:@]+:\d+@[^@]+@[^@]+$/.test(s)) {
    const [adres, user, ...resztaHasla] = s.split('@');
    const [host, portStr] = adres.split(':');
    const port = parseInt(portStr, 10);
    if (!host || !port) return null;
    return { host, port, user: user || '', pass: resztaHasla.join('@') || '' };
  }

  // Format: user:pass@host:port lub host:port@user:pass
  if (s.includes('@')) {
    const [cz1, cz2] = s.split('@');
    if (/:\d+$/.test(cz1)) {
      const [host, portStr] = cz1.split(':');
      const [user, ...reszta] = (cz2 || '').split(':');
      const port = parseInt(portStr, 10);
      if (!host || !port) return null;
      return { host, port, user: user || '', pass: reszta.join(':') || '' };
    } else {
      const [host, portStr] = (cz2 || '').split(':');
      const [user, ...reszta] = (cz1 || '').split(':');
      const port = parseInt(portStr, 10);
      if (!host || !port) return null;
      return { host, port, user: user || '', pass: reszta.join(':') || '' };
    }
  }

  const czesci = s.split(':');
  if (czesci.length >= 4) {
    const [host, portStr, user, ...resztaHasla] = czesci;
    const port = parseInt(portStr, 10);
    if (!host || !port) return null;
    return { host, port, user, pass: resztaHasla.join(':') };
  }
  if (czesci.length === 2) {
    const [host, portStr] = czesci;
    const port = parseInt(portStr, 10);
    if (!host || !port) return null;
    return { host, port, user: '', pass: '' };
  }
  return null;
}

const net = require('net');
const dns = require('dns').promises;

// Automatyczne rozwiązywanie rekordu SRV (_minecraft._tcp.domena),
// aby proxy łączyło się z prawdziwym adresem serwera gry (np. proxy.rapy.gg zamiast Cloudflare rapy.gg)
const srvCache = new Map();
async function rozwiazAdresMinecraft(host, port) {
  const domyslnyPort = Number(port) || 25565;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || domyslnyPort !== 25565) {
    return { host, port: domyslnyPort };
  }
  const klucz = `${host}:${domyslnyPort}`;
  const zCache = srvCache.get(klucz);
  if (zCache && Date.now() - zCache.ts < 300000) {
    return { host: zCache.host, port: zCache.port };
  }
  try {
    const rekordy = await dns.resolveSrv(`_minecraft._tcp.${host}`);
    if (rekordy && rekordy.length > 0) {
      const docelowyHost = rekordy[0].name.replace(/\.$/, '');
      const docelowyPort = rekordy[0].port || domyslnyPort;
      srvCache.set(klucz, { host: docelowyHost, port: docelowyPort, ts: Date.now() });
      return { host: docelowyHost, port: docelowyPort };
    }
  } catch (e) {}
  srvCache.set(klucz, { host, port: domyslnyPort, ts: Date.now() });
  return { host, port: domyslnyPort };
}

// Uniwersalne tworzenie tunelu TCP przez Proxy (obsługuje HTTP CONNECT oraz SOCKS5)
function polaczPrzezProxyUniwersalne(proxy, celHost, celPort, timeoutMs = 10000) {
  const sprobujHttpConnect = (port, realHost, realPort) =>
    new Promise((resolve, reject) => {
      const socket = net.connect(port, proxy.host);
      let zakonczone = false;
      const timer = setTimeout(() => {
        if (!zakonczone) {
          zakonczone = true;
          socket.destroy();
          reject(new Error('Proxy timeout'));
        }
      }, timeoutMs);

      socket.once('error', (err) => {
        if (!zakonczone) {
          zakonczone = true;
          clearTimeout(timer);
          reject(err);
        }
      });

      socket.once('connect', () => {
        const auth = proxy.user
          ? 'Proxy-Authorization: Basic ' + Buffer.from(`${proxy.user}:${proxy.pass || ''}`).toString('base64') + '\r\n'
          : '';
        const req =
          `CONNECT ${realHost}:${realPort} HTTP/1.1\r\n` +
          `Host: ${realHost}:${realPort}\r\n` +
          auth +
          `Connection: keep-alive\r\n\r\n`;
        socket.write(req);

        let bufor = '';
        const onData = (chunk) => {
          bufor += chunk.toString('latin1');
          const koniecNaglowka = bufor.indexOf('\r\n\r\n');
          if (koniecNaglowka !== -1) {
            socket.removeListener('data', onData);
            clearTimeout(timer);
            const pierwszaLinia = bufor.split('\r\n')[0] || '';
            if (/^HTTP\/1\.[01]\s+200\b/i.test(pierwszaLinia)) {
              zakonczone = true;
              const nadmiar = Buffer.from(bufor.slice(koniecNaglowka + 4), 'latin1');
              if (nadmiar.length > 0) socket.unshift(nadmiar);
              resolve(socket);
            } else {
              zakonczone = true;
              socket.destroy();
              reject(new Error('Proxy status: ' + pierwszaLinia));
            }
          }
        };
        socket.on('data', onData);
      });
    });

  const sprobujSocks5 = (port, realHost, realPort) =>
    SocksClient.createConnection({
      proxy: {
        host: proxy.host,
        port,
        type: 5,
        userId: proxy.user || undefined,
        password: proxy.pass || undefined,
      },
      command: 'connect',
      destination: { host: realHost, port: realPort },
      timeout: timeoutMs,
    }).then(info => info.socket);

  return (async () => {
    const cel = await rozwiazAdresMinecraft(celHost, celPort);
    const bazowyPort = Number(proxy.port);
    // W Proxy-Seller port 50100 to HTTP, a 50101 to natywne SOCKS5 (najlepsze dla Minecraft TCP)
    const sockPort = bazowyPort === 50100 ? 50101 : bazowyPort;

    // Dla Proxy-Seller Residential (res.proxy-seller.com): równoległe szybkie zestawienie z węzłem mającym otwarty port 25565 (~260 ms)
    if (String(proxy.host).includes('res.proxy-seller.com') || (bazowyPort >= 10000 && bazowyPort < 11000)) {
      const uzywanePorty = new Set(konfig.proxyLista.map(p => Number(p.port)));
      for (let proba = 0; proba < 10; proba++) {
        const kandydaci = proba === 0 ? [sockPort] : [];
        while (kandydaci.length < 6) {
          const losowyPort = 10000 + Math.floor(Math.random() * 1000);
          if (!uzywanePorty.has(losowyPort) && !kandydaci.includes(losowyPort)) {
            kandydaci.push(losowyPort);
          }
        }
        let wygrany = false;
        try {
          const wynik = await Promise.any(
            kandydaci.map(async (pTest) => {
              const sock = await sprobujSocks5(pTest, cel.host, cel.port);
              if (wygrany) {
                sock.destroy();
                throw new Error('duplicate');
              }
              wygrany = true;
              return { port: pTest, sock };
            })
          );
          return wynik.sock;
        } catch {}
      }
    }

    try {
      return await sprobujSocks5(sockPort, cel.host, cel.port);
    } catch (e1) {
      return await sprobujHttpConnect(bazowyPort, cel.host, cel.port);
    }
  })();
}

// ─── AUTORYZACJA API ─────────────────────────────────────────────────────────
function autoryzacja(req, res, next) {
  const podane = req.headers['x-haslo'] || '';
  if (podane !== konfig.hasloPanelu) {
    return res.status(401).json({ blad: 'złe hasło' });
  }
  next();
}

const { mineflayer: mineflayerViewer } = require('prismarine-viewer');

let aktywnyPodglad = {
  slot: 0,
  nick: '',
  port: 3001,
  botRef: null,
};

async function zamknijPodglad3D() {
  if (aktywnyPodglad.botRef && aktywnyPodglad.botRef.viewer) {
    try { aktywnyPodglad.botRef.viewer.close(); } catch (e) {}
    delete aktywnyPodglad.botRef.viewer;
    await new Promise(r => setTimeout(r, 150));
  }
  aktywnyPodglad.slot = 0;
  aktywnyPodglad.nick = '';
  aktywnyPodglad.botRef = null;
}

// ─── ENDPOINTY REST API ──────────────────────────────────────────────────────
app.post('/api/podglad', autoryzacja, async (req, res) => {
  const slotNr = parseInt(req.query.slot, 10);
  const firstPerson = req.query.fp !== '0';
  const slotObj = konfig.sloty.find(s => s.slot === slotNr);
  if (!slotObj) return res.json({ ok: false, powod: 'Nie znaleziono slotu' });

  const rt = pobierzRuntime(slotNr);
  if (!rt.bot || !rt.online) {
    return res.json({ ok: false, powod: 'Ten bot nie jest jeszcze w grze (musi najpierw wejść na serwer)' });
  }

  try {
    await zamknijPodglad3D();
    const viewerPort = 3001;
    // Jeśli świat (bot.world) jest już załadowany, uruchamiamy pełną kamerę 3D WebGL
    if (rt.bot.entity && rt.bot.world) {
      mineflayerViewer(rt.bot, { port: viewerPort, firstPerson, viewDistance: 6 });
      aktywnyPodglad = { slot: slotNr, nick: slotObj.nick, port: viewerPort, botRef: rt.bot };
      log(`👁️ Uruchomiono podgląd 3D na żywo dla #${slotNr} (${slotObj.nick}) → http://localhost:${viewerPort}`);
    } else {
      aktywnyPodglad = { slot: slotNr, nick: slotObj.nick, port: 0, botRef: rt.bot };
      log(`👁️ Otwarto podgląd ekranu weryfikacji/mapy dla #${slotNr} (${slotObj.nick})`);
    }
    res.json({
      ok: true,
      url: (rt.bot.entity && rt.bot.world) ? `http://localhost:${viewerPort}` : '',
      slot: slotNr,
      nick: slotObj.nick,
      wiadomosc: `Otwarto podgląd dla ${slotObj.nick}`,
    });
  } catch (err) {
    log(`⚠️ Informacja podglądu 3D: ${err.message}`);
    res.json({
      ok: true,
      url: '',
      slot: slotNr,
      nick: slotObj.nick,
      wiadomosc: `Otwarto podgląd bota ${slotObj.nick}`,
    });
  }
});

// Odczyt ekwipunku, otwartego okna GUI (np. skrzynki/kompasu) oraz graczy w pobliżu
app.get('/api/bot-ekran', autoryzacja, (req, res) => {
  const slotNr = parseInt(req.query.slot, 10);
  const slotObj = konfig.sloty.find(s => s.slot === slotNr);
  if (!slotObj) return res.json({ ok: false, powod: 'Nie znaleziono slotu' });

  const rt = pobierzRuntime(slotNr);
  if (!rt.bot) {
    return res.json({ ok: false, online: false, powod: 'Bot jest rozłączony' });
  }
  const b = rt.bot;
  const pos = b.entity && b.entity.position ? {
    x: Number(b.entity.position.x.toFixed(1)),
    y: Number(b.entity.position.y.toFixed(1)),
    z: Number(b.entity.position.z.toFixed(1)),
  } : null;

  const ekwipunek = (b.inventory ? b.inventory.items() : []).map(it => ({
    slot: it.slot,
    name: it.name,
    displayName: it.displayName || it.name,
    count: it.count,
  }));

  let okno = null;
  if (b.currentWindow) {
    const w = b.currentWindow;
    let tytul = w.title || 'Otwarte Menu GUI';
    try {
      tytul = typeof w.title === 'string' ? wyciagnijTekstJson(JSON.parse(w.title)) || w.title : wyciagnijTekstJson(w.title);
    } catch {}
    const slotyOkna = (w.slots || []).map((it, idx) => it ? {
      slot: idx,
      name: it.name,
      displayName: it.displayName || it.name,
      count: it.count,
    } : null).filter(Boolean);
    okno = { title: tytul, totalSlots: (w.slots || []).length, items: slotyOkna };
  }

  res.json({
    ok: true,
    online: rt.online,
    slot: slotNr,
    nick: slotObj.nick,
    stan: rt.stan,
    health: b.health ?? 20,
    food: b.food ?? 20,
    pozycja: pos,
    ekwipunek,
    okno,
    mapa128: rt.mapa128 || null,
    maScianeMap: !!rt.maScianeMap,
    scianaMap: rt.maScianeMap ? rt.scianaMap : null,
    hasloKont: konfig.mcHasloKont || 'HasloBotow123!',
    podgladUrl: (aktywnyPodglad.slot === slotNr && aktywnyPodglad.port) ? `http://localhost:${aktywnyPodglad.port}` : null,
  });
});

// Kliknięcie w slot otwartego okna GUI lub użycie przedmiotu w łapce z poziomu podglądu
app.post('/api/bot-klik', autoryzacja, async (req, res) => {
  const slotNr = parseInt(req.query.slot, 10);
  const akcja = req.query.akcja; // 'window' | 'hotbar' | 'use' | 'move'
  const nr = parseInt(req.query.nr, 10) || 0;
  const kierunek = req.query.kierunek || 'forward';

  const rt = pobierzRuntime(slotNr);
  if (!rt.bot || !rt.online) return res.json({ ok: false, powod: 'Bot nie jest w grze' });
  const b = rt.bot;

  try {
    if (akcja === 'window' && b.currentWindow) {
      await b.clickWindow(nr, 0, 0);
      return res.json({ ok: true, wiadomosc: `Kliknięto slot #${nr} w oknie GUI` });
    } else if (akcja === 'hotbar') {
      b.setQuickBarSlot(Math.max(0, Math.min(8, nr)));
      b.activateItem();
      return res.json({ ok: true, wiadomosc: `Użyto przedmiotu z paska #${nr + 1}` });
    } else if (akcja === 'jump') {
      b.setControlState('jump', true);
      setTimeout(() => { try { b.setControlState('jump', false); } catch {} }, 400);
      return res.json({ ok: true, wiadomosc: 'Skok wykonany' });
    } else if (akcja === 'move') {
      b.setControlState(kierunek, true);
      setTimeout(() => { try { b.setControlState(kierunek, false); } catch {} }, 600);
      return res.json({ ok: true, wiadomosc: `Ruch: ${kierunek}` });
    }
    res.json({ ok: false, powod: 'Nieznana akcja lub brak otwartego okna' });
  } catch (e) {
    res.json({ ok: false, powod: e.message });
  }
});
app.get('/api/stan', autoryzacja, (req, res) => {
  const teraz = Date.now();
  const odstep = Number(konfig.odstepKolejkiMs) || 15000;

  const botyWidok = konfig.sloty.map(s => {
    const rt = pobierzRuntime(s.slot);
    const pr = wybierzProxyDlaSlotu(s);
    const p = rt.bot && rt.bot.entity ? rt.bot.entity.position : null;

    return {
      slot: s.slot,
      nick: s.nick,
      wlaczony: s.wlaczony,
      stan: rt.stan,
      online: rt.online,
      pozycja: p ? { x: p.x, y: p.y, z: p.z } : null,
      czas: rt.online && rt.czasWejscia ? teraz - rt.czasWejscia : 0,
      blad: rt.blad || '',
      proxy: pr ? `${pr.host}:${pr.port}` : 'bez proxy',
      proxyNr: pr ? pr.nr : 0,
      proxyReczne: !!s.proxyReczne,
      skryptAktywny: !!rt.skryptAktywny,
      skryptNazwa: rt.aktywnySkryptNazwa || s.skryptNazwa || 'dynie',
    };
  });

  const wlaczoneSloty = botyWidok.filter(b => b.wlaczony);
  const wGrze = botyWidok.filter(b => b.online).length;
  const wKolejce = botyWidok.filter(b => b.wlaczony && !b.online && b.stan === 'rozłączony').length;
  const nastepneZa = wKolejce > 0 ? Math.max(0, odstep - (teraz - ostatnieWejscieMs)) : 0;

  const proxyWidok = konfig.proxyLista.map(p => {
    const przypisane = botyWidok.filter(b => b.proxyNr === p.nr);
    return {
      nr: p.nr,
      nazwa: p.nazwa || `Proxy ${p.nr}`,
      host: p.host,
      port: p.port,
      user: p.user,
      kont: przypisane.length,
      wlaczone: przypisane.filter(b => b.wlaczony).length,
      wGrze: przypisane.filter(b => b.online).length,
      test: p.test || null,
    };
  });

  res.json({
    max: konfig.max,
    wszystkich: wlaczoneSloty.length,
    wGrze,
    wKolejce,
    nastepneZa,
    odstep,
    pulaNickow: wczytajPuleNickow().length,
    proxy: konfig.proxyLista.length,
    proxyLista: proxyWidok,
    boty: botyWidok,
    dziennik,
    admin: true,
    cofnij: konfig.ostatnieLosowanie ? { od: konfig.ostatnieLosowanie.od, do: konfig.ostatnieLosowanie.do } : null,
    serwer: {
      host: konfig.mcHost,
      port: konfig.mcPort,
      wersja: konfig.mcWersja,
      hasloKont: konfig.mcHasloKont,
      komendaWejscia: konfig.mcKomendaWejscia,
      odstepS: Math.round(odstep / 1000),
    },
  });
});

// Zmiana konfiguracji docelowego serwera Minecraft z poziomu panelu
app.post('/api/serwer-zapisz', autoryzacja, (req, res) => {
  try {
    const body = JSON.parse(req.body || '{}');
    if (body.host) konfig.mcHost = String(body.host).trim();
    if (body.port) konfig.mcPort = parseInt(body.port, 10) || 25565;
    if (body.wersja !== undefined) konfig.mcWersja = String(body.wersja).trim();
    if (body.hasloKont !== undefined) konfig.mcHasloKont = String(body.hasloKont);
    if (body.komendaWejscia !== undefined) konfig.mcKomendaWejscia = String(body.komendaWejscia).trim();
    if (body.odstepS !== undefined) {
      const s = Math.max(2, parseInt(body.odstepS, 10) || 15);
      konfig.odstepKolejkiMs = s * 1000;
    }
    zapiszDane();
    log(`⚙️ Zaktualizowano serwer docelowy: ${konfig.mcHost}:${konfig.mcPort} (wersja ${konfig.mcWersja || 'auto'})`);
    res.json({ ok: true, wiadomosc: `Zapisano serwer ${konfig.mcHost}:${konfig.mcPort}` });
  } catch (e) {
    res.json({ ok: false, powod: 'Nieprawidłowe dane formularza' });
  }
});

// Wpuszczanie bota (po numerze slotu, konkretnym nicku lub pierwszym wolnym slocie)
app.post('/api/wejdz', autoryzacja, (req, res) => {
  const param = (req.query.nick || '').trim();
  let slotObj = null;

  if (/^\d+$/.test(param)) {
    const nr = parseInt(param, 10);
    slotObj = konfig.sloty.find(s => s.slot === nr);
  } else if (param) {
    slotObj = konfig.sloty.find(s => s.nick.toLowerCase() === param.toLowerCase());
    if (!slotObj) {
      slotObj = konfig.sloty.find(s => !s.wlaczony);
      if (slotObj) slotObj.nick = param;
    }
  } else {
    slotObj = konfig.sloty.find(s => !s.wlaczony);
  }

  if (!slotObj) {
    return res.json({ ok: false, powod: 'Wszystkie sloty we flocie są już włączone' });
  }

  slotObj.wlaczony = true;
  zapiszDane();

  // Jeśli kolejka jest wolna i minął odstęp, wpuść od razu
  const teraz = Date.now();
  const odstep = Number(konfig.odstepKolejkiMs) || 15000;
  const rt = pobierzRuntime(slotObj.slot);
  if (teraz - ostatnieWejscieMs >= odstep && !rt.online && rt.stan === 'rozłączony') {
    ostatnieWejscieMs = teraz;
    polaczBota(slotObj);
    return res.json({ ok: true, wiadomosc: `Wpuszczam #${slotObj.slot} (${slotObj.nick})` });
  }

  log(`🕒 [${slotObj.nick}] (#${slotObj.slot}) dodany do kolejki wejść`);
  res.json({ ok: true, wiadomosc: `Dodano #${slotObj.slot} (${slotObj.nick}) do kolejki` });
});

// Wyłączanie pojedynczego bota
app.post('/api/wyjdz', autoryzacja, (req, res) => {
  const param = (req.query.nick || '').trim();
  const nr = parseInt(param, 10);
  const slotObj = konfig.sloty.find(s => s.slot === nr || s.nick === param);
  if (!slotObj) return res.json({ ok: false, powod: 'Nie znaleziono bota' });

  rozlaczBota(slotObj.slot, 'zatrzymany z panelu');
  zapiszDane();
  res.json({ ok: true, wiadomosc: `Rozłączono #${slotObj.slot} (${slotObj.nick})` });
});

// Wpuszczanie zakresu slotów od..do
app.post('/api/zakres', autoryzacja, (req, res) => {
  const od = Math.max(1, parseInt(req.query.od, 10) || 1);
  const doN = Math.min(konfig.max, parseInt(req.query.do, 10) || od);
  let ile = 0;
  for (let i = od; i <= doN; i++) {
    const s = konfig.sloty.find(x => x.slot === i);
    if (s && !s.wlaczony) {
      s.wlaczony = true;
      ile++;
    }
  }
  zapiszDane();
  log(`▶ Włączono zakres slotów #${od}–#${doN} (nowych w kolejce: ${ile})`);
  res.json({ ok: true, wiadomosc: `Włączono sloty #${od}–#${doN} (dodano ${ile})` });
});

// Rozłączenie wszystkich botów
app.post('/api/wyjdz-wszyscy', autoryzacja, (req, res) => {
  for (const s of konfig.sloty) {
    if (s.wlaczony) rozlaczBota(s.slot, 'rozłącz wszystkie');
  }
  zapiszDane();
  res.json({ ok: true, wiadomosc: 'Rozłączono wszystkie boty' });
});

// Wysłanie komendy / wiadomości z jednego bota
app.post('/api/komenda', autoryzacja, (req, res) => {
  const nick = (req.query.nick || '').trim();
  const tekst = (req.query.tekst || '').trim();
  if (!tekst) return res.json({ ok: false, powod: 'Pusta komenda' });

  const slotObj = konfig.sloty.find(s => s.nick === nick);
  if (!slotObj) return res.json({ ok: false, powod: 'Nie znaleziono bota' });
  const rt = pobierzRuntime(slotObj.slot);
  if (!rt.online || !rt.bot) return res.json({ ok: false, powod: 'Bot nie jest w grze' });

  rt.bot.chat(tekst);
  log(`→ [${slotObj.nick}] ${tekst}`);
  res.json({ ok: true, wiadomosc: `Wysłano do ${slotObj.nick}: ${tekst}` });
});

// Wysłanie komendy ze wszystkich botów online
app.post('/api/komenda-wszyscy', autoryzacja, (req, res) => {
  const tekst = (req.query.tekst || '').trim();
  if (!tekst) return res.json({ ok: false, powod: 'Pusta komenda' });

  let ile = 0;
  for (const s of konfig.sloty) {
    const rt = pobierzRuntime(s.slot);
    if (rt.online && rt.bot) {
      rt.bot.chat(tekst);
      ile++;
    }
  }
  log(`→ [WSZYSCY ${ile}] ${tekst}`);
  res.json({ ok: true, wiadomosc: `Wysłano komendę z ${ile} botów` });
});

// ─── ZARZĄDZANIE SKRYPTAMI Z PANELU (START / STOP / EDYCJA) ──────────────────
app.post('/api/skrypt-przelacz', autoryzacja, (req, res) => {
  const slotNr = parseInt(req.query.slot, 10);
  const skrypt = (req.query.skrypt || 'dynie').trim();
  const slotObj = konfig.sloty.find(s => s.slot === slotNr);
  if (!slotObj) return res.json({ ok: false, powod: 'Nie znaleziono slotu' });

  slotObj.skryptNazwa = skrypt;
  const rt = pobierzRuntime(slotNr);
  if (rt.skryptAktywny) {
    res.json(zatrzymajSkryptBota(slotNr));
  } else {
    res.json(uruchomSkryptBota(slotNr, skrypt));
  }
});

app.post('/api/skrypt-wszyscy', autoryzacja, (req, res) => {
  const akcja = req.query.akcja; // 'start' | 'stop'
  const skrypt = (req.query.skrypt || 'dynie').trim();
  let ile = 0;

  for (const s of konfig.sloty) {
    const rt = pobierzRuntime(s.slot);
    if (akcja === 'stop') {
      if (rt.skryptAktywny) {
        zatrzymajSkryptBota(s.slot);
        ile++;
      }
    } else if (rt.online && rt.bot) {
      s.skryptNazwa = skrypt;
      const w = uruchomSkryptBota(s.slot, skrypt);
      if (w.ok) ile++;
    }
  }
  zapiszDane();
  res.json({
    ok: true,
    wiadomosc: akcja === 'stop' ? `Zatrzymano skrypt na ${ile} botach` : `Uruchomiono skrypt "${skrypt}" na ${ile} botach w grze`,
  });
});

app.get('/api/skrypt-kod', autoryzacja, (req, res) => {
  const q = req.query.nazwa;
  const nazwa = q === 'wlasny' ? 'wlasny.js' : q === 'nagrody' ? 'nagrody.js' : 'dynie.js';
  const sciezka = path.join(__dirname, 'skrypty', nazwa);
  const kod = fs.existsSync(sciezka) ? fs.readFileSync(sciezka, 'utf8') : '';
  res.json({ ok: true, nazwa, kod });
});

app.post('/api/skrypt-zapisz', autoryzacja, (req, res) => {
  const q = req.query.nazwa;
  const nazwa = q === 'wlasny' ? 'wlasny.js' : q === 'nagrody' ? 'nagrody.js' : 'dynie.js';
  const sciezka = path.join(__dirname, 'skrypty', nazwa);
  fs.writeFileSync(sciezka, req.body || '', 'utf8');
  log(`💾 Zapisano zmodyfikowany plik skryptu: skrypty/${nazwa}`);
  res.json({ ok: true, wiadomosc: `Zapisano skrypty/${nazwa} — gotowy do uruchomienia!` });
});

// ─── PRZELOSOWANIE NICKÓW ────────────────────────────────────────────────────
app.post('/api/przelosuj', autoryzacja, (req, res) => {
  const od = Math.max(1, parseInt(req.query.od, 10) || 1);
  const doN = Math.min(konfig.max, parseInt(req.query.do, 10) || od);

  const kopia = [];
  for (let i = od; i <= doN; i++) {
    const s = konfig.sloty.find(x => x.slot === i);
    if (!s) continue;
    kopia.push({ slot: s.slot, staryNick: s.nick });
    if (s.wlaczony) rozlaczBota(s.slot, 'przelosowanie nicka');
    fs.appendFileSync(PLIK_STARE_NICKI, s.nick + '\n', 'utf8');
    s.nick = wezNickZPuli();
  }
  konfig.ostatnieLosowanie = { od, do: doN, lista: kopia };
  zapiszDane();
  log(`🎲 Przelosowano nicki w slotach #${od}–#${doN}`);
  res.json({ ok: true, wiadomosc: `Wymieniono nicki w slotach #${od}–#${doN}` });
});

app.post('/api/cofnij-losowanie', autoryzacja, (req, res) => {
  if (!konfig.ostatnieLosowanie) return res.json({ ok: false, powod: 'Brak losowania do cofnięcia' });
  const { od, do: doN, lista } = konfig.ostatnieLosowanie;
  for (const el of lista) {
    const s = konfig.sloty.find(x => x.slot === el.slot);
    if (s) {
      if (s.wlaczony) rozlaczBota(s.slot, 'cofnięcie losowania');
      s.nick = el.staryNick;
    }
  }
  konfig.ostatnieLosowanie = null;
  zapiszDane();
  log(`↩ Cofnięto losowanie nicków (#${od}–#${doN})`);
  res.json({ ok: true, wiadomosc: `Przywrócono poprzednie nicki (#${od}–#${doN})` });
});

// ─── ZARZĄDZANIE PROXY SOCKS5 ────────────────────────────────────────────────
app.post('/api/proxy-dodaj', autoryzacja, (req, res) => {
  const linie = (req.body || '').split(/\r?\n/);
  let dodano = 0;
  for (const l of linie) {
    const p = parsujLinieProxy(l);
    if (!p) continue;
    const nr = konfig.proxyLista.length ? Math.max(...konfig.proxyLista.map(x => x.nr)) + 1 : 1;
    konfig.proxyLista.push({
      nr,
      nazwa: `Proxy ${nr}`,
      host: p.host,
      port: p.port,
      user: p.user,
      pass: p.pass,
      test: null,
    });
    dodano++;
  }
  zapiszDane();
  if (!dodano) return res.json({ ok: false, powod: 'Nie rozpoznano formatu. Użyj host:port:user:hasło' });
  log(`🌐 Dodano ${dodano} nowych serwerów proxy SOCKS5`);
  res.json({ ok: true, wiadomosc: `Dodano ${dodano} proxy SOCKS5` });
});

app.post('/api/proxy-usun', autoryzacja, (req, res) => {
  const nr = parseInt(req.query.nr, 10);
  konfig.proxyLista = konfig.proxyLista.filter(p => p.nr !== nr);
  for (const s of konfig.sloty) {
    if (s.proxyNr === nr) {
      s.proxyReczne = false;
      s.proxyNr = 0;
    }
  }
  zapiszDane();
  log(`🗑 Usunięto Proxy #${nr}`);
  res.json({ ok: true, wiadomosc: `Usunięto Proxy ${nr}` });
});

// Testowanie połączenia przez proxy (SOCKS5 / HTTP CONNECT) do docelowego serwera Minecraft
app.post('/api/proxy-test', autoryzacja, async (req, res) => {
  const nr = parseInt(req.query.nr, 10);
  const p = konfig.proxyLista.find(x => x.nr === nr);
  if (!p) return res.json({ ok: false, powod: 'Nie znaleziono proxy' });

  const start = Date.now();
  try {
    const socket = await polaczPrzezProxyUniwersalne(p, konfig.mcHost, Number(konfig.mcPort) || 25565, 8000);
    const ms = Date.now() - start;
    socket.destroy();
    p.test = { ok: true, ms, powod: '' };
    zapiszDane();
    res.json({ ok: true, ms, wiadomosc: `Proxy ${nr} działa (${ms} ms)` });
  } catch (err) {
    p.test = { ok: false, ms: 0, powod: err.message || 'timeout' };
    zapiszDane();
    res.json({ ok: false, powod: `Proxy ${nr} błąd: ${p.test.powod}` });
  }
});

app.post('/api/konto-proxy', autoryzacja, (req, res) => {
  const od = Math.max(1, parseInt(req.query.od, 10) || 1);
  const doN = Math.min(konfig.max, parseInt(req.query.do, 10) || od);
  const nr = parseInt(req.query.nr, 10) || 0;

  for (let i = od; i <= doN; i++) {
    const s = konfig.sloty.find(x => x.slot === i);
    if (s) {
      s.proxyReczne = nr !== 0;
      s.proxyNr = nr;
    }
  }
  zapiszDane();
  const opis = nr === -1 ? `Ustawiono bez proxy (lokalne IP) dla #${od}–#${doN}` : nr > 0 ? `Przypisano #${od}–#${doN} do Proxy ${nr}` : `Ustawiono auto-proxy dla #${od}–#${doN}`;
  res.json({ ok: true, wiadomosc: opis });
});

app.post('/api/max', autoryzacja, (req, res) => {
  const n = Math.max(1, Math.min(200, parseInt(req.query.n, 10) || 100));
  konfig.max = n;
  dopasujSloty();
  res.json({ ok: true, wiadomosc: `Ustawiono limit floty na ${n} kont` });
});

app.post('/api/proxy-usun-bledne', autoryzacja, (req, res) => {
  const przed = konfig.proxyLista.length;
  const usunieteNr = new Set(
    konfig.proxyLista.filter(p => p.test && p.test.ok === false).map(p => p.nr)
  );
  if (!usunieteNr.size) {
    return res.json({ ok: false, powod: 'Brak przetestowanych niedziałających proxy do usunięcia' });
  }
  konfig.proxyLista = konfig.proxyLista.filter(p => !usunieteNr.has(p.nr));
  for (const s of konfig.sloty) {
    if (usunieteNr.has(s.proxyNr)) {
      s.proxyReczne = false;
      s.proxyNr = 0;
    }
  }
  zapiszDane();
  const ile = przed - konfig.proxyLista.length;
  log(`🗑 Usunięto ${ile} niedziałających proxy SOCKS5`);
  res.json({ ok: true, wiadomosc: `Usunięto ${ile} niedziałających proxy` });
});

app.post('/api/proxy-wyczysc', autoryzacja, (req, res) => {
  konfig.proxyLista = [];
  for (const s of konfig.sloty) {
    s.proxyReczne = false;
    s.proxyNr = 0;
  }
  zapiszDane();
  log('🗑 Wyczyszczono całą listę proxy SOCKS5');
  res.json({ ok: true, wiadomosc: 'Wyczyszczono listę proxy' });
});

// ─── SYSTEM AUTO-NAGRODY (100 BOTÓW PO KOLEI + HARMONOGRAM CO 5H 10MIN) ──────
const { znajdzSlotKluczaPoPrawej } = require('./skrypty/nagrody');

const stanCyklu = {
  aktywny: false,          // Czy harmonogram (cykl 5h 10m) jest włączony
  wTrakcie: false,         // Czy trwa aktualnie wpuszczanie botów 1..100
  wstrzymany: false,       // Czy kolejka jest na pauzie
  zatrzymajFlaga: false,   // Sygnał przerwania bieżącego cyklu
  nrCyklu: 0,
  aktualnySlot: 0,
  aktualnyNick: '',
  aktualnyKrok: 'Gotowy do startu',
  aktualnyBotRef: null,
  odebranoWTymCyklu: 0,
  bledyWTymCyklu: 0,
  lacznieOdebrano: 0,
  ostatniStartMs: 0,
  ostatniKoniecMs: 0,
  nastepnyCyklMs: 0,       // Timestamp kiedy ruszy następny cykl (po 5h 10min)
  statusy: new Map(),      // slot -> { stan, krok, ostatnioOdebrano, ileRazy, slotKlikniety, przedmiot, blad }
};

function pobierzStatusNagrody(slotNr) {
  if (!stanCyklu.statusy.has(slotNr)) {
    stanCyklu.statusy.set(slotNr, {
      stan: 'oczekuje', // 'oczekuje' | 'w grze' | 'odebrano' | 'błąd'
      krok: 'Czeka na swoją kolej',
      ostatnioOdebrano: 0,
      ileRazy: 0,
      slotKlikniety: null,
      przedmiot: '',
      blad: '',
    });
  }
  return stanCyklu.statusy.get(slotNr);
}

// Pojedyncze wejście bota: Proxy -> Login -> Wejście na tryb -> /darmowenagrody -> Klik w klucz po prawej -> Wyjście
function wykonajBotaNagrody(slotObj) {
  return new Promise((resolve) => {
    const ng = { ...DOMYSLNE_NAGRODY, ...(konfig.nagrody || {}) };
    const st = pobierzStatusNagrody(slotObj.slot);

    // Jeśli ten slot miał włączonego zwykłego bota, rozłącz go
    const rt = pobierzRuntime(slotObj.slot);
    if (rt.bot) {
      try { rt.bot.quit(); } catch (e) {}
      rt.bot = null;
      rt.online = false;
    }

    const proxy = wybierzProxyDlaSlotu(slotObj);
    if (ng.wymagajProxy && !proxy) {
      st.stan = 'błąd';
      st.blad = 'Brak przypisanego Proxy SOCKS5 (włączono wymóg proxy)';
      st.krok = 'Pominięto — brak proxy';
      stanCyklu.bledyWTymCyklu++;
      log(`✗ [${slotObj.nick}] (#${slotObj.slot}) Pominięto — brak proxy SOCKS5`);
      return resolve({ ok: false, powod: st.blad });
    }

    let zakonczone = false;
    let bot = null;
    let timerTimeout = null;
    let timerRetryKomendy = null;

    const aktualizujKrok = (krokTekst) => {
      st.krok = krokTekst;
      stanCyklu.aktualnyKrok = `[#${slotObj.slot} ${slotObj.nick}] ${krokTekst}`;
    };

    const zakoncz = (sukces, powodLubInfo = '') => {
      if (zakonczone) return;
      zakonczone = true;
      clearTimeout(timerTimeout);
      clearInterval(timerRetryKomendy);
      stanCyklu.aktualnyBotRef = null;

      if (bot) {
        try { bot.removeAllListeners(); } catch (e) {}
        try { bot.quit(); } catch (e) {}
        bot = null;
      }

      if (sukces) {
        st.stan = 'odebrano';
        st.krok = `Odebrano klucz i rozłączono ✅`;
        st.blad = '';
        st.ostatnioOdebrano = Date.now();
        st.ileRazy = (st.ileRazy || 0) + 1;
        stanCyklu.odebranoWTymCyklu++;
        stanCyklu.lacznieOdebrano++;
      } else {
        st.stan = 'błąd';
        st.blad = powodLubInfo || 'Nie udało się odebrać nagrody';
        st.krok = `Błąd: ${st.blad}`;
        stanCyklu.bledyWTymCyklu++;
      }

      resolve({ ok: sukces, powod: powodLubInfo });
    };

    const maxCzasMs = Math.max(15, Number(ng.timeoutBotaS) || 45) * 1000;
    timerTimeout = setTimeout(() => {
      log(`⏱ [${slotObj.nick}] (#${slotObj.slot}) Przekroczono czas (${ng.timeoutBotaS}s) — przechodzę do kolejnego bota`);
      zakoncz(false, `Timeout (${ng.timeoutBotaS}s)`);
    }, maxCzasMs);

    st.stan = 'w grze';
    st.blad = '';
    const opisProxy = proxy ? `Proxy #${proxy.nr} (${proxy.host}:${proxy.port})` : 'bez proxy (lokalne IP)';
    aktualizujKrok(`1/5 Łączenie przez ${opisProxy}...`);
    log(`🚀 [Cykl ${stanCyklu.nrCyklu || 1} · #${slotObj.slot}/${ng.liczbaBotow}] Wchodzi ${slotObj.nick} przez ${opisProxy}`);

    const opcje = {
      host: konfig.mcHost,
      port: Number(konfig.mcPort) || 25565,
      username: slotObj.nick,
      version: konfig.mcWersja || false,
      auth: 'offline',
      hideErrors: true,
      checkTimeoutInterval: 45000,
      viewDistance: 1,
      chat: 'commandsOnly',
      colorsEnabled: false,
      enableServerListing: false,
      particleStatus: 'minimal',
      physicsEnabled: false,
    };

    if (proxy) {
      opcje.connect = (client) => {
        polaczPrzezProxyUniwersalne(proxy, konfig.mcHost, Number(konfig.mcPort) || 25565, 12000)
          .then(socket => {
            if (zakonczone) {
              socket.destroy();
              return;
            }
            client.setSocket(socket);
            client.emit('connect');
          })
          .catch(err => {
            log(`✗ [${slotObj.nick}] Błąd Proxy #${proxy.nr}: ${err.message}`);
            zakoncz(false, `Błąd proxy #${proxy.nr}: ${err.message}`);
          });
      };
    }

    try {
      bot = mineflayer.createBot(opcje);
      bot._nieLadujSwiata = true; // Nie pobieraj kolejnych chunków mapy świata
      stanCyklu.aktualnyBotRef = bot;
    } catch (err) {
      return zakoncz(false, `Błąd startu bota: ${err.message}`);
    }

    let czyZalogowany = false;
    let czySekwencjaTrybuRusza = false;
    let czyWpisanoDarmoweNagrody = false;
    let czyKliknietoKlucz = false;

    const uruchomWejscieNaTrybINagrody = async () => {
      if (czySekwencjaTrybuRusza || zakonczone) return;
      czySekwencjaTrybuRusza = true;

      try {
        // Krok 2: Odczekaj chwilę po zalogowaniu
        const czekajPoLoginie = Math.max(1, Number(ng.opoznieniePoLoginieS) || 3) * 1000;
        aktualizujKrok(`2/5 Zalogowano — czekam ${ng.opoznieniePoLoginieS}s...`);
        await new Promise(r => setTimeout(r, czekajPoLoginie));
        if (zakonczone || !bot) return;

        // Krok 3: Wejście na tryb (komenda lub kliknięcie w kompas/GUI w lobby)
        const komendaTrybu = (ng.komendaTrybu || konfig.mcKomendaWejscia || '').trim();
        const lobbySlot = Number(ng.lobbyKlikSlot);

        if (lobbySlot >= 0) {
          aktualizujKrok(`3/5 Otwieram wybór trybu w lobby (slot #${lobbySlot})...`);
          log(`🧭 [${slotObj.nick}] Klikam kompas w lobby i wybieram slot #${lobbySlot}`);
          try {
            const hb = Math.max(0, Math.min(8, Number(ng.lobbyHotbarSlot) || 0));
            bot.setQuickBarSlot(hb);
            await new Promise(r => setTimeout(r, 400));
            bot.activateItem();
            await new Promise(r => setTimeout(r, 1200));
            if (bot.currentWindow) {
              await bot.clickWindow(lobbySlot, 0, 0);
            }
          } catch (e) {}
        }

        if (komendaTrybu) {
          aktualizujKrok(`3/5 Wchodzę na tryb (${komendaTrybu})...`);
          log(`→ [${slotObj.nick}] Wchodzę na tryb: ${komendaTrybu}`);
          bot.chat(komendaTrybu);
        } else if (lobbySlot < 0) {
          aktualizujKrok(`3/5 Na trybie — przygotowanie do /darmowenagrody...`);
        }

        const czekajNaTrybie = Math.max(1, Number(ng.opoznienieNaTrybieS) || 4) * 1000;
        await new Promise(r => setTimeout(r, czekajNaTrybie));
        if (zakonczone || !bot) return;

        // Krok 4: Wpisanie /darmowenagrody
        const komendaNagrody = (ng.komendaNagrody || '/darmowenagrody').trim();
        czyWpisanoDarmoweNagrody = true;
        aktualizujKrok(`4/5 Wpisuję ${komendaNagrody} — czekam na okno GUI...`);
        log(`💬 [${slotObj.nick}] Wpisuję na czacie: ${komendaNagrody}`);
        bot.chat(komendaNagrody);

        // Ponów komendę do 2 razy jeśli okno GUI jeszcze się nie otworzyło (np. opóźnienie przełączenia podserwera)
        let proby = 0;
        timerRetryKomendy = setInterval(() => {
          if (zakonczone || czyKliknietoKlucz || !bot) {
            clearInterval(timerRetryKomendy);
            return;
          }
          proby++;
          if (proby <= 2 && !bot.currentWindow) {
            log(`↻ [${slotObj.nick}] Ponawiam komendę: ${komendaNagrody} (próba ${proby + 1}/3)`);
            bot.chat(komendaNagrody);
          } else if (proby > 2) {
            clearInterval(timerRetryKomendy);
          }
        }, 4000);
      } catch (err) {
        if (!zakonczone) zakoncz(false, err.message);
      }
    };

    // Obsługa otwarcia okna GUI po wpisaniu /darmowenagrody
    bot.on('windowOpen', async (window) => {
      if (zakonczone || !czyWpisanoDarmoweNagrody || czyKliknietoKlucz) return;
      czyKliknietoKlucz = true;
      clearInterval(timerRetryKomendy);

      try {
        aktualizujKrok(`5/5 Otwarto GUI — szukam klucza po prawej stronie...`);
        // Czekamy chwilę aż serwer wypełni sloty przedmiotami
        await new Promise(r => setTimeout(r, 800));
        if (zakonczone || !bot) return;

        const recznySlot = Number.isInteger(Number(ng.slotKlucza)) ? Number(ng.slotKlucza) : 23;
        const celSlot = ng.trybSlotu === 'reczny'
          ? recznySlot
          : znajdzSlotKluczaPoPrawej(window, recznySlot);

        const itemObj = window.slots && window.slots[celSlot] ? window.slots[celSlot] : null;
        const nazwaItemu = itemObj ? (itemObj.displayName || itemObj.name) : 'klucz';
        st.slotKlikniety = celSlot;
        st.przedmiot = nazwaItemu;

        aktualizujKrok(`5/5 Klikam klucz po prawej (slot #${celSlot}: ${nazwaItemu})...`);
        log(`🔑 [${slotObj.nick}] Klikam klucz po prawej stronie w /darmowenagrody → slot #${celSlot} (${nazwaItemu})`);

        await bot.clickWindow(celSlot, 0, 0);

        // Odczekaj chwilę na przetworzenie kliknięcia przez serwer i wyjdź
        await new Promise(r => setTimeout(r, 1300));
        if (zakonczone) return;

        try { bot.closeWindow(window); } catch (e) {}
        await new Promise(r => setTimeout(r, 500));

        log(`✅ [${slotObj.nick}] (#${slotObj.slot}/${ng.liczbaBotow}) Odebrał klucz i wychodzi z serwera!`);
        zakoncz(true);
      } catch (err) {
        log(`⚠️ [${slotObj.nick}] Błąd podczas klikania klucza: ${err.message}`);
        zakoncz(false, `Błąd kliknięcia GUI: ${err.message}`);
      }
    });

    // Automatyczne logowanie / rejestracja na czacie
    bot.on('messagestr', (msg) => {
      if (zakonczone) return;
      const m = msg.toLowerCase();
      if (konfig.mcHasloKont && (m.includes('/register') || m.includes('zarejestruj'))) {
        if (!bot._ostatniReg || Date.now() - bot._ostatniReg > 3500) {
          bot._ostatniReg = Date.now();
          aktualizujKrok(`2/5 Rejestracja konta (/register)...`);
          setTimeout(() => {
            if (!zakonczone && bot) {
              log(`🔐 [${slotObj.nick}] Wysyłam /register`);
              bot.chat(`/register ${konfig.mcHasloKont} ${konfig.mcHasloKont}`);
              czyZalogowany = true;
              uruchomWejscieNaTrybINagrody();
            }
          }, 1000);
        }
      } else if (konfig.mcHasloKont && (m.includes('/login') || m.includes('zaloguj'))) {
        if (!bot._ostatniLog || Date.now() - bot._ostatniLog > 3500) {
          bot._ostatniLog = Date.now();
          aktualizujKrok(`2/5 Logowanie konta (/login)...`);
          setTimeout(() => {
            if (!zakonczone && bot) {
              log(`🔐 [${slotObj.nick}] Wysyłam /login`);
              bot.chat(`/login ${konfig.mcHasloKont}`);
              czyZalogowany = true;
              uruchomWejscieNaTrybINagrody();
            }
          }, 1000);
        }
      }
    });

    bot.once('spawn', () => {
      if (zakonczone) return;
      aktualizujKrok(`2/5 Połączono ze spawnem — weryfikacja logowania...`);
      // Jeśli w ciągu 3.5s serwer nie poprosił o /login ani /register, ruszamy dalej z wejściem na tryb
      setTimeout(() => {
        if (!zakonczone && !czyZalogowany) {
          czyZalogowany = true;
          uruchomWejscieNaTrybINagrody();
        }
      }, 3500);
    });

    bot.on('kicked', (reason) => {
      if (zakonczone) return;
      let tekst = '';
      try {
        tekst = typeof reason === 'string' ? wyciagnijTekstJson(JSON.parse(reason)) : wyciagnijTekstJson(reason);
      } catch {
        tekst = String(reason);
      }
      tekst = tekst.replace(/§[0-9a-fk-or]/gi, '').trim() || 'Wyrzucony z serwera';
      log(`✗ [${slotObj.nick}] KICK: ${tekst}`);
      zakoncz(false, `KICK: ${tekst}`);
    });

    bot.on('error', (err) => {
      if (zakonczone) return;
      log(`⚠️ [${slotObj.nick}] Błąd połączenia: ${err.message}`);
      zakoncz(false, err.message || 'Błąd połączenia');
    });

    bot.on('end', () => {
      if (!zakonczone) {
        zakoncz(false, 'Rozłączono przed odebraniem nagrody');
      }
    });
  });
}

// Główna pętla wykonująca 100 botów po kolei (jeden wchodzi -> odbiera -> wychodzi -> kolejny)
async function uruchomPelnyCyklNagrod() {
  if (stanCyklu.wTrakcie) return;

  const ng = { ...DOMYSLNE_NAGRODY, ...(konfig.nagrody || {}) };
  const ileBotow = Math.max(1, Math.min(200, Number(ng.liczbaBotow) || 100));
  if (konfig.max < ileBotow) {
    konfig.max = ileBotow;
    dopasujSloty();
  }

  stanCyklu.aktywny = true;
  stanCyklu.wTrakcie = true;
  stanCyklu.wstrzymany = false;
  stanCyklu.zatrzymajFlaga = false;
  stanCyklu.nrCyklu++;
  stanCyklu.odebranoWTymCyklu = 0;
  stanCyklu.bledyWTymCyklu = 0;
  stanCyklu.ostatniStartMs = Date.now();
  stanCyklu.nastepnyCyklMs = 0;

  // Reset statusów na nowy cykl
  for (let i = 1; i <= ileBotow; i++) {
    const st = pobierzStatusNagrody(i);
    st.stan = 'oczekuje';
    st.krok = 'W kolejce do wejścia';
    st.blad = '';
  }

  log(`🎁 ═══ START CYKLU #${stanCyklu.nrCyklu}: ${ileBotow} botów po kolei (/darmowenagrody) ═══`);

  for (let i = 1; i <= ileBotow; i++) {
    if (stanCyklu.zatrzymajFlaga) break;

    // Obsługa pauzy
    while (stanCyklu.wstrzymany && !stanCyklu.zatrzymajFlaga) {
      stanCyklu.aktualnyKrok = `⏸ Wstrzymano na bocie #${i}/${ileBotow}`;
      await new Promise(r => setTimeout(r, 800));
    }
    if (stanCyklu.zatrzymajFlaga) break;

    const slotObj = konfig.sloty.find(s => s.slot === i);
    if (!slotObj) continue;

    stanCyklu.aktualnySlot = slotObj.slot;
    stanCyklu.aktualnyNick = slotObj.nick;

    await wykonajBotaNagrody(slotObj);

    if (stanCyklu.zatrzymajFlaga) break;

    // Odstęp przed kolejnym botem
    if (i < ileBotow) {
      const odstepS = Math.max(1, Number((konfig.nagrody && konfig.nagrody.odstepMiedzyBotamiS) ?? 4));
      for (let s = odstepS; s > 0; s--) {
        if (stanCyklu.zatrzymajFlaga) break;
        stanCyklu.aktualnyKrok = `⏳ Odstęp ${s}s przed wejściem bota #${i + 1} (${konfig.sloty[i] ? konfig.sloty[i].nick : ''})...`;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  stanCyklu.wTrakcie = false;
  stanCyklu.aktualnySlot = 0;
  stanCyklu.aktualnyNick = '';
  stanCyklu.ostatniKoniecMs = Date.now();

  if (stanCyklu.zatrzymajFlaga) {
    stanCyklu.aktualnyKrok = '⏹ Cykl zatrzymany ręcznie';
    log(`⏹ Zatrzymano cykl #${stanCyklu.nrCyklu} (odebrano: ${stanCyklu.odebranoWTymCyklu}/${ileBotow})`);
    return;
  }

  const ngAktualne = { ...DOMYSLNE_NAGRODY, ...(konfig.nagrody || {}) };
  if (ngAktualne.autoPowtarzaj && stanCyklu.aktywny) {
    const h = Math.max(0, Number(ngAktualne.interwalGodziny) ?? 5);
    const m = Math.max(0, Number(ngAktualne.interwalMinuty) ?? 10);
    const interwalMs = Math.max(60000, (h * 3600 + m * 60) * 1000);
    stanCyklu.nastepnyCyklMs = Date.now() + interwalMs;
    stanCyklu.aktualnyKrok = `✅ Cykl #${stanCyklu.nrCyklu} ukończony (${stanCyklu.odebranoWTymCyklu}/${ileBotow}). Czekam ${h}h ${m}min na kolejny cykl.`;
    log(`🏁 Zakończono cykl #${stanCyklu.nrCyklu}! Odebrano nagrody: ${stanCyklu.odebranoWTymCyklu}/${ileBotow}. Następne wejście 100 botów za ${h}h ${m}min!`);
  } else {
    stanCyklu.aktywny = false;
    stanCyklu.aktualnyKrok = `✅ Zakończono cykl (${stanCyklu.odebranoWTymCyklu}/${ileBotow} odebranych)`;
    log(`🏁 Zakończono pojedynczy cykl #${stanCyklu.nrCyklu}! Odebrano: ${stanCyklu.odebranoWTymCyklu}/${ileBotow}`);
  }
}

// Zegar sprawdzający co sekundę czy minęło 5h i 10min od ostatniego cyklu
setInterval(() => {
  if (stanCyklu.aktywny && !stanCyklu.wTrakcie && stanCyklu.nastepnyCyklMs > 0) {
    if (Date.now() >= stanCyklu.nastepnyCyklMs) {
      stanCyklu.nastepnyCyklMs = 0;
      log('⏰ Minęło 5h 10min — automatycznie uruchamiam kolejny cykl 100 botów po darmowe nagrody!');
      uruchomPelnyCyklNagrod();
    }
  }
}, 1000);

// ─── ENDPOINTY REST API DLA STRONY PROXY & AUTO-NAGRODY ──────────────────────
app.get('/api/nagrody-stan', autoryzacja, (req, res) => {
  const teraz = Date.now();
  const ng = { ...DOMYSLNE_NAGRODY, ...(konfig.nagrody || {}) };
  const ileBotow = Math.max(1, Math.min(konfig.sloty.length, Number(ng.liczbaBotow) || 100));

  const botyNagrody = konfig.sloty.slice(0, ileBotow).map(s => {
    const st = pobierzStatusNagrody(s.slot);
    const pr = wybierzProxyDlaSlotu(s);
    return {
      slot: s.slot,
      nick: s.nick,
      stan: st.stan,
      krok: st.krok,
      ostatnioOdebrano: st.ostatnioOdebrano,
      ileRazy: st.ileRazy || 0,
      slotKlikniety: st.slotKlikniety,
      przedmiot: st.przedmiot || '',
      blad: st.blad || '',
      proxy: pr ? `${pr.host}:${pr.port}` : 'bez proxy (lokalne IP)',
      proxyNr: pr ? pr.nr : 0,
      proxyReczne: !!s.proxyReczne,
      proxyOk: pr && pr.test ? pr.test.ok : null,
    };
  });

  const proxyWidok = konfig.proxyLista.map(p => {
    const przypisane = botyNagrody.filter(b => b.proxyNr === p.nr);
    return {
      nr: p.nr,
      nazwa: p.nazwa || `Proxy ${p.nr}`,
      host: p.host,
      port: p.port,
      user: p.user,
      kont: przypisane.length,
      test: p.test || null,
    };
  });

  res.json({
    konfigNagrody: ng,
    serwer: {
      host: konfig.mcHost,
      port: konfig.mcPort,
      wersja: konfig.mcWersja,
      hasloKont: konfig.mcHasloKont,
      komendaWejscia: konfig.mcKomendaWejscia,
    },
    cykl: {
      aktywny: stanCyklu.aktywny,
      wTrakcie: stanCyklu.wTrakcie,
      wstrzymany: stanCyklu.wstrzymany,
      nrCyklu: stanCyklu.nrCyklu,
      aktualnySlot: stanCyklu.aktualnySlot,
      aktualnyNick: stanCyklu.aktualnyNick,
      aktualnyKrok: stanCyklu.aktualnyKrok,
      odebranoWTymCyklu: stanCyklu.odebranoWTymCyklu,
      bledyWTymCyklu: stanCyklu.bledyWTymCyklu,
      lacznieOdebrano: stanCyklu.lacznieOdebrano,
      ostatniStartMs: stanCyklu.ostatniStartMs,
      ostatniKoniecMs: stanCyklu.ostatniKoniecMs,
      nastepnyCyklMs: stanCyklu.nastepnyCyklMs,
      pozostaloDoCykluMs: stanCyklu.nastepnyCyklMs > teraz ? stanCyklu.nastepnyCyklMs - teraz : 0,
    },
    proxyLista: proxyWidok,
    pulaNickow: wczytajPuleNickow().length,
    boty: botyNagrody,
    dziennik,
  });
});

app.post('/api/nagrody-konfig', autoryzacja, (req, res) => {
  try {
    const b = JSON.parse(req.body || '{}');
    if (!konfig.nagrody) konfig.nagrody = { ...DOMYSLNE_NAGRODY };

    if (b.host !== undefined && String(b.host).trim()) konfig.mcHost = String(b.host).trim();
    if (b.port !== undefined) konfig.mcPort = parseInt(b.port, 10) || 25565;
    if (b.wersja !== undefined) konfig.mcWersja = String(b.wersja).trim();
    if (b.hasloKont !== undefined) konfig.mcHasloKont = String(b.hasloKont);

    if (b.liczbaBotow !== undefined) {
      const n = Math.max(1, Math.min(200, parseInt(b.liczbaBotow, 10) || 100));
      konfig.nagrody.liczbaBotow = n;
      if (konfig.max < n) {
        konfig.max = n;
        dopasujSloty();
      }
    }
    if (b.komendaTrybu !== undefined) {
      konfig.nagrody.komendaTrybu = String(b.komendaTrybu).trim();
      konfig.mcKomendaWejscia = konfig.nagrody.komendaTrybu;
    }
    if (b.lobbyKlikSlot !== undefined) {
      const ls = parseInt(b.lobbyKlikSlot, 10);
      konfig.nagrody.lobbyKlikSlot = Number.isNaN(ls) ? -1 : ls;
    }
    if (b.lobbyHotbarSlot !== undefined) {
      konfig.nagrody.lobbyHotbarSlot = Math.max(0, Math.min(8, parseInt(b.lobbyHotbarSlot, 10) || 0));
    }
    if (b.komendaNagrody !== undefined) {
      konfig.nagrody.komendaNagrody = String(b.komendaNagrody).trim() || '/darmowenagrody';
    }
    if (b.trybSlotu !== undefined) {
      konfig.nagrody.trybSlotu = b.trybSlotu === 'reczny' ? 'reczny' : 'auto';
    }
    if (b.slotKlucza !== undefined) {
      const sk = parseInt(b.slotKlucza, 10);
      konfig.nagrody.slotKlucza = Number.isNaN(sk) ? 23 : Math.max(0, Math.min(53, sk));
    }
    if (b.opoznieniePoLoginieS !== undefined) {
      konfig.nagrody.opoznieniePoLoginieS = Math.max(1, Math.min(30, parseInt(b.opoznieniePoLoginieS, 10) || 3));
    }
    if (b.opoznienieNaTrybieS !== undefined) {
      konfig.nagrody.opoznienieNaTrybieS = Math.max(1, Math.min(30, parseInt(b.opoznienieNaTrybieS, 10) || 4));
    }
    if (b.odstepMiedzyBotamiS !== undefined) {
      konfig.nagrody.odstepMiedzyBotamiS = Math.max(1, Math.min(120, parseInt(b.odstepMiedzyBotamiS, 10) || 4));
    }
    if (b.timeoutBotaS !== undefined) {
      konfig.nagrody.timeoutBotaS = Math.max(15, Math.min(180, parseInt(b.timeoutBotaS, 10) || 45));
    }
    if (b.interwalGodziny !== undefined) {
      konfig.nagrody.interwalGodziny = Math.max(0, Math.min(48, parseInt(b.interwalGodziny, 10)));
    }
    if (b.interwalMinuty !== undefined) {
      konfig.nagrody.interwalMinuty = Math.max(0, Math.min(59, parseInt(b.interwalMinuty, 10)));
    }
    if (b.autoPowtarzaj !== undefined) {
      konfig.nagrody.autoPowtarzaj = !!b.autoPowtarzaj;
    }
    if (b.wymagajProxy !== undefined) {
      konfig.nagrody.wymagajProxy = !!b.wymagajProxy;
    }

    zapiszDane();
    log(`⚙️ Zapisano ustawienia Auto-Nagrody (${konfig.nagrody.liczbaBotow} botów, cykl co ${konfig.nagrody.interwalGodziny}h ${konfig.nagrody.interwalMinuty}min)`);
    res.json({ ok: true, wiadomosc: 'Zapisano konfigurację Proxy i Auto-Nagród!' });
  } catch (e) {
    res.json({ ok: false, powod: 'Błąd zapisu konfiguracji: ' + e.message });
  }
});

app.post('/api/nagrody-start', autoryzacja, (req, res) => {
  if (stanCyklu.wTrakcie) {
    if (stanCyklu.wstrzymany) {
      stanCyklu.wstrzymany = false;
      log('▶ Wznowiono kolejkę odbierania nagród');
      return res.json({ ok: true, wiadomosc: 'Wznowiono cykl odbierania nagród' });
    }
    return res.json({ ok: false, powod: 'Cykl 100 botów już trwa!' });
  }
  uruchomPelnyCyklNagrod();
  res.json({ ok: true, wiadomosc: `Uruchomiono cykl ${konfig.nagrody.liczbaBotow} botów po kolei (+ powtarzanie co ${konfig.nagrody.interwalGodziny}h ${konfig.nagrody.interwalMinuty}m)` });
});

app.post('/api/nagrody-pauza', autoryzacja, (req, res) => {
  if (!stanCyklu.wTrakcie) {
    return res.json({ ok: false, powod: 'Cykl nie jest teraz w trakcie wykonywania' });
  }
  stanCyklu.wstrzymany = !stanCyklu.wstrzymany;
  log(stanCyklu.wstrzymany ? '⏸ Wstrzymano kolejkę Auto-Nagród' : '▶ Wznowiono kolejkę Auto-Nagród');
  res.json({
    ok: true,
    wiadomosc: stanCyklu.wstrzymany ? 'Wstrzymano kolejkę (pauza po bieżącym bocie)' : 'Wznowiono kolejkę botów',
  });
});

app.post('/api/nagrody-stop', autoryzacja, (req, res) => {
  stanCyklu.aktywny = false;
  stanCyklu.wstrzymany = false;
  stanCyklu.zatrzymajFlaga = true;
  stanCyklu.nastepnyCyklMs = 0;
  if (stanCyklu.aktualnyBotRef) {
    try { stanCyklu.aktualnyBotRef.quit(); } catch (e) {}
    stanCyklu.aktualnyBotRef = null;
  }
  stanCyklu.wTrakcie = false;
  stanCyklu.aktualnySlot = 0;
  stanCyklu.aktualnyNick = '';
  stanCyklu.aktualnyKrok = '⏹ Zatrzymany';
  log('⏹ Zatrzymano cykl i wyłączono harmonogram 5h 10min');
  res.json({ ok: true, wiadomosc: 'Zatrzymano cykl i harmonogram Auto-Nagród' });
});

app.post('/api/nagrody-test-jeden', autoryzacja, async (req, res) => {
  if (stanCyklu.wTrakcie) {
    return res.json({ ok: false, powod: 'Zatrzymaj najpierw główny cykl, aby przetestować pojedynczego bota' });
  }
  const nr = Math.max(1, parseInt(req.query.slot, 10) || 1);
  const slotObj = konfig.sloty.find(s => s.slot === nr);
  if (!slotObj) return res.json({ ok: false, powod: `Nie znaleziono slotu #${nr}` });

  stanCyklu.wTrakcie = true;
  stanCyklu.zatrzymajFlaga = false;
  stanCyklu.aktualnySlot = slotObj.slot;
  stanCyklu.aktualnyNick = slotObj.nick;

  res.json({ ok: true, wiadomosc: `Testuję bota #${slotObj.slot} (${slotObj.nick}) → /darmowenagrody...` });

  await wykonajBotaNagrody(slotObj);
  stanCyklu.wTrakcie = false;
  stanCyklu.aktualnySlot = 0;
  stanCyklu.aktualnyNick = '';
});

// Endpoint podtrzymujący darmowy serwer w chmurze (Render.com / UptimeRobot) 24/7
app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

// Serwowanie panelu WWW (Farma Dyń + Nowa strona Proxy & Auto-Nagrody)
app.get(['/proxy', '/nagrody', '/proxy.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'proxy.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// Automatyczne podtrzymywanie darmowego hostingu Render.com (co 10 minut)
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    fetch(`${process.env.RENDER_EXTERNAL_URL}/ping`).catch(() => {});
  }, 10 * 60 * 1000);
}

const os = require('os');
function pobierzLokalneIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

wczytajDane();
app.listen(PORT, '0.0.0.0', () => {
  const lanIp = pobierzLokalneIP();
  log(`🚀 Panel Floty uruchomiony na komputerze: http://localhost:${PORT}`);
  log(`📱 Link na telefon (w tej samej sieci Wi-Fi): http://${lanIp}:${PORT}`);
  log(`🎁 Strona Proxy & Auto-Nagrody na telefon: http://${lanIp}:${PORT}/proxy`);
  log(`🔑 Hasło logowania do panelu: ${konfig.hasloPanelu}`);
  log(`🎯 Aktualny serwer docelowy: ${konfig.mcHost}:${konfig.mcPort}`);
});
