// ============================================================
// SUNNYSIDE WORLD - Sprite Sheet Loader & Animator
// Carga sprite strips y maneja animaciones frame-a-frame
// ============================================================

export class SpriteSheet {
  constructor(imagePath, frameCount, frameWidth = null, frameHeight = null) {
    this.imagePath = imagePath;
    this.frameCount = frameCount;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.image = null;
    this.loaded = false;
  }

  async load() {
    return new Promise((resolve, reject) => {
      this.image = new Image();
      this.image.onload = () => {
        this.loaded = true;
        // Los sprite strips son horizontales
        if (!this.frameWidth) {
          this.frameWidth = this.image.width / this.frameCount;
        }
        if (!this.frameHeight) {
          this.frameHeight = this.image.height;
        }
        resolve(this);
      };
      this.image.onerror = () => reject(new Error(`Failed to load: ${this.imagePath}`));
      this.image.src = this.imagePath;
    });
  }

  drawFrame(ctx, frameIndex, x, y, scale = 1, flipX = false) {
    if (!this.loaded) return;
    const frame = frameIndex % this.frameCount;
    const sx = frame * this.frameWidth;
    const dw = this.frameWidth * scale;
    const dh = this.frameHeight * scale;

    ctx.save();
    if (flipX) {
      ctx.translate(x + dw, y);
      ctx.scale(-1, 1);
      ctx.drawImage(this.image, sx, 0, this.frameWidth, this.frameHeight, 0, 0, dw, dh);
    } else {
      ctx.drawImage(this.image, sx, 0, this.frameWidth, this.frameHeight, x, y, dw, dh);
    }
    ctx.restore();
  }
}

export class AnimatedSprite {
  constructor(spriteSheet, speed = 100, loop = true) {
    this.spriteSheet = spriteSheet;
    this.speed = speed; // ms per frame
    this.loop = loop;
    this.currentFrame = 0;
    this.elapsed = 0;
    this.finished = false;
    this.playing = true;
  }

  update(deltaTime) {
    if (!this.playing || this.finished) return;
    this.elapsed += deltaTime;
    if (this.elapsed >= this.speed) {
      this.elapsed -= this.speed;
      this.currentFrame++;
      if (this.currentFrame >= this.spriteSheet.frameCount) {
        if (this.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = this.spriteSheet.frameCount - 1;
          this.finished = true;
        }
      }
    }
  }

  draw(ctx, x, y, scale = 1, flipX = false) {
    this.spriteSheet.drawFrame(ctx, this.currentFrame, x, y, scale, flipX);
  }

  reset() {
    this.currentFrame = 0;
    this.elapsed = 0;
    this.finished = false;
    this.playing = true;
  }

  get width() { return (this.spriteSheet.frameWidth || 32) ; }
  get height() { return (this.spriteSheet.frameHeight || 32); }
}

// Cache global de sprites cargados
const spriteCache = new Map();

export async function loadSprite(path, frameCount) {
  const key = path;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const sheet = new SpriteSheet(path, frameCount);
  await sheet.load();
  spriteCache.set(key, sheet);
  return sheet;
}

export async function loadAnimatedSprite(path, frameCount, speed = 100, loop = true) {
  const sheet = await loadSprite(path, frameCount);
  return new AnimatedSprite(sheet, speed, loop);
}
