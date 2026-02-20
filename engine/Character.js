// ============================================================
// SUNNYSIDE WORLD - Character System
// Sistema de personajes: humanos, goblins, skeletons
// ============================================================

import { loadSprite, AnimatedSprite } from './SpriteSheet.js';
import {
  HUMAN_ANIMATIONS, GOBLIN_ANIMATIONS, SKELETON_ANIMATIONS,
  HAIR_STYLES, getHumanSpritePath, getGoblinSpritePath, getSkeletonSpritePath
} from './AssetRegistry.js';

export class Character {
  constructor(id, type = 'human', config = {}) {
    this.id = id;
    this.type = type; // 'human', 'goblin', 'skeleton'
    this.name = config.name || 'Adventurer';
    this.hairStyle = config.hairStyle || 'base';

    // Posición y movimiento (en píxeles del mundo)
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = config.speed || 80; // píxeles por segundo
    this.direction = 'right'; // 'left' o 'right'

    // Estado
    this.currentAnimation = 'idle';
    this.previousAnimation = 'idle';
    this.isMoving = false;
    this.isAlive = true;
    this.health = config.health || 100;
    this.maxHealth = config.maxHealth || 100;

    // Sprites cargados
    this.animations = {};
    this.currentSprite = null;
    this.loaded = false;

    // Para IA NPCs
    this.isNPC = config.isNPC || false;
    this.behavior = config.behavior || null;
    this.dialogue = config.dialogue || [];
    this.waypoints = config.waypoints || [];
    this.waypointIndex = 0;
    this.thinkTimer = 0;

    // Expresión actual (para bocadillos)
    this.expression = null;
    this.expressionTimer = 0;

    // Speech bubble
    this.speechBubbleText = null;
    this.speechBubbleTimer = 0;
    this.speechBubbleDuration = 0;
    this.speechBubbleColor = '#fff';

    // Escala de renderizado (sprite frame is 96x64 but drawn char is ~20x30px inside)
    this.scale = config.scale || 2;
  }

  async load() {
    const animDefs = this.getAnimationDefs();
    const promises = [];

    if (this.type === 'human') {
      // HUMANS: Always load 3 layers: base (body) + hair + tools
      for (const [name, def] of Object.entries(animDefs)) {
        // 1) BASE layer (body) - always loaded
        const basePath = getHumanSpritePath(name, 'base');
        if (basePath) {
          promises.push(
            loadSprite(basePath, def.frames).then(sheet => {
              this.animations[`${name}_body`] = new AnimatedSprite(sheet, def.speed);
            }).catch(err => {
              console.warn(`Could not load body ${name}: ${err.message}`);
            })
          );
        }

        // 2) HAIR layer - only if not 'base' (which IS the body)
        if (this.hairStyle !== 'base') {
          const hairPath = getHumanSpritePath(name, this.hairStyle);
          if (hairPath) {
            promises.push(
              loadSprite(hairPath, def.frames).then(sheet => {
                this.animations[`${name}_hair`] = new AnimatedSprite(sheet, def.speed);
              }).catch(err => {
                console.warn(`Could not load hair ${name}: ${err.message}`);
              })
            );
          }
        }

        // 3) TOOLS layer
        const toolPath = getHumanSpritePath(name, 'tools');
        if (toolPath) {
          promises.push(
            loadSprite(toolPath, def.frames).then(sheet => {
              this.animations[`${name}_tools`] = new AnimatedSprite(sheet, def.speed);
            }).catch(() => {})
          );
        }
      }
    } else {
      // GOBLIN / SKELETON: single sprite per animation
      for (const [name, def] of Object.entries(animDefs)) {
        const path = this.getSpritePath(name);
        if (!path) continue;
        promises.push(
          loadSprite(path, def.frames).then(sheet => {
            this.animations[name] = new AnimatedSprite(sheet, def.speed);
          }).catch(err => {
            console.warn(`Could not load animation ${name}: ${err.message}`);
          })
        );
      }
    }

    await Promise.allSettled(promises);
    // Set initial sprite
    this.currentSprite = this.animations['idle_body'] || this.animations['idle'] || null;
    this.loaded = true;
  }

  getAnimationDefs() {
    switch (this.type) {
      case 'human': return HUMAN_ANIMATIONS;
      case 'goblin': return GOBLIN_ANIMATIONS;
      case 'skeleton': return SKELETON_ANIMATIONS;
      default: return HUMAN_ANIMATIONS;
    }
  }

  getSpritePath(animation) {
    switch (this.type) {
      case 'human': return getHumanSpritePath(animation, this.hairStyle);
      case 'goblin': return getGoblinSpritePath(animation);
      case 'skeleton': return getSkeletonSpritePath(animation);
      default: return null;
    }
  }

  setAnimation(name) {
    if (name === this.currentAnimation && this.currentSprite) return;
    this.previousAnimation = this.currentAnimation;
    this.currentAnimation = name;

    if (this.type === 'human') {
      // Body layer is the main sprite
      const bodyKey = `${name}_body`;
      if (this.animations[bodyKey]) {
        this.currentSprite = this.animations[bodyKey];
        this.currentSprite.reset();
      }
      // Reset hair layer too
      const hairKey = `${name}_hair`;
      if (this.animations[hairKey]) {
        this.animations[hairKey].reset();
      }
    } else {
      if (this.animations[name]) {
        this.currentSprite = this.animations[name];
        this.currentSprite.reset();
      }
    }
  }

  moveTo(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  showExpression(type, duration = 2000) {
    this.expression = type;
    this.expressionTimer = duration;
  }

  showSpeechBubble(text, duration = 4000, color = '#fff') {
    this.speechBubbleText = text;
    this.speechBubbleTimer = duration;
    this.speechBubbleDuration = duration;
    this.speechBubbleColor = color;
  }

  update(deltaTime, tileMap = null) {
    // Movimiento
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      this.isMoving = true;
      const moveX = (dx / dist) * this.speed * (deltaTime / 1000);
      const moveY = (dy / dist) * this.speed * (deltaTime / 1000);

      // Dirección
      if (dx < 0) this.direction = 'left';
      else if (dx > 0) this.direction = 'right';

      // Verificar colisiones si hay tilemap
      let newX = this.x + moveX;
      let newY = this.y + moveY;

      if (tileMap) {
        // tileSize=16, world tileScale=3 → 48px per tile
        const tilePixelSize = tileMap.tileSize * 3;
        // Check collision at character's feet (center-bottom of sprite)
        const feetX = Math.floor((newX + this.currentSprite.width * this.scale / 2) / tilePixelSize);
        const feetY = Math.floor((newY + this.currentSprite.height * this.scale - 4) / tilePixelSize);
        if (!tileMap.isSolid(feetX, feetY)) {
          this.x = newX;
          this.y = newY;
        }
      } else {
        this.x = newX;
        this.y = newY;
      }

      if (this.currentAnimation !== 'run') {
        this.setAnimation(dist > 100 ? 'run' : 'walk');
      }
    } else {
      if (this.isMoving) {
        this.isMoving = false;
        this.setAnimation('idle');
      }
    }

    // NPC AI
    if (this.isNPC) {
      this.updateAI(deltaTime);
    }

    // Actualizar animación
    if (this.currentSprite) {
      this.currentSprite.update(deltaTime);
    }

    // Sync overlay layers to body frame (humans have body + hair + tools)
    if (this.type === 'human') {
      const frame = this.currentSprite?.currentFrame || 0;
      const hairKey = `${this.currentAnimation}_hair`;
      const toolsKey = `${this.currentAnimation}_tools`;
      if (this.animations[hairKey]) {
        this.animations[hairKey].currentFrame = frame;
      }
      if (this.animations[toolsKey]) {
        this.animations[toolsKey].currentFrame = frame;
      }
    }

    // Expresión timer
    if (this.expressionTimer > 0) {
      this.expressionTimer -= deltaTime;
      if (this.expressionTimer <= 0) {
        this.expression = null;
      }
    }

    // Speech bubble timer
    if (this.speechBubbleTimer > 0) {
      this.speechBubbleTimer -= deltaTime;
      if (this.speechBubbleTimer <= 0) {
        this.speechBubbleText = null;
      }
    }
  }

  updateAI(deltaTime) {
    this.thinkTimer -= deltaTime;
    if (this.thinkTimer > 0) return;

    if (this.behavior === 'patrol' && this.waypoints.length > 0) {
      const wp = this.waypoints[this.waypointIndex];
      const dx = wp.x - this.x;
      const dy = wp.y - this.y;
      if (Math.sqrt(dx * dx + dy * dy) < 10) {
        this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
        this.thinkTimer = 1000 + Math.random() * 2000;
      } else {
        this.moveTo(wp.x, wp.y);
      }
    } else if (this.behavior === 'wander') {
      this.moveTo(
        this.x + (Math.random() - 0.5) * 200,
        this.y + (Math.random() - 0.5) * 200
      );
      this.thinkTimer = 2000 + Math.random() * 4000;
    } else if (this.behavior === 'idle_random') {
      const randomAnims = ['idle', 'waiting', 'doing'];
      const pick = randomAnims[Math.floor(Math.random() * randomAnims.length)];
      this.setAnimation(pick);
      this.thinkTimer = 3000 + Math.random() * 5000;
    }
  }

  draw(ctx, camera) {
    if (!this.loaded || !this.currentSprite) return;

    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;
    const flipX = this.direction === 'left';

    // Sombra (at character's feet, ~75% down the sprite frame)
    const charW = this.currentSprite.width * this.scale;
    const charH = this.currentSprite.height * this.scale;
    const feetY = screenY + charH * 0.72;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(
      screenX + charW / 2,
      feetY,
      charW * 0.18,
      3 * this.scale, 0, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // Render character layers
    if (this.type === 'human') {
      // Layer 1: Body (base)
      const bodyKey = `${this.currentAnimation}_body`;
      if (this.animations[bodyKey]) {
        this.animations[bodyKey].draw(ctx, screenX, screenY, this.scale, flipX);
      }
      // Layer 2: Hair overlay
      const hairKey = `${this.currentAnimation}_hair`;
      if (this.animations[hairKey]) {
        this.animations[hairKey].draw(ctx, screenX, screenY, this.scale, flipX);
      }
      // Layer 3: Tools overlay
      const toolsKey = `${this.currentAnimation}_tools`;
      if (this.animations[toolsKey]) {
        this.animations[toolsKey].draw(ctx, screenX, screenY, this.scale, flipX);
      }
    } else {
      // Goblin / Skeleton: single sprite
      this.currentSprite.draw(ctx, screenX, screenY, this.scale, flipX);
    }

    // Nombre
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    const nameX = screenX + charW / 2;
    const nameY = screenY - 6;
    ctx.strokeText(this.name, nameX, nameY);
    ctx.fillText(this.name, nameX, nameY);
    ctx.restore();

    // Barra de vida (si no está al 100%)
    if (this.health < this.maxHealth) {
      const barWidth = Math.max(30, charW * 0.5);
      const barX = screenX + charW / 2 - barWidth / 2;
      const barY = screenY - 12;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barWidth, 4);
      ctx.fillStyle = this.health > 50 ? '#4a4' : this.health > 25 ? '#aa4' : '#a44';
      ctx.fillRect(barX, barY, barWidth * (this.health / this.maxHealth), 4);
    }

    // Burbuja de expresión (emoji only)
    if (this.expression && this.expressionTimer > 0 && !this.speechBubbleText) {
      const bubbleX = screenX + charW / 2;
      const bubbleY = screenY - 18;
      const symbols = {
        chat: '💬', love: '❤️', confused: '❓', angry: '💢',
        happy: '✨', sleep: '💤', alert: '❗', music: '🎵'
      };
      const symbol = symbols[this.expression] || '💬';
      const alpha = Math.min(1, this.expressionTimer / 500);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      // Fondo burbuja
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const bw = 18, bh = 18;
      ctx.beginPath();
      ctx.roundRect(bubbleX - bw/2, bubbleY - bh + 2, bw, bh, 4);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillText(symbol, bubbleX, bubbleY - 2);
      ctx.restore();
    }

    // ── SPEECH BUBBLE: texto real sobre el personaje ──
    if (this.speechBubbleText && this.speechBubbleTimer > 0) {
      const bubbleCenterX = screenX + charW / 2;
      const bubbleBaseY = screenY - 14;
      const alpha = Math.min(1, this.speechBubbleTimer / 600);

      ctx.save();
      ctx.globalAlpha = alpha;

      // Word wrap the text
      ctx.font = 'bold 9px monospace';
      const maxLineWidth = 120;
      const words = this.speechBubbleText.split(' ');
      const lines = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(testLine).width > maxLineWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Limit to 3 lines max
      if (lines.length > 3) {
        lines.length = 3;
        lines[2] = lines[2].substring(0, lines[2].length - 3) + '...';
      }

      const lineHeight = 11;
      const padding = 6;
      const bubbleW = Math.min(maxLineWidth + padding * 2,
        Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2);
      const bubbleH = lines.length * lineHeight + padding * 2;
      const bubbleX = bubbleCenterX - bubbleW / 2;
      const bubbleY = bubbleBaseY - bubbleH - 6;

      // Bubble background
      ctx.fillStyle = 'rgba(20, 20, 35, 0.88)';
      ctx.strokeStyle = this.speechBubbleColor || '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 6);
      ctx.fill();
      ctx.stroke();

      // Tail triangle pointing down
      ctx.fillStyle = 'rgba(20, 20, 35, 0.88)';
      ctx.beginPath();
      ctx.moveTo(bubbleCenterX - 5, bubbleY + bubbleH);
      ctx.lineTo(bubbleCenterX, bubbleY + bubbleH + 6);
      ctx.lineTo(bubbleCenterX + 5, bubbleY + bubbleH);
      ctx.closePath();
      ctx.fill();

      // Text
      ctx.fillStyle = this.speechBubbleColor || '#fff';
      ctx.textAlign = 'center';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], bubbleCenterX, bubbleY + padding + 8 + i * lineHeight);
      }

      ctx.restore();
    }
  }

  // Serializar para envío por red
  serialize() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      hairStyle: this.hairStyle,
      x: this.x,
      y: this.y,
      direction: this.direction,
      currentAnimation: this.currentAnimation,
      health: this.health,
      maxHealth: this.maxHealth,
      isNPC: this.isNPC,
      expression: this.expression
    };
  }

  // Actualizar desde datos de red
  updateFromNetwork(data) {
    this.targetX = data.x;
    this.targetY = data.y;
    this.direction = data.direction;
    this.health = data.health;
    if (data.currentAnimation !== this.currentAnimation) {
      this.setAnimation(data.currentAnimation);
    }
    if (data.expression !== this.expression) {
      this.expression = data.expression;
      this.expressionTimer = 2000;
    }
  }
}
