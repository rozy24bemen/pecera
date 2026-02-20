// ============================================================
// SUNNYSIDE WORLD - World Objects
// Animales, plantas, cultivos, VFX y decoraciones del mundo
// ============================================================

import { loadSprite, AnimatedSprite } from './SpriteSheet.js';
import { ANIMALS, PLANTS, VFX, DECORATIONS, CROPS, getCropStagePath } from './AssetRegistry.js';

export class WorldObject {
  constructor(id, type, objectKey, x, y, config = {}) {
    this.id = id;
    this.type = type;       // 'animal', 'plant', 'vfx', 'decoration', 'crop'
    this.objectKey = objectKey; // key en el registro (ej: 'chicken', 'tree_01')
    this.x = x;
    this.y = y;
    // Scale: most sprites are already good at 1x, tiny ones (fire=5px) need scaling
    this.scale = config.scale || 1;
    this.sprite = null;
    this.loaded = false;

    // Para cultivos
    this.growthStage = config.growthStage || 0;
    this.maxGrowthStage = 5;
    this.growthTimer = 0;
    this.growthInterval = config.growthInterval || 30000; // ms entre etapas

    // Para animales con movimiento
    this.wanderRadius = config.wanderRadius || 50;
    this.originX = x;
    this.originY = y;
    this.targetX = x;
    this.targetY = y;
    this.speed = config.speed || 20;
    this.direction = 'right';
    this.moveTimer = 0;

    // Interactividad
    this.interactive = config.interactive || false;
    this.onInteract = config.onInteract || null;
  }

  async load() {
    const registry = this.getRegistry();
    if (!registry) return;

    const entry = registry[this.objectKey];
    if (!entry) return;

    if (this.type === 'crop') {
      // Para cultivos, cargar la etapa actual
      await this.loadCropStage();
    } else {
      const sheet = await loadSprite(entry.path, entry.frames);
      this.sprite = new AnimatedSprite(sheet, entry.speed);
      // Auto-scale sprites to match world proportions (tiles=48px, chars at 2x)
      if (this.scale === 1) {
        if (sheet.frameWidth <= 10) {
          this.scale = 6; // fire (5px) → 30px
        } else if (sheet.frameWidth <= 20) {
          this.scale = 4; // small vfx → ~80px
        } else if (sheet.frameWidth <= 36) {
          this.scale = 3; // animals/small plants (32px) → 96px
        } else if (sheet.frameWidth <= 64) {
          this.scale = 2; // medium objects
        }
        // large objects (windmill 112px) stay at 1
      }
    }
    this.loaded = true;
  }

  async loadCropStage() {
    const path = getCropStagePath(this.objectKey, this.growthStage);
    if (!path) return;
    const sheet = await loadSprite(path, 1);
    this.sprite = new AnimatedSprite(sheet, 0, false);
  }

  getRegistry() {
    switch (this.type) {
      case 'animal': return ANIMALS;
      case 'plant': return PLANTS;
      case 'vfx': return VFX;
      case 'decoration': return DECORATIONS;
      case 'crop': return CROPS;
      default: return null;
    }
  }

  update(deltaTime) {
    // Actualizar animación
    if (this.sprite) {
      this.sprite.update(deltaTime);
    }

    // Movimiento de animales
    if (this.type === 'animal') {
      this.updateAnimalMovement(deltaTime);
    }

    // Crecimiento de cultivos
    if (this.type === 'crop' && this.growthStage < this.maxGrowthStage) {
      this.growthTimer += deltaTime;
      if (this.growthTimer >= this.growthInterval) {
        this.growthTimer = 0;
        this.growthStage++;
        this.loadCropStage();
      }
    }
  }

  updateAnimalMovement(deltaTime) {
    this.moveTimer -= deltaTime;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      this.x += (dx / dist) * this.speed * (deltaTime / 1000);
      this.y += (dy / dist) * this.speed * (deltaTime / 1000);
      this.direction = dx < 0 ? 'left' : 'right';
    } else if (this.moveTimer <= 0) {
      // Nuevo destino aleatorio dentro del radio
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * this.wanderRadius;
      this.targetX = this.originX + Math.cos(angle) * r;
      this.targetY = this.originY + Math.sin(angle) * r;
      this.moveTimer = 3000 + Math.random() * 5000;
    }
  }

  draw(ctx, camera) {
    if (!this.loaded || !this.sprite) return;
    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;
    this.sprite.draw(ctx, screenX, screenY, this.scale, this.direction === 'left');
  }

  serialize() {
    return {
      id: this.id,
      type: this.type,
      objectKey: this.objectKey,
      x: this.x,
      y: this.y,
      growthStage: this.growthStage,
      direction: this.direction
    };
  }
}
