// ============================================================
// SUNNYSIDE WORLD - World Builder API
// Herramientas conversacionales para construir mundos
// Este archivo se ejecuta desde el chat de Copilot
// ============================================================

import { ASSET_CATALOG, HAIR_STYLES, HUMAN_ANIMATIONS, ANIMALS, PLANTS, CROPS, VFX, DECORATIONS } from './AssetRegistry.js';

/**
 * WorldBuilder: API de alto nivel para que el usuario
 * construya mundos hablando conmigo. Yo ejecuto estas funciones.
 */
export class WorldBuilder {
  constructor(gameEngine) {
    this.game = gameEngine;
  }

  // ═══════════════════════════════════════════════════════════
  // 🌍 MUNDOS
  // ═══════════════════════════════════════════════════════════

  /** Crear un nuevo mundo */
  async createWorld(type, width, height) {
    return await this.game.createWorld(type, width, height);
  }

  /** Pintar tiles en una zona */
  paintTiles(tileType, x1, y1, x2, y2) {
    if (!this.game.tileMap) return 'No hay mapa cargado';
    this.game.tileMap.fillRect('ground', x1, y1, x2, y2, tileType);
    return `Pintado ${tileType} de (${x1},${y1}) a (${x2},${y2})`;
  }

  /** Crear un camino entre dos puntos */
  createPath(x1, y1, x2, y2, width = 2) {
    if (!this.game.tileMap) return 'No hay mapa cargado';
    const dx = x2 - x1;
    const dy = y2 - y1;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x1 + (dx * i) / steps);
      const y = Math.round(y1 + (dy * i) / steps);
      for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
        this.game.tileMap.setTile('ground', x + w, y, 'dirt_path');
        this.game.tileMap.setTile('ground', x, y + w, 'dirt_path');
      }
    }
    return `Camino creado de (${x1},${y1}) a (${x2},${y2})`;
  }

  /** Crear un lago/estanque circular */
  createLake(centerX, centerY, radius) {
    if (!this.game.tileMap) return 'No hay mapa cargado';
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (x * x + y * y <= radius * radius) {
          this.game.tileMap.setTile('ground', centerX + x, centerY + y, 'water');
        }
      }
    }
    return `Lago creado en (${centerX},${centerY}) con radio ${radius}`;
  }

  /** Crear una valla alrededor de una zona */
  createFence(x1, y1, x2, y2) {
    if (!this.game.tileMap) return 'No hay mapa cargado';
    this.game.tileMap.strokeRect('ground', x1, y1, x2, y2, 'fence_h');
    return `Valla creada de (${x1},${y1}) a (${x2},${y2})`;
  }

  // ═══════════════════════════════════════════════════════════
  // 👤 PERSONAJES Y NPCs
  // ═══════════════════════════════════════════════════════════

  /** Crear el jugador principal */
  async createPlayer(name, hairStyle = 'shorthair', type = 'human') {
    return await this.game.createPlayer(name, hairStyle, type);
  }

  /** Añadir un NPC al mundo */
  async addNPC(name, type, config) {
    return await this.game.addNPC(name, type, config);
  }

  /** Añadir un aldeano humano que pasea */
  async addVillager(name, x, y, hairStyle) {
    return await this.game.addNPC(name, 'human', {
      hairStyle: hairStyle || HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)],
      x, y,
      behavior: 'wander',
      speed: 30
    });
  }

  /** Añadir un guardia que patrulla */
  async addGuard(name, waypoints) {
    return await this.game.addNPC(name, 'human', {
      hairStyle: 'shorthair',
      x: waypoints[0].x,
      y: waypoints[0].y,
      behavior: 'patrol',
      waypoints,
      speed: 40
    });
  }

  /** Añadir un enemigo goblin */
  async addGoblin(name, x, y) {
    return await this.game.addNPC(name || 'Goblin', 'goblin', {
      x, y, behavior: 'wander', speed: 35
    });
  }

  /** Añadir un skeleton */
  async addSkeleton(name, x, y) {
    return await this.game.addNPC(name || 'Skeleton', 'skeleton', {
      x, y, behavior: 'wander', speed: 25
    });
  }

  /** Poblar una zona con NPCs variados */
  async populateWithNPCs(count, area, types = ['human']) {
    const names = [
      'Ana', 'Luis', 'María', 'Pedro', 'Lucía', 'Carlos', 'Elena', 'Diego',
      'Sara', 'Marcos', 'Laura', 'Javier', 'Carmen', 'Pablo', 'Marta', 'Raúl'
    ];
    const results = [];
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const name = names[Math.floor(Math.random() * names.length)] + '_' + i;
      const x = (area?.x || 100) + Math.random() * (area?.width || 600);
      const y = (area?.y || 100) + Math.random() * (area?.height || 600);
      results.push(await this.game.addNPC(name, type, { x, y, behavior: 'wander' }));
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // 🐔 ANIMALES
  // ═══════════════════════════════════════════════════════════

  /** Añadir un animal */
  async addAnimal(type, x, y) {
    return await this.game.addWorldObject('animal', type, x, y);
  }

  /** Crear una granja con animales */
  async createFarm(x, y, animals = { chicken: 3, cow: 2, pig: 2, sheep: 3 }) {
    const results = [];
    for (const [type, count] of Object.entries(animals)) {
      for (let i = 0; i < count; i++) {
        const ax = x + Math.random() * 200;
        const ay = y + Math.random() * 200;
        results.push(await this.game.addWorldObject('animal', type, ax, ay, { wanderRadius: 80 }));
      }
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // 🌱 CULTIVOS Y PLANTAS
  // ═══════════════════════════════════════════════════════════

  /** Plantar un cultivo */
  async plantCrop(cropType, x, y) {
    return await this.game.addWorldObject('crop', cropType, x, y);
  }

  /** Crear un campo de cultivos */
  async createCropField(cropType, x, y, rows = 4, cols = 6) {
    const results = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        results.push(await this.game.addWorldObject('crop', cropType, x + c * 36, y + r * 36, {
          growthStage: Math.floor(Math.random() * 6)
        }));
      }
    }
    return results;
  }

  /** Plantar un bosque de árboles */
  async plantForest(x, y, width, height, density = 10) {
    const results = [];
    for (let i = 0; i < density; i++) {
      const tx = x + Math.random() * width;
      const ty = y + Math.random() * height;
      const treeType = Math.random() > 0.5 ? 'tree_01' : 'tree_02';
      results.push(await this.game.addWorldObject('plant', treeType, tx, ty));
    }
    // Añadir algunos hongos
    for (let i = 0; i < Math.floor(density / 3); i++) {
      const mx = x + Math.random() * width;
      const my = y + Math.random() * height;
      const mushroom = ['mushroom_blue_1', 'mushroom_blue_2', 'mushroom_red'][Math.floor(Math.random() * 3)];
      results.push(await this.game.addWorldObject('plant', mushroom, mx, my));
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // ✨ VFX Y DECORACIONES
  // ═══════════════════════════════════════════════════════════

  /** Añadir fuego */
  async addFire(x, y) {
    return await this.game.addWorldObject('vfx', 'fire_01', x, y);
  }

  /** Añadir molino */
  async addWindmill(x, y) {
    return await this.game.addWorldObject('decoration', 'windmill_full', x, y);
  }

  /** Añadir bote */
  async addBoat(x, y, onWater = true) {
    return await this.game.addWorldObject('decoration', onWater ? 'coracle' : 'coracle_land', x, y);
  }

  /** Añadir efecto de brillo */
  async addGlint(x, y) {
    return await this.game.addWorldObject('vfx', 'glint_01', x, y);
  }

  // ═══════════════════════════════════════════════════════════
  // 🏗️ ESCENAS COMPUESTAS
  // ═══════════════════════════════════════════════════════════

  /** Crear una aldea completa */
  async buildVillage() {
    await this.createWorld('village', 64, 64);

    // Granja
    await this.createFarm(150, 150);

    // Campo de trigo
    await this.createCropField('wheat', 200, 400, 3, 8);

    // Bosque al este
    await this.plantForest(700, 100, 400, 400, 15);

    // Molino
    await this.addWindmill(500, 300);

    // Fuego de campamento
    await this.addFire(400, 350);

    // NPCs
    await this.addVillager('Elena', 300, 300, 'longhair');
    await this.addVillager('Marco', 450, 350, 'shorthair');
    await this.addGuard('Guardia Rey', [
      { x: 200, y: 500 }, { x: 600, y: 500 }, { x: 600, y: 700 }, { x: 200, y: 700 }
    ]);
    await this.addGoblin('Gruk', 800, 200);

    return '🏘️ Aldea completa creada';
  }

  /** Crear un bosque encantado */
  async buildEnchantedForest() {
    await this.createWorld('forest', 80, 80);

    // Bosques densos
    await this.plantForest(50, 50, 300, 300, 20);
    await this.plantForest(500, 200, 400, 400, 25);
    await this.plantForest(100, 500, 350, 350, 18);

    // Fogatas
    await this.addFire(400, 400);
    await this.addFire(250, 600);

    // Brillos mágicos
    await this.addGlint(300, 300);
    await this.addGlint(600, 500);
    await this.addGlint(150, 250);

    // Criaturas
    await this.addGoblin('Grimbly', 700, 300);
    await this.addGoblin('Snark', 200, 700);
    await this.addSkeleton('Ancient', 500, 600);
    await this.addSkeleton('Hollow', 800, 800);

    // Un aldeano perdido
    await this.addVillager('Leñador', 400, 400, 'mophair');

    return '🌲 Bosque encantado creado';
  }

  /** Crear una isla tropical */
  async buildTropicalIsland() {
    await this.createWorld('island', 50, 50);

    // Palmeras (usamos tree_01/02)
    await this.plantForest(300, 200, 200, 200, 8);

    // Cultivos
    await this.createCropField('pumpkin', 350, 350, 2, 4);

    // Animales
    await this.addAnimal('chicken', 400, 300);
    await this.addAnimal('duck', 420, 280);

    // Bote en la costa
    await this.addBoat(180, 400, true);

    // NPC náufrago
    await this.addVillager('Náufrago', 350, 300, 'spikeyhair');

    // Fogata
    await this.addFire(370, 370);

    return '🏝️ Isla tropical creada';
  }

  // ═══════════════════════════════════════════════════════════
  // 📋 INFO Y CATÁLOGO
  // ═══════════════════════════════════════════════════════════

  /** Listar todo lo disponible */
  getCatalog() {
    return {
      mundos: ['village', 'forest', 'island', 'empty'],
      personajes: ['human', 'goblin', 'skeleton'],
      peinados: HAIR_STYLES,
      animaciones: Object.keys(HUMAN_ANIMATIONS),
      animales: Object.keys(ANIMALS),
      cultivos: Object.keys(CROPS),
      plantas: Object.keys(PLANTS),
      vfx: Object.keys(VFX),
      decoraciones: Object.keys(DECORATIONS),
      tiles: ['grass', 'grass_dark', 'dirt', 'dirt_path', 'sand', 'water', 'stone', 'stone_floor', 'wood_floor', 'fence_h', 'fence_v', 'wall', 'bridge_h', 'bridge_v'],
      escenas: ['buildVillage()', 'buildEnchantedForest()', 'buildTropicalIsland()']
    };
  }
}
