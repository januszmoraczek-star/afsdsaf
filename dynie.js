const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

/**
 * Skrypt: Farma Dyń (pumpkin)
 * Bot automatycznie szuka dyń w promieniu 32 kratek, zakłada siekierę,
 * podchodzi do dyni i ją wykopuje.
 */
module.exports = {
  nazwa: 'dynie',
  opis: 'Chodzi po farmie i niszczy dynie (pumpkin)',

  start(bot, log) {
    if (!bot.pathfinder) {
      bot.loadPlugin(pathfinder);
    }

    const mcData = require('minecraft-data')(bot.version);
    const ruch = new Movements(bot, mcData);
    ruch.canDig = false; // Nie niszcz bloków konstrukcyjnych podczas chodzenia
    ruch.allow1by1towers = false;
    bot.pathfinder.setMovements(ruch);

    bot._skryptAktywny = true;
    log(`🎃 [${bot.username}] Uruchomiono skrypt: Farma Dyń`);

    const petla = async () => {
      while (bot._skryptAktywny && bot.entity) {
        try {
          const idDyni = mcData.blocksByName.pumpkin ? mcData.blocksByName.pumpkin.id : null;
          if (!idDyni) {
            log(`⚠️ [${bot.username}] Brak definicji bloku pumpkin dla wersji ${bot.version}`);
            break;
          }

          // Szukamy najbliższej dyni w promieniu 32 kratek
          const dynia = bot.findBlock({
            matching: idDyni,
            maxDistance: 32,
          });

          if (!dynia) {
            // Brak dyń w pobliżu — czekamy 2 sekundy aż odrosną
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          // Wyposaż siekierę, jeśli jest w ekwipunku
          const siekiera = bot.inventory.items().find(item => item.name.includes('_axe'));
          if (siekiera && (!bot.heldItem || bot.heldItem.type !== siekiera.type)) {
            await bot.equip(siekiera, 'hand').catch(() => {});
          }

          // Podejdź na zasięg wzroku/kopania (ok. 3 kratki)
          const cel = new goals.GoalGetToBlock(dynia.position.x, dynia.position.y, dynia.position.z);
          await bot.pathfinder.goto(cel);

          if (!bot._skryptAktywny) break;

          // Upewnij się, że blok nadal tam jest i go wykop
          const aktualnyBlok = bot.blockAt(dynia.position);
          if (aktualnyBlok && aktualnyBlok.name === 'pumpkin') {
            await bot.lookAt(aktualnyBlok.position.offset(0.5, 0.5, 0.5), true);
            await bot.dig(aktualnyBlok, true);
          }
        } catch (err) {
          // Ignorujemy drobne błędy ścieżki (np. ktoś inny wykopał dynię)
          await new Promise(r => setTimeout(r, 600));
        }
      }
    };

    petla();
  },

  stop(bot, log) {
    bot._skryptAktywny = false;
    try {
      if (bot.pathfinder) bot.pathfinder.setGoal(null);
      bot.stopDigging();
      bot.clearControlStates();
    } catch (e) {}
    log(`⏹ [${bot.username}] Zatrzymano skrypt: Farma Dyń`);
  },
};
