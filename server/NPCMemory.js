// ============================================================
// SUNNYSIDE WORLD - NPC Memory System
// Simulates human-like memory: episodic, semantic, emotional
// With natural recall (can fail, partial, or succeed)
// ============================================================

// ── Memory types ────────────────────────────────────────────
// EPISODIC:  "Elena me dijo que le gustan las calabazas" (events)
// SEMANTIC:  "Elena es granjera" (facts)
// EMOTIONAL: "Me cae bien Elena" (feelings/opinions)

const MAX_MEMORIES_PER_NPC = 80;
const MEMORY_DECAY_INTERVAL = 60000; // 1 min
const BASE_DECAY_RATE = 0.02; // per interval

// Importance thresholds
const IMPORTANCE = {
  TRIVIAL: 1,     // "Elena said hi"
  LOW: 2,         // "Elena was watering plants"
  NORMAL: 3,      // "Elena told me about her grandmother"
  HIGH: 5,        // "Elena said her favorite color is green"
  CRITICAL: 8,    // "Elena saved my life" / emotional event
  PERMANENT: 10   // Core identity facts — never decay
};

class Memory {
  constructor({ npcOwner, type, content, about, tags, importance, emotion }) {
    this.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    this.npcOwner = npcOwner;         // Who owns this memory
    this.type = type;                 // 'episodic', 'semantic', 'emotional'
    this.content = content;           // The actual memory text
    this.about = about || null;       // Who/what it's about (NPC name, player name, place)
    this.tags = tags || [];           // Searchable keywords
    this.importance = importance || IMPORTANCE.NORMAL;
    this.emotion = emotion || 'neutral'; // 'happy','sad','angry','curious','amused','annoyed'
    this.strength = 1.0;             // 1.0 = fresh, decays over time
    this.accessCount = 0;            // How many times recalled
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
  }

  // Rehearsal: accessing a memory strengthens it (like real brains)
  access() {
    this.accessCount++;
    this.lastAccessed = Date.now();
    // Strengthen on recall (spaced repetition effect)
    this.strength = Math.min(1.0, this.strength + 0.15);
  }

  // Natural decay
  decay(rate) {
    // Important memories decay slower
    const protectedRate = rate / (this.importance * 0.5 + 1);
    // Frequently accessed memories decay slower
    const accessBonus = Math.min(0.5, this.accessCount * 0.05);
    this.strength -= Math.max(0.001, protectedRate - accessBonus);
    return this.strength > 0.05; // Return false if memory should be forgotten
  }

  // Relevance score for a query
  relevance(query, contextTags) {
    let score = 0;
    const queryLower = query.toLowerCase();
    const contentLower = this.content.toLowerCase();

    // Direct content match
    if (contentLower.includes(queryLower)) score += 3;
    
    // Word overlap
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    for (const word of queryWords) {
      if (contentLower.includes(word)) score += 1;
    }

    // Tag match
    if (contextTags) {
      for (const tag of contextTags) {
        if (this.tags.includes(tag)) score += 2;
      }
    }

    // About match
    if (this.about && queryLower.includes(this.about.toLowerCase())) score += 2;

    // Recency bonus (recent memories easier to recall)
    const ageMins = (Date.now() - this.lastAccessed) / 60000;
    if (ageMins < 5) score += 2;
    else if (ageMins < 30) score += 1;

    // Emotional memories are more vivid
    if (this.emotion !== 'neutral') score += 1;

    // Strength directly affects recall
    score *= this.strength;

    return score;
  }
}

// ── Per-NPC Memory Store ────────────────────────────────────
class NPCMemoryStore {
  constructor(npcName) {
    this.npcName = npcName;
    this.memories = [];
    this.shortTerm = []; // Last few things that happened (auto-clears)
    this.MAX_SHORT_TERM = 6;
  }

  // Store a new memory
  remember(opts) {
    const mem = new Memory({ npcOwner: this.npcName, ...opts });
    this.memories.push(mem);
    this.shortTerm.push(mem);
    if (this.shortTerm.length > this.MAX_SHORT_TERM) {
      this.shortTerm.shift();
    }

    // Evict weakest memories if over limit
    if (this.memories.length > MAX_MEMORIES_PER_NPC) {
      this.memories.sort((a, b) => {
        // Never evict permanent memories
        if (a.importance >= IMPORTANCE.PERMANENT) return -1;
        if (b.importance >= IMPORTANCE.PERMANENT) return 1;
        return (a.strength * a.importance) - (b.strength * b.importance);
      });
      this.memories = this.memories.slice(-MAX_MEMORIES_PER_NPC);
    }

    return mem;
  }

  // Try to recall something — may return nothing, partial, or full results
  // Simulates the "tip of the tongue" effect
  recall(query, { tags, maxResults = 3, mustSucceed = false } = {}) {
    const scored = this.memories
      .map(m => ({ memory: m, score: m.relevance(query, tags) }))
      .filter(s => s.score > 0.5)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return { success: false, memories: [], feeling: 'nothing' };
    }

    // Simulate recall difficulty
    const topScore = scored[0].score;
    
    if (!mustSucceed) {
      // Very weak memories might fail to recall
      if (topScore < 1.0 && Math.random() < 0.3) {
        return { 
          success: false, 
          memories: [], 
          feeling: 'vague', // "I feel like I heard something about that..."
          hint: scored[0].memory.about || scored[0].memory.tags[0] || null
        };
      }
      
      // Medium memories: partial recall
      if (topScore < 2.0 && Math.random() < 0.2) {
        const partial = scored[0];
        partial.memory.access();
        return {
          success: true,
          memories: [partial.memory],
          feeling: 'fuzzy', // "I think I remember something..."
          confidence: 'low'
        };
      }
    }

    // Successful recall
    const results = scored.slice(0, maxResults);
    results.forEach(r => r.memory.access());

    return {
      success: true,
      memories: results.map(r => r.memory),
      feeling: topScore > 4 ? 'vivid' : 'clear',
      confidence: topScore > 4 ? 'high' : 'medium'
    };
  }

  // Get memories about a specific person/topic
  memoriesAbout(subject) {
    return this.memories
      .filter(m => m.about === subject || m.tags.includes(subject.toLowerCase()))
      .sort((a, b) => b.strength - a.strength);
  }

  // Get emotional stance toward someone
  feelingsAbout(subject) {
    const emotional = this.memories
      .filter(m => m.type === 'emotional' && m.about === subject)
      .sort((a, b) => b.createdAt - a.createdAt);
    
    if (emotional.length === 0) return { emotion: 'neutral', reason: null };
    
    // Most recent strong emotion wins, but accumulation matters
    const emotionCounts = {};
    for (const m of emotional) {
      emotionCounts[m.emotion] = (emotionCounts[m.emotion] || 0) + m.strength;
    }
    
    const dominant = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      emotion: dominant[0],
      intensity: Math.min(1, dominant[1] / 3),
      reason: emotional[0].content
    };
  }

  // Get recent short-term context as text
  getShortTermSummary() {
    if (this.shortTerm.length === 0) return '';
    return this.shortTerm
      .map(m => m.content)
      .join('. ');
  }

  // Decay all memories
  tick() {
    this.memories = this.memories.filter(m => m.decay(BASE_DECAY_RATE));
  }

  // Get memory stats
  stats() {
    const byType = { episodic: 0, semantic: 0, emotional: 0 };
    for (const m of this.memories) byType[m.type] = (byType[m.type] || 0) + 1;
    return {
      total: this.memories.length,
      shortTerm: this.shortTerm.length,
      byType,
      avgStrength: this.memories.length > 0
        ? Math.round(this.memories.reduce((s, m) => s + m.strength, 0) / this.memories.length * 100) / 100
        : 0
    };
  }

  // Serialize for debug/save
  toJSON() {
    return {
      npc: this.npcName,
      stats: this.stats(),
      memories: this.memories
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 20)
        .map(m => ({
          type: m.type,
          content: m.content,
          about: m.about,
          tags: m.tags,
          importance: m.importance,
          emotion: m.emotion,
          strength: Math.round(m.strength * 100) / 100,
          accessCount: m.accessCount,
          ageMin: Math.round((Date.now() - m.createdAt) / 60000)
        }))
    };
  }
}

// ── Global Memory Manager ───────────────────────────────────
class MemoryManager {
  constructor() {
    this.stores = {};
    this._decayTimer = null;
  }

  init(npcNames) {
    for (const name of npcNames) {
      this.stores[name] = new NPCMemoryStore(name);
    }
    this._seedCoreMemories();
    this._startDecay();
  }

  // Seed NPCs with their core knowledge about each other
  _seedCoreMemories() {
    const relationships = {
      Elena: {
        Marco: { facts: ['Marco es el guardia de la aldea', 'Marco escribe poesía en secreto'], emotion: 'happy', tags: ['marco', 'guardia', 'poesía'] },
        Gruk: { facts: ['Gruk es un goblin curioso que vive cerca del bosque', 'A Gruk le gustan las cosas brillantes'], emotion: 'amused', tags: ['gruk', 'goblin', 'shiny'] },
        Bones: { facts: ['Bones es un esqueleto antiguo que fue bibliotecario', 'Bones echa de menos el vino'], emotion: 'curious', tags: ['bones', 'esqueleto', 'bibliotecario'] },
        self: { facts: ['Me encanta cuidar mis plantas y hierbas', 'Mi abuela me enseñó los remedios', 'Mi sopa de calabaza es la mejor de la aldea'], tags: ['plantas', 'hierbas', 'abuela', 'calabaza'] }
      },
      Marco: {
        Elena: { facts: ['Elena es la granjera y herbolaria de la aldea', 'Elena siempre huele a lavanda', 'Elena hace la mejor sopa de calabaza'], emotion: 'happy', tags: ['elena', 'granjera', 'lavanda'] },
        Gruk: { facts: ['Gruk es un goblin que ronda la aldea', 'Gruk no es peligroso pero es molesto'], emotion: 'annoyed', tags: ['gruk', 'goblin', 'molesto'] },
        Bones: { facts: ['Bones es un esqueleto filósofo', 'Bones no duerme nunca, útil para guardia nocturna'], emotion: 'neutral', tags: ['bones', 'esqueleto', 'guardia'] },
        self: { facts: ['Fui soldado antes de retirarme aquí', 'Protejo esta aldea con mi vida', 'Escribo poesía cuando nadie mira'], tags: ['soldado', 'guardia', 'poesía', 'aldea'] }
      },
      Gruk: {
        Elena: { facts: ['Elena da comida a Gruk a veces', 'Elena huele bonito', 'Elena tiene plantas shiny'], emotion: 'happy', tags: ['elena', 'comida', 'shiny'] },
        Marco: { facts: ['Marco es grande y da miedo', 'Marco persigue a Gruk cuando roba manzanas'], emotion: 'annoyed', tags: ['marco', 'grande', 'manzanas'] },
        Bones: { facts: ['Bones es huesos que hablan', 'Bones no tiene shiny pero cuenta cosas interesantes'], emotion: 'curious', tags: ['bones', 'huesos', 'historias'] },
        self: { facts: ['Gruk buscar shiny siempre', 'Gruk coleccionar botones', 'Gruk no ser malo, solo curioso'], tags: ['shiny', 'botones', 'curioso'] }
      },
      Bones: {
        Elena: { facts: ['Elena es amable y no tiene miedo de un esqueleto', 'Elena me trae flores a veces'], emotion: 'happy', tags: ['elena', 'amable', 'flores'] },
        Marco: { facts: ['Marco es un hombre de honor', 'Marco me respeta como compañero de guardia nocturna'], emotion: 'neutral', tags: ['marco', 'honor', 'guardia'] },
        Gruk: { facts: ['Gruk es fascinantemente primitivo', 'Gruk intentó robarm un hueso una vez pensando que era shiny'], emotion: 'amused', tags: ['gruk', 'primitivo', 'hueso'] },
        self: { facts: ['Fui bibliotecario en vida', 'Echo de menos el vino tinto', 'Llevo siglos sin poder cerrar los ojos'], tags: ['bibliotecario', 'vino', 'muerte', 'libros'] }
      }
    };

    for (const [npc, relations] of Object.entries(relationships)) {
      const store = this.stores[npc];
      if (!store) continue;

      for (const [target, data] of Object.entries(relations)) {
        const about = target === 'self' ? npc : target;
        for (const fact of data.facts) {
          store.remember({
            type: 'semantic',
            content: fact,
            about,
            tags: data.tags || [],
            importance: IMPORTANCE.PERMANENT,
            emotion: data.emotion || 'neutral'
          });
        }
        if (target !== 'self' && data.emotion) {
          store.remember({
            type: 'emotional',
            content: `Siento ${data.emotion === 'happy' ? 'aprecio' : data.emotion === 'annoyed' ? 'fastidio' : data.emotion === 'curious' ? 'curiosidad' : data.emotion === 'amused' ? 'diversión' : 'indiferencia'} hacia ${target}`,
            about: target,
            tags: [target.toLowerCase()],
            importance: IMPORTANCE.HIGH,
            emotion: data.emotion
          });
        }
      }
    }
  }

  _startDecay() {
    this._decayTimer = setInterval(() => {
      for (const store of Object.values(this.stores)) {
        store.tick();
      }
    }, MEMORY_DECAY_INTERVAL);
  }

  // ── Public API ──────────────────────────────────────────

  // Store a new experience for an NPC
  addMemory(npcName, opts) {
    const store = this.stores[npcName];
    if (!store) return null;
    return store.remember(opts);
  }

  // When an NPC hears/sees a conversation
  observeConversation(npcName, speaker, message, context) {
    const store = this.stores[npcName];
    if (!store) return;

    // Episodic: what happened
    store.remember({
      type: 'episodic',
      content: `${speaker} dijo: "${message.substring(0, 80)}"`,
      about: speaker,
      tags: this._extractTags(message),
      importance: this._assessImportance(message, speaker, npcName),
      emotion: this._inferEmotion(message, npcName)
    });

    // Try to extract semantic facts
    const facts = this._extractFacts(speaker, message);
    for (const fact of facts) {
      store.remember({
        type: 'semantic',
        content: fact.content,
        about: fact.about || speaker,
        tags: fact.tags,
        importance: IMPORTANCE.HIGH,
        emotion: 'neutral'
      });
    }
  }

  // When two NPCs interact
  recordInteraction(npc1, npc2, topic, outcome) {
    for (const npc of [npc1, npc2]) {
      const other = npc === npc1 ? npc2 : npc1;
      const store = this.stores[npc];
      if (!store) continue;

      store.remember({
        type: 'episodic',
        content: `Hablé con ${other} sobre ${topic}. ${outcome || ''}`.trim(),
        about: other,
        tags: [other.toLowerCase(), ...this._extractTags(topic)],
        importance: IMPORTANCE.NORMAL,
        emotion: 'neutral'
      });
    }
  }

  // Try to remember something
  tryRecall(npcName, query, opts) {
    const store = this.stores[npcName];
    if (!store) return { success: false, memories: [], feeling: 'nothing' };
    return store.recall(query, opts);
  }

  // Get what an NPC knows/feels about someone
  getRelationshipContext(npcName, aboutName) {
    const store = this.stores[npcName];
    if (!store) return { facts: [], feeling: { emotion: 'neutral' } };

    const facts = store.memoriesAbout(aboutName).slice(0, 5);
    const feeling = store.feelingsAbout(aboutName);

    return { facts, feeling };
  }

  // Build memory context string for AI prompt
  buildMemoryContext(npcName, conversationParticipants) {
    const store = this.stores[npcName];
    if (!store) return '';

    const parts = [];

    // Short-term: what just happened
    const shortTerm = store.getShortTermSummary();
    if (shortTerm) {
      parts.push(`[Reciente] ${shortTerm}`);
    }

    // What do I know about each participant?
    for (const participant of conversationParticipants) {
      if (participant === npcName) continue;
      const rel = this.getRelationshipContext(npcName, participant);
      if (rel.facts.length > 0) {
        const factTexts = rel.facts.slice(0, 3).map(f => f.content);
        parts.push(`[Sobre ${participant}] ${factTexts.join('. ')}. Siento: ${rel.feeling.emotion}`);
      }
    }

    return parts.join('\n');
  }

  // Get all memory stats for debug
  getDebugInfo() {
    const info = {};
    for (const [name, store] of Object.entries(this.stores)) {
      info[name] = store.toJSON();
    }
    return info;
  }

  // ── Private helpers ─────────────────────────────────────

  _extractTags(text) {
    const tags = [];
    const lower = text.toLowerCase();
    
    // NPC names
    for (const name of ['elena', 'marco', 'gruk', 'bones']) {
      if (lower.includes(name)) tags.push(name);
    }

    // Topics
    const topicWords = {
      'planta|hierba|flor|jardín|cultivo|regar': 'plantas',
      'shiny|brillante|oro|tesoro|botón': 'shiny',
      'guardia|patrulla|pelea|espada|proteger': 'guardia',
      'hueso|muerte|morir|vida|filosof': 'filosofía',
      'comida|comer|cocinar|sopa|manzana': 'comida',
      'libro|leer|historia|saber|conocer': 'conocimiento',
      'mina|piedra|cavar|excavar|pico': 'minería',
      'amigo|querer|cariño|solo|compañía': 'amistad',
      'triste|feliz|contento|enfadado|miedo': 'emociones'
    };

    for (const [pattern, tag] of Object.entries(topicWords)) {
      if (new RegExp(pattern, 'i').test(lower)) tags.push(tag);
    }

    return [...new Set(tags)];
  }

  _assessImportance(message, speaker, listener) {
    const lower = message.toLowerCase();
    
    // Personal revelations are important
    if (/mi nombre|me llamo|mi favorit|mi familia|te cuento un secreto/i.test(lower)) {
      return IMPORTANCE.HIGH;
    }
    
    // Direct address is more important
    if (lower.includes(listener.toLowerCase())) {
      return IMPORTANCE.NORMAL + 1;
    }

    // Questions directed at the NPC
    if (/\?|¿/.test(message) && lower.includes(listener.toLowerCase())) {
      return IMPORTANCE.NORMAL + 1;
    }

    // Short greetings are less important
    if (message.length < 15) return IMPORTANCE.LOW;

    return IMPORTANCE.NORMAL;
  }

  _inferEmotion(message, npcName) {
    const lower = message.toLowerCase();
    
    if (/jaja|jeje|gracioso|divertido|risa/i.test(lower)) return 'amused';
    if (/gracias|amable|genial|increíble|me gusta/i.test(lower)) return 'happy';
    if (/triste|pena|lástima|lo siento|pobre/i.test(lower)) return 'sad';
    if (/idiota|tonto|feo|odio|cállate/i.test(lower)) return 'angry';
    if (/misterio|secreto|curioso|interesante|¿por qué/i.test(lower)) return 'curious';
    
    return 'neutral';
  }

  _extractFacts(speaker, message) {
    const facts = [];
    const lower = message.toLowerCase();

    // "My name is X"
    const nameMatch = lower.match(/(?:me llamo|mi nombre es|soy) (\w+)/i);
    if (nameMatch) {
      facts.push({
        content: `${speaker} se llama ${nameMatch[1]}`,
        about: speaker,
        tags: ['nombre', speaker.toLowerCase()]
      });
    }

    // "I like X"
    const likeMatch = lower.match(/me (?:gusta|encanta|fascina) (?:mucho )?(?:el |la |los |las )?(.{3,25}?)(?:\.|,|$)/i);
    if (likeMatch) {
      facts.push({
        content: `A ${speaker} le gusta ${likeMatch[1]}`,
        about: speaker,
        tags: ['gustos', speaker.toLowerCase()]
      });
    }

    // "I work as X"
    const workMatch = lower.match(/(?:trabajo (?:como|de)|soy) (.{3,20}?) (?:de profesión|en|$)/i);
    if (workMatch) {
      facts.push({
        content: `${speaker} trabaja como ${workMatch[1]}`,
        about: speaker,
        tags: ['trabajo', speaker.toLowerCase()]
      });
    }

    return facts;
  }
}

// Singleton
export const npcMemory = new MemoryManager();
export { IMPORTANCE };
