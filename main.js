// ============================================================
// SUNNYSIDE WORLD - Main Entry Point
// Inicialización y pantalla de inicio
// ============================================================

import { GameEngine } from './engine/GameEngine.js';
import { ASSET_CATALOG } from './engine/AssetRegistry.js';
import { WorldBuilder } from './engine/WorldBuilder.js';

// Exponer catálogo globalmente para inspección
window.ASSETS = ASSET_CATALOG;

let game = null;
let builder = null;

// ── Start Screen Handler ────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', async () => {
  const name = document.getElementById('player-name').value.trim() || 'Hero';
  const type = document.getElementById('player-type').value;
  const hair = document.getElementById('player-hair').value;
  const worldType = document.getElementById('world-type').value;

  // Ocultar pantalla de inicio
  document.getElementById('start-screen').style.display = 'none';

  // Inicializar motor
  game = new GameEngine('game-canvas');

  // Crear mundo
  await game.createWorld(worldType, 64, 64);

  // Crear jugador
  await game.createPlayer(name, hair, type);

  // Poblar el mundo con objetos decorativos
  await populateDefaultWorld(game, worldType);

  // Conectar multiplayer
  game.connectMultiplayer();

  // Iniciar game loop
  game.start();

  // Exponer globalmente para uso conversacional
  window.game = game;
  builder = new WorldBuilder(game);
  window.builder = builder;

  console.log('🌻 Sunnyside World is running!');
  console.log('💡 Usa window.game para controlar el mundo desde la consola');
  console.log('🛠️ Usa window.builder para construir mundos conversacionalmente');
  console.log('📋 Usa window.builder.getCatalog() para ver todo lo disponible');
});

// ── Poblar mundo con contenido por defecto ──────────────────
async function populateDefaultWorld(game, worldType) {
  // Coordenadas en píxeles del mundo (tileSize=16 * tileScale=3 = 48px per tile)
  const T = 48; // tile pixel size

  // Animales en la zona central
  await game.addWorldObject('animal', 'chicken', 15 * T, 20 * T);
  await game.addWorldObject('animal', 'cow',     20 * T, 18 * T);
  await game.addWorldObject('animal', 'sheep',   22 * T, 22 * T);
  await game.addWorldObject('animal', 'duck',    18 * T, 25 * T);
  await game.addWorldObject('animal', 'pig',     14 * T, 23 * T);

  // Árboles repartidos
  await game.addWorldObject('plant', 'tree_01', 3 * T,  20 * T);
  await game.addWorldObject('plant', 'tree_02', 25 * T, 5 * T);
  await game.addWorldObject('plant', 'tree_01', 40 * T, 35 * T);
  await game.addWorldObject('plant', 'tree_02', 8 * T,  40 * T);
  await game.addWorldObject('plant', 'tree_01', 50 * T, 10 * T);
  await game.addWorldObject('plant', 'tree_02', 55 * T, 45 * T);
  await game.addWorldObject('plant', 'tree_01', 5 * T,  55 * T);

  // Hongos bajo los árboles
  await game.addWorldObject('plant', 'mushroom_blue_1', 4 * T, 22 * T);
  await game.addWorldObject('plant', 'mushroom_red',    26 * T, 7 * T);
  await game.addWorldObject('plant', 'mushroom_blue_2', 42 * T, 37 * T);

  // Fuego en la plaza central
  await game.addWorldObject('vfx', 'fire_01', 32 * T, 32 * T);
  await game.addWorldObject('vfx', 'fire_02', 31 * T + 20, 32 * T - 5);

  // Molino al norte
  await game.addWorldObject('decoration', 'windmill_full', 35 * T, 8 * T);

  // NPCs are now loaded from the server via world-state event
  // (server is authoritative for NPC positions and IDs)

  // Cultivos en la parcela norte
  if (worldType === 'village') {
    const crops = ['wheat', 'carrot', 'potato', 'pumpkin', 'sunflower', 'cabbage'];
    for (let i = 0; i < crops.length; i++) {
      for (let row = 0; row < 3; row++) {
        await game.addWorldObject('crop', crops[i], (6 + i * 2) * T, (6 + row * 2) * T, {
          growthStage: Math.floor(Math.random() * 6),
          growthInterval: 15000
        });
      }
    }
  }
}
