// ============================================================
// SUNNYSIDE WORLD - Multiplayer Server v2
// Con actividades NPC, multi-respuesta IA, sistema de amistad
// ============================================================

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllNPCResponses, getNPCConversation, addToHistory,
  getDebugState, getChatHistory, testNPCDirect, getContextualFallback,
  isRateLimited
} from './gemini.js';
import { NPC_PERSONALITIES, NPC_CHAT_COLORS } from './NPCPersonalities.js';
import { npcMemory, IMPORTANCE } from './NPCMemory.js';
import { socialEngine, CHAT_RULES } from './NPCSocialEngine.js';

const apiKeys = {
  groqKey: process.env.GROQ_API_KEY,
  geminiKey: process.env.GEMINI_API_KEY,
};
const hasAI = apiKeys.groqKey || apiKeys.geminiKey;
if (!hasAI) {
  console.warn('⚠️  Ni GROQ_API_KEY ni GEMINI_API_KEY en .env - NPCs no podrán hablar con IA');
}

// ── Heartbeat Config ────────────────────────────────────────
const HEARTBEAT_INTERVAL = 15 * 60 * 1000; // 15 minutos

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// ── Estado del mundo en el servidor ─────────────────────────
const worldState = {
  players: new Map(),
  npcs: new Map(),
  objects: new Map(),
  chat: [],
  friendship: new Map(),  // playerId → { Elena: 0, Marco: 0, Gruk: 0, Bones: 0 }
  playerMemory: new Map()  // playerId → { nombre: 'Juan', edad: '25', color_favorito: 'azul', ... }
};

// ── Player Memory: extrae datos personales del jugador ──────
const MEMORY_PATTERNS = [
  { key: 'nombre_real', patterns: [/me llamo (\w+)/i, /mi nombre (?:real )?(?:es|será) (\w+)/i, /soy (\w+)/i] },
  { key: 'edad', patterns: [/tengo (\d+) años/i, /mi edad (?:es|son) (\d+)/i, /(\d+) años/i] },
  { key: 'color_favorito', patterns: [/mi color favorito (?:es|será) (?:el )?(\w+)/i, /me gusta (?:el color )?(\w+)/i, /favorito (?:es|el) (\w+)/i] },
  { key: 'comida_favorita', patterns: [/mi comida favorita (?:es|será) (.+?)(?:\.|$)/i, /me gusta (?:comer|la comida) (.+?)(?:\.|$)/i] },
  { key: 'hobby', patterns: [/me gusta (?:mucho )?(?:el |la |los |las )?(\w+(?:\s\w+)?)/i, /mi hobby (?:es|será) (.+?)(?:\.|$)/i] },
  { key: 'profesion', patterns: [/soy (\w+(?:\s\w+)?) de profesión/i, /trabajo (?:como|de) (.+?)(?:\.|$)/i] },
];

function extractPlayerMemory(message, existingMemory) {
  const memory = { ...existingMemory };
  const msgLower = message.toLowerCase();
  
  for (const { key, patterns } of MEMORY_PATTERNS) {
    for (const pattern of patterns) {
      const match = msgLower.match(pattern);
      if (match && match[1] && match[1].length > 1 && match[1].length < 30) {
        // Don't overwrite with NPC names or common words
        const val = match[1].trim();
        const skipWords = ['elena', 'marco', 'gruk', 'bones', 'hola', 'si', 'no', 'que', 'como', 'bien', 'mal'];
        if (!skipWords.includes(val.toLowerCase())) {
          memory[key] = val;
        }
      }
    }
  }
  return memory;
}

// ── Actividades posibles por tipo de NPC ────────────────────
// Humano y Goblin: todas las animaciones disponibles
// Esqueleto: solo idle, walk, attack, death, hurt
const NPC_ACTIVITIES = {
  Elena: {
    activities: [
      { name: 'regando cultivos', animation: 'watering', duration: 6000, zone: { x: 1350, y: 1350, w: 200, h: 200 } },
      { name: 'recogiendo hierbas', animation: 'doing', duration: 5000, zone: { x: 1400, y: 1500, w: 150, h: 100 } },
      { name: 'cargando cosecha', animation: 'carry', duration: 4000, zone: { x: 1450, y: 1450, w: 100, h: 100 } },
      { name: 'descansando', animation: 'idle', duration: 4000, zone: null },
      { name: 'paseando', animation: 'walk', duration: 6000, zone: null }
    ]
  },
  Marco: {
    activities: [
      { name: 'patrullando', animation: 'walk', duration: 8000, zone: { x: 1550, y: 1400, w: 300, h: 300 } },
      { name: 'talando madera', animation: 'axe', duration: 7000, zone: { x: 1700, y: 1450, w: 80, h: 80 } },
      { name: 'combatiendo monstruos', animation: 'attack', duration: 5000, zone: { x: 1800, y: 1350, w: 100, h: 100 } },
      { name: 'vigilando', animation: 'idle', duration: 6000, zone: null },
      { name: 'entrenando', animation: 'roll', duration: 4000, zone: { x: 1600, y: 1550, w: 80, h: 80 } }
    ]
  },
  Gruk: {
    activities: [
      { name: 'picando piedra', animation: 'mining', duration: 7000, zone: { x: 1250, y: 1550, w: 100, h: 100 } },
      { name: 'excavando', animation: 'dig', duration: 6000, zone: { x: 1300, y: 1600, w: 80, h: 80 } },
      { name: 'cargando botín', animation: 'carry', duration: 5000, zone: { x: 1280, y: 1500, w: 150, h: 100 } },
      { name: 'buscando shiny', animation: 'walk', duration: 8000, zone: null },
      { name: 'escondiéndose', animation: 'idle', duration: 4000, zone: null },
      { name: 'martilleando', animation: 'hammering', duration: 6000, zone: { x: 1320, y: 1580, w: 60, h: 60 } }
    ]
  },
  Bones: {
    // Skeleton only has: idle, walk, attack, death, hurt
    activities: [
      { name: 'meditando', animation: 'idle', duration: 10000, zone: { x: 1700, y: 1600, w: 80, h: 80 } },
      { name: 'vagando', animation: 'walk', duration: 8000, zone: null },
      { name: 'espantando intrusos', animation: 'attack', duration: 4000, zone: { x: 1750, y: 1650, w: 60, h: 60 } },
      { name: 'contemplando la existencia', animation: 'idle', duration: 12000, zone: null },
      { name: 'patrullando su territorio', animation: 'walk', duration: 7000, zone: { x: 1650, y: 1550, w: 200, h: 200 } }
    ]
  }
};

// ── NPCs del servidor ───────────────────────────────────────
const serverNPCs = [
  {
    id: 'npc_villager_1', type: 'human', name: 'Elena',
    hairStyle: 'longhair', x: 1450, y: 1450,
    currentAnimation: 'idle', direction: 'right', health: 100, maxHealth: 100, isNPC: true,
    _activity: null, _activityTimer: 0, _activityIndex: -1
  },
  {
    id: 'npc_villager_2', type: 'human', name: 'Marco',
    hairStyle: 'shorthair', x: 1600, y: 1500,
    currentAnimation: 'idle', direction: 'right', health: 100, maxHealth: 100, isNPC: true,
    _activity: null, _activityTimer: 0, _activityIndex: -1
  },
  {
    id: 'npc_goblin_1', type: 'goblin', name: 'Gruk',
    x: 1300, y: 1550,
    currentAnimation: 'idle', direction: 'left', health: 80, maxHealth: 80, isNPC: true,
    _activity: null, _activityTimer: 0, _activityIndex: -1
  },
  {
    id: 'npc_skeleton_1', type: 'skeleton', name: 'Bones',
    x: 1700, y: 1600,
    currentAnimation: 'idle', direction: 'right', health: 60, maxHealth: 60, isNPC: true,
    _activity: null, _activityTimer: 0, _activityIndex: -1
  }
];

// Inicializar NPCs
serverNPCs.forEach(npc => {
  worldState.npcs.set(npc.id, { ...npc });
});

// ── Inicializar Memory + Social Engine ──────────────────────
const npcNames = Object.keys(NPC_PERSONALITIES);
npcMemory.init(npcNames);
socialEngine.init(npcNames);

// Provide position data to social engine
socialEngine.setPositionProvider(() => {
  const positions = {};
  for (const [id, npc] of worldState.npcs) {
    positions[npc.name] = { x: npc.x, y: npc.y };
  }
  return positions;
});

console.log(`[Memory] 🧠 Memory system initialized for ${npcNames.join(', ')}`);
console.log(`[Social] 🤝 Social engine initialized`);

// ── Obtener actividad actual de cada NPC (para contexto IA) ─
function getNPCActivities() {
  const activities = {};
  for (const [id, npc] of worldState.npcs) {
    const act = NPC_ACTIVITIES[npc.name];
    if (act && npc._activityIndex >= 0) {
      activities[npc.name] = act.activities[npc._activityIndex]?.name || 'descansando';
    } else {
      activities[npc.name] = 'descansando';
    }
  }
  return activities;
}

// ── NPC Activity + Movement Loop ────────────────────────────
setInterval(() => {
  // Social engine tick — NPCs decide if they want to interact
  const socialAction = socialEngine.tick();
  
  // Process seek intents — NPCs walk toward each other
  const seeks = socialEngine.getSeekTargets();
  for (const seek of seeks) {
    const seekerNPC = Array.from(worldState.npcs.values()).find(n => n.name === seek.npc);
    const targetNPC = Array.from(worldState.npcs.values()).find(n => n.name === seek.target);
    if (seekerNPC && targetNPC) {
      // Override current target to walk toward the other NPC
      seekerNPC._targetX = targetNPC.x + (Math.random() - 0.5) * 60;
      seekerNPC._targetY = targetNPC.y + (Math.random() - 0.5) * 60;
      seekerNPC._targetX = Math.max(1100, Math.min(2000, seekerNPC._targetX));
      seekerNPC._targetY = Math.max(1200, Math.min(1900, seekerNPC._targetY));
      seekerNPC.currentAnimation = 'walk';
      seekerNPC._activityTimer = 8000; // Give time to walk there
      console.log(`[Social] 🚶 ${seek.npc} is walking toward ${seek.target} (${seek.reason})`);
    }
  }

  for (const [id, npc] of worldState.npcs) {
    const actDef = NPC_ACTIVITIES[npc.name];
    if (!actDef) continue;

    npc._activityTimer -= 500;

    // Elegir nueva actividad
    if (npc._activityTimer <= 0) {
      const prevIdx = npc._activityIndex;
      let newIdx;
      do {
        newIdx = Math.floor(Math.random() * actDef.activities.length);
      } while (newIdx === prevIdx && actDef.activities.length > 1);

      npc._activityIndex = newIdx;
      const activity = actDef.activities[newIdx];
      npc._activityTimer = activity.duration + Math.random() * 3000;
      npc.currentAnimation = activity.animation;

      // Si hay zona, moverse hacia ella
      if (activity.zone) {
        npc._targetX = activity.zone.x + Math.random() * activity.zone.w;
        npc._targetY = activity.zone.y + Math.random() * activity.zone.h;
      } else {
        // Wander aleatorio
        npc._targetX = npc.x + (Math.random() - 0.5) * 200;
        npc._targetY = npc.y + (Math.random() - 0.5) * 200;
      }
      // Clampar dentro de los límites del mapa (zona central)
      npc._targetX = Math.max(1100, Math.min(2000, npc._targetX));
      npc._targetY = Math.max(1200, Math.min(1900, npc._targetY));
    }

    // Moverse hacia target
    if (npc._targetX !== undefined) {
      const dx = npc._targetX - npc.x;
      const dy = npc._targetY - npc.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 15) {
        const speed = 12;
        npc.x += (dx / dist) * speed;
        npc.y += (dy / dist) * speed;
        npc.direction = dx < 0 ? 'left' : 'right';
        // Si está caminando hacia destino, usar walk; si ya llegó, la animación de actividad
        if (['walk', 'run'].includes(npc.currentAnimation) === false && dist > 50) {
          npc.currentAnimation = 'walk';
        }
      } else {
        // Llegó al destino, hacer su actividad
        const activity = actDef.activities[npc._activityIndex];
        if (activity) {
          npc.currentAnimation = activity.animation;
        }
        npc._targetX = undefined;
        npc._targetY = undefined;
      }
    }

    io.emit('npc-update', {
      id: npc.id,
      x: npc.x,
      y: npc.y,
      direction: npc.direction,
      currentAnimation: npc.currentAnimation,
      health: npc.health,
      activity: actDef.activities[npc._activityIndex]?.name || ''
    });
  }
}, 500);

// ── Helper: enviar mensaje NPC al chat ──────────────────────
function broadcastNPCMessage(npcKey, message) {
  const npcMsg = {
    playerId: `npc_${npcKey.toLowerCase()}`,
    playerName: npcKey,
    message,
    color: NPC_CHAT_COLORS[npcKey] || '#ccc',
    isNPC: true,
    time: Date.now()
  };
  worldState.chat.push(npcMsg);
  if (worldState.chat.length > 100) worldState.chat.shift();
  io.emit('chat-message', npcMsg);

  const npcId = findNPCIdByName(npcKey);
  if (npcId) {
    io.emit('npc-expression', { id: npcId, expression: 'chat', duration: 3000 });
    // Speech bubble over NPC
    io.emit('speech-bubble', {
      id: npcId,
      name: npcKey,
      message: message,
      color: NPC_CHAT_COLORS[npcKey] || '#fff',
      duration: Math.min(6000, 2500 + message.length * 60)
    });
  }
}

// ── Helper: encontrar ID de NPC por nombre ──────────────────
function findNPCIdByName(name) {
  for (const [id, npc] of worldState.npcs) {
    if (npc.name === name) return id;
  }
  return null;
}

// ── HEARTBEAT: NPC-to-NPC conversation (cada 15 min) ────────
const HEARTBEAT_PROMPTS = [
  '*mira al cielo y comenta sobre el tiempo*',
  '*observa el paisaje y dice algo*',
  '*habla solo, pensando en voz alta*',
  '*bosteza y comenta algo*',
  '*mira a su alrededor y reacciona*',
  '*recuerda algo y lo comparte*',
  '*se estira y dice algo casual*'
];

// HEARTBEAT DISABLED: NPC-to-NPC conversations waste free-tier API quota.
// Player chat has priority. NPCs only talk when player talks to them.
// To re-enable, uncomment below and set HEARTBEAT_INTERVAL higher (e.g. 30+ min)
/*
setInterval(async () => {
  if (worldState.players.size === 0 || !hasAI) return;
  const activities = getNPCActivities();
  console.log(`[Heartbeat] NPC-to-NPC conversation...`);
  try {
    const conversation = await getNPCConversation(apiKeys, activities);
    if (conversation) {
      let delay = 0;
      for (const [npcKey, message] of Object.entries(conversation)) {
        setTimeout(() => { addToHistory(npcKey, message); broadcastNPCMessage(npcKey, message); }, delay);
        delay += 2000 + Math.random() * 1500;
      }
    }
  } catch (err) { console.error(`[Heartbeat Error]`, err.message); }
}, HEARTBEAT_INTERVAL);
*/

// ── Socket.IO Connection Handler ────────────────────────────
io.on('connection', (socket) => {
  console.log(`🟢 Player connected: ${socket.id}`);

  socket.on('join-world', (playerData) => {
    const player = {
      id: socket.id,
      name: playerData.name || 'Aventurero',
      type: playerData.type || 'human',
      hairStyle: playerData.hairStyle || 'base',
      x: playerData.x ?? 1536,
      y: playerData.y ?? 1536,
      direction: 'right',
      currentAnimation: 'idle',
      health: 100,
      maxHealth: 100,
      viewportW: playerData.viewportW || 1280,
      viewportH: playerData.viewportH || 720
    };
    console.log(`[Join] 🎮 ${player.name} joined at (${player.x}, ${player.y}) viewport ${player.viewportW}x${player.viewportH}`);

    worldState.players.set(socket.id, player);

    // Inicializar amistad del jugador
    worldState.friendship.set(socket.id, {
      Elena: 0, Marco: 0, Gruk: 0, Bones: 0
    });

    // Inicializar memoria del jugador
    if (!worldState.playerMemory.has(socket.id)) {
      worldState.playerMemory.set(socket.id, {});
    }

    // Enviar estado completo al nuevo jugador
    socket.emit('world-state', {
      players: Array.from(worldState.players.values()),
      npcs: Array.from(worldState.npcs.values()),
      objects: Array.from(worldState.objects.values())
    });

    // Enviar estado de amistad
    socket.emit('friendship-init', {
      levels: worldState.friendship.get(socket.id),
      npcInfo: Object.fromEntries(
        Object.entries(NPC_PERSONALITIES).map(([k, v]) => [k, {
          type: v.type, role: v.role, hairStyle: v.hairStyle
        }])
      )
    });

    // Avisar a los demás
    socket.broadcast.emit('player-joined', player);

    // Bienvenida del sistema (sin request a Gemini)
    socket.emit('chat-message', {
      playerId: 'system',
      playerName: '🌻 Sistema',
      message: `¡Bienvenido ${player.name}! Habla por el chat y los NPCs te responderán.`,
      color: '#ffd700',
      isNPC: false,
      time: Date.now()
    });

    console.log(`👤 ${player.name} joined the world`);
  });

  socket.on('player-move', (data) => {
    const player = worldState.players.get(socket.id);
    if (!player) return;

    player.x = data.x;
    player.y = data.y;
    player.direction = data.direction;
    player.currentAnimation = data.animation;
    if (data.viewportW) player.viewportW = data.viewportW;
    if (data.viewportH) player.viewportH = data.viewportH;

    socket.broadcast.emit('player-moved', {
      id: socket.id,
      ...data
    });
  });

  socket.on('player-action', (data) => {
    const player = worldState.players.get(socket.id);
    if (!player) return;

    socket.broadcast.emit('player-action', {
      id: socket.id,
      ...data
    });
  });

  // ── CHAT: TODOS los NPCs responden (1 sola request) ──────
  socket.on('chat-message', (data) => {
    const player = worldState.players.get(socket.id);
    const playerName = player?.name || 'Anónimo';

    // ── Update player position from chat data (guaranteed fresh!) ──
    if (player && data.x !== undefined) {
      player.x = data.x;
      player.y = data.y;
      if (data.viewportW) player.viewportW = data.viewportW;
      if (data.viewportH) player.viewportH = data.viewportH;
    }

    const msg = {
      playerId: socket.id,
      playerName,
      message: data.message,
      color: '#7bf',
      time: Date.now()
    };
    worldState.chat.push(msg);
    if (worldState.chat.length > 100) worldState.chat.shift();

    // Broadcast mensaje del jugador
    io.emit('chat-message', msg);

    // ── Speech bubble for player ──
    io.emit('speech-bubble', {
      id: socket.id,
      name: playerName,
      message: data.message,
      duration: Math.min(6000, 2000 + data.message.length * 60)
    });

    // ── Extract player memory ──
    const existingMemory = worldState.playerMemory.get(socket.id) || {};
    const updatedMemory = extractPlayerMemory(data.message, existingMemory);
    if (Object.keys(updatedMemory).length > Object.keys(existingMemory).length) {
      worldState.playerMemory.set(socket.id, updatedMemory);
      const newKeys = Object.keys(updatedMemory).filter(k => !existingMemory[k]);
      if (newKeys.length > 0) {
        console.log(`[Memory] 🧠 ${playerName} revealed: ${newKeys.map(k => `${k}=${updatedMemory[k]}`).join(', ')}`);
      }
    } else {
      worldState.playerMemory.set(socket.id, updatedMemory);
    }

    // ── Multi-NPC AI Responses via Gemini (1 request) ────
    if (hasAI) {
      addToHistory(playerName, data.message);
      const activities = getNPCActivities();
      const msgLower = data.message.toLowerCase();
      const playerMem = worldState.playerMemory.get(socket.id) || {};

      // ── Proximity filter: NPC must be visible on player's screen ──
      // Rule: if you can see their speech bubble, you hear each other
      const halfW = (player?.viewportW || 1280) / 2 + 80;  // +80 margin for speech bubble
      const halfH = (player?.viewportH || 720) / 2 + 80;
      const nearbyNPCs = [];
      const proximityDebug = [];  // for UI feedback
      if (player) {
        for (const [id, npc] of worldState.npcs) {
          const dx = Math.abs(npc.x - player.x);
          const dy = Math.abs(npc.y - player.y);
          const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
          const inRangeX = dx <= halfW;
          const inRangeY = dy <= halfH;
          const canHear = inRangeX && inRangeY;
          if (canHear) {
            nearbyNPCs.push(npc.name);
          }
          proximityDebug.push({
            name: npc.name,
            dist,
            dx: Math.round(dx),
            dy: Math.round(dy),
            canHear,
            npcPos: { x: Math.round(npc.x), y: Math.round(npc.y) }
          });
        }
      }

      // Send proximity info to client for UI feedback
      socket.emit('proximity-info', {
        listening: nearbyNPCs,
        all: proximityDebug,
        playerPos: { x: Math.round(player?.x || 0), y: Math.round(player?.y || 0) },
        viewport: { w: player?.viewportW || 0, h: player?.viewportH || 0 },
        halfW: Math.round(halfW),
        halfH: Math.round(halfH)
      });

      console.log(`[Chat] 💬 ${playerName} at (${Math.round(player?.x)},${Math.round(player?.y)}) | nearby: [${nearbyNPCs.join(', ')}] | viewport: ${player?.viewportW}x${player?.viewportH}`);

      // ── Store player message in NPC memories ──
      for (const npcName of nearbyNPCs) {
        npcMemory.observeConversation(npcName, playerName, data.message, { activity: activities[npcName] });
      }

      // ── Build enhanced system prompt with memory ──
      const enhancedPrompt = socialEngine.buildPlayerConversationPrompt(
        playerName, data.message, activities, playerMem, npcMoods, nearbyNPCs
      );

      // Un solo setTimeout con un solo request
      setTimeout(async () => {
        try {
          const responses = await getAllNPCResponses(apiKeys, playerName, data.message, activities, playerMem, npcMoods, enhancedPrompt);

          // Si Gemini devuelve null (error/rate limit), usar fallback contextual
          const allNpcNames = Object.keys(NPC_PERSONALITIES);
          const finalResponses = responses || getContextualFallback(activities,
            allNpcNames.filter(k => msgLower.includes(k.toLowerCase()))
          );

          // ── Filter by proximity: only nearby NPCs respond ──
          const filteredResponses = {};
          for (const [npcKey, response] of Object.entries(finalResponses)) {
            if (nearbyNPCs.includes(npcKey)) {
              filteredResponses[npcKey] = response;
            }
          }

          // If no nearby NPCs had a response, let the closest NPC give a hint
          const entriesToUse = Object.keys(filteredResponses).length > 0
            ? Object.entries(filteredResponses)
            : (nearbyNPCs.length > 0
              ? [[nearbyNPCs[0], finalResponses[nearbyNPCs[0]] || '...']]
              : []);

          // If nobody is nearby, send a system hint
          if (entriesToUse.length === 0 && Object.keys(finalResponses).length > 0) {
            socket.emit('chat-message', {
              playerId: 'system',
              playerName: '🌻 Sistema',
              message: 'No hay nadie cerca para oírte. Acércate a un NPC.',
              color: '#ffd700',
              isNPC: false,
              time: Date.now()
            });
            return;
          }
          
          // Notificar al cliente si fue fallback
          if (!responses) {
            const debugState = getDebugState();
            const limited = isRateLimited();
            io.emit('ai-status', {
              status: limited ? 'ratelimit' : 'fallback',
              reason: 'API no disponible',
              rateLimitSec: limited ? debugState.rateLimitRemainingSec : 0
            });
          } else {
            io.emit('ai-status', { status: 'ok' });
          }
          
          // ── Realistic response timing per NPC personality ──
          // Delays are CUMULATIVE: each message waits for the previous one
          let idx = 0;
          let accumulatedDelay = 0;
          for (const [npcKey, response] of entriesToUse) {
            accumulatedDelay += socialEngine.getResponseDelay(npcKey, idx);
            const delay = accumulatedDelay;
            
            setTimeout(() => {
              addToHistory(npcKey, response);
              broadcastNPCMessage(npcKey, response);

              // ── Store NPC response in all nearby NPCs' memories ──
              for (const otherNPC of nearbyNPCs) {
                if (otherNPC !== npcKey) {
                  npcMemory.observeConversation(otherNPC, npcKey, response, {});
                }
              }
              // Store in the responding NPC's own memory too
              npcMemory.addMemory(npcKey, {
                type: 'episodic',
                content: `Le dije a ${playerName}: "${response.substring(0, 60)}"`,
                about: playerName,
                tags: [playerName.toLowerCase(), 'conversación'],
                importance: 3,
                emotion: 'neutral'
              });

              // ── Incrementar amistad por hablar ────────
              const friendship = worldState.friendship.get(socket.id);
              if (friendship) {
                let gain = 2;
                if (response.includes('?') || response.includes('¿')) gain += 1;
                const newMemKeys = Object.keys(updatedMemory).filter(k => !existingMemory[k]);
                if (newMemKeys.length > 0) gain += 2;
                
                friendship[npcKey] = Math.min(100, (friendship[npcKey] || 0) + gain);
                
                if (npcMoods[npcKey]) {
                  npcMoods[npcKey].social = Math.min(100, npcMoods[npcKey].social + 10);
                  npcMoods[npcKey].happiness = Math.min(100, npcMoods[npcKey].happiness + 3);
                }

                // Update social engine drives
                if (socialEngine.drives[npcKey]) {
                  socialEngine.drives[npcKey].onConversation();
                }
                
                const discoveries = detectDiscoveries(npcKey, response);
                if (discoveries.length > 0) {
                  socket.emit('friendship-discovery', {
                    npcKey,
                    discoveries,
                    friendship: friendship[npcKey]
                  });
                }
                socket.emit('friendship-update', {
                  npcKey,
                  level: friendship[npcKey]
                });
              }
            }, delay);
            idx++;
          }
        } catch (err) {
          console.error(`[NPC AI Error]:`, err.message);
        }
      }, 1000);
    }
  });

  socket.on('disconnect', () => {
    const player = worldState.players.get(socket.id);
    if (player) {
      console.log(`🔴 ${player.name} disconnected`);
      worldState.players.delete(socket.id);
      worldState.friendship.delete(socket.id);
      io.emit('player-left', { id: socket.id });
    }
  });
});

// ── Detectar si un NPC reveló su color o comida favorita ────
const DISCOVERY_KEYWORDS = {
  Elena: {
    color: ['verde esmeralda', 'verde', 'esmeralda'],
    food: ['sopa de calabaza', 'calabaza', 'hierbas frescas']
  },
  Marco: {
    color: ['azul real', 'azul'],
    food: ['estofado', 'carne con patatas', 'estofado de carne']
  },
  Gruk: {
    color: ['dorado', 'shiny', 'brilla', 'oro', 'gold'],
    food: ['manzana', 'manzanas robadas', 'manzanas']
  },
  Bones: {
    color: ['blanco hueso', 'blanco', 'hueso'],
    food: ['vino tinto', 'vino', 'tinto']
  }
};

function detectDiscoveries(npcKey, message) {
  const keywords = DISCOVERY_KEYWORDS[npcKey];
  if (!keywords) return [];
  const msg = message.toLowerCase();
  const discoveries = [];
  if (keywords.color.some(kw => msg.includes(kw))) discoveries.push('color');
  if (keywords.food.some(kw => msg.includes(kw))) discoveries.push('food');
  return discoveries;
}

// ═══════════════════════════════════════════════════════════
// NPC LIFE SIMULATION - Sistema de vida autónoma
// ═══════════════════════════════════════════════════════════

// Moods de cada NPC (afectan sus respuestas y actividades)
const npcMoods = {
  Elena: { happiness: 80, energy: 70, social: 60 },
  Marco: { happiness: 50, energy: 80, social: 30 },
  Gruk: { happiness: 70, energy: 90, social: 50 },
  Bones: { happiness: 30, energy: 100, social: 20 }
};

// Relaciones entre NPCs
const npcRelationships = {
  Elena: { Marco: 60, Gruk: 45, Bones: 35 },
  Marco: { Elena: 55, Gruk: 25, Bones: 40 },
  Gruk: { Elena: 50, Marco: 20, Bones: 30 },
  Bones: { Elena: 40, Marco: 45, Gruk: 35 }
};

// Log de vida NPC (para debug)
const npcLifeLog = [];
const MAX_LIFE_LOG = 100;

function logNPCLife(event) {
  event.time = Date.now();
  event.timeStr = new Date().toLocaleTimeString();
  npcLifeLog.push(event);
  if (npcLifeLog.length > MAX_LIFE_LOG) npcLifeLog.shift();
}

// ── Simulación de vida: cada 30s actualiza moods ────────────
setInterval(() => {
  for (const [name, mood] of Object.entries(npcMoods)) {
    // Energía se regenera lentamente
    mood.energy = Math.min(100, mood.energy + 1);

    // Social decay (necesitan interacción)
    mood.social = Math.max(0, mood.social - 0.5);

    // Happiness afectada por social y energía
    if (mood.social < 20) mood.happiness = Math.max(10, mood.happiness - 1);
    if (mood.energy > 80) mood.happiness = Math.min(100, mood.happiness + 0.5);

    // Social engine handles the actual seeking behavior now
    if (mood.social < 25) {
      logNPCLife({ type: 'mood', npc: name, detail: `${name} se siente solo (social: ${Math.round(mood.social)})` });
    }
  }
}, 30000);

// ── Interacciones orgánicas entre NPCs (Social Engine) ──────
// Smart system: NPCs only chat when social drives demand it
// Much more efficient than random timers
const NPC_INTERACTIONS_ENABLED = true;

// Process NPC-to-NPC conversations driven by social engine
setInterval(async () => {
  if (!NPC_INTERACTIONS_ENABLED) return;
  if (worldState.players.size === 0 || !hasAI) return;
  if (isRateLimited()) return;

  // Check if social engine queued a conversation
  const conversationReq = socialEngine.getNextConversation();
  if (!conversationReq) return;

  logNPCLife({ 
    type: 'interaction', 
    detail: `${conversationReq.initiator} quiere hablar con ${conversationReq.target} (${conversationReq.topic?.type || 'general'}: ${conversationReq.topic?.topic || ''})` 
  });

  console.log(`[Social] 💬 ${conversationReq.initiator} → ${conversationReq.target} (topic: ${conversationReq.topic?.topic || 'general'})`);

  const activities = getNPCActivities();
  
  // Use social engine's enhanced prompt builder
  const { systemPrompt, userMsg } = socialEngine.buildConversationPrompt(conversationReq, activities);
  
  // Make AI request using existing infrastructure
  const conversation = await getNPCConversation(apiKeys, activities, systemPrompt, userMsg);

  if (conversation) {
    // conversation is now an array: [{npc, msg}, {npc, msg}, ...]
    // Use realistic timing from social engine
    // Delays are CUMULATIVE: each message waits for the previous one
    let accumulatedDelay = 0;
    
    for (let idx = 0; idx < conversation.length; idx++) {
      const { npc: npcKey, msg: message } = conversation[idx];
      if (!npcKey || !message) continue;
      
      accumulatedDelay += socialEngine.getResponseDelay(npcKey, idx);
      const delay = accumulatedDelay;
      
      setTimeout(() => {
        addToHistory(npcKey, message);
        broadcastNPCMessage(npcKey, message);

        if (npcMoods[npcKey]) {
          npcMoods[npcKey].social = Math.min(100, npcMoods[npcKey].social + 15);
          npcMoods[npcKey].happiness = Math.min(100, npcMoods[npcKey].happiness + 5);
        }

        logNPCLife({ type: 'chat', npc: npcKey, message: message.substring(0, 50) });
      }, delay);
    }

    // Lock conversations until all messages have been displayed
    socialEngine.lockConversation(accumulatedDelay + 2000);

    // Notify social engine the conversation happened
    socialEngine.afterConversation(
      conversationReq.participants,
      conversation
    );

    // Update relationships
    const speakerNames = [...new Set(conversation.map(t => t.npc).filter(Boolean))];
    for (let i = 0; i < speakerNames.length; i++) {
      for (let j = i + 1; j < speakerNames.length; j++) {
        const a = speakerNames[i], b = speakerNames[j];
        if (npcRelationships[a]?.[b] !== undefined) {
          npcRelationships[a][b] = Math.min(100, npcRelationships[a][b] + 2);
        }
        if (npcRelationships[b]?.[a] !== undefined) {
          npcRelationships[b][a] = Math.min(100, npcRelationships[b][a] + 2);
        }
      }
    }
  }
}, 8000); // Check every 8s (but social engine controls actual frequency via cooldowns)

// ── AI status: emit only when it CHANGES (no flickering) ────
let _prevAIStatus = 'ok';
setInterval(() => {
  const limited = isRateLimited();
  const newStatus = limited ? 'ratelimit' : 'ok';
  // Only emit when status actually changes
  if (newStatus !== _prevAIStatus) {
    _prevAIStatus = newStatus;
    const debugState = getDebugState();
    io.emit('ai-status', {
      status: newStatus,
      successRate: debugState.successRate,
      requests: debugState.requestCount,
      queue: debugState.queueLength,
      rateLimitSec: limited ? debugState.rateLimitRemainingSec : 0
    });
    console.log(`[AI Status] ${newStatus === 'ok' ? '✅' : '⏳'} → ${newStatus}`);
  }
}, 3000);

// ── Servir archivos estáticos en producción ─────────────────
app.use(express.static('dist'));
app.use('/Sunnyside_World_Assets', express.static('Sunnyside_World_Assets'));

// ── Health check ────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    players: worldState.players.size,
    npcs: worldState.npcs.size,
    uptime: process.uptime(),
    nextHeartbeat: Math.ceil((HEARTBEAT_INTERVAL - (Date.now() % HEARTBEAT_INTERVAL)) / 1000) + 's'
  });
});

// ── DEBUG: Estado completo de Gemini AI ─────────────────────
app.get('/api/debug', (req, res) => {
  const geminiState = getDebugState();
  const npcActivities = getNPCActivities();
  const npcPositions = {};
  for (const [id, npc] of worldState.npcs) {
    npcPositions[npc.name] = {
      x: Math.round(npc.x), y: Math.round(npc.y),
      animation: npc.currentAnimation,
      activity: NPC_ACTIVITIES[npc.name]?.activities[npc._activityIndex]?.name || 'idle'
    };
  }

  res.json({
    gemini: geminiState,
    npcActivities,
    npcPositions,
    players: worldState.players.size,
    chatHistoryLength: getChatHistory().length,
    chatHistory: getChatHistory().slice(-5),
    friendshipState: Object.fromEntries(worldState.friendship),
    serverTime: new Date().toISOString()
  });
});

// ── API: Player Memory / AI Context ─────────────────────────
app.get('/api/player-memory', (req, res) => {
  const memories = {};
  for (const [socketId, player] of worldState.players) {
    const mem = worldState.playerMemory.get(socketId) || {};
    const friendship = worldState.friendship.get(socketId) || {};
    memories[player.name] = {
      socketId: socketId.substring(0, 8) + '...',
      memory: mem,
      friendship,
      position: { x: Math.round(player.x), y: Math.round(player.y) }
    };
  }

  // Also include AI prompt context
  const activities = getNPCActivities();
  const npcNames = Object.keys(NPC_PERSONALITIES);
  const npcDetails = {};
  for (const [key, p] of Object.entries(NPC_PERSONALITIES)) {
    npcDetails[key] = {
      type: p.type,
      role: p.role,
      quirks: p.quirks,
      favoriteColor: p.favoriteColor,
      favoriteFood: p.favoriteFood,
      currentActivity: activities[key] || 'idle'
    };
  }

  res.json({
    players: memories,
    npcPersonalities: npcDetails,
    chatHistory: getChatHistory().slice(-10),
    totalMemoryEntries: Array.from(worldState.playerMemory.values()).reduce((sum, m) => sum + Object.keys(m).length, 0)
  });
});

// ── DEBUG: Test directo de NPC (sin pasar por socket) ───────
app.get('/api/test-npc', async (req, res) => {
  const message = req.query.msg || 'Hola a todos';
  if (!hasAI) {
    return res.status(500).json({ error: 'No API keys configured' });
  }
  const activities = getNPCActivities();
  const result = await testNPCDirect(apiKeys, message, activities);
  res.json(result);
});

// ── DEBUG: Forzar conversación NPC-to-NPC ───────────────────
app.get('/api/test-heartbeat', async (req, res) => {
  if (!hasAI) {
    return res.status(500).json({ error: 'No API keys configured' });
  }
  const activities = getNPCActivities();
  const conversation = await getNPCConversation(apiKeys, activities);
  if (conversation) {
    // conversation is now an array [{npc, msg}]
    let delay = 0;
    for (const { npc: npcKey, msg: message } of conversation) {
      if (!npcKey || !message) continue;
      setTimeout(() => {
        addToHistory(npcKey, message);
        broadcastNPCMessage(npcKey, message);
      }, delay);
      delay += 3000;
    }
  }
  res.json({ success: !!conversation, conversation });
});

// ── DEBUG: Test fallback contextual ─────────────────────────
app.get('/api/test-fallback', (req, res) => {
  const npcName = req.query.npc || null;
  const activities = getNPCActivities();
  const addressed = npcName ? [npcName] : null;
  const fallback = getContextualFallback(activities, addressed);
  res.json({ activities, addressed, fallback });
});

// ── DEBUG: Log de vida NPC (últimos eventos) ────────────────
app.get('/api/npc-life', (req, res) => {
  res.json({
    events: npcLifeLog.slice(-30),
    currentMoods: { ...npcMoods },
    relationships: { ...npcRelationships },
    pendingInteractions: socialEngine.hasPendingConversations() ? socialEngine.conversationQueue.length : 0
  });
});

// ── DEBUG: NPC Memory System ────────────────────────────────
app.get('/api/npc-memory', (req, res) => {
  res.json({
    memory: npcMemory.getDebugInfo(),
    social: socialEngine.getDebugInfo()
  });
});

// ── DEBUG: Try NPC recall ───────────────────────────────────
app.get('/api/npc-recall', (req, res) => {
  const npc = req.query.npc || 'Elena';
  const query = req.query.q || 'shiny';
  const result = npcMemory.tryRecall(npc, query, { maxResults: 5 });
  res.json({ npc, query, result });
});

// ── Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🌻 ═══════════════════════════════════════════════`);
  console.log(`🌻  SUNNYSIDE WORLD SERVER`);
  console.log(`🌻  Running on http://localhost:${PORT}`);
  console.log(`🌻  ${worldState.npcs.size} NPCs active`);
  console.log(`🌻  Heartbeat: cada ${HEARTBEAT_INTERVAL / 60000} min`);
  console.log(`🌻  Groq API:   ${apiKeys.groqKey ? '✅ activa (primary)' : '❌ no configurada'}`);
  console.log(`🌻  Gemini API: ${apiKeys.geminiKey ? '✅ activa (fallback)' : '❌ no configurada'}`);
  console.log(`🌻 ═══════════════════════════════════════════════\n`);
});
