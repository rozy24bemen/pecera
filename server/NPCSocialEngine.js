// ============================================================
// SUNNYSIDE WORLD - NPC Social Engine
// Autonomous NPC-to-NPC conversations with realistic dynamics
// NPCs seek each other, form intentions, chat naturally
// ============================================================

import { NPC_PERSONALITIES } from './NPCPersonalities.js';
import { npcMemory, IMPORTANCE } from './NPCMemory.js';

// ── Chat Realism Rules ──────────────────────────────────────
// These rules define HOW the NPCs chat to feel like real people

export const CHAT_RULES = {
  // Personality affects response time (ms base + random)
  // These are PER-MESSAGE delays (added cumulatively)
  typingSpeed: {
    Elena: { base: 3600, variance: 2400 },    // Warm, thinks before speaking
    Marco: { base: 1800, variance: 1200 },    // Quick, decisive
    Gruk: { base: 2700, variance: 3600 },     // Erratic
    Bones: { base: 6000, variance: 3000 },    // Deliberate, philosophical
  },

  // How likely each NPC is to respond to a general message (0-1)
  talkativeness: {
    Elena: 0.7,   // Social, likes to chat
    Marco: 0.35,  // Only speaks when relevant
    Gruk: 0.55,   // Chimes in randomly
    Bones: 0.4,   // Speaks when philosophical or punny
  },

  // How likely to initiate conversation
  initiativeChance: {
    Elena: 0.4,   // Often starts conversations
    Marco: 0.15,  // Rarely initiates unless important
    Gruk: 0.5,    // Often blurts things out
    Bones: 0.25,  // Sometimes shares a thought
  },

  // Maximum message length tendency (chars)
  verbosity: {
    Elena: 60,   // Medium, warm
    Marco: 35,   // Short, direct
    Gruk: 40,    // Short, simple
    Bones: 70,   // Longer, eloquent
  },

  // Topics each NPC gravitates toward
  interests: {
    Elena: ['plantas', 'comida', 'amistad', 'salud', 'el tiempo', 'la aldea', 'recuerdos'],
    Marco: ['guardia', 'seguridad', 'entrenamiento', 'la aldea', 'deber'],
    Gruk: ['shiny', 'comida', 'exploración', 'botones', 'manzanas'],
    Bones: ['filosofía', 'muerte', 'libros', 'vino', 'existencia', 'humor'],
  },

  // NPCs that naturally gravitate to each other
  socialPreferences: {
    Elena: { Marco: 0.6, Gruk: 0.5, Bones: 0.4 },
    Marco: { Elena: 0.5, Bones: 0.4, Gruk: 0.2 },
    Gruk: { Elena: 0.6, Bones: 0.3, Marco: 0.2 },
    Bones: { Elena: 0.5, Marco: 0.4, Gruk: 0.3 },
  }
};

// ── Social Drives ───────────────────────────────────────────
// Each NPC has internal needs that motivate behavior

class SocialDrive {
  constructor(npcName) {
    this.npcName = npcName;
    this.loneliness = 30;          // 0-100, increases over time
    this.curiosity = 50;           // Desire to learn/ask things
    this.expressiveness = 40;      // Desire to share/tell things
    this.helpfulness = 20;         // Desire to help someone
    this.currentIntent = null;     // What they want to do right now
    this.intentTarget = null;      // Who they want to interact with
    this.intentTopic = null;       // What they want to talk about
    this.lastConversation = 0;     // Timestamp
    this.conversationCooldown = 0; // Don't chat again too soon
  }

  // Update drives over time
  tick(deltaMs) {
    const deltaSec = deltaMs / 1000;

    // Loneliness increases when not talking
    const timeSinceChat = Date.now() - this.lastConversation;
    if (timeSinceChat > 60000) { // More than 1 min since last chat
      this.loneliness = Math.min(100, this.loneliness + deltaSec * 0.15);
    }

    // Curiosity fluctuates
    this.curiosity = Math.min(100, this.curiosity + deltaSec * 0.05 * (Math.random() - 0.3));
    this.curiosity = Math.max(0, this.curiosity);

    // Expressiveness builds up (things to say)
    this.expressiveness = Math.min(100, this.expressiveness + deltaSec * 0.08);

    // Cooldown
    this.conversationCooldown = Math.max(0, this.conversationCooldown - deltaMs);
  }

  // Should this NPC try to start a conversation?
  shouldInitiate() {
    if (this.conversationCooldown > 0) return false;
    
    const initiative = CHAT_RULES.initiativeChance[this.npcName] || 0.3;
    const urgency = (this.loneliness + this.expressiveness) / 200;
    
    return Math.random() < initiative * urgency;
  }

  // Pick who to talk to
  pickTarget(nearbyNPCs) {
    if (nearbyNPCs.length === 0) return null;

    const prefs = CHAT_RULES.socialPreferences[this.npcName] || {};
    const scored = nearbyNPCs
      .filter(n => n !== this.npcName)
      .map(name => {
        let score = prefs[name] || 0.3;
        // Boost if we have memories about them
        const rel = npcMemory.getRelationshipContext(this.npcName, name);
        if (rel.feeling.emotion === 'happy') score += 0.2;
        if (rel.feeling.emotion === 'curious') score += 0.15;
        // Random factor
        score += Math.random() * 0.3;
        return { name, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored.length > 0 ? scored[0].name : null;
  }

  // Pick a conversation topic
  pickTopic(target) {
    const topics = [];
    const interests = CHAT_RULES.interests[this.npcName] || [];

    // Memory-based topics (something I remember about them)
    const recall = npcMemory.tryRecall(this.npcName, target, { tags: [target.toLowerCase()], maxResults: 2 });
    if (recall.success && recall.memories.length > 0) {
      topics.push({
        type: 'memory',
        topic: recall.memories[0].content,
        weight: 3
      });
    }

    // Interest-based topics
    const randomInterest = interests[Math.floor(Math.random() * interests.length)];
    if (randomInterest) {
      topics.push({ type: 'interest', topic: randomInterest, weight: 2 });
    }

    // Activity-based (commenting on what someone is doing)
    topics.push({ type: 'activity', topic: 'actividad actual', weight: 1.5 });

    // Environmental/random
    const envTopics = [
      'qué bonito día', 'hace calor hoy', 'oí un ruido raro',
      'vi algo moverse en el bosque', 'tengo hambre', 'qué hora es',
      'ayer soñé algo raro', 'has visto algo interesante',
    ];
    topics.push({
      type: 'environmental',
      topic: envTopics[Math.floor(Math.random() * envTopics.length)],
      weight: 1
    });

    // Weighted random selection
    const totalWeight = topics.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * totalWeight;
    for (const t of topics) {
      r -= t.weight;
      if (r <= 0) return t;
    }
    return topics[0];
  }

  // After having a conversation
  onConversation() {
    this.lastConversation = Date.now();
    this.loneliness = Math.max(0, this.loneliness - 30);
    this.expressiveness = Math.max(0, this.expressiveness - 20);
    this.conversationCooldown = 90000 + Math.random() * 120000; // 90s-210s cooldown
  }
}

// ── Conversation Generator ──────────────────────────────────
// Creates the context and prompts for multi-NPC conversations

export class NPCSocialEngine {
  constructor() {
    this.drives = {};
    this.conversationQueue = []; // Pending conversations to process
    this.activeConversation = null;
    this.conversationLock = false;  // Prevents overlapping conversations
    this.conversationLockUntil = 0; // Timestamp when lock expires
    this.lastTickTime = Date.now();
    this._onConversationCallback = null;
    this._getNPCPositions = null;
  }

  init(npcNames) {
    for (const name of npcNames) {
      this.drives[name] = new SocialDrive(name);
    }
  }

  // Set callback for when a conversation should happen
  onConversation(callback) {
    this._onConversationCallback = callback;
  }

  // Set function to get NPC positions
  setPositionProvider(fn) {
    this._getNPCPositions = fn;
  }

  // Main tick — called every few seconds
  tick() {
    const now = Date.now();
    const delta = now - this.lastTickTime;
    this.lastTickTime = now;

    // Update all drives
    for (const drive of Object.values(this.drives)) {
      drive.tick(delta);
    }

    // Check if any NPC wants to initiate
    const initiators = Object.values(this.drives)
      .filter(d => d.shouldInitiate())
      .sort((a, b) => (b.loneliness + b.expressiveness) - (a.loneliness + a.expressiveness));

    if (initiators.length === 0) return null;

    const initiator = initiators[0];
    const nearbyNPCs = this._getNearbyNPCs(initiator.npcName);

    if (nearbyNPCs.length === 0) {
      // NPC is alone — maybe they'll seek someone out
      return this._createSeekIntent(initiator);
    }

    const target = initiator.pickTarget(nearbyNPCs);
    if (!target) return null;

    const topicInfo = initiator.pickTopic(target);

    // Create conversation request
    const conversationReq = {
      type: 'npc-chat',
      initiator: initiator.npcName,
      target,
      topic: topicInfo,
      participants: this._getConversationParticipants(initiator.npcName, target, nearbyNPCs),
      timestamp: Date.now()
    };

    this.conversationQueue.push(conversationReq);
    return conversationReq;
  }

  // Get who might join a conversation between two NPCs
  _getConversationParticipants(initiator, target, nearbyNPCs) {
    const participants = [initiator, target];

    // Other nearby NPCs might join based on talkativeness
    for (const npc of nearbyNPCs) {
      if (npc === initiator || npc === target) continue;
      const talkativeness = CHAT_RULES.talkativeness[npc] || 0.3;
      if (Math.random() < talkativeness * 0.5) { // 50% of normal talkativeness to join others' chat
        participants.push(npc);
      }
    }

    return participants;
  }

  // Get NPCs near a given NPC
  _getNearbyNPCs(npcName) {
    if (!this._getNPCPositions) return Object.keys(this.drives).filter(n => n !== npcName);

    const positions = this._getNPCPositions();
    const myPos = positions[npcName];
    if (!myPos) return [];

    const HEARING_RANGE = 350; // pixels
    const nearby = [];

    for (const [name, pos] of Object.entries(positions)) {
      if (name === npcName) continue;
      const dx = pos.x - myPos.x;
      const dy = pos.y - myPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < HEARING_RANGE) {
        nearby.push(name);
      }
    }

    return nearby;
  }

  // Create intent for NPC to walk toward someone
  _createSeekIntent(drive) {
    const prefs = CHAT_RULES.socialPreferences[drive.npcName] || {};
    const candidates = Object.entries(prefs).sort((a, b) => b[1] - a[1]);

    if (candidates.length === 0) return null;

    // Pick with some randomness
    const target = Math.random() < 0.6
      ? candidates[0][0]
      : candidates[Math.floor(Math.random() * candidates.length)][0];

    drive.currentIntent = 'seek';
    drive.intentTarget = target;

    return {
      type: 'seek',
      npc: drive.npcName,
      target,
      reason: drive.loneliness > 60 ? 'lonely' : 'wants_to_chat'
    };
  }

  // Build the AI prompt for a multi-NPC conversation
  buildConversationPrompt(conversationReq, npcActivities) {
    const { initiator, target, topic, participants } = conversationReq;

    // Build memory context for each participant
    const memoryContexts = {};
    for (const name of participants) {
      memoryContexts[name] = npcMemory.buildMemoryContext(name, participants);
    }

    const activityContext = participants
      .map(n => `${n}: ${npcActivities[n] || 'idle'}`)
      .join(', ');

    let topicHint = '';
    if (topic) {
      switch (topic.type) {
        case 'memory':
          topicHint = `${initiator} recuerda algo: "${topic.topic}" y quiere comentarlo.`;
          break;
        case 'interest':
          topicHint = `${initiator} quiere hablar de: ${topic.topic}.`;
          break;
        case 'activity':
          topicHint = `${initiator} comenta sobre lo que están haciendo.`;
          break;
        case 'environmental':
          topicHint = `${initiator} comenta: "${topic.topic}".`;
          break;
      }
    }

    const npcDescs = participants.map(name => {
      const p = NPC_PERSONALITIES[name];
      const memCtx = memoryContexts[name] || '';
      return `${name}(${p.type},${p.role}): ${p.quirks[0]}${memCtx ? '\n  Recuerdos: ' + memCtx.substring(0, 200) : ''}`;
    }).join('\n');

    const systemPrompt = `Eres el narrador de NPCs en Sunnyside World. Genera una conversación SECUENCIAL entre NPCs.

PARTICIPANTES:
${npcDescs}

ACTIVIDADES: ${activityContext}

FORMATO: Array JSON de turnos en ORDEN CRONOLÓGICO. Cada turno es un mensaje de un NPC.
[{"npc":"Nombre","msg":"texto"},{"npc":"Nombre2","msg":"texto"},...]

REGLAS CRÍTICAS:
- Genera entre 2 y 4 turnos SECUENCIALES.
- Un NPC puede hablar más de una vez si la conversación lo requiere.
- ${initiator} SIEMPRE habla primero (turno 1).
- Cada turno es una REACCIÓN al turno anterior. No pueden responder a algo que no se ha dicho aún.
- Max 50 caracteres por mensaje. Corto y natural.
- Mantener personalidad: Elena=maternal/cariño, Marco=seco/directo, Gruk=tercera persona/shiny, Bones=filosófico/huesos.
- La conversación debe tener SENTIDO de principio a fin. Cada mensaje conecta con el anterior.
- Sin emojis. Español. JSON puro sin markdown.`;

    const userMsg = `[Conversación NPC-NPC]
${topicHint}
${initiator} inicia hablando con/cerca de ${target}.
Participantes cercanos: ${participants.join(', ')}.
Genera 2-4 turnos secuenciales. Array JSON puro. ${initiator} habla primero.`;

    return { systemPrompt, userMsg };
  }

  // Build enhanced prompt for player-NPC conversation with memory
  buildPlayerConversationPrompt(playerName, playerMessage, npcActivities, playerMemory, npcMoods, nearbyNPCs) {
    const participants = [...nearbyNPCs];

    // Build memory context for each nearby NPC about the player
    const memoryHints = {};
    for (const npc of participants) {
      const recall = npcMemory.tryRecall(npc, playerName, { tags: [playerName.toLowerCase()], maxResults: 3 });
      const npcMemories = npcMemory.buildMemoryContext(npc, [playerName, ...participants]);
      memoryHints[npc] = {
        recall,
        context: npcMemories
      };
    }

    const npcDescs = Object.entries(NPC_PERSONALITIES).map(([key, p]) => {
      const act = npcActivities?.[key] || 'descansando';
      const mood = npcMoods?.[key];
      const moodStr = mood
        ? ` Ánimo:${mood.happiness > 70 ? 'feliz' : mood.happiness > 40 ? 'normal' : 'triste'},social:${mood.social > 50 ? 'sociable' : 'solo'}`
        : '';
      const memCtx = memoryHints[key]?.context || '';
      const isNearby = participants.includes(key);
      return `${key}(${p.type},${p.role}): ${p.quirks[0]}.${moodStr} [${act}]${isNearby ? ' ✓CERCA' : ' ✗LEJOS'}${memCtx ? '\n  Recuerdos: ' + memCtx.substring(0, 150) : ''}`;
    }).join('\n');

    const systemPrompt = `Eres el narrador de 4 NPCs en Sunnyside World. Responde SOLO JSON puro, sin texto extra.

${npcDescs}

FORMATO OBLIGATORIO (JSON puro, sin markdown):
{"Elena":"texto","Marco":null,"Gruk":null,"Bones":null}

REGLAS DE CHAT REALISTA:
- Solo NPCs marcados ✓CERCA pueden responder. Los demás = null obligatorio.
- Solo 1-2 NPCs responden normalmente. No todos hablan siempre.
- Si el jugador HABLA CON un NPC específico, ESE NPC responde primero.
- Los demás pueden reaccionar/añadir si es natural, pero no siempre.
- MÁXIMO 55 caracteres por frase. Ultra-corto como chat real.
- Español. Sin emojis. En personaje SIEMPRE.
- Elena: maternal, plantas, llama "cariño". Marco: seco, directo, sarcástico. Gruk: tercera persona, obsesionado con shiny. Bones: filosófico, chistes de huesos.
- No dicen que son IA. Revelan personalidad gradualmente.
- Pueden preguntar al jugador sobre su vida.
- USA los recuerdos de cada NPC cuando sea relevante.
- Pueden reaccionar a lo que OTRO NPC dijo antes (conversación encadenada).
- A veces un NPC puede estar de acuerdo o discrepar con otro NPC.
- Pueden referirse a lo que están haciendo en ese momento.`;

    return systemPrompt;
  }

  // After a conversation happens, update drives and memories
  // messages can be array format [{npc, msg}] or object format {npc: msg}
  afterConversation(participants, messages) {
    // Normalize to array of {speaker, text}
    let turns;
    if (Array.isArray(messages)) {
      turns = messages.map(t => ({ speaker: t.npc, text: t.msg }));
    } else {
      turns = Object.entries(messages).filter(([k, v]) => v).map(([k, v]) => ({ speaker: k, text: v }));
    }

    for (const name of participants) {
      const drive = this.drives[name];
      if (drive) {
        drive.onConversation();
      }

      // Store memories of the conversation
      for (const turn of turns) {
        if (turn.text && turn.speaker !== name) {
          npcMemory.observeConversation(name, turn.speaker, turn.text, {});
        }
      }
    }

    // Record the interaction for relationship tracking
    const speakers = [...new Set(turns.map(t => t.speaker))];
    if (speakers.length >= 2) {
      npcMemory.recordInteraction(speakers[0], speakers[1],
        turns[0]?.text?.substring(0, 30) || 'chat',
        'conversación normal'
      );
    }
  }

  // NPC wants to seek someone — return movement target
  getSeekTargets() {
    const seeks = [];
    for (const [name, drive] of Object.entries(this.drives)) {
      if (drive.currentIntent === 'seek' && drive.intentTarget) {
        seeks.push({
          npc: name,
          target: drive.intentTarget,
          reason: 'social'
        });
        // Clear intent after providing it
        drive.currentIntent = null;
        drive.intentTarget = null;
      }
    }
    return seeks;
  }

  // Consume next conversation from queue (respects lock)
  getNextConversation() {
    // Don't start new conversation if one is still displaying
    if (Date.now() < this.conversationLockUntil) return null;
    this.conversationLock = false;
    return this.conversationQueue.shift() || null;
  }

  // Lock conversations for a duration (while messages are displaying)
  lockConversation(durationMs) {
    this.conversationLock = true;
    this.conversationLockUntil = Date.now() + durationMs;
  }

  // Is conversation locked?
  isLocked() {
    return Date.now() < this.conversationLockUntil;
  }

  // Check if queue has pending conversations
  hasPendingConversations() {
    return this.conversationQueue.length > 0;
  }

  // Should NPC respond to a player message? (based on talkativeness)
  shouldNPCRespond(npcName, playerMessage, isDirectlyAddressed) {
    if (isDirectlyAddressed) return true;

    const talkativeness = CHAT_RULES.talkativeness[npcName] || 0.3;
    const drive = this.drives[npcName];

    let chance = talkativeness;

    // Boost if lonely
    if (drive && drive.loneliness > 50) chance += 0.15;
    // Boost if topic matches interests
    const interests = CHAT_RULES.interests[npcName] || [];
    const msgLower = playerMessage.toLowerCase();
    if (interests.some(i => msgLower.includes(i))) chance += 0.2;

    return Math.random() < chance;
  }

  // Get response delay for a specific NPC (realistic typing)
  // Returns the INDIVIDUAL delay for this message (caller must accumulate)
  getResponseDelay(npcName, index) {
    const speed = CHAT_RULES.typingSpeed[npcName] || { base: 3000, variance: 1500 };
    const baseDelay = index === 0 ? 1800 : 3000; // First responder waits, others wait longer
    return baseDelay + speed.base + Math.random() * speed.variance;
  }

  // Get debug info
  getDebugInfo() {
    const info = {};
    for (const [name, drive] of Object.entries(this.drives)) {
      info[name] = {
        loneliness: Math.round(drive.loneliness),
        curiosity: Math.round(drive.curiosity),
        expressiveness: Math.round(drive.expressiveness),
        intent: drive.currentIntent,
        intentTarget: drive.intentTarget,
        cooldownMs: Math.round(drive.conversationCooldown),
        lastConversationAgo: Math.round((Date.now() - drive.lastConversation) / 1000) + 's'
      };
    }
    return {
      drives: info,
      queueLength: this.conversationQueue.length,
      chatRules: {
        talkativeness: CHAT_RULES.talkativeness,
        typingSpeed: Object.fromEntries(
          Object.entries(CHAT_RULES.typingSpeed).map(([k, v]) => [k, `${v.base}+${v.variance}ms`])
        )
      }
    };
  }
}

// Singleton
export const socialEngine = new NPCSocialEngine();
