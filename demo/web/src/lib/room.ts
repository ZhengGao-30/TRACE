/**
 * ALFWorld command -> spatial scene.
 *
 * ALFWorld receptacles are addressed as "<kind> <n>" (cabinet 5, fridge 1, ...).
 * Every step's admissible set contains a `go to X` for each reachable receptacle,
 * so the room inventory is recovered from the commands themselves.
 */

export type Kind =
  | 'cabinet' | 'drawer' | 'countertop' | 'fridge' | 'microwave' | 'sinkbasin'
  | 'stoveburner' | 'garbagecan' | 'diningtable' | 'shelf' | 'desk' | 'bed'
  | 'dresser' | 'sidetable' | 'safe' | 'toilet' | 'bathtubbasin' | 'armchair'
  | 'sofa' | 'coffeetable' | 'toaster' | 'coffeemachine' | 'handtowelholder'
  | 'towelholder' | 'cart' | 'laundryhamper' | 'other'

export interface Recep {
  id: string          // "cabinet 5"
  kind: Kind
  n: number
  x: number           // 0..1 floor coords
  y: number
  open?: boolean
  visited?: boolean
  highlight?: boolean
}

export type Verb =
  | 'goto' | 'open' | 'close' | 'take' | 'put' | 'cool' | 'heat' | 'clean'
  | 'use' | 'examine' | 'look' | 'inventory' | 'unknown'

export interface ParsedCmd {
  verb: Verb
  target?: string     // receptacle id
  object?: string     // portable object id
  raw: string
}

const RECEP_KINDS: Kind[] = [
  'cabinet', 'drawer', 'countertop', 'fridge', 'microwave', 'sinkbasin',
  'stoveburner', 'garbagecan', 'diningtable', 'shelf', 'desk', 'bed',
  'dresser', 'sidetable', 'safe', 'toilet', 'bathtubbasin', 'armchair',
  'sofa', 'coffeetable', 'toaster', 'coffeemachine', 'handtowelholder',
  'towelholder', 'cart', 'laundryhamper',
]

export const KIND_ICON: Record<string, string> = {
  cabinet: '🚪', drawer: '🗄️', countertop: '🧱', fridge: '🧊', microwave: '📻',
  sinkbasin: '🚰', stoveburner: '🔥', garbagecan: '🗑️', diningtable: '🍽️',
  shelf: '📚', desk: '🖥️', bed: '🛏️', dresser: '🪞', sidetable: '🪑',
  safe: '🔐', toilet: '🚽', bathtubbasin: '🛁', armchair: '💺', sofa: '🛋️',
  coffeetable: '☕', toaster: '🍞', coffeemachine: '☕', cart: '🛒',
  laundryhamper: '🧺', handtowelholder: '🧻', towelholder: '🧻', other: '📦',
}

export const OBJ_ICON: Record<string, string> = {
  lettuce: '🥬', potato: '🥔', tomato: '🍅', apple: '🍎', bread: '🍞',
  egg: '🥚', mug: '☕', cup: '🥤', plate: '🍽️', bowl: '🥣', pan: '🍳',
  pot: '🍲', knife: '🔪', fork: '🍴', spoon: '🥄', ladle: '🥄',
  cd: '💿', creditcard: '💳', book: '📕', pen: '🖊️', pencil: '✏️',
  laptop: '💻', cellphone: '📱', keychain: '🔑', watch: '⌚',
  remotecontrol: '🎮', box: '📦', statue: '🗿', vase: '🏺',
  desklamp: '💡', candle: '🕯️', soapbar: '🧼', spraybottle: '🧴',
  toiletpaper: '🧻', towel: '🧻', pillow: '🛏️', newspaper: '📰',
  alarmclock: '⏰', saltshaker: '🧂', peppershaker: '🧂', winebottle: '🍷',
  dishsponge: '🧽', butterknife: '🔪', glassbottle: '🍾', tissuebox: '🧻',
}

export function objIcon(objId?: string): string {
  if (!objId) return '📦'
  const base = objId.replace(/\s*\d+$/, '').toLowerCase()
  return OBJ_ICON[base] ?? '📦'
}

function kindOf(id: string): Kind {
  const base = id.replace(/\s*\d+$/, '').toLowerCase()
  return (RECEP_KINDS as string[]).includes(base) ? (base as Kind) : 'other'
}

/** Parse one ALFWorld command into a verb + operands. */
export function parseCommand(raw: string): ParsedCmd {
  const s = (raw || '').trim()
  let m: RegExpMatchArray | null

  if ((m = s.match(/^go to (.+)$/))) return { verb: 'goto', target: m[1], raw: s }
  if ((m = s.match(/^open (.+)$/))) return { verb: 'open', target: m[1], raw: s }
  if ((m = s.match(/^close (.+)$/))) return { verb: 'close', target: m[1], raw: s }
  if ((m = s.match(/^take (.+?) from (.+)$/)))
    return { verb: 'take', object: m[1], target: m[2], raw: s }
  if ((m = s.match(/^(?:move|put) (.+?) (?:to|in|on) (.+)$/)))
    return { verb: 'put', object: m[1], target: m[2], raw: s }
  if ((m = s.match(/^cool (.+?) with (.+)$/)))
    return { verb: 'cool', object: m[1], target: m[2], raw: s }
  if ((m = s.match(/^heat (.+?) with (.+)$/)))
    return { verb: 'heat', object: m[1], target: m[2], raw: s }
  if ((m = s.match(/^clean (.+?) with (.+)$/)))
    return { verb: 'clean', object: m[1], target: m[2], raw: s }
  if ((m = s.match(/^use (.+)$/))) return { verb: 'use', target: m[1], raw: s }
  if ((m = s.match(/^examine (.+)$/))) return { verb: 'examine', object: m[1], raw: s }
  if (/^look$/.test(s)) return { verb: 'look', raw: s }
  if (/^inventory$/.test(s)) return { verb: 'inventory', raw: s }
  return { verb: 'unknown', raw: s }
}

/**
 * Lay receptacles out around the room.
 *
 * Appliances hug the "wall" (top edge), storage runs down the two sides, and
 * big surfaces sit in the middle -- close enough to a real floor plan that the
 * walk reads as spatial, while staying deterministic for a given inventory.
 */
const WALL: Kind[] = ['fridge', 'microwave', 'sinkbasin', 'stoveburner', 'toaster',
  'coffeemachine', 'toilet', 'bathtubbasin']
const CENTER: Kind[] = ['diningtable', 'countertop', 'desk', 'bed', 'sofa',
  'armchair', 'coffeetable', 'cart']

export function layoutRoom(ids: string[]): Recep[] {
  const items = ids.map((id) => ({ id, kind: kindOf(id), n: parseInt(id.match(/(\d+)$/)?.[1] ?? '0', 10) }))
  const wall = items.filter((i) => WALL.includes(i.kind))
  const center = items.filter((i) => CENTER.includes(i.kind))
  const side = items.filter((i) => !WALL.includes(i.kind) && !CENTER.includes(i.kind))

  const out: Recep[] = []
  const place = (i: { id: string; kind: Kind; n: number }, x: number, y: number) =>
    out.push({ id: i.id, kind: i.kind, n: i.n, x, y })

  // top wall: appliances
  wall.forEach((i, k) => place(i, wall.length === 1 ? 0.5 : 0.10 + (0.80 * k) / Math.max(1, wall.length - 1), 0.09))

  // left + right columns: cabinets / drawers / shelves
  const half = Math.ceil(side.length / 2)
  side.slice(0, half).forEach((i, k) =>
    place(i, 0.07, 0.26 + (0.66 * k) / Math.max(1, half - 1)))
  side.slice(half).forEach((i, k) =>
    place(i, 0.93, 0.26 + (0.66 * k) / Math.max(1, side.length - half - 1)))

  // middle: big surfaces
  center.forEach((i, k) => {
    const cols = Math.min(3, center.length)
    const row = Math.floor(k / cols)
    const col = k % cols
    const rows = Math.ceil(center.length / cols)
    place(i,
      cols === 1 ? 0.5 : 0.28 + (0.44 * col) / (cols - 1),
      rows === 1 ? 0.55 : 0.36 + (0.42 * row) / (rows - 1))
  })
  return out
}

type Translate = (k: any, vars?: Record<string, string | number>) => string

/** Human-readable one-liner for the action banner, in the active locale. */
export function describe(p: ParsedCmd, _zh: boolean, t: Translate): string {
  const vars = { t: p.target ?? '', o: p.object ?? '' }
  return p.verb === 'unknown' ? p.raw : t(`v_${p.verb}`, vars)
}
