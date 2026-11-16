/**
 * Skrypt: Własny skrypt użytkownika (wlasny.js)
 * Możesz tutaj wkleić dowolną własną logikę kopania / chodzenia / klikania
 * albo edytować kod bezpośrednio w panelu WWW w sekcji "Skrypty".
 */
module.exports = {
  nazwa: 'wlasny',
  opis: 'Własny skrypt (edytowalny w pliku skrypty/wlasny.js lub w panelu)',

  start(bot, log) {
    bot._skryptAktywny = true;
    log(`⚡ [${bot.username}] Uruchomiono Własny Skrypt`);

    // Przykładowa pętla: co 4 sekundy macha ręką i patrzy przed siebie (Anty-AFK / Kopanie przed sobą)
    bot._wlasnyInterval = setInterval(async () => {
      if (!bot._skryptAktywny || !bot.entity) return;
      try {
        const blokPrzed = bot.blockAtCursor(4);
        if (blokPrzed && blokPrzed.name === 'pumpkin') {
          await bot.dig(blokPrzed, true);
        } else {
          bot.swingArm('right');
        }
      } catch (e) {}
    }, 1500);
  },

  stop(bot, log) {
    bot._skryptAktywny = false;
    if (bot._wlasnyInterval) {
      clearInterval(bot._wlasnyInterval);
      bot._wlasnyInterval = null;
    }
    try {
      bot.stopDigging();
      bot.clearControlStates();
    } catch (e) {}
    log(`⏹ [${bot.username}] Zatrzymano Własny Skrypt`);
  },
};
