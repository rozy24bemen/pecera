// ============================================================
// SUNNYSIDE WORLD - UI System
// Interfaz de usuario: chat, inventario, HUD
// ============================================================

export class UIManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.chatMessages = [];
    this.chatInput = '';
    this.chatOpen = false;
    this.notifications = [];
    this.miniMapVisible = true;
    this.debugMode = false;

    // Friendship data
    this.friendshipLevels = {};
    this.npcInfo = {};
    this.discoveries = {};  // { Elena: { color: false, food: false }, ... }
    this.friendshipPanelOpen = false;

    // Load saved discoveries from localStorage
    try {
      const saved = localStorage.getItem('sunnyside_discoveries');
      if (saved) this.discoveries = JSON.parse(saved);
    } catch {}

    // AI status tracking
    this.aiStatus = { status: 'ok' };

    // Chat box HTML overlay
    this.createChatOverlay();
    this.createHUD();
    this.createFriendshipPanel();
    this.createAIStatusIndicator();
    this.createProximityIndicator();
    this.createDebugPanel();
  }

  createChatOverlay() {
    // Chat container
    this.chatContainer = document.createElement('div');
    this.chatContainer.id = 'chat-container';
    this.chatContainer.innerHTML = `
      <div id="chat-messages"></div>
      <div id="chat-input-row">
        <input type="text" id="chat-input" placeholder="Escribe un mensaje... (Enter para enviar)" autocomplete="off" />
        <button id="chat-send">▶</button>
      </div>
    `;
    document.body.appendChild(this.chatContainer);

    this.chatMessagesEl = document.getElementById('chat-messages');
    this.chatInputEl = document.getElementById('chat-input');

    document.getElementById('chat-send').addEventListener('click', () => {
      this.sendChat();
    });

    this.chatInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendChat();
      e.stopPropagation();
    });

    this.chatInputEl.addEventListener('focus', () => { this.chatOpen = true; });
    this.chatInputEl.addEventListener('blur', () => { this.chatOpen = false; });
  }

  createHUD() {
    this.hudContainer = document.createElement('div');
    this.hudContainer.id = 'hud-container';
    this.hudContainer.innerHTML = `
      <div id="hud-info">
        <span id="hud-players">👥 0</span>
        <span id="hud-coords">📍 0, 0</span>
        <span id="hud-fps">🎮 60 FPS</span>
      </div>
      <div id="notifications"></div>
    `;
    document.body.appendChild(this.hudContainer);

    this.hudPlayers = document.getElementById('hud-players');
    this.hudCoords = document.getElementById('hud-coords');
    this.hudFps = document.getElementById('hud-fps');
    this.notifContainer = document.getElementById('notifications');
  }

  sendChat() {
    const msg = this.chatInputEl.value.trim();
    if (!msg) return;
    this.chatInputEl.value = '';
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('chat-message', { detail: msg }));
  }

  addChatMessage(playerName, message, color = '#fff', isNPC = false) {
    this.chatMessages.push({ playerName, message, color, time: Date.now() });
    if (this.chatMessages.length > 50) this.chatMessages.shift();

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg' + (isNPC ? ' chat-npc' : '');
    const prefix = isNPC ? '🤖 ' : '';
    msgEl.innerHTML = `<span style="color:${color};font-weight:bold">${prefix}${playerName}:</span> ${message}`;
    this.chatMessagesEl.appendChild(msgEl);
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
  }

  addSystemMessage(message) {
    this.addChatMessage('🌻 Sistema', message, '#ffd700');
  }

  showNotification(text, duration = 3000) {
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.textContent = text;
    this.notifContainer.appendChild(notif);

    setTimeout(() => {
      notif.classList.add('fade-out');
      setTimeout(() => notif.remove(), 500);
    }, duration);
  }

  updateHUD(playerCount, playerX, playerY, fps) {
    this.hudPlayers.textContent = `👥 ${playerCount}`;
    this.hudCoords.textContent = `📍 ${Math.floor(playerX)}, ${Math.floor(playerY)}`;
    this.hudFps.textContent = `🎮 ${fps} FPS`;
  }

  // Dibujar mini-mapa en el canvas
  drawMiniMap(ctx, tileMap, characters, camera) {
    if (!this.miniMapVisible || !tileMap) return;

    const mapW = 150;
    const mapH = 150;
    const mapX = ctx.canvas.width - mapW - 10;
    const mapY = 10;
    const scaleX = mapW / (tileMap.width * tileMap.tileSize * 2);
    const scaleY = mapH / (tileMap.height * tileMap.tileSize * 2);

    // Fondo
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = '#e0c97f';
    ctx.lineWidth = 2;
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // Tiles simplificados
    const tileRenderW = mapW / tileMap.width;
    const tileRenderH = mapH / tileMap.height;
    for (let y = 0; y < tileMap.height; y++) {
      for (let x = 0; x < tileMap.width; x++) {
        const tile = tileMap.getTile('ground', x, y);
        let color = '#4a7c59'; // grass
        if (tile === 'water' || tile === 'water_deep') color = '#3d5a80';
        else if (tile === 'dirt' || tile === 'dirt_path') color = '#8b7355';
        else if (tile === 'sand') color = '#c2b280';
        else if (tile === 'stone' || tile === 'stone_floor') color = '#808080';
        else if (tile?.includes('fence') || tile?.includes('wall')) color = '#654321';

        ctx.fillStyle = color;
        ctx.fillRect(mapX + x * tileRenderW, mapY + y * tileRenderH, tileRenderW + 0.5, tileRenderH + 0.5);
      }
    }

    // Jugadores como puntos
    for (const char of characters) {
      ctx.fillStyle = char.isNPC ? '#ff6b6b' : '#ffd700';
      const px = mapX + char.x * scaleX;
      const py = mapY + char.y * scaleY;
      const dotSize = char.isNPC ? 3 : 5;
      ctx.fillRect(px - dotSize/2, py - dotSize/2, dotSize, dotSize);
      // Highlight local player
      if (!char.isNPC && char.id === 'local') {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(px - dotSize/2 - 1, py - dotSize/2 - 1, dotSize + 2, dotSize + 2);
      }
    }

    // Viewport
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mapX + camera.x * scaleX,
      mapY + camera.y * scaleY,
      camera.viewWidth * scaleX,
      camera.viewHeight * scaleY
    );

    ctx.restore();
  }

  isChatFocused() {
    return this.chatOpen;
  }

  // ═══════════════════════════════════════════════════════════
  // FRIENDSHIP PANEL
  // ═══════════════════════════════════════════════════════════

  createFriendshipPanel() {
    // Toggle button
    this.friendshipBtn = document.createElement('button');
    this.friendshipBtn.id = 'friendship-toggle';
    this.friendshipBtn.innerHTML = '❤️';
    this.friendshipBtn.title = 'Relaciones';
    this.friendshipBtn.addEventListener('click', () => this.toggleFriendshipPanel());
    document.body.appendChild(this.friendshipBtn);

    // Panel
    this.friendshipPanel = document.createElement('div');
    this.friendshipPanel.id = 'friendship-panel';
    this.friendshipPanel.classList.add('hidden');
    this.friendshipPanel.innerHTML = `
      <div class="fp-header">
        <h3>❤️ Relaciones</h3>
        <button class="fp-close" id="fp-close">✕</button>
      </div>
      <div id="fp-cards"></div>
    `;
    document.body.appendChild(this.friendshipPanel);

    document.getElementById('fp-close').addEventListener('click', () => {
      this.toggleFriendshipPanel();
    });
  }

  toggleFriendshipPanel() {
    this.friendshipPanelOpen = !this.friendshipPanelOpen;
    this.friendshipPanel.classList.toggle('hidden', !this.friendshipPanelOpen);
    this.friendshipBtn.classList.toggle('active', this.friendshipPanelOpen);
  }

  initFriendshipPanel(levels, npcInfo) {
    this.friendshipLevels = levels || {};
    this.npcInfo = npcInfo || {};

    // Initialize discoveries if not saved
    for (const key of Object.keys(levels)) {
      if (!this.discoveries[key]) {
        this.discoveries[key] = { color: false, food: false };
      }
    }

    this.renderFriendshipCards();
  }

  updateFriendship(npcKey, level) {
    this.friendshipLevels[npcKey] = level;
    this.renderFriendshipCards();
  }

  unlockDiscovery(npcKey, discoveryTypes) {
    if (!this.discoveries[npcKey]) {
      this.discoveries[npcKey] = { color: false, food: false };
    }
    for (const t of discoveryTypes) {
      this.discoveries[npcKey][t] = true;
    }
    // Save to localStorage
    try {
      localStorage.setItem('sunnyside_discoveries', JSON.stringify(this.discoveries));
    } catch {}
    this.renderFriendshipCards();
  }

  renderFriendshipCards() {
    const container = document.getElementById('fp-cards');
    if (!container) return;

    const NPC_DETAILS = {
      Elena: { emoji: '🌿', colorVal: 'Verde esmeralda', foodVal: 'Sopa de calabaza', barColor: '#7ddf64' },
      Marco: { emoji: '⚔️', colorVal: 'Azul real', foodVal: 'Estofado de carne', barColor: '#6ba3d6' },
      Gruk:  { emoji: '👺', colorVal: 'Dorado (shiny!)', foodVal: 'Manzanas robadas', barColor: '#e8a838' },
      Bones: { emoji: '💀', colorVal: 'Blanco hueso', foodVal: 'Vino tinto (recuerdo)', barColor: '#c8c8d0' }
    };

    const NPC_TYPE_LABEL = {
      Elena: 'Granjera · Humana',
      Marco: 'Guardia · Humano',
      Gruk: 'Curioso · Goblin',
      Bones: 'Filósofo · Esqueleto'
    };

    container.innerHTML = Object.entries(this.friendshipLevels).map(([key, level]) => {
      const det = NPC_DETAILS[key] || { emoji: '👤', barColor: '#888' };
      const disc = this.discoveries[key] || { color: false, food: false };
      const pct = Math.min(100, Math.max(0, level));

      // Friendship rank
      let rank = '🔵 Desconocido';
      if (pct >= 80) rank = '💛 Mejor amigo';
      else if (pct >= 60) rank = '💚 Buen amigo';
      else if (pct >= 40) rank = '🤝 Amigo';
      else if (pct >= 20) rank = '👋 Conocido';

      const colorSlot = disc.color
        ? `<div class="fp-slot unlocked"><span class="fp-slot-icon">🎨</span><span>${det.colorVal}</span></div>`
        : `<div class="fp-slot locked"><span class="fp-slot-icon">🔒</span><span>Color favorito</span></div>`;

      const foodSlot = disc.food
        ? `<div class="fp-slot unlocked"><span class="fp-slot-icon">🍽️</span><span>${det.foodVal}</span></div>`
        : `<div class="fp-slot locked"><span class="fp-slot-icon">🔒</span><span>Comida favorita</span></div>`;

      return `
        <div class="fp-card">
          <div class="fp-avatar">${det.emoji}</div>
          <div class="fp-info">
            <div class="fp-name">${key}</div>
            <div class="fp-role">${NPC_TYPE_LABEL[key] || ''}</div>
            <div class="fp-rank">${rank}</div>
            <div class="fp-bar-bg">
              <div class="fp-bar-fill" style="width:${pct}%;background:${det.barColor}"></div>
              <span class="fp-bar-label">${pct}/100</span>
            </div>
            <div class="fp-slots">
              ${colorSlot}
              ${foodSlot}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════
  // AI STATUS INDICATOR (junto al chat)
  // ═══════════════════════════════════════════════════════════

  createAIStatusIndicator() {
    this.aiIndicator = document.createElement('div');
    this.aiIndicator.id = 'ai-status-indicator';
    this.aiIndicator.innerHTML = `<span class="ai-dot"></span><span class="ai-label">AI ✓</span>`;
    document.body.appendChild(this.aiIndicator);
  }

  createProximityIndicator() {
    this.proximityIndicator = document.createElement('div');
    this.proximityIndicator.id = 'proximity-indicator';
    this.proximityIndicator.innerHTML = `
      <div class="prox-header">👂 Escuchando: <span id="prox-listening">—</span></div>
      <div class="prox-debug hidden" id="prox-debug"></div>
    `;
    document.body.appendChild(this.proximityIndicator);

    // Click to toggle debug
    this.proximityIndicator.querySelector('.prox-header').addEventListener('click', () => {
      const dbg = document.getElementById('prox-debug');
      dbg.classList.toggle('hidden');
    });
  }

  updateProximityInfo(data) {
    const listeningEl = document.getElementById('prox-listening');
    const debugEl = document.getElementById('prox-debug');
    if (!listeningEl) return;

    // Show who's listening
    if (data.listening.length > 0) {
      listeningEl.innerHTML = data.listening.map(name => {
        const colors = { Elena: '#7ddf64', Marco: '#6ba3d6', Gruk: '#e8a838', Bones: '#c8c8d0' };
        return `<span style="color:${colors[name] || '#fff'};font-weight:bold">${name}</span>`;
      }).join(', ');
    } else {
      listeningEl.innerHTML = '<span style="color:#f66">nadie</span>';
    }

    // Debug details
    if (debugEl) {
      let html = `<div class="prox-dbg-row" style="color:#888">Tu pos: (${data.playerPos.x}, ${data.playerPos.y}) | viewport: ${data.viewport.w}×${data.viewport.h} | rango: ±${data.halfW}×±${data.halfH}</div>`;
      for (const npc of data.all) {
        const color = npc.canHear ? '#4ade80' : '#f66';
        const icon = npc.canHear ? '✅' : '❌';
        html += `<div class="prox-dbg-row" style="color:${color}">${icon} ${npc.name}: dist=${npc.dist}px (dx=${npc.dx}, dy=${npc.dy}) pos=(${npc.npcPos.x},${npc.npcPos.y})</div>`;
      }
      debugEl.innerHTML = html;
    }
  }

  updateAIStatus(data) {
    this.aiStatus = data;
    const dot = this.aiIndicator.querySelector('.ai-dot');
    const label = this.aiIndicator.querySelector('.ai-label');

    // Clear any existing countdown timer
    if (this._aiCountdown) {
      clearInterval(this._aiCountdown);
      this._aiCountdown = null;
    }

    if (data.status === 'ok') {
      dot.className = 'ai-dot ai-ok';
      label.textContent = 'AI ✓';
    } else if (data.status === 'ratelimit') {
      dot.className = 'ai-dot ai-ratelimit';
      let remaining = data.rateLimitSec || 30;
      label.textContent = `AI ⏳ ${remaining}s`;
      // Countdown timer
      this._aiCountdown = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(this._aiCountdown);
          this._aiCountdown = null;
          dot.className = 'ai-dot ai-ok';
          label.textContent = 'AI ✓';
          this.aiStatus = { status: 'ok' };
        } else {
          label.textContent = `AI ⏳ ${remaining}s`;
        }
      }, 1000);
    } else if (data.status === 'fallback') {
      dot.className = 'ai-dot ai-fallback';
      label.textContent = 'AI ↩ fallback';
      // Auto-clear after 5s
      setTimeout(() => {
        if (this.aiStatus.status === 'fallback') {
          dot.className = 'ai-dot ai-ok';
          label.textContent = 'AI ✓';
        }
      }, 5000);
    } else {
      dot.className = 'ai-dot ai-error';
      label.textContent = 'AI ✕ error';
    }

    // Update debug panel if open
    if (this.debugPanelOpen) this.refreshDebugPanel();
  }

  // ═══════════════════════════════════════════════════════════
  // DEBUG PANEL (F12)
  // ═══════════════════════════════════════════════════════════

  createDebugPanel() {
    this.debugPanelOpen = false;

    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'debug-panel';
    this.debugPanel.classList.add('hidden');
    this.debugPanel.innerHTML = `
      <div class="dbg-header">
        <h3>🔧 Debug Panel</h3>
        <button class="dbg-close" id="dbg-close">✕</button>
      </div>
      <div class="dbg-tabs">
        <button class="dbg-tab active" data-tab="ai">🤖 AI</button>
        <button class="dbg-tab" data-tab="npcs">👥 NPCs</button>
        <button class="dbg-tab" data-tab="memory">🧠 Memory</button>
        <button class="dbg-tab" data-tab="life">🌿 Life</button>
        <button class="dbg-tab" data-tab="test">🧪 Test</button>
      </div>
      <div id="dbg-content" class="dbg-content"></div>
    `;
    document.body.appendChild(this.debugPanel);

    // F12 toggle
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        this.toggleDebugPanel();
      }
    });

    document.getElementById('dbg-close').addEventListener('click', () => {
      this.toggleDebugPanel();
    });

    // Tab switching
    this.debugPanel.querySelectorAll('.dbg-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.debugPanel.querySelectorAll('.dbg-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentDebugTab = tab.dataset.tab;
        this.refreshDebugPanel();
      });
    });

    this.currentDebugTab = 'ai';

    // Auto-refresh when open
    setInterval(() => {
      if (this.debugPanelOpen) this.refreshDebugPanel();
    }, 3000);
  }

  toggleDebugPanel() {
    this.debugPanelOpen = !this.debugPanelOpen;
    this.debugPanel.classList.toggle('hidden', !this.debugPanelOpen);
    if (this.debugPanelOpen) this.refreshDebugPanel();
  }

  async refreshDebugPanel() {
    const content = document.getElementById('dbg-content');
    if (!content) return;

    try {
      if (this.currentDebugTab === 'ai') {
        const res = await fetch('/api/debug');
        const data = await res.json();
        const g = data.gemini;
        content.innerHTML = `
          <div class="dbg-section">
            <h4>Gemini Status</h4>
            <div class="dbg-grid">
              <span>Model:</span><span>${g.model}</span>
              <span>Requests:</span><span>${g.requestCount}</span>
              <span>Success:</span><span class="dbg-good">${g.successCount}</span>
              <span>Fails:</span><span class="dbg-bad">${g.failCount}</span>
              <span>Repairs:</span><span class="dbg-warn">${g.repairCount}</span>
              <span>Fallbacks:</span><span class="dbg-warn">${g.fallbackCount}</span>
              <span>Success Rate:</span><span>${g.successRate}</span>
              <span>Avg Response:</span><span>${g.avgResponseMs}ms</span>
              <span>Rate Limited:</span><span class="${g.rateLimitActive ? 'dbg-bad' : 'dbg-good'}">${g.rateLimitActive ? g.rateLimitRemainingSec + 's' : 'No'}</span>
              <span>Queue:</span><span>${g.queueLength}</span>
            </div>
          </div>
          ${g.lastResponse ? `
          <div class="dbg-section">
            <h4>Last Response (#${g.lastResponse.reqNum})</h4>
            <div class="dbg-grid">
              <span>Finish:</span><span>${g.lastResponse.finishReason}</span>
              <span>Time:</span><span>${g.lastResponse.elapsed}ms</span>
            </div>
            <pre class="dbg-raw">${g.lastResponse.raw?.substring(0, 300) || 'N/A'}</pre>
          </div>` : ''}
          ${g.lastError ? `
          <div class="dbg-section dbg-error-box">
            <h4>Last Error</h4>
            <div class="dbg-grid">
              <span>Type:</span><span class="dbg-bad">${g.lastError.type}</span>
            </div>
            <pre class="dbg-raw">${g.lastError.message?.substring(0, 200) || 'N/A'}</pre>
          </div>` : ''}
        `;

      } else if (this.currentDebugTab === 'npcs') {
        const res = await fetch('/api/debug');
        const data = await res.json();
        content.innerHTML = `
          <div class="dbg-section">
            <h4>NPC Positions & Activities</h4>
            ${Object.entries(data.npcPositions).map(([name, npc]) => `
              <div class="dbg-npc-card">
                <strong>${name}</strong>
                <span>📍 ${npc.x}, ${npc.y}</span>
                <span>🎬 ${npc.animation}</span>
                <span>📋 ${npc.activity}</span>
              </div>
            `).join('')}
          </div>
          <div class="dbg-section">
            <h4>Chat History (last 5)</h4>
            ${data.chatHistory.map(h => `<div class="dbg-chat-line"><strong>${h.sender}:</strong> ${h.text}</div>`).join('')}
          </div>
        `;

      } else if (this.currentDebugTab === 'memory') {
        const res = await fetch('/api/player-memory');
        const data = await res.json();
        let html = '';

        // Player memories
        html += '<div class="dbg-section"><h4>🧠 Lo que la IA recuerda de ti</h4>';
        const players = Object.entries(data.players);
        if (players.length === 0) {
          html += '<div style="color:#888">No hay jugadores conectados</div>';
        }
        for (const [name, info] of players) {
          const memEntries = Object.entries(info.memory);
          html += `<div class="dbg-npc-card"><strong>${name}</strong> 📍(${info.position.x}, ${info.position.y})</div>`;
          if (memEntries.length === 0) {
            html += '<div style="color:#888;padding-left:12px">Sin datos personales aún. ¡Cuéntales cosas sobre ti!</div>';
          } else {
            for (const [key, val] of memEntries) {
              const icons = { nombre_real: '👤', edad: '🎂', color_favorito: '🎨', comida_favorita: '🍕', hobby: '⚽', profesion: '💼' };
              html += `<div style="padding-left:12px">${icons[key] || '📝'} <strong>${key}:</strong> ${val}</div>`;
            }
          }
          html += '<div style="padding-left:12px;margin-top:4px"><strong>Amistad:</strong> ';
          html += Object.entries(info.friendship).map(([npc, lvl]) => {
            const bar = lvl > 50 ? '💚' : lvl > 20 ? '💛' : '🤍';
            return `${npc}: ${bar}${lvl}`;
          }).join(' | ');
          html += '</div>';
        }
        html += '</div>';

        // NPC Personalities (what they know)
        html += '<div class="dbg-section"><h4>🎭 Personalidades NPC</h4>';
        for (const [name, npc] of Object.entries(data.npcPersonalities)) {
          html += `<div class="dbg-npc-card">`;
          html += `<strong>${name}</strong> (${npc.type}, ${npc.role})`;
          html += `<div style="font-size:10px;color:#aaa">${npc.quirks.join(' | ')}</div>`;
          html += `<div style="font-size:10px">🎨 ${npc.favoriteColor} | 🍕 ${npc.favoriteFood} | 📋 ${npc.currentActivity}</div>`;
          html += `</div>`;
        }
        html += '</div>';

        // Chat history
        html += '<div class="dbg-section"><h4>💬 Historial reciente (contexto IA)</h4>';
        if (data.chatHistory.length === 0) {
          html += '<div style="color:#888">Sin historial aún</div>';
        }
        for (const h of data.chatHistory) {
          html += `<div class="dbg-chat-line"><strong>${h.sender}:</strong> ${h.text}</div>`;
        }
        html += '</div>';

        content.innerHTML = html;

      } else if (this.currentDebugTab === 'life') {
        const res = await fetch('/api/npc-life');
        const data = await res.json();
        content.innerHTML = `
          <div class="dbg-section">
            <h4>NPC Moods</h4>
            ${Object.entries(data.currentMoods).map(([name, mood]) => `
              <div class="dbg-mood-card">
                <strong>${name}</strong>
                <div class="dbg-mood-bar"><span>😊 ${Math.round(mood.happiness)}</span><div class="dbg-bar" style="width:${mood.happiness}%;background:#7ddf64"></div></div>
                <div class="dbg-mood-bar"><span>⚡ ${Math.round(mood.energy)}</span><div class="dbg-bar" style="width:${mood.energy}%;background:#e8a838"></div></div>
                <div class="dbg-mood-bar"><span>💬 ${Math.round(mood.social)}</span><div class="dbg-bar" style="width:${mood.social}%;background:#6ba3d6"></div></div>
              </div>
            `).join('')}
          </div>
          <div class="dbg-section">
            <h4>NPC Relationships</h4>
            ${Object.entries(data.relationships).map(([name, rels]) =>
              `<div><strong>${name}:</strong> ${Object.entries(rels).map(([t, v]) => `${t}=${v}`).join(', ')}</div>`
            ).join('')}
          </div>
          <div class="dbg-section">
            <h4>Life Log (last 15)</h4>
            ${data.events.slice(-15).reverse().map(e => `<div class="dbg-log-line">[${e.timeStr}] ${e.detail || e.type}</div>`).join('')}
          </div>
        `;

      } else if (this.currentDebugTab === 'test') {
        content.innerHTML = `
          <div class="dbg-section">
            <h4>🧪 Test NPC Response</h4>
            <div class="dbg-test-row">
              <input type="text" id="dbg-test-input" placeholder="Mensaje de prueba..." value="Hola Elena, ¿qué haces?" />
              <button id="dbg-test-btn">Enviar</button>
            </div>
            <div id="dbg-test-result" class="dbg-raw">Escribe un mensaje y pulsa Enviar</div>
          </div>
          <div class="dbg-section">
            <h4>Quick Actions</h4>
            <button class="dbg-action-btn" id="dbg-heartbeat-btn">💬 Forzar Heartbeat</button>
            <button class="dbg-action-btn" id="dbg-fallback-btn">↩ Test Fallback</button>
          </div>
        `;

        document.getElementById('dbg-test-btn').addEventListener('click', async () => {
          const input = document.getElementById('dbg-test-input');
          const resultEl = document.getElementById('dbg-test-result');
          resultEl.textContent = '⏳ Enviando...';
          try {
            const res = await fetch(`/api/test-npc?msg=${encodeURIComponent(input.value)}`);
            const data = await res.json();
            resultEl.textContent = JSON.stringify(data, null, 2);
          } catch (err) {
            resultEl.textContent = `Error: ${err.message}`;
          }
        });

        document.getElementById('dbg-heartbeat-btn').addEventListener('click', async () => {
          const resultEl = document.getElementById('dbg-test-result');
          resultEl.textContent = '⏳ Forzando heartbeat...';
          try {
            const res = await fetch('/api/test-heartbeat');
            const data = await res.json();
            resultEl.textContent = JSON.stringify(data, null, 2);
          } catch (err) {
            resultEl.textContent = `Error: ${err.message}`;
          }
        });

        document.getElementById('dbg-fallback-btn').addEventListener('click', async () => {
          const resultEl = document.getElementById('dbg-test-result');
          try {
            const res = await fetch('/api/test-fallback');
            const data = await res.json();
            resultEl.textContent = JSON.stringify(data, null, 2);
          } catch (err) {
            resultEl.textContent = `Error: ${err.message}`;
          }
        });
      }
    } catch (err) {
      content.innerHTML = `<div class="dbg-error-box">Error: ${err.message}</div>`;
    }
  }
}
