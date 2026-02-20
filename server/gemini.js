// ============================================================
// SUNNYSIDE WORLD - AI Service v4
// Multi-provider: Groq (primary) + Gemini (fallback)
// Groq free tier: 14,400 req/day, 30 RPM — 30x more than Gemini
// ============================================================

import { NPC_PERSONALITIES } from './NPCPersonalities.js';

// ── Provider configuration ──────────────────────────────────
const GROQ_MODEL = 'llama-3.1-8b-instant'; // 14,400 RPD free tier
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
];
const geminiExhausted = new Map();
let geminiModelIdx = 0;

function getGeminiModel() {
  const now = Date.now();
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const idx = (geminiModelIdx + i) % GEMINI_MODELS.length;
    const model = GEMINI_MODELS[idx];
    if (now >= (geminiExhausted.get(model) || 0)) {
      geminiModelIdx = idx;
      return model;
    }
  }
  return GEMINI_MODELS[geminiModelIdx];
}

function markGeminiExhausted(model) {
  geminiExhausted.set(model, Date.now() + 60 * 60 * 1000);
  geminiModelIdx = (GEMINI_MODELS.indexOf(model) + 1) % GEMINI_MODELS.length;
  console.log(`[AI] 🔄 Gemini ${model} agotado → ${getGeminiModel()}`);
}

// ── Estado global ───────────────────────────────────────────
const state = {
  provider: 'none',
  model: '',
  rateLimitedUntil: 0,
  requestCount: 0,
  successCount: 0,
  failCount: 0,
  repairCount: 0,
  fallbackCount: 0,
  lastRequest: null,
  lastResponse: null,
  lastError: null,
  queueLength: 0,
  avgResponseMs: 0,
  _responseTimes: [],
};

export function getDebugState() {
  const exhausted = [];
  for (const [m, t] of geminiExhausted) if (Date.now() < t) exhausted.push(m);
  return {
    ...state,
    _responseTimes: undefined,
    uptime: Math.round(process.uptime()),
    rateLimitActive: Date.now() < state.rateLimitedUntil,
    rateLimitRemainingSec: Math.max(0, Math.ceil((state.rateLimitedUntil - Date.now()) / 1000)),
    successRate: state.requestCount > 0 ? Math.round((state.successCount / state.requestCount) * 100) + '%' : 'N/A',
    geminiExhausted: exhausted,
  };
}

// ── Historial de chat ───────────────────────────────────────
const MAX_HISTORY = 12;
const chatHistory = [];

export function addToHistory(sender, text) {
  chatHistory.push({ sender, text, time: Date.now() });
  if (chatHistory.length > MAX_HISTORY) chatHistory.shift();
}

export function getChatHistory() {
  return [...chatHistory];
}

// ── Queue ───────────────────────────────────────────────────
const REQUEST_SPACING_MS = 2200;
let lastRequestTime = 0;
const requestQueue = [];
let processingQueue = false;

export function isRateLimited() {
  return Date.now() < state.rateLimitedUntil;
}

async function enqueueRequest(fn) {
  if (Date.now() < state.rateLimitedUntil) {
    const waitMs = state.rateLimitedUntil - Date.now();
    if (waitMs <= 15000) {
      await new Promise(r => setTimeout(r, waitMs + 300));
    } else {
      return null;
    }
  }
  return new Promise((resolve, reject) => {
    requestQueue.push({ fn, resolve, reject });
    state.queueLength = requestQueue.length;
    processQueue();
  });
}

async function processQueue() {
  if (processingQueue) return;
  processingQueue = true;
  while (requestQueue.length > 0) {
    const { fn, resolve, reject } = requestQueue.shift();
    state.queueLength = requestQueue.length;
    if (Date.now() < state.rateLimitedUntil) {
      const w = state.rateLimitedUntil - Date.now();
      if (w <= 15000) await new Promise(r => setTimeout(r, w + 300));
      else { resolve(null); continue; }
    }
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < REQUEST_SPACING_MS) {
      await new Promise(r => setTimeout(r, REQUEST_SPACING_MS - elapsed));
    }
    lastRequestTime = Date.now();
    try { resolve(await fn()); }
    catch (err) { reject(err); }
  }
  processingQueue = false;
}

// ── JSON REPAIR ─────────────────────────────────────────────
function repairJSON(text) {
  if (!text || text.trim().length === 0) return null;
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try { return JSON.parse(cleaned); } catch {}

  if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
    const lastQ = cleaned.lastIndexOf('"');
    if (lastQ > 0) {
      for (const suffix of ['}', '"}']) {
        try {
          const p = JSON.parse(cleaned.substring(0, lastQ + 1) + suffix);
          state.repairCount++;
          return p;
        } catch {}
      }
    }
  }

  const pairRx = /"(Elena|Marco|Gruk|Bones)"\s*:\s*("(?:[^"\\]|\\.)*"|null)/g;
  const result = {};
  let m;
  while ((m = pairRx.exec(cleaned)) !== null) {
    result[m[1]] = m[2] === 'null' ? null : m[2].slice(1, -1);
  }
  if (Object.keys(result).length > 0) { state.repairCount++; return result; }

  const emergRx = /"?(Elena|Marco|Gruk|Bones)"?\s*:\s*"([^"]{3,})"/g;
  const emerg = {};
  while ((m = emergRx.exec(cleaned)) !== null) emerg[m[1]] = m[2];
  if (Object.keys(emerg).length > 0) { state.repairCount++; return emerg; }

  return null;
}

// ── JSON REPAIR for conversation arrays [{npc, msg}] ────────
function repairConversationArray(text) {
  if (!text || text.trim().length === 0) return null;
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // Try direct parse — might be a valid array already
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].npc && parsed[0].msg) {
      return parsed;
    }
    // If AI returned old object format {NPC: msg}, convert to array
    if (!Array.isArray(parsed) && typeof parsed === 'object') {
      const npcNames = Object.keys(NPC_PERSONALITIES);
      const arr = [];
      for (const key of npcNames) {
        if (parsed[key] && typeof parsed[key] === 'string' && parsed[key].trim()) {
          arr.push({ npc: key, msg: parsed[key].substring(0, 200) });
        }
      }
      if (arr.length >= 2) { state.repairCount++; return arr; }
    }
  } catch {}

  // Try to repair truncated array
  if (cleaned.startsWith('[')) {
    // Find last complete object in array
    const objRx = /\{\s*"npc"\s*:\s*"(Elena|Marco|Gruk|Bones)"\s*,\s*"msg"\s*:\s*"([^"]{1,200})"\s*\}/g;
    const items = [];
    let match;
    while ((match = objRx.exec(cleaned)) !== null) {
      items.push({ npc: match[1], msg: match[2] });
    }
    if (items.length >= 2) { state.repairCount++; return items; }
  }

  // Fallback: try old object format repair and convert
  const fallback = repairJSON(cleaned);
  if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
    const npcNames = Object.keys(NPC_PERSONALITIES);
    const arr = [];
    for (const key of npcNames) {
      if (fallback[key] && typeof fallback[key] === 'string' && fallback[key].trim()) {
        arr.push({ npc: key, msg: fallback[key].substring(0, 200) });
      }
    }
    if (arr.length >= 2) return arr;
  }

  return null;
}

// ── System Prompt ───────────────────────────────────────────
function buildSystemPrompt(npcActivities, npcMoodData) {
  const descs = Object.entries(NPC_PERSONALITIES).map(([key, p]) => {
    const act = npcActivities?.[key] || 'descansando';
    const mood = npcMoodData?.[key];
    const moodStr = mood
      ? ` Ánimo:${mood.happiness > 70 ? 'feliz' : mood.happiness > 40 ? 'normal' : 'triste'},social:${mood.social > 50 ? 'sociable' : 'solo'}`
      : '';
    return `${key}(${p.type},${p.role}): ${p.quirks[0]}.${moodStr} [${act}]`;
  }).join('\n');

  return `Eres el narrador de 4 NPCs en Sunnyside World. Responde SOLO JSON puro, sin texto extra.

${descs}

FORMATO OBLIGATORIO (JSON puro, sin markdown):
{"Elena":"texto","Marco":null,"Gruk":null,"Bones":null}

REGLAS:
- Solo 1-2 NPCs responden. Los demás = null.
- Si el jugador HABLA CON un NPC ("Elena, ...", "oye Marco"), ESE NPC responde.
- Si pregunta "Elena, ¿dónde está Bones?" → Elena responde. Bones NO.
- MÁXIMO 50 caracteres por frase. Ultra-corto.
- Español. Sin emojis. En personaje.
- Elena: maternal, plantas, llama "cariño". Marco: seco, directo, sarcástico. Gruk: tercera persona, obsesionado con shiny. Bones: filosófico, chistes de huesos.
- No dicen que son IA. Revelan personalidad gradualmente.
- Pueden preguntar al jugador sobre su vida, intereses, nombre.
- Recuerda datos del jugador y úsalos naturalmente.`;
}

// ── Smart addressing ────────────────────────────────────────
function detectAddressing(msgLower, npcNames) {
  const spokenTo = [];
  const mentionedAbout = [];

  const speakToPatterns = [
    /^(oye|hey|hola|eh|ey|mira|dime|escucha)\s+(elena|marco|gruk|bones)/i,
    /^(elena|marco|gruk|bones)\s*[,!:¡¿]/i,
    /^(elena|marco|gruk|bones)$/i,
    /^(elena|marco|gruk|bones)\s+(dime|sabes|puedes|quiero|te|eres|como|que|donde|por|tienes|has)/i,
  ];

  const askAboutPatterns = [
    /(?:donde|dónde)\s+(?:esta|está|anda|vive)\s+(elena|marco|gruk|bones)/i,
    /(?:visto|conoces|sabes de|que piensas de|opinas de|que tal|como es)\s+(elena|marco|gruk|bones)/i,
    /(?:sobre|acerca de|de)\s+(elena|marco|gruk|bones)/i,
    /(?:con|a)\s+(elena|marco|gruk|bones)\s*\?/i,
  ];

  for (const pattern of speakToPatterns) {
    const match = msgLower.match(pattern);
    if (match) {
      for (const name of npcNames) {
        if (match[0].toLowerCase().includes(name.toLowerCase()) && !spokenTo.includes(name)) {
          spokenTo.push(name);
        }
      }
    }
  }

  for (const pattern of askAboutPatterns) {
    const match = msgLower.match(pattern);
    if (match) {
      for (const name of npcNames) {
        if (match[0].toLowerCase().includes(name.toLowerCase()) && !spokenTo.includes(name) && !mentionedAbout.includes(name)) {
          mentionedAbout.push(name);
        }
      }
    }
  }

  if (spokenTo.length === 0) {
    for (const name of npcNames) {
      const idx = msgLower.indexOf(name.toLowerCase());
      if (idx !== -1 && !mentionedAbout.includes(name)) {
        if (idx < 3) spokenTo.push(name);
        else mentionedAbout.push(name);
      }
    }
    if (spokenTo.length === 0 && mentionedAbout.length === 1) {
      spokenTo.push(mentionedAbout.shift());
    }
  }

  return { spokenTo, mentionedAbout };
}

// ── Groq API call (OpenAI-compatible) ───────────────────────
async function callGroq(groqKey, systemPrompt, userMessage) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 400,
      temperature: 0.8,
      top_p: 0.9,
    })
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after');
    const waitSec = retryAfter ? parseInt(retryAfter) : 10;
    return { error: true, type: 'rate_limit', waitSec };
  }

  if (!res.ok) {
    const errText = await res.text();
    return { error: true, type: `http_${res.status}`, message: errText.substring(0, 200) };
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const finishReason = data?.choices?.[0]?.finish_reason || 'unknown';
  const usage = data?.usage;

  return { error: false, text, finishReason, usage, model: data?.model || GROQ_MODEL };
}

// ── Gemini API call (with model rotation) ───────────────────
async function callGemini(geminiKey, systemPrompt, userMessage) {
  const MAX_TRIES = GEMINI_MODELS.length;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const model = getGeminiModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 400,
          topP: 0.9,
          responseMimeType: 'application/json'
        }
      })
    });

    if (res.status === 429) {
      const errData = await res.json().catch(() => ({}));
      if (errData?.error?.status === 'RESOURCE_EXHAUSTED') {
        markGeminiExhausted(model);
        continue;
      }
      return { error: true, type: 'rate_limit', waitSec: 10, message: `Gemini ${model} RPM` };
    }

    if (!res.ok) {
      return { error: true, type: `http_${res.status}`, message: (await res.text()).substring(0, 200) };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const finishReason = data?.candidates?.[0]?.finishReason || 'unknown';

    return { error: false, text, finishReason, model };
  }

  return { error: true, type: 'all_exhausted', message: 'All Gemini models exhausted' };
}

// ── Main request: tries Groq first, then Gemini ─────────────
export async function getAllNPCResponses(apiKeys, playerName, playerMessage, npcActivities, playerMemory, npcMoodData, customSystemPrompt) {
  return enqueueRequest(() => _doRequest(apiKeys, playerName, playerMessage, npcActivities, playerMemory, npcMoodData, customSystemPrompt));
}

async function _doRequest(apiKeys, playerName, playerMessage, npcActivities, playerMemory, npcMoodData, customSystemPrompt) {
  const { groqKey, geminiKey } = apiKeys;
  const msgLower = playerMessage.toLowerCase();
  const npcNames = Object.keys(NPC_PERSONALITIES);
  const { spokenTo, mentionedAbout } = detectAddressing(msgLower, npcNames);

  let hint = '';
  if (spokenTo.length > 0) {
    hint = ` [HABLA CON ${spokenTo.join(', ')}`;
    if (mentionedAbout.length > 0) hint += `, PREGUNTA SOBRE ${mentionedAbout.join(', ')}`;
    hint += `. Solo ${spokenTo.join('/')} responde(n).]`;
  } else if (mentionedAbout.length > 0) {
    hint = ` [Menciona a ${mentionedAbout.join(', ')}. Quien mejor conozca el tema responde.]`;
  }

  const memoryCtx = playerMemory && Object.keys(playerMemory).length > 0
    ? `\n[Recuerdas del jugador: ${Object.entries(playerMemory).map(([k, v]) => `${k}=${v}`).join(', ')}]`
    : '';

  const recent = chatHistory.slice(-4).map(h => `${h.sender}: ${h.text}`).join('\n');
  const userMsg = recent
    ? `[Reciente]:\n${recent}\n\n${playerName}: ${playerMessage}${hint}${memoryCtx}`
    : `${playerName}: ${playerMessage}${hint}${memoryCtx}`;

  // Use custom system prompt (from social engine) or build default
  const systemPrompt = customSystemPrompt || buildSystemPrompt(npcActivities, npcMoodData);

  state.requestCount++;
  const reqNum = state.requestCount;
  const startTime = Date.now();
  state.lastRequest = { time: startTime, type: 'chat', prompt: userMsg.substring(0, 150), reqNum };

  let result = null;

  // 1) GROQ (primary)
  if (groqKey) {
    console.log(`[AI] 📤 #${reqNum} [Groq/${GROQ_MODEL}] → "${playerMessage.substring(0, 40)}"`);
    try {
      result = await callGroq(groqKey, systemPrompt, userMsg);
      if (!result.error) {
        state.provider = 'groq';
        state.model = result.model || GROQ_MODEL;
      } else {
        console.warn(`[AI] ⚠️ Groq failed: ${result.type} → trying Gemini...`);
        if (result.type === 'rate_limit') {
          state.rateLimitedUntil = Date.now() + (result.waitSec || 10) * 1000;
        }
        result = null;
      }
    } catch (err) {
      console.error(`[AI] ❌ Groq network: ${err.message}`);
      result = null;
    }
  }

  // 2) GEMINI (fallback)
  if (!result && geminiKey) {
    const gm = getGeminiModel();
    console.log(`[AI] 📤 #${reqNum} [Gemini/${gm}] → "${playerMessage.substring(0, 40)}"`);
    try {
      result = await callGemini(geminiKey, systemPrompt, userMsg);
      if (!result.error) {
        state.provider = 'gemini';
        state.model = result.model || gm;
      } else {
        console.error(`[AI] ❌ Gemini: ${result.message}`);
        if (result.type === 'rate_limit') state.rateLimitedUntil = Date.now() + (result.waitSec || 10) * 1000;
        state.lastError = { time: Date.now(), type: result.type, message: result.message };
        state.failCount++;
        return null;
      }
    } catch (err) {
      state.lastError = { time: Date.now(), type: 'NETWORK', message: err.message };
      state.failCount++;
      return null;
    }
  }

  if (!result || result.error) {
    state.lastError = { time: Date.now(), type: 'NO_PROVIDER', message: 'Sin GROQ_API_KEY ni GEMINI_API_KEY disponibles' };
    state.failCount++;
    return null;
  }

  // ── Parse response ──
  const elapsed = Date.now() - startTime;
  state._responseTimes.push(elapsed);
  if (state._responseTimes.length > 20) state._responseTimes.shift();
  state.avgResponseMs = Math.round(state._responseTimes.reduce((a, b) => a + b, 0) / state._responseTimes.length);

  const raw = result.text || '';
  state.lastResponse = { time: Date.now(), raw: raw.substring(0, 500), finishReason: result.finishReason, elapsed, reqNum, provider: state.provider, model: state.model };

  if (!raw) {
    state.lastError = { time: Date.now(), type: 'EMPTY', message: 'Empty response' };
    state.failCount++;
    return null;
  }

  const parsed = repairJSON(raw);
  if (!parsed) {
    state.lastError = { time: Date.now(), type: 'JSON_FAIL', message: `Irrecuperable: ${raw.substring(0, 80)}` };
    console.error(`[AI] ❌ JSON irrecuperable: ${raw.substring(0, 80)}`);
    state.failCount++;
    return null;
  }

  const responses = {};
  const npcKeys = [...npcNames].sort((a, b) => (spokenTo.includes(a) ? -1 : 0) - (spokenTo.includes(b) ? -1 : 0));
  for (const key of npcKeys) {
    const val = parsed[key];
    if (val && val !== 'null' && val !== null && typeof val === 'string' && val.trim().length > 0) {
      responses[key] = val.substring(0, 200);
    }
  }

  if (Object.keys(responses).length > 0) {
    state.successCount++;
    state.lastResponse.parsed = responses;
    console.log(`[AI] ✅ #${reqNum} [${state.provider}/${state.model}] → ${Object.keys(responses).join(', ')} (${elapsed}ms)`);
    return responses;
  }

  state.lastError = { time: Date.now(), type: 'EMPTY_RESULT', message: 'No valid NPC responses in JSON' };
  state.failCount++;
  return null;
}

// ── NPC-to-NPC conversation ─────────────────────────────────
export async function getNPCConversation(apiKeys, npcActivities, customSystemPrompt, customUserMsg) {
  return enqueueRequest(() => _doNPCConversation(apiKeys, npcActivities, customSystemPrompt, customUserMsg));
}

async function _doNPCConversation(apiKeys, npcActivities, customSystemPrompt, customUserMsg) {
  const { groqKey, geminiKey } = apiKeys;
  const systemPrompt = customSystemPrompt || buildSystemPrompt(npcActivities);
  const userMsg = customUserMsg || `NPCs hablan entre sí. 2 NPCs charlan (max 40 chars). JSON puro.`;

  state.requestCount++;
  let result = null;

  if (groqKey) {
    try { result = await callGroq(groqKey, systemPrompt, userMsg); } catch { result = null; }
    if (result?.error) result = null;
  }
  if (!result && geminiKey) {
    try { result = await callGemini(geminiKey, systemPrompt, userMsg); } catch { result = null; }
    if (result?.error) result = null;
  }
  if (!result) { state.failCount++; return null; }

  // Try array format first (new sequential format), fallback to object
  const parsed = repairConversationArray(result.text);
  if (parsed && Array.isArray(parsed) && parsed.length >= 2) {
    state.successCount++;
    console.log(`[AI] ✅ NPC conversation (array): ${parsed.map(t => t.npc).join(' → ')}`);
    return parsed;
  }

  // Fallback: old object format → convert to array
  const objParsed = repairJSON(result.text);
  if (objParsed) {
    const arr = [];
    for (const key of Object.keys(NPC_PERSONALITIES)) {
      if (objParsed[key] && typeof objParsed[key] === 'string' && objParsed[key].trim()) {
        arr.push({ npc: key, msg: objParsed[key].substring(0, 200) });
      }
    }
    if (arr.length >= 2) { state.successCount++; return arr; }
  }

  return null;
}

// ── Test endpoint ───────────────────────────────────────────
export async function testNPCDirect(apiKeys, message, npcActivities) {
  const { groqKey, geminiKey } = apiKeys;
  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt(npcActivities);
  const userMsg = `Jugador: ${message}`;

  const testResult = {
    input: message,
    provider: 'none',
    model: 'none',
    groqAvailable: !!groqKey,
    geminiAvailable: !!geminiKey,
    timestamp: new Date().toISOString(),
    steps: []
  };

  testResult.steps.push({ step: 'prompt_built', ms: Date.now() - startTime });

  if (groqKey) {
    try {
      const res = await callGroq(groqKey, systemPrompt, userMsg);
      testResult.steps.push({ step: 'groq_responded', ms: Date.now() - startTime });
      if (!res.error) {
        testResult.provider = 'groq';
        testResult.model = res.model || GROQ_MODEL;
        testResult.rawResponse = res.text;
        testResult.finishReason = res.finishReason;
        testResult.usage = res.usage;
        testResult.httpStatus = 200;
      } else {
        testResult.groqError = res.message || res.type;
      }
    } catch (e) {
      testResult.groqError = e.message;
    }
  }

  if (!testResult.rawResponse && geminiKey) {
    try {
      const res = await callGemini(geminiKey, systemPrompt, userMsg);
      testResult.steps.push({ step: 'gemini_responded', ms: Date.now() - startTime });
      if (!res.error) {
        testResult.provider = 'gemini';
        testResult.model = res.model || getGeminiModel();
        testResult.rawResponse = res.text;
        testResult.finishReason = res.finishReason;
        testResult.httpStatus = 200;
      } else {
        testResult.geminiError = res.message;
        testResult.httpStatus = 429;
      }
    } catch (e) {
      testResult.geminiError = e.message;
    }
  }

  if (testResult.rawResponse) {
    const parsed = repairJSON(testResult.rawResponse);
    testResult.parsedJSON = parsed;
    if (parsed) {
      const responses = {};
      for (const key of Object.keys(NPC_PERSONALITIES)) {
        if (parsed[key] && parsed[key] !== null && typeof parsed[key] === 'string') {
          responses[key] = parsed[key];
        }
      }
      testResult.npcResponses = responses;
      testResult.respondingNPCs = Object.keys(responses);
    }
  }

  testResult.totalMs = Date.now() - startTime;
  testResult.success = !!testResult.npcResponses && Object.keys(testResult.npcResponses).length > 0;
  return testResult;
}

// ── Fallback contextual ─────────────────────────────────────
const CONTEXTUAL_FALLBACKS = {
  Elena: {
    'regando cultivos': ['Las calabazas necesitan agua, cariño.', 'Hoy la lavanda huele divina.'],
    'recogiendo hierbas': ['Esta menta es perfecta para el té.', 'Las hierbas hoy están preciosas.'],
    'cargando cosecha': ['¡Vaya cosecha, cariño!', 'Esto dará para buena sopa.'],
    'descansando': ['¡Qué bonito día, cariño!', 'La brisa es perfecta.'],
    'paseando': ['Pasear relaja el alma.', 'Cada rincón tiene su encanto.'],
    _default: ['¡Hola, cariño!', 'Las plantas crecen bien hoy.']
  },
  Marco: {
    'patrullando': ['Todo despejado.', 'Nada sospechoso por aquí.'],
    'talando madera': ['Buen tronco. Resistente.', 'La madera reforzará la valla.'],
    'combatiendo monstruos': ['¡Atrás, bestia!', 'Otro menos.'],
    'vigilando': ['Mantengo la guardia.', 'Ojo avizor.'],
    'entrenando': ['No se baja la guardia nunca.', 'El cuerpo es un arma más.'],
    _default: ['Todo tranquilo. De momento.', 'Hmph.']
  },
  Gruk: {
    'picando piedra': ['Gruk buscar shiny en roca!', 'Piedra dura, Gruk más duro.'],
    'excavando': ['Gruk encontrar... tierra.', 'Cavar cavar.'],
    'cargando botín': ['Gruk llevar tesoro!', '¡Mucho shiny hoy!'],
    'buscando shiny': ['¿Dónde estar shiny?', 'Gruk oler shiny cerca...'],
    'escondiéndose': ['Gruk no estar aquí. Shh.', '*mira nervioso*'],
    'martilleando': ['¡Clang clang!', 'Gruk arreglar cosa.'],
    _default: ['¡Shiny!', 'Gruk amigo.']
  },
  Bones: {
    'meditando': ['La eternidad da para reflexionar.', 'Meditar sin cerebro... irónico.'],
    'vagando': ['Paseo mis huesos. Literalmente.', 'Vagar es mi cardio.'],
    'espantando intrusos': ['¡Buh! ...Nunca funciona.', 'Ser esqueleto y no asustar.'],
    'contemplando la existencia': ['¿Piensa un esqueleto?', 'Cogito ergo... rattle.'],
    'patrullando su territorio': ['Mi ronda. No duermo.', 'Este rincón es mío.'],
    _default: ['*rattle*', 'Echo de menos los párpados.']
  }
};

export function getContextualFallback(npcActivities, addressed) {
  const result = {};
  const keys = Object.keys(CONTEXTUAL_FALLBACKS);
  let respondents;
  if (addressed && addressed.length > 0) {
    respondents = [...addressed];
    if (Math.random() < 0.3) {
      const others = keys.filter(k => !addressed.includes(k));
      if (others.length > 0) respondents.push(others[Math.floor(Math.random() * others.length)]);
    }
  } else {
    const shuffled = [...keys].sort(() => Math.random() - 0.5);
    respondents = shuffled.slice(0, 1 + Math.floor(Math.random() * 2));
  }
  for (const npcKey of respondents) {
    const fb = CONTEXTUAL_FALLBACKS[npcKey];
    if (!fb) continue;
    const activity = npcActivities?.[npcKey] || 'descansando';
    const phrases = fb[activity] || fb._default;
    result[npcKey] = phrases[Math.floor(Math.random() * phrases.length)];
  }
  state.fallbackCount++;
  return result;
}
