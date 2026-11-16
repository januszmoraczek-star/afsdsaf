/**
 * Skrypt: Darmowe Nagrody (/darmowenagrody)
 * Wpisuje na czacie /darmowenagrody, czeka na otwarcie GUI,
 * klika w klucz po prawej stronie (domyślnie auto / slot 23) i wychodzi z serwera.
 */

function znajdzSlotKluczaPoPrawej(window, domyslnySlot = 23) {
  if (!window || !Array.isArray(window.slots)) return domyslnySlot;
  const koniecKontenera = window.inventoryStart || Math.min(window.slots.length, 54);
  const kandydaci = [];

  for (let i = 0; i < koniecKontenera; i++) {
    const item = window.slots[i];
    if (!item || !item.name || item.name === 'air') continue;
    const n = item.name.toLowerCase();
    // Pomijamy szybki dekoracyjne w ramce GUI
    if (n.includes('glass_pane') || n.includes('stained_glass') || n === 'barrier') continue;
    kandydaci.push({ slot: i, col: i % 9, row: Math.floor(i / 9), item });
  }

  if (kandydaci.length > 0) {
    // Sortujemy malejąco po kolumnie (od prawej do lewej), aby wybrać klucz po prawej stronie
    kandydaci.sort((a, b) => b.col - a.col || a.row - b.row);
    return kandydaci[0].slot;
  }

  return domyslnySlot;
}

module.exports = {
  nazwa: 'nagrody',
  opis: 'Wpisuje /darmowenagrody, klika klucz po prawej stronie w GUI i wychodzi',
  znajdzSlotKluczaPoPrawej,

  start(bot, log, opcje = {}) {
    const komenda = opcje.komendaNagrody || '/darmowenagrody';
    const trybSlotu = opcje.trybSlotu || 'auto';
    const recznySlot = Number.isInteger(opcje.slotKlucza) ? opcje.slotKlucza : 23;
    const wyjdzPoOdebraniu = opcje.wyjdzPoOdebraniu !== false;
    const onSukces = typeof opcje.onSukces === 'function' ? opcje.onSukces : null;

    bot._skryptAktywny = true;
    let odebrano = false;

    const obsluzOkno = async (window) => {
      if (!bot._skryptAktywny || odebrano) return;
      try {
        // Czekamy chwilę aż serwer dośle wszystkie przedmioty w oknie
        await new Promise(r => setTimeout(r, 750));
        if (!bot._skryptAktywny || odebrano) return;

        const celSlot = trybSlotu === 'reczny'
          ? recznySlot
          : znajdzSlotKluczaPoPrawej(window, recznySlot);

        const itemWSlcie = window.slots && window.slots[celSlot] ? window.slots[celSlot].name : 'klucz';
        log(`🔑 [${bot.username}] Otwarto GUI — klikam klucz po prawej (slot #${celSlot}: ${itemWSlcie})`);

        odebrano = true;
        await bot.clickWindow(celSlot, 0, 0);

        await new Promise(r => setTimeout(r, 1200));
        try { bot.closeWindow(window); } catch (e) {}

        log(`🎁 [${bot.username}] Odebrano nagrodę z /darmowenagrody!`);
        if (onSukces) onSukces(celSlot, itemWSlcie);

        if (wyjdzPoOdebraniu) {
          await new Promise(r => setTimeout(r, 600));
          try { bot.quit(); } catch (e) {}
        }
      } catch (err) {
        log(`⚠️ [${bot.username}] Błąd klikania w GUI nagrody: ${err.message}`);
      }
    };

    bot._nagrodyWindowHandler = obsluzOkno;
    bot.on('windowOpen', obsluzOkno);

    log(`💬 [${bot.username}] Wysyłam komendę: ${komenda}`);
    bot.chat(komenda);
  },

  stop(bot, log) {
    bot._skryptAktywny = false;
    if (bot._nagrodyWindowHandler) {
      bot.removeListener('windowOpen', bot._nagrodyWindowHandler);
      bot._nagrodyWindowHandler = null;
    }
    log(`⏹ [${bot.username}] Zatrzymano skrypt: Darmowe Nagrody`);
  },
};
