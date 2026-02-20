// ============================================================
// SUNNYSIDE WORLD - Network Manager
// Cliente WebSocket para multiplayer en tiempo real
// ============================================================

import { io } from 'socket.io-client';

export class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.playerId = null;
    this.callbacks = {};
  }

  connect(url = window.location.origin) {
    this.socket = io(url, {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.playerId = this.socket.id;
      console.log('🌐 Connected as:', this.playerId);
      this.emit('callback', 'connected', this.playerId);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('🔌 Disconnected');
      this.emit('callback', 'disconnected');
    });

    // Juego
    this.socket.on('world-state', (data) => this.emit('callback', 'world-state', data));
    this.socket.on('player-joined', (data) => this.emit('callback', 'player-joined', data));
    this.socket.on('player-left', (data) => this.emit('callback', 'player-left', data));
    this.socket.on('player-moved', (data) => this.emit('callback', 'player-moved', data));
    this.socket.on('player-action', (data) => this.emit('callback', 'player-action', data));
    this.socket.on('chat-message', (data) => this.emit('callback', 'chat-message', data));
    this.socket.on('world-update', (data) => this.emit('callback', 'world-update', data));
    this.socket.on('npc-update', (data) => this.emit('callback', 'npc-update', data));
    this.socket.on('npc-expression', (data) => this.emit('callback', 'npc-expression', data));
    this.socket.on('object-added', (data) => this.emit('callback', 'object-added', data));
    this.socket.on('object-removed', (data) => this.emit('callback', 'object-removed', data));
    this.socket.on('friendship-init', (data) => this.emit('callback', 'friendship-init', data));
    this.socket.on('friendship-update', (data) => this.emit('callback', 'friendship-update', data));
    this.socket.on('friendship-discovery', (data) => this.emit('callback', 'friendship-discovery', data));
    this.socket.on('ai-status', (data) => this.emit('callback', 'ai-status', data));
    this.socket.on('speech-bubble', (data) => this.emit('callback', 'speech-bubble', data));
    this.socket.on('proximity-info', (data) => this.emit('callback', 'proximity-info', data));
  }

  on(event, callback) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(callback);
  }

  emit(type, event, data) {
    if (type === 'callback') {
      const cbs = this.callbacks[event];
      if (cbs) cbs.forEach(cb => cb(data));
    }
  }

  // Enviar movimiento del jugador
  sendMove(x, y, direction, animation, viewportW, viewportH) {
    if (!this.connected) return;
    this.socket.emit('player-move', { x, y, direction, animation, viewportW, viewportH });
  }

  // Enviar acción
  sendAction(action, data = {}) {
    if (!this.connected) return;
    this.socket.emit('player-action', { action, ...data });
  }

  // Enviar mensaje de chat (includes player position for proximity check)
  sendChatMessage(message, x, y, viewportW, viewportH) {
    if (!this.connected) return;
    this.socket.emit('chat-message', { message, x, y, viewportW, viewportH });
  }

  // Unirse al mundo con info de personaje
  joinWorld(playerData) {
    if (!this.connected) return;
    this.socket.emit('join-world', playerData);
  }

  disconnect() {
    if (this.socket) this.socket.disconnect();
  }
}
