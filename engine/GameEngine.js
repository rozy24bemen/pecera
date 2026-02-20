// ============================================================
// SUNNYSIDE WORLD - Game Engine Core
// Motor principal: game loop, input, rendering
// ============================================================

import { Camera } from './Camera.js';
import { Character } from './Character.js';
import { TileMap, WorldGenerator } from './TileMap.js';
import { WorldObject } from './WorldObject.js';
import { UIManager } from './UIManager.js';
import { NetworkManager } from './NetworkManager.js';
import { HAIR_STYLES } from './AssetRegistry.js';

export class GameEngine {
  constructor(canvasId = 'game-canvas') {
    // Canvas
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    // Tamaño
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Sistemas
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.ui = new UIManager(this.canvas);
    this.network = new NetworkManager();

    // Mundo
    this.tileMap = null;
    this.worldObjects = new Map();
    this.characters = new Map();
    this.localPlayer = null;
    this.tileScale = 3; // 16px * 3 = 48px per tile on screen

    // Input
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };
    this.setupInput();

    // Game loop
    this.lastTime = 0;
    this.fps = 0;
    this.fpsCounter = 0;
    this.fpsTimer = 0;
    this.running = false;

    // ID counter
    this.nextId = 1;

    // Network callbacks
    this.setupNetwork();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.camera) {
      this.camera.resize(this.canvas.width, this.canvas.height);
    }
    this.ctx.imageSmoothingEnabled = false;
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      if (this.ui.isChatFocused()) return;
      this.keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.handleClick(e);
    });

    this.canvas.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    // Click derecho para mover
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.localPlayer) {
        const world = this.camera.screenToWorld(e.clientX, e.clientY);
        this.localPlayer.moveTo(world.x, world.y);
      }
    });
  }

  handleClick(e) {
    if (this.localPlayer) {
      const world = this.camera.screenToWorld(e.clientX, e.clientY);
      this.localPlayer.moveTo(world.x, world.y);
    }
  }

  setupNetwork() {
    this.network.on('connected', (id) => {
      this.ui.addSystemMessage('Conectado al servidor');
      this.ui.showNotification('🌻 ¡Bienvenido a Sunnyside World!');

      // Enviar info del jugador local + viewport
      if (this.localPlayer) {
        this.network.joinWorld({
          ...this.localPlayer.serialize(),
          viewportW: this.canvas.width,
          viewportH: this.canvas.height
        });
      }
    });

    this.network.on('disconnected', () => {
      this.ui.addSystemMessage('Desconectado del servidor');
    });

    this.network.on('world-state', async (data) => {
      // Recibir estado completo del mundo
      if (data.players) {
        for (const pData of data.players) {
          if (pData.id !== this.network.playerId) {
            this.addRemotePlayer(pData);
          }
        }
      }
      // Create NPCs from server data (authoritative positions & IDs)
      if (data.npcs) {
        for (const npcData of data.npcs) {
          // Remove any client-side NPC with the same name to avoid duplicates
          for (const [id, char] of this.characters) {
            if (char.isNPC && char.name === npcData.name) {
              this.characters.delete(id);
            }
          }
          const npc = new Character(npcData.id, npcData.type || 'human', {
            name: npcData.name,
            isNPC: true,
            hairStyle: npcData.hairStyle || 'base',
            x: npcData.x,
            y: npcData.y,
            behavior: 'wander'
          });
          await npc.load();
          npc.currentAnimation = npcData.currentAnimation || 'idle';
          npc.direction = npcData.direction || 'right';
          this.characters.set(npcData.id, npc);
        }
        console.log(`🌻 ${data.npcs.length} NPCs loaded from server`);
      }
    });

    this.network.on('player-joined', async (data) => {
      if (data.id !== this.network.playerId) {
        this.addRemotePlayer(data);
        this.ui.addSystemMessage(`${data.name} se ha unido`);
        this.ui.showNotification(`👋 ${data.name} se ha unido`);
      }
    });

    this.network.on('player-left', (data) => {
      const char = this.characters.get(data.id);
      if (char) {
        this.ui.addSystemMessage(`${char.name} se ha ido`);
        this.characters.delete(data.id);
      }
    });

    this.network.on('player-moved', (data) => {
      const char = this.characters.get(data.id);
      if (char) {
        char.updateFromNetwork(data);
      }
    });

    this.network.on('chat-message', (data) => {
      // Skip own messages (already shown locally), but show NPC and other players
      if (data.playerId === this.network.playerId && !data.isNPC) return;
      this.ui.addChatMessage(data.playerName, data.message, data.color, data.isNPC || false);
    });

    this.network.on('npc-update', (data) => {
      const npc = this.characters.get(data.id);
      if (npc) {
        npc.updateFromNetwork(data);
      }
    });

    // NPC expression bubbles (from AI chat)
    this.network.on('npc-expression', (data) => {
      const npc = this.characters.get(data.id);
      if (npc) {
        npc.showExpression(data.expression, data.duration || 3000);
      }
    });

    // Friendship system events
    this.network.on('friendship-init', (data) => {
      this.ui.initFriendshipPanel(data.levels, data.npcInfo);
    });

    this.network.on('friendship-update', (data) => {
      this.ui.updateFriendship(data.npcKey, data.level);
    });

    this.network.on('friendship-discovery', (data) => {
      this.ui.unlockDiscovery(data.npcKey, data.discoveries);
      for (const type of data.discoveries) {
        const label = type === 'color' ? '🎨 Color favorito' : '🍽️ Comida favorita';
        this.ui.showNotification(`¡Descubriste el ${label} de ${data.npcKey}!`, 5000);
      }
    });

    // AI Status indicator
    this.network.on('ai-status', (data) => {
      this.ui.updateAIStatus(data);
    });

    // Speech bubbles over characters
    this.network.on('speech-bubble', (data) => {
      // data: { id, name, message, color?, duration }
      // id can be socket.id (player) or npc_xxx (NPC)
      let char = this.characters.get(data.id);
      // If it's the local player's bubble
      if (data.id === this.network.playerId) {
        char = this.localPlayer;
      }
      if (char) {
        char.showSpeechBubble(data.message, data.duration || 4000, data.color || '#fff');
      }
    });

    this.network.on('object-added', async (data) => {
      const obj = new WorldObject(data.id, data.type, data.objectKey, data.x, data.y, data);
      await obj.load();
      this.worldObjects.set(data.id, obj);
    });

    this.network.on('object-removed', (data) => {
      this.worldObjects.delete(data.id);
    });

    // Chat local -> server
    window.addEventListener('chat-message', (e) => {
      this.network.sendChatMessage(
        e.detail,
        this.localPlayer?.x || 0,
        this.localPlayer?.y || 0,
        this.canvas.width,
        this.canvas.height
      );
      this.ui.addChatMessage(this.localPlayer?.name || 'Tú', e.detail, '#7bf');
      // Show speech bubble on local player immediately
      if (this.localPlayer) {
        this.localPlayer.showSpeechBubble(e.detail, Math.min(5000, 2000 + e.detail.length * 50), '#7bf');
      }
    });

    // Proximity info from server
    this.network.on('proximity-info', (data) => {
      this.ui.updateProximityInfo(data);
    });

    // Periodic position sync (even when idle) - every 2s
    setInterval(() => {
      if (this.network.connected && this.localPlayer) {
        this.network.sendMove(
          this.localPlayer.x,
          this.localPlayer.y,
          this.localPlayer.direction,
          this.localPlayer.currentAnimation,
          this.canvas.width,
          this.canvas.height
        );
      }
    }, 2000);

    // Real-time proximity calculation (client-side, every 500ms)
    setInterval(() => {
      if (!this.localPlayer) return;
      const px = this.localPlayer.x;
      const py = this.localPlayer.y;
      const halfW = this.canvas.width / 2 + 80;
      const halfH = this.canvas.height / 2 + 80;
      const listening = [];
      const all = [];
      for (const char of this.characters.values()) {
        if (!char.isNPC) continue;
        const dx = Math.abs(char.x - px);
        const dy = Math.abs(char.y - py);
        const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
        const canHear = dx <= halfW && dy <= halfH;
        if (canHear) listening.push(char.name);
        all.push({
          name: char.name,
          dist,
          dx: Math.round(dx),
          dy: Math.round(dy),
          canHear,
          npcPos: { x: Math.round(char.x), y: Math.round(char.y) }
        });
      }
      this.ui.updateProximityInfo({
        listening,
        all,
        playerPos: { x: Math.round(px), y: Math.round(py) },
        viewport: { w: this.canvas.width, h: this.canvas.height },
        halfW: Math.round(halfW),
        halfH: Math.round(halfH)
      });
    }, 500);
  }

  async addRemotePlayer(data) {
    const char = new Character(data.id, data.type || 'human', {
      name: data.name,
      hairStyle: data.hairStyle || 'base',
      x: data.x,
      y: data.y
    });
    await char.load();
    this.characters.set(data.id, char);
  }

  // ═══════════════════════════════════════════════════════════
  // API PÚBLICA - Para usar desde el chat conversacional
  // ═══════════════════════════════════════════════════════════

  /**
   * Crear un mundo nuevo
   * @param {'village'|'forest'|'island'|'empty'} type
   * @param {number} width - ancho en tiles
   * @param {number} height - alto en tiles
   */
  async createWorld(type = 'village', width = 64, height = 64) {
    switch (type) {
      case 'village':
        this.tileMap = WorldGenerator.generateVillage(width, height);
        break;
      case 'forest':
        this.tileMap = WorldGenerator.generateForest(width, height);
        break;
      case 'island':
        this.tileMap = WorldGenerator.generateIsland(width, height);
        break;
      default:
        this.tileMap = WorldGenerator.generateEmpty(width, height);
    }

    await this.tileMap.loadTileset();
    const worldPixelW = width * this.tileMap.tileSize * this.tileScale;
    const worldPixelH = height * this.tileMap.tileSize * this.tileScale;
    this.camera.setBounds(0, 0, worldPixelW, worldPixelH);
    this.ui.addSystemMessage(`Mundo "${type}" creado (${width}x${height})`);
    return this.tileMap;
  }

  /**
   * Crear el jugador local
   */
  async createPlayer(name = 'Hero', hairStyle = 'base', type = 'human') {
    const ts = this.tileMap ? this.tileMap.tileSize * this.tileScale : 48;
    const startX = this.tileMap ? (this.tileMap.width / 2) * ts : 400;
    const startY = this.tileMap ? (this.tileMap.height / 2) * ts : 400;

    this.localPlayer = new Character('local', type, {
      name,
      hairStyle,
      x: startX,
      y: startY,
      speed: 120
    });

    await this.localPlayer.load();
    this.characters.set('local', this.localPlayer);
    this.camera.follow(this.localPlayer);

    this.ui.addSystemMessage(`Jugador "${name}" creado (${type}, pelo: ${hairStyle})`);
    return this.localPlayer;
  }

  /**
   * Añadir un NPC
   */
  async addNPC(name, type = 'human', config = {}) {
    const id = `npc_${this.nextId++}`;
    const npc = new Character(id, type, {
      name,
      isNPC: true,
      hairStyle: config.hairStyle || HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)],
      x: config.x || Math.random() * 500,
      y: config.y || Math.random() * 500,
      behavior: config.behavior || 'wander',
      waypoints: config.waypoints || [],
      dialogue: config.dialogue || [],
      speed: config.speed || 40,
      ...config
    });

    await npc.load();
    this.characters.set(id, npc);
    this.ui.addSystemMessage(`NPC "${name}" (${type}) añadido al mundo`);
    return npc;
  }

  /**
   * Añadir un objeto al mundo (animal, planta, decoración, cultivo, VFX)
   */
  async addWorldObject(type, objectKey, x, y, config = {}) {
    const id = `obj_${this.nextId++}`;
    const obj = new WorldObject(id, type, objectKey, x, y, config);
    await obj.load();
    this.worldObjects.set(id, obj);
    this.ui.addSystemMessage(`${type} "${objectKey}" añadido en (${x}, ${y})`);
    return obj;
  }

  /**
   * Poblar zona con múltiples objetos
   */
  async populateArea(type, objectKey, count, area = {}) {
    const minX = area.x || 100;
    const minY = area.y || 100;
    const maxX = minX + (area.width || 400);
    const maxY = minY + (area.height || 400);

    const promises = [];
    for (let i = 0; i < count; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      promises.push(this.addWorldObject(type, objectKey, x, y, area.config || {}));
    }
    await Promise.all(promises);
    this.ui.addSystemMessage(`${count}x ${objectKey} distribuidos en el área`);
  }

  /**
   * Conectar al servidor multiplayer
   */
  connectMultiplayer(url) {
    this.network.connect(url);
  }

  // ═══════════════════════════════════════════════════════════
  // GAME LOOP
  // ═══════════════════════════════════════════════════════════

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  stop() {
    this.running = false;
  }

  gameLoop(timestamp) {
    if (!this.running) return;

    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // FPS counter
    this.fpsCounter++;
    this.fpsTimer += deltaTime;
    if (this.fpsTimer >= 1000) {
      this.fps = this.fpsCounter;
      this.fpsCounter = 0;
      this.fpsTimer = 0;
    }

    this.update(deltaTime);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(deltaTime) {
    // Input del jugador local
    if (this.localPlayer && !this.ui.isChatFocused()) {
      let dx = 0, dy = 0;
      if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
      if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
      if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
      if (this.keys['d'] || this.keys['arrowright']) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const speed = this.localPlayer.speed * (deltaTime / 1000);
        const len = Math.sqrt(dx * dx + dy * dy);
        this.localPlayer.targetX = this.localPlayer.x + (dx / len) * speed * 3;
        this.localPlayer.targetY = this.localPlayer.y + (dy / len) * speed * 3;
      }

      // Enviar posición por red
      if (this.network.connected && this.localPlayer.isMoving) {
        this.network.sendMove(
          this.localPlayer.x,
          this.localPlayer.y,
          this.localPlayer.direction,
          this.localPlayer.currentAnimation,
          this.canvas.width,
          this.canvas.height
        );
      }
    }

    // Actualizar personajes
    for (const char of this.characters.values()) {
      char.update(deltaTime, this.tileMap);
    }

    // Actualizar objetos del mundo
    for (const obj of this.worldObjects.values()) {
      obj.update(deltaTime);
    }

    // Actualizar cámara
    this.camera.update(deltaTime);

    // Actualizar HUD
    this.ui.updateHUD(
      this.characters.size,
      this.localPlayer?.x || 0,
      this.localPlayer?.y || 0,
      this.fps
    );
  }

  render() {
    const ctx = this.ctx;

    // Clear con color de fondo (matches grass)
    ctx.fillStyle = '#4a7a30';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Renderizar mapa
    if (this.tileMap) {
      this.tileMap.render(ctx, this.camera, this.tileScale);
    }

    // Recoger todos los renderizables y ordenar por Y de pies (depth sort)
    const renderables = [];

    for (const obj of this.worldObjects.values()) {
      const bottom = obj.y + (obj.sprite ? obj.sprite.height * obj.scale : 32);
      renderables.push({ y: bottom, draw: () => obj.draw(ctx, this.camera) });
    }

    for (const char of this.characters.values()) {
      const bottom = char.y + (char.currentSprite ? char.currentSprite.height * char.scale : 64);
      renderables.push({ y: bottom, draw: () => char.draw(ctx, this.camera) });
    }

    // Ordenar por Y para el depth sorting correcto
    renderables.sort((a, b) => a.y - b.y);

    for (const r of renderables) {
      r.draw();
    }

    // Mini-mapa
    this.ui.drawMiniMap(ctx, this.tileMap, Array.from(this.characters.values()), this.camera);
  }
}

// ── Exposición global para uso desde consola/chat ───────────
window.GameEngine = GameEngine;
