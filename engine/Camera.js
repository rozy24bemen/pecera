// ============================================================
// SUNNYSIDE WORLD - Camera System
// Cámara 2D con follow, zoom y viewport
// ============================================================

export class Camera {
  constructor(viewWidth, viewHeight) {
    this.x = 0;
    this.y = 0;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.zoom = 1;
    this.target = null; // Entity to follow
    this.smoothing = 0.1;
    this.bounds = null; // { minX, minY, maxX, maxY }
    this.shake = { x: 0, y: 0, intensity: 0, duration: 0 };
  }

  follow(entity) {
    this.target = entity;
  }

  setBounds(minX, minY, maxX, maxY) {
    this.bounds = { minX, minY, maxX, maxY };
  }

  shakeCamera(intensity = 5, duration = 300) {
    this.shake.intensity = intensity;
    this.shake.duration = duration;
  }

  centerOn(x, y) {
    this.x = x - this.viewWidth / 2;
    this.y = y - this.viewHeight / 2;
    this.clampToBounds();
  }

  update(deltaTime) {
    if (this.target) {
      // Center camera on character (sprites are ~96x64 at scale 2 = 192x128, char body is centered)
      const sw = this.target.currentSprite ? this.target.currentSprite.width * (this.target.scale || 2) / 2 : 96;
      const sh = this.target.currentSprite ? this.target.currentSprite.height * (this.target.scale || 2) / 2 : 64;
      const targetX = this.target.x + sw - this.viewWidth / 2;
      const targetY = this.target.y + sh - this.viewHeight / 2;
      this.x += (targetX - this.x) * this.smoothing;
      this.y += (targetY - this.y) * this.smoothing;
    }

    // Shake
    if (this.shake.duration > 0) {
      this.shake.duration -= deltaTime;
      this.shake.x = (Math.random() - 0.5) * this.shake.intensity;
      this.shake.y = (Math.random() - 0.5) * this.shake.intensity;
    } else {
      this.shake.x = 0;
      this.shake.y = 0;
    }

    this.clampToBounds();
  }

  clampToBounds() {
    if (this.bounds) {
      this.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX - this.viewWidth, this.x));
      this.y = Math.max(this.bounds.minY, Math.min(this.bounds.maxY - this.viewHeight, this.y));
    }
  }

  // Coordenadas del mundo -> pantalla
  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.x + this.shake.x) * this.zoom,
      y: (worldY - this.y + this.shake.y) * this.zoom
    };
  }

  // Coordenadas de pantalla -> mundo
  screenToWorld(screenX, screenY) {
    return {
      x: screenX / this.zoom + this.x - this.shake.x,
      y: screenY / this.zoom + this.y - this.shake.y
    };
  }

  resize(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;
  }
}
