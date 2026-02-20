// ============================================================
// SUNNYSIDE WORLD - Tilemap Engine
// Sistema de tiles para construir mundos
// ============================================================

import { SpriteSheet } from './SpriteSheet.js';
import { TILESETS } from './AssetRegistry.js';

// ── Definición de tiles ─────────────────────────────────────
// Renderizado por color con variación para look pixel-art
export const TILE_TYPES = {
  grass:          { color: '#5a8f3c', solid: false, name: 'Hierba',           variant: '#4e8234' },
  grass_dark:     { color: '#3d6b2e', solid: false, name: 'Hierba oscura',    variant: '#356125' },
  dirt:           { color: '#8b7355', solid: false, name: 'Tierra',           variant: '#7d664a' },
  dirt_path:      { color: '#a08c6a', solid: false, name: 'Camino de tierra', variant: '#96825f' },
  sand:           { color: '#d4c07a', solid: false, name: 'Arena',            variant: '#c9b56f' },
  water:          { color: '#3d7db5', solid: true,  name: 'Agua', swimable: true, variant: '#3572a5', animate: true },
  water_deep:     { color: '#2a5a8a', solid: true,  name: 'Agua profunda',    variant: '#1e4e7e' },
  stone:          { color: '#6b6b6b', solid: true,  name: 'Piedra',           variant: '#5e5e5e' },
  stone_floor:    { color: '#8a8a8a', solid: false, name: 'Suelo de piedra',  variant: '#7d7d7d' },
  wood_floor:     { color: '#9e7c52', solid: false, name: 'Suelo de madera',  variant: '#8f6e45' },
  grass_top:      { color: '#5a8f3c', solid: false, name: 'Borde hierba',     variant: '#4e8234' },
  grass_bottom:   { color: '#5a8f3c', solid: false, name: 'Borde hierba',     variant: '#4e8234' },
  grass_left:     { color: '#5a8f3c', solid: false, name: 'Borde hierba',     variant: '#4e8234' },
  grass_right:    { color: '#5a8f3c', solid: false, name: 'Borde hierba',     variant: '#4e8234' },
  fence_h:        { color: '#7a5c3a', solid: true,  name: 'Valla horizontal', variant: '#6d5030', draw: 'fence' },
  fence_v:        { color: '#7a5c3a', solid: true,  name: 'Valla vertical',   variant: '#6d5030', draw: 'fence' },
  wall:           { color: '#5a5a5a', solid: true,  name: 'Muro',             variant: '#4d4d4d', draw: 'wall' },
  bridge_h:       { color: '#a08050', solid: false, name: 'Puente horizontal', variant: '#8d7045', draw: 'bridge' },
  bridge_v:       { color: '#a08050', solid: false, name: 'Puente vertical',   variant: '#8d7045', draw: 'bridge' },
  house_wall:     { color: '#c4a882', solid: true,  name: 'Pared de casa',    variant: '#b89c76' },
  house_door:     { color: '#6b4226', solid: false, name: 'Puerta',           variant: '#5e3720', interactive: true },
  house_window:   { color: '#87ceeb', solid: true,  name: 'Ventana',          variant: '#7dc4e1' },
  roof:           { color: '#b85c38', solid: true,  name: 'Tejado',           variant: '#a5512f' },
};

export class TileMap {
  constructor(width, height, tileSize = 16) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    // Multiple layers: ground, decoration, collision
    this.layers = {
      ground: new Array(width * height).fill('grass'),
      decoration: new Array(width * height).fill(null),
      collision: new Array(width * height).fill(false),
      objects: [] // { type, x, y, data }
    };
    this.tilesetImage = null;
    this.tilesetCols = 0;
    this.loaded = false;
  }

  async loadTileset(tilesetKey = 'world_16px') {
    const tileset = TILESETS[tilesetKey];
    this.tileSize = tileset.tileSize;
    this.loaded = true;
    // Color-based rendering, no tileset image needed
    return Promise.resolve();
  }

  setTile(layer, x, y, tileType) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.layers[layer][y * this.width + x] = tileType;
    if (layer === 'ground' && TILE_TYPES[tileType]) {
      this.layers.collision[y * this.width + x] = TILE_TYPES[tileType].solid;
    }
  }

  getTile(layer, x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.layers[layer][y * this.width + x];
  }

  isSolid(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return true;
    return this.layers.collision[y * this.width + x];
  }

  // Rellenar una zona rectangular con un tipo de tile
  fillRect(layer, x1, y1, x2, y2, tileType) {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        this.setTile(layer, x, y, tileType);
      }
    }
  }

  // Dibujar un rectángulo de borde (ej: vallas)
  strokeRect(layer, x1, y1, x2, y2, tileType) {
    for (let x = x1; x <= x2; x++) {
      this.setTile(layer, x, y1, tileType);
      this.setTile(layer, x, y2, tileType);
    }
    for (let y = y1; y <= y2; y++) {
      this.setTile(layer, x1, y, tileType);
      this.setTile(layer, x2, y, tileType);
    }
  }

  addObject(type, x, y, data = {}) {
    this.layers.objects.push({ type, x, y, ...data });
  }

  removeObject(x, y) {
    this.layers.objects = this.layers.objects.filter(o => o.x !== x || o.y !== y);
  }

  drawTileColor(ctx, tileType, screenX, screenY, tileX, tileY, size) {
    const tile = TILE_TYPES[tileType];
    if (!tile) return;

    // Base color with simple hash variation for organic look
    const hash = ((tileX * 7 + tileY * 13) % 3);
    ctx.fillStyle = hash === 0 ? tile.color : tile.variant;
    ctx.fillRect(screenX, screenY, size + 0.5, size + 0.5);

    // Water animation shimmer
    if (tile.animate) {
      const t = Date.now() * 0.001;
      const shimmer = Math.sin(t * 2 + tileX * 0.5 + tileY * 0.3) * 0.08;
      ctx.fillStyle = `rgba(255,255,255,${0.05 + shimmer})`;
      ctx.fillRect(screenX, screenY, size + 0.5, size + 0.5);
    }

    // Special draws
    if (tile.draw === 'fence') {
      ctx.fillStyle = '#5a3f20';
      const m = size * 0.3;
      ctx.fillRect(screenX + m, screenY, size - m * 2, size);
      ctx.fillStyle = '#8a6840';
      ctx.fillRect(screenX + m + 1, screenY + size * 0.15, size - m * 2 - 2, size * 0.2);
      ctx.fillRect(screenX + m + 1, screenY + size * 0.6,  size - m * 2 - 2, size * 0.2);
    } else if (tile.draw === 'wall') {
      // Brick pattern
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.5;
      const brickH = size / 3;
      for (let r = 0; r < 3; r++) {
        const offset = r % 2 === 0 ? 0 : size / 2;
        ctx.strokeRect(screenX + offset, screenY + r * brickH, size, brickH);
      }
    } else if (tile.draw === 'bridge') {
      ctx.strokeStyle = '#6b4f30';
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX + 1, screenY + 1, size - 2, size - 2);
    }

    // Subtle grid lines for grass
    if (tileType === 'grass' || tileType === 'grass_dark') {
      // Small grass detail dots
      if (hash === 1) {
        ctx.fillStyle = tile.variant;
        ctx.fillRect(screenX + size * 0.3, screenY + size * 0.6, 2, 2);
        ctx.fillRect(screenX + size * 0.7, screenY + size * 0.3, 2, 2);
      }
    }
  }

  // Renderizar solo las tiles visibles en el viewport
  render(ctx, camera, scale = 2) {
    const renderSize = this.tileSize * scale;
    const startX = Math.max(0, Math.floor(camera.x / renderSize));
    const startY = Math.max(0, Math.floor(camera.y / renderSize));
    const endX = Math.min(this.width, startX + Math.ceil(camera.viewWidth / renderSize) + 2);
    const endY = Math.min(this.height, startY + Math.ceil(camera.viewHeight / renderSize) + 2);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const screenX = x * renderSize - camera.x;
        const screenY = y * renderSize - camera.y;

        // Ground layer
        const groundTile = this.layers.ground[y * this.width + x];
        if (groundTile) {
          this.drawTileColor(ctx, groundTile, screenX, screenY, x, y, renderSize);
        }

        // Decoration layer
        const decoTile = this.layers.decoration[y * this.width + x];
        if (decoTile) {
          this.drawTileColor(ctx, decoTile, screenX, screenY, x, y, renderSize);
        }
      }
    }
  }

  // Serializar para enviar por red
  serialize() {
    return {
      width: this.width,
      height: this.height,
      tileSize: this.tileSize,
      layers: {
        ground: this.layers.ground,
        decoration: this.layers.decoration,
        objects: this.layers.objects
      }
    };
  }

  // Cargar desde datos serializados
  static deserialize(data) {
    const map = new TileMap(data.width, data.height, data.tileSize);
    map.layers.ground = data.layers.ground;
    map.layers.decoration = data.layers.decoration;
    map.layers.objects = data.layers.objects || [];
    // Recalcular colisiones
    for (let i = 0; i < map.width * map.height; i++) {
      const t = TILE_TYPES[map.layers.ground[i]];
      map.layers.collision[i] = t ? t.solid : false;
    }
    return map;
  }
}

// ── World Generator: genera mapas procedurales ──────────────
export class WorldGenerator {
  static generateVillage(width = 64, height = 64) {
    const map = new TileMap(width, height);

    // Rellenar con hierba con variación
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Variación natural de hierba
        const noise = Math.sin(x * 0.3) * Math.cos(y * 0.4) + Math.random() * 0.3;
        map.setTile('ground', x, y, noise > 0.5 ? 'grass_dark' : 'grass');
      }
    }

    // Caminos principales en cruz (más anchos)
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    map.fillRect('ground', centerX - 1, 2, centerX + 1, height - 3, 'dirt_path');
    map.fillRect('ground', 2, centerY - 1, width - 3, centerY + 1, 'dirt_path');

    // Plaza central
    map.fillRect('ground', centerX - 3, centerY - 3, centerX + 3, centerY + 3, 'dirt_path');
    map.fillRect('ground', centerX - 2, centerY - 2, centerX + 2, centerY + 2, 'stone_floor');

    // Lago ovalado al noreste
    const lakeX = Math.floor(width * 0.75);
    const lakeY = Math.floor(height * 0.25);
    for (let y = -4; y <= 4; y++) {
      for (let x = -5; x <= 5; x++) {
        const dx = x / 5;
        const dy = y / 4;
        if (dx * dx + dy * dy <= 1) {
          map.setTile('ground', lakeX + x, lakeY + y, 'water');
          // Arena alrededor
          if (dx * dx + dy * dy > 0.7) {
            map.setTile('ground', lakeX + x, lakeY + y, 'sand');
          }
        }
      }
    }
    // Agua interior
    for (let y = -3; y <= 3; y++) {
      for (let x = -4; x <= 4; x++) {
        const dx = x / 4;
        const dy = y / 3;
        if (dx * dx + dy * dy <= 0.8) {
          map.setTile('ground', lakeX + x, lakeY + y, 'water');
        }
      }
    }

    // Parcelas de cultivo (tierra labrada)
    map.fillRect('ground', 5, 5, 18, 14, 'dirt');
    map.strokeRect('ground', 4, 4, 19, 15, 'fence_h');

    // Parcela sur
    map.fillRect('ground', 5, height - 18, 18, height - 8, 'dirt');
    map.strokeRect('ground', 4, height - 19, 19, height - 7, 'fence_h');

    // Zona de piedra (cantera)
    map.fillRect('ground', width - 16, height - 16, width - 5, height - 7, 'stone_floor');
    map.strokeRect('ground', width - 17, height - 17, width - 4, height - 6, 'stone');

    // Camino secundario al lago
    for (let x = centerX + 3; x < lakeX - 5; x++) {
      map.setTile('ground', x, lakeY, 'dirt_path');
      map.setTile('ground', x, lakeY + 1, 'dirt_path');
    }

    return map;
  }

  static generateForest(width = 80, height = 80) {
    const map = new TileMap(width, height);
    map.fillRect('ground', 0, 0, width - 1, height - 1, 'grass_dark');

    // Caminos serpenteantes
    let pathY = Math.floor(height / 2);
    for (let x = 0; x < width; x++) {
      pathY += Math.floor(Math.random() * 3) - 1;
      pathY = Math.max(2, Math.min(height - 3, pathY));
      map.fillRect('ground', x, pathY - 1, x, pathY + 1, 'dirt_path');
    }

    // Ríos
    let riverX = Math.floor(width * 0.3);
    for (let y = 0; y < height; y++) {
      riverX += Math.floor(Math.random() * 3) - 1;
      riverX = Math.max(2, Math.min(width - 3, riverX));
      map.fillRect('ground', riverX - 1, y, riverX + 1, y, 'water');
    }

    // Puente sobre el río
    const bridgeY = Math.floor(height / 2);
    map.fillRect('ground', riverX - 2, bridgeY - 1, riverX + 2, bridgeY + 1, 'bridge_h');

    return map;
  }

  static generateIsland(width = 50, height = 50) {
    const map = new TileMap(width, height);
    map.fillRect('ground', 0, 0, width - 1, height - 1, 'water');

    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const rx = Math.floor(width * 0.35);
    const ry = Math.floor(height * 0.35);

    // Isla elíptica
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const dist = dx * dx + dy * dy;
        if (dist < 0.6) {
          map.setTile('ground', x, y, 'grass');
        } else if (dist < 0.8) {
          map.setTile('ground', x, y, 'sand');
        }
      }
    }

    return map;
  }

  static generateEmpty(width = 40, height = 40, baseTile = 'grass') {
    const map = new TileMap(width, height);
    map.fillRect('ground', 0, 0, width - 1, height - 1, baseTile);
    return map;
  }
}
