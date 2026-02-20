// ============================================================
// SUNNYSIDE WORLD - Asset Registry
// Catálogo completo de todos los assets disponibles
// ============================================================

export const TILE_SIZE = 16;
export const TILE_SIZE_LARGE = 32;

// ── TILESETS ─────────────────────────────────────────────────
export const TILESETS = {
  world_16px: {
    path: 'Tileset/spr_tileset_sunnysideworld_16px.png',
    tileSize: 16,
    description: 'Tileset principal del mundo (16px)'
  },
  forest_32px: {
    path: 'Tileset/spr_tileset_sunnysideworld_forest_32px.png',
    tileSize: 32,
    description: 'Tileset de bosque (32px)'
  }
};

// ── TIPOS DE PELO PARA HUMANOS ──────────────────────────────
export const HAIR_STYLES = ['base', 'bowlhair', 'curlyhair', 'longhair', 'mophair', 'shorthair', 'spikeyhair'];
export const TOOL_LAYER = 'tools';

// ── ANIMACIONES DE HUMANOS ─────────────────────────────────
export const HUMAN_ANIMATIONS = {
  idle:      { folder: 'IDLE',      suffix: 'idle',      frames: 9,  speed: 100 },
  walk:      { folder: 'WALKING',   suffix: 'walk',      frames: 8,  speed: 90  },
  run:       { folder: 'RUN',       suffix: 'run',       frames: 8,  speed: 70  },
  attack:    { folder: 'ATTACK',    suffix: 'attack',    frames: 10, speed: 80  },
  axe:       { folder: 'AXE',       suffix: 'axe',       frames: 10, speed: 80  },
  carry:     { folder: 'CARRY',     suffix: 'carry',     frames: 8,  speed: 90  },
  casting:   { folder: 'CASTING',   suffix: 'casting',   frames: 15, speed: 80  },
  caught:    { folder: 'CAUGHT',    suffix: 'caught',    frames: 10, speed: 80  },
  death:     { folder: 'DEATH',     suffix: 'death',     frames: 13, speed: 100 },
  dig:       { folder: 'DIG',       suffix: 'dig',       frames: 13, speed: 80  },
  doing:     { folder: 'DOING',     suffix: 'doing',     frames: 8,  speed: 100 },
  hammering: { folder: 'HAMMERING', suffix: 'hamering', frames: 23, speed: 70  },
  hurt:      { folder: 'HURT',      suffix: 'hurt',      frames: 8,  speed: 100 },
  jump:      { folder: 'JUMP',      suffix: 'jump',      frames: 9,  speed: 80  },
  mining:    { folder: 'MINING',    suffix: 'mining',    frames: 10, speed: 80  },
  reeling:   { folder: 'REELING',   suffix: 'reeling',   frames: 13, speed: 80  },
  roll:      { folder: 'ROLL',      suffix: 'roll',      frames: 10, speed: 70  },
  swimming:  { folder: 'SWIMMING',  suffix: 'swimming',  frames: 12, speed: 100 },
  waiting:   { folder: 'WAITING',   suffix: 'waiting',   frames: 9,  speed: 120 },
  watering:  { folder: 'WATERING',  suffix: 'watering',  frames: 5,  speed: 100 }
};

// ── ANIMACIONES GOBLIN ──────────────────────────────────────
export const GOBLIN_ANIMATIONS = {
  idle:      { frames: 9,  speed: 100 },
  walk:      { frames: 8,  speed: 90  },
  run:       { frames: 8,  speed: 70  },
  attack:    { frames: 10, speed: 80  },
  axe:       { frames: 10, speed: 80  },
  carry:     { frames: 8,  speed: 90  },
  casting:   { frames: 15, speed: 80  },
  caught:    { frames: 10, speed: 80  },
  death:     { frames: 13, speed: 100 },
  dig:       { frames: 13, speed: 80  },
  doing:     { frames: 8,  speed: 100 },
  hammering: { frames: 23, speed: 70  },
  hurt:      { frames: 8,  speed: 100 },
  jump:      { frames: 9,  speed: 80  },
  mining:    { frames: 10, speed: 80  },
  reeling:   { frames: 13, speed: 80  },
  roll:      { frames: 10, speed: 70  },
  swimming:  { frames: 12, speed: 100 },
  waiting:   { frames: 9,  speed: 120 },
  watering:  { frames: 5,  speed: 100 }
};

// ── ANIMACIONES SKELETON ────────────────────────────────────
export const SKELETON_ANIMATIONS = {
  idle:   { frames: 6,  speed: 120 },
  walk:   { frames: 8,  speed: 90  },
  attack: { frames: 7,  speed: 80  },
  death:  { frames: 10, speed: 100 },
  hurt:   { frames: 7,  speed: 100 },
  jump:   { frames: 10, speed: 80  }
};

// ── ANIMALES ────────────────────────────────────────────────
export const ANIMALS = {
  bird:    { path: 'Elements/Animals/spr_deco_bird_01_strip4.png',    frames: 4, speed: 150 },
  chicken: { path: 'Elements/Animals/spr_deco_chicken_01_strip4.png', frames: 4, speed: 150 },
  cow:     { path: 'Elements/Animals/spr_deco_cow_strip4.png',        frames: 4, speed: 200 },
  duck:    { path: 'Elements/Animals/spr_deco_duck_01_strip4.png',    frames: 4, speed: 150 },
  pig:     { path: 'Elements/Animals/spr_deco_pig_01_strip4.png',     frames: 4, speed: 200 },
  sheep:   { path: 'Elements/Animals/spr_deco_sheep_01_strip4.png',   frames: 4, speed: 200 },
  blinking:{ path: 'Elements/Animals/spr_deco_blinking_strip12.png',  frames: 12,speed: 100 }
};

// ── CULTIVOS (6 etapas de crecimiento) ──────────────────────
export const CROPS = {
  beetroot:    { stages: 6, prefix: 'Elements/Crops/beetroot_'    },
  cabbage:     { stages: 6, prefix: 'Elements/Crops/cabbage_'     },
  carrot:      { stages: 6, prefix: 'Elements/Crops/carrot_'      },
  cauliflower: { stages: 6, prefix: 'Elements/Crops/cauliflower_' },
  kale:        { stages: 6, prefix: 'Elements/Crops/kale_'        },
  parsnip:     { stages: 6, prefix: 'Elements/Crops/parsnip_'     },
  potato:      { stages: 6, prefix: 'Elements/Crops/potato_'      },
  pumpkin:     { stages: 6, prefix: 'Elements/Crops/pumpkin_'     },
  radish:      { stages: 6, prefix: 'Elements/Crops/radish_'      },
  sunflower:   { stages: 6, prefix: 'Elements/Crops/sunflower_'   },
  wheat:       { stages: 6, prefix: 'Elements/Crops/wheat_'       }
};

// ── ITEMS DE CULTIVO ────────────────────────────────────────
export const CROP_ITEMS = {
  seeds: 'Elements/Crops/seeds_generic.png',
  egg:   'Elements/Crops/egg.png',
  fish:  'Elements/Crops/fish.png',
  milk:  'Elements/Crops/milk.png',
  rock:  'Elements/Crops/rock.png',
  wood:  'Elements/Crops/wood.png',
  crate_base: 'Elements/Crops/crate_base.png',
  crate_top:  'Elements/Crops/crate_top.png',
  soil_00: 'Elements/Crops/soil_00.png',
  soil_01: 'Elements/Crops/soil_01.png',
  soil_03: 'Elements/Crops/soil_03.png',
  soil_04: 'Elements/Crops/soil_04.png'
};

// ── PLANTAS / ÁRBOLES ───────────────────────────────────────
export const PLANTS = {
  tree_01:         { path: 'Elements/Plants/spr_deco_tree_01_strip4.png',          frames: 4, speed: 300 },
  tree_02:         { path: 'Elements/Plants/spr_deco_tree_02_strip4.png',          frames: 4, speed: 300 },
  mushroom_blue_1: { path: 'Elements/Plants/spr_deco_mushroom_blue_01_strip4.png', frames: 4, speed: 200 },
  mushroom_blue_2: { path: 'Elements/Plants/spr_deco_mushroom_blue_02_strip4.png', frames: 4, speed: 200 },
  mushroom_blue_3: { path: 'Elements/Plants/spr_deco_mushroom_blue_03_strip4.png', frames: 4, speed: 200 },
  mushroom_red:    { path: 'Elements/Plants/spr_deco_mushroom_red_01_strip4.png',  frames: 4, speed: 200 }
};

// ── VFX ─────────────────────────────────────────────────────
export const VFX = {
  fire_01: { path: 'Elements/VFX/Fire/spr_deco_fire_01_strip4.png', frames: 4, speed: 100 },
  fire_02: { path: 'Elements/VFX/Fire/spr_deco_fire_02_strip4.png', frames: 4, speed: 100 },
  glint_01:{ path: 'Elements/VFX/Glint/spr_deco_glint_01_strip6.png', frames: 6, speed: 80 },
  glint_02:{ path: 'Elements/VFX/Glint/spr_deco_glint_02_strip4.png', frames: 4, speed: 80 },
  chimney_01:{ path: 'Elements/VFX/Chimney Smoke/chimneysmoke_01_strip30.png', frames: 30, speed: 60 },
  chimney_02:{ path: 'Elements/VFX/Chimney Smoke/chimneysmoke_02_strip30.png', frames: 30, speed: 60 },
  chimney_03:{ path: 'Elements/VFX/Chimney Smoke/chimneysmoke_03_strip30.png', frames: 30, speed: 60 },
  chimney_04:{ path: 'Elements/VFX/Chimney Smoke/chimneysmoke_04_strip30.png', frames: 30, speed: 60 },
  chimney_05:{ path: 'Elements/VFX/Chimney Smoke/chimneysmoke_05_strip30.png', frames: 30, speed: 60 }
};

// ── OTROS ELEMENTOS DECORATIVOS ─────────────────────────────
export const DECORATIONS = {
  windmill:      { path: 'Elements/Other/spr_deco_windmill_strip9.png',             frames: 9, speed: 100 },
  windmill_shadow:{ path: 'Elements/Other/spr_deco_windmillshadow_strip9.png',      frames: 9, speed: 100 },
  windmill_full: { path: 'Elements/Other/spr_deco_windmill_withshadow_strip9.png',  frames: 9, speed: 100 },
  coracle:       { path: 'Elements/Other/spr_deco_coracle_strip4.png',              frames: 4, speed: 200 },
  coracle_land:  { path: 'Elements/Other/spr_deco_coracle_land.png',                frames: 1, speed: 0   }
};

// ── UI ELEMENTS ─────────────────────────────────────────────
export const UI_ITEMS = {
  tools: ['axe', 'hammer', 'pickaxe', 'shovel', 'sword', 'rod', 'water'],
  cursors: ['cursor_01', 'cursor_02', 'cursor_03', 'cursor_04', 'cursor_05'],
  expressions: ['alerted', 'attack', 'chat', 'confused', 'love', 'stress', 'working'],
  bars: {
    green: { stages: 7, prefix: 'UI/greenbar_' },
    red:   { stages: 7, prefix: 'UI/redbar_' },
    blue:  { stages: 6, prefix: 'UI/bluebar_' }
  }
};

// ── HELPER: Construir ruta de sprite strip de humano ────────
export function getHumanSpritePath(animation, hairStyle = 'base') {
  const anim = HUMAN_ANIMATIONS[animation];
  if (!anim) return null;
  const layer = hairStyle === 'tools' ? 'tools' : hairStyle;
  return `Characters/Human/${anim.folder}/${layer}_${anim.suffix}_strip${anim.frames}.png`;
}

// ── HELPER: Construir ruta de sprite de goblin ──────────────
export function getGoblinSpritePath(animation) {
  const anim = GOBLIN_ANIMATIONS[animation];
  if (!anim) return null;
  return `Characters/Goblin/PNG/spr_${animation}_strip${anim.frames}.png`;
}

// ── HELPER: Construir ruta de sprite de skeleton ────────────
export function getSkeletonSpritePath(animation) {
  const anim = SKELETON_ANIMATIONS[animation];
  if (!anim) return null;
  return `Characters/Skeleton/PNG/skeleton_${animation}_strip${anim.frames}.png`;
}

// ── HELPER: Ruta de etapa de cultivo ────────────────────────
export function getCropStagePath(cropName, stage) {
  const crop = CROPS[cropName];
  if (!crop || stage < 0 || stage >= crop.stages) return null;
  return `${crop.prefix}0${stage}.png`;
}

// ── HELPER: Ruta de UI ──────────────────────────────────────
export function getUIPath(name) {
  return `UI/${name}.png`;
}

// ── Exportar todo como catálogo navegable ────────────────────
export const ASSET_CATALOG = {
  tilesets: TILESETS,
  characters: {
    human: { animations: HUMAN_ANIMATIONS, hairStyles: HAIR_STYLES },
    goblin: { animations: GOBLIN_ANIMATIONS },
    skeleton: { animations: SKELETON_ANIMATIONS }
  },
  elements: {
    animals: ANIMALS,
    crops: CROPS,
    cropItems: CROP_ITEMS,
    plants: PLANTS,
    vfx: VFX,
    decorations: DECORATIONS
  },
  ui: UI_ITEMS
};
