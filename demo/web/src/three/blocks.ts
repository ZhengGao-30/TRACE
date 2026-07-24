/**
 * Voxel furniture blueprints, Minecraft-style.
 *
 * Everything is axis-aligned boxes on a 1-unit block grid. Coordinates are
 * LOCAL to the furniture piece: x right, y up, z forward, origin at the centre
 * of its footprint on the floor.
 */
import type { Kind } from '../lib/room'

export interface Box {
  p: [number, number, number]   // centre
  s: [number, number, number]   // size
  c: string                     // colour
  door?: boolean                // this box swings open (cabinets, fridge, ...)
  drawer?: boolean              // this box slides out
}

export interface Blueprint {
  boxes: Box[]
  h: number                     // total height, for name tags / item anchors
  label: string
}

// --- Minecraft-ish palette -------------------------------------------------
const OAK = '#b8894f'
const OAK_D = '#9a7040'
const OAK_L = '#cda06a'
const SPRUCE = '#6b4f31'
const STONE = '#9a9a95'
const STONE_D = '#7c7c78'
const IRON = '#d7d9dc'
const IRON_D = '#a9adb2'
const WHITE = '#eceff2'
const DARK = '#33383d'
const GLASS = '#8fc7dd'
const WATER = '#3d80c4'
const GOLD = '#e0b552'
const RED = '#a8422f'
const GREEN = '#5d8b48'
const WOOL = '#d8d3c8'

const b = (p: Box['p'], s: Box['s'], c: string, extra: Partial<Box> = {}): Box =>
  ({ p, s, c, ...extra })

/** A closed storage box with a swinging front panel. */
function cabinet(c = OAK, cd = OAK_D, w = 1.0, h = 1.0, d = 0.8): Box[] {
  return [
    b([0, h / 2, 0], [w, h, d], c),
    b([0, h / 2, d / 2 + 0.03], [w * 0.92, h * 0.86, 0.06], cd, { door: true }),
    b([w * 0.3, h / 2, d / 2 + 0.09], [0.08, 0.16, 0.06], IRON, { door: true }),
  ]
}

export const BLUEPRINTS: Record<string, Blueprint> = {
  cabinet: { boxes: cabinet(OAK, OAK_D, 1.0, 1.1, 0.8), h: 1.1, label: 'cabinet' },

  drawer: {
    boxes: [
      b([0, 0.35, 0], [1.0, 0.7, 0.8], OAK_L),
      b([0, 0.5, 0.43], [0.86, 0.24, 0.08], OAK_D, { drawer: true }),
      b([0, 0.2, 0.43], [0.86, 0.24, 0.08], OAK_D, { drawer: true }),
      b([0, 0.5, 0.48], [0.22, 0.05, 0.05], IRON, { drawer: true }),
      b([0, 0.2, 0.48], [0.22, 0.05, 0.05], IRON, { drawer: true }),
    ], h: 0.7, label: 'drawer',
  },

  countertop: {
    boxes: [
      b([0, 0.42, 0], [1.5, 0.84, 0.9], OAK_D),
      b([0, 0.9, 0], [1.62, 0.14, 1.0], STONE),
    ], h: 1.0, label: 'countertop',
  },

  fridge: {
    boxes: [
      b([0, 1.0, 0], [1.0, 2.0, 0.9], IRON),
      b([0, 1.35, 0.48], [0.9, 1.2, 0.06], IRON_D, { door: true }),
      b([0, 0.45, 0.48], [0.9, 0.8, 0.06], IRON_D, { door: true }),
      b([0.36, 1.35, 0.53], [0.06, 0.5, 0.06], DARK, { door: true }),
      b([0.36, 0.55, 0.53], [0.06, 0.4, 0.06], DARK, { door: true }),
    ], h: 2.0, label: 'fridge',
  },

  microwave: {
    boxes: [
      b([0, 0.3, 0], [1.0, 0.6, 0.7], DARK),
      b([-0.12, 0.3, 0.37], [0.6, 0.42, 0.05], GLASS, { door: true }),
      b([0.36, 0.3, 0.37], [0.2, 0.44, 0.04], STONE_D),
    ], h: 0.6, label: 'microwave',
  },

  sinkbasin: {
    boxes: [
      b([0, 0.42, 0], [1.2, 0.84, 0.9], STONE_D),
      b([0, 0.9, 0], [1.3, 0.12, 1.0], IRON),
      b([0, 0.93, 0], [0.8, 0.1, 0.6], WATER),
      b([0, 1.15, -0.3], [0.1, 0.42, 0.1], IRON_D),
    ], h: 1.2, label: 'sink',
  },

  stoveburner: {
    boxes: [
      b([0, 0.42, 0], [1.0, 0.84, 0.9], DARK),
      b([0, 0.88, 0], [1.05, 0.1, 0.95], STONE_D),
      b([-0.22, 0.95, -0.18], [0.3, 0.05, 0.3], RED),
      b([0.22, 0.95, -0.18], [0.3, 0.05, 0.3], DARK),
    ], h: 1.0, label: 'stove',
  },

  garbagecan: {
    boxes: [
      b([0, 0.4, 0], [0.6, 0.8, 0.6], GREEN),
      b([0, 0.84, 0], [0.68, 0.1, 0.68], DARK, { door: true }),
    ], h: 0.9, label: 'bin',
  },

  diningtable: {
    boxes: [
      b([0, 0.78, 0], [2.0, 0.14, 1.3], OAK),
      b([-0.85, 0.36, -0.5], [0.14, 0.72, 0.14], OAK_D),
      b([0.85, 0.36, -0.5], [0.14, 0.72, 0.14], OAK_D),
      b([-0.85, 0.36, 0.5], [0.14, 0.72, 0.14], OAK_D),
      b([0.85, 0.36, 0.5], [0.14, 0.72, 0.14], OAK_D),
    ], h: 0.9, label: 'table',
  },

  shelf: {
    boxes: [
      b([0, 0.9, -0.3], [1.4, 1.8, 0.12], SPRUCE),
      b([-0.68, 0.9, 0], [0.1, 1.8, 0.6], SPRUCE),
      b([0.68, 0.9, 0], [0.1, 1.8, 0.6], SPRUCE),
      b([0, 0.55, 0], [1.4, 0.08, 0.6], OAK),
      b([0, 1.15, 0], [1.4, 0.08, 0.6], OAK),
      b([0, 1.72, 0], [1.4, 0.08, 0.6], OAK),
    ], h: 1.8, label: 'shelf',
  },

  desk: {
    boxes: [
      b([0, 0.76, 0], [1.8, 0.12, 0.9], OAK_L),
      b([-0.75, 0.35, 0], [0.16, 0.7, 0.8], OAK_D),
      b([0.75, 0.35, 0], [0.16, 0.7, 0.8], OAK_D),
      b([0.4, 1.0, -0.25], [0.7, 0.45, 0.06], DARK),
      b([0.4, 0.78, -0.25], [0.2, 0.06, 0.12], STONE_D),
    ], h: 1.2, label: 'desk',
  },

  bed: {
    boxes: [
      b([0, 0.25, 0], [1.4, 0.5, 2.2], OAK_D),
      b([0, 0.56, 0.1], [1.36, 0.16, 2.0], RED),
      b([0, 0.68, -0.85], [1.0, 0.2, 0.44], WOOL),
      b([0, 0.9, -1.14], [1.4, 0.9, 0.14], OAK),
    ], h: 1.4, label: 'bed',
  },

  dresser: {
    boxes: [
      b([0, 0.55, 0], [1.4, 1.1, 0.7], SPRUCE),
      b([0, 0.8, 0.38], [1.24, 0.3, 0.06], OAK_D, { drawer: true }),
      b([0, 0.42, 0.38], [1.24, 0.3, 0.06], OAK_D, { drawer: true }),
      b([0, 1.18, 0], [1.5, 0.1, 0.8], OAK),
    ], h: 1.2, label: 'dresser',
  },

  sidetable: {
    boxes: [
      b([0, 0.6, 0], [0.9, 0.12, 0.7], OAK),
      b([-0.35, 0.3, -0.25], [0.1, 0.6, 0.1], OAK_D),
      b([0.35, 0.3, -0.25], [0.1, 0.6, 0.1], OAK_D),
      b([-0.35, 0.3, 0.25], [0.1, 0.6, 0.1], OAK_D),
      b([0.35, 0.3, 0.25], [0.1, 0.6, 0.1], OAK_D),
    ], h: 0.7, label: 'sidetable',
  },

  safe: {
    boxes: [
      b([0, 0.4, 0], [0.8, 0.8, 0.7], STONE_D),
      b([0, 0.4, 0.37], [0.7, 0.7, 0.06], DARK, { door: true }),
      b([0, 0.4, 0.42], [0.18, 0.18, 0.06], GOLD, { door: true }),
    ], h: 0.9, label: 'safe',
  },

  toilet: {
    boxes: [
      b([0, 0.2, 0], [0.7, 0.4, 0.8], WHITE),
      b([0, 0.45, 0.05], [0.6, 0.12, 0.7], WHITE),
      b([0, 0.55, -0.42], [0.7, 0.7, 0.24], WHITE),
    ], h: 0.9, label: 'toilet',
  },

  bathtubbasin: {
    boxes: [
      b([0, 0.3, 0], [1.8, 0.6, 1.0], WHITE),
      b([0, 0.5, 0], [1.6, 0.2, 0.8], WATER),
    ], h: 0.6, label: 'bathtub',
  },

  armchair: {
    boxes: [
      b([0, 0.35, 0], [1.0, 0.3, 1.0], RED),
      b([0, 0.7, -0.42], [1.0, 0.8, 0.18], RED),
      b([-0.42, 0.6, 0], [0.16, 0.5, 1.0], RED),
      b([0.42, 0.6, 0], [0.16, 0.5, 1.0], RED),
    ], h: 1.1, label: 'armchair',
  },

  sofa: {
    boxes: [
      b([0, 0.35, 0], [2.2, 0.3, 1.0], GREEN),
      b([0, 0.7, -0.42], [2.2, 0.8, 0.18], GREEN),
      b([-1.02, 0.6, 0], [0.16, 0.5, 1.0], GREEN),
      b([1.02, 0.6, 0], [0.16, 0.5, 1.0], GREEN),
    ], h: 1.1, label: 'sofa',
  },

  coffeetable: {
    boxes: [
      b([0, 0.42, 0], [1.4, 0.1, 0.9], OAK_L),
      b([-0.6, 0.2, -0.35], [0.1, 0.42, 0.1], OAK_D),
      b([0.6, 0.2, -0.35], [0.1, 0.42, 0.1], OAK_D),
      b([-0.6, 0.2, 0.35], [0.1, 0.42, 0.1], OAK_D),
      b([0.6, 0.2, 0.35], [0.1, 0.42, 0.1], OAK_D),
    ], h: 0.5, label: 'coffeetable',
  },

  toaster: {
    boxes: [
      b([0, 0.2, 0], [0.5, 0.4, 0.35], IRON),
      b([0, 0.42, 0], [0.34, 0.06, 0.2], DARK),
    ], h: 0.5, label: 'toaster',
  },

  coffeemachine: {
    boxes: [
      b([0, 0.3, 0], [0.5, 0.6, 0.45], DARK),
      b([0, 0.12, 0.16], [0.3, 0.24, 0.2], GLASS),
    ], h: 0.7, label: 'coffee',
  },

  cart: {
    boxes: [
      b([0, 0.6, 0], [0.9, 0.1, 0.7], IRON_D),
      b([0, 0.3, 0], [0.9, 0.1, 0.7], IRON_D),
      b([-0.4, 0.35, -0.3], [0.08, 0.7, 0.08], IRON),
      b([0.4, 0.35, -0.3], [0.08, 0.7, 0.08], IRON),
    ], h: 0.7, label: 'cart',
  },

  laundryhamper: {
    boxes: [
      b([0, 0.35, 0], [0.7, 0.7, 0.7], WOOL),
      b([0, 0.72, 0], [0.78, 0.08, 0.78], OAK),
    ], h: 0.8, label: 'hamper',
  },

  other: {
    boxes: [b([0, 0.4, 0], [0.8, 0.8, 0.8], STONE)],
    h: 0.8, label: 'box',
  },
}

export function blueprintOf(kind: Kind): Blueprint {
  return BLUEPRINTS[kind] ?? BLUEPRINTS.other
}

/** Held-item colours (a tiny cube in the player's hand). */
export const ITEM_COLOR: Record<string, string> = {
  lettuce: '#6fbf4a', potato: '#c79a5b', tomato: '#c8402f', apple: '#c8402f',
  bread: '#c9a26a', egg: '#f0ead6', mug: '#dfe4e8', cup: '#dfe4e8',
  plate: '#e8ecef', bowl: '#dcd6c6', pan: '#3b3f44', pot: '#3b3f44',
  knife: '#c2c7cc', fork: '#c2c7cc', spoon: '#c2c7cc', ladle: '#c2c7cc',
  cd: '#b9c6d6', creditcard: '#d8b24a', book: '#8c3b3b', pen: '#2f3a4a',
  laptop: '#4a5560', cellphone: '#2f3a4a', keychain: '#d8b24a',
  soapbar: '#e6dfd0', spraybottle: '#7fa8c9', toiletpaper: '#f2f2ee',
  towel: '#e0d5c2', pillow: '#e8e2d4', desklamp: '#e6c65a',
  candle: '#f0e2b0', statue: '#a9a49a', vase: '#8fa9bd',
  saltshaker: '#eceff2', peppershaker: '#4a4a4a', winebottle: '#3c5a3a',
  dishsponge: '#e0d24a', alarmclock: '#c25a4a', remotecontrol: '#2f3a4a',
  newspaper: '#e4e1d6', tissuebox: '#dfe4e8', butterknife: '#c2c7cc',
  glassbottle: '#9fc9d6', box: '#b8894f', pencil: '#e0b552',
  watch: '#c2c7cc',
}

export function itemColor(objId?: string): string {
  if (!objId) return '#c9a26a'
  return ITEM_COLOR[objId.replace(/\s*\d+$/, '').toLowerCase()] ?? '#c9a26a'
}

// ---------------------------------------------------------------------------
// Category accents.
//
// A real ALFWorld room has ~34 receptacles and, in wood/stone tones alone, they
// all read the same. Each kind therefore gets a category colour used for its
// base plate, its accent trim and its name tag, so the room can be scanned at a
// glance and a command like "go to drawer 4" is findable.
// ---------------------------------------------------------------------------
export type Category = 'storage' | 'appliance' | 'surface' | 'water' | 'comfort' | 'misc'

export const CATEGORY: Record<string, Category> = {
  cabinet: 'storage', drawer: 'storage', dresser: 'storage', shelf: 'storage',
  safe: 'storage', laundryhamper: 'storage',
  fridge: 'appliance', microwave: 'appliance', stoveburner: 'appliance',
  toaster: 'appliance', coffeemachine: 'appliance',
  countertop: 'surface', diningtable: 'surface', desk: 'surface',
  sidetable: 'surface', coffeetable: 'surface', cart: 'surface',
  sinkbasin: 'water', bathtubbasin: 'water', toilet: 'water',
  bed: 'comfort', sofa: 'comfort', armchair: 'comfort',
  garbagecan: 'misc', handtowelholder: 'misc', towelholder: 'misc', other: 'misc',
}

export const CAT_COLOR: Record<Category, string> = {
  storage: '#f0a93c', appliance: '#38bdf8', surface: '#a78bfa',
  water: '#22d3ee', comfort: '#fb7185', misc: '#94a3b8',
}

export const CAT_LABEL: Record<Category, { zh: string; en: string }> = {
  storage: { zh: '储物', en: 'storage' },
  appliance: { zh: '电器', en: 'appliance' },
  surface: { zh: '台面', en: 'surface' },
  water: { zh: '水槽', en: 'water' },
  comfort: { zh: '家具', en: 'furniture' },
  misc: { zh: '其他', en: 'misc' },
}

export function categoryOf(kind: string): Category {
  return CATEGORY[kind] ?? 'misc'
}
export function accentOf(kind: string): string {
  return CAT_COLOR[categoryOf(kind)]
}
