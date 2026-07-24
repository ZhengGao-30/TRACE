/**
 * Footprint-aware room layout.
 *
 * The naive "spread evenly over 0..1" placement made 9 cabinets overlap into a
 * diagonal wall, because it ignored how wide each piece actually is. This walks
 * the room perimeter instead, advancing by each piece's own footprint, and
 * spills into an inner ring when a wall runs out.
 */
import { blueprintOf } from './blocks'
import type { Kind } from '../lib/room'

export interface Placed {
  id: string
  kind: Kind
  x: number
  z: number
  rot: number      // faces the room centre
}

const RECEP_KINDS = new Set([
  'cabinet', 'drawer', 'countertop', 'fridge', 'microwave', 'sinkbasin',
  'stoveburner', 'garbagecan', 'diningtable', 'shelf', 'desk', 'bed',
  'dresser', 'sidetable', 'safe', 'toilet', 'bathtubbasin', 'armchair',
  'sofa', 'coffeetable', 'toaster', 'coffeemachine', 'handtowelholder',
  'towelholder', 'cart', 'laundryhamper',
])

function kindOf(id: string): Kind {
  const base = id.replace(/\s*\d+$/, '').toLowerCase()
  return (RECEP_KINDS.has(base) ? base : 'other') as Kind
}

/** How much wall length a piece needs, from its own blueprint. */
function footprint(kind: Kind): number {
  const bp = blueprintOf(kind)
  const w = Math.max(...bp.boxes.map((b) => Math.abs(b.p[0]) + b.s[0] / 2)) * 2
  return w + 0.9                        // + breathing room between neighbours
}

// appliances belong on a wall; big surfaces belong in the middle of the room
const CENTER = new Set(['diningtable', 'countertop', 'desk', 'bed', 'sofa',
  'armchair', 'coffeetable', 'cart'])

export interface Layout { items: Placed[]; room: number }

export function layoutRoom3D(ids: string[]): Layout {
  const all = ids.map((id) => ({ id, kind: kindOf(id) }))
  const centre = all.filter((i) => CENTER.has(i.kind))
  const walls = all.filter((i) => !CENTER.has(i.kind))

  // pick a room size that actually fits the wall pieces on three walls,
  // in up to two rings, so nothing has to overlap
  const need = walls.reduce((s, i) => s + footprint(i.kind), 0)
  const room = Math.max(24, Math.min(46, Math.ceil((need / 2 / 3 + 6) / 2) * 2))
  const half = room / 2

  const items: Placed[] = []

  // --- three walls (back, left, right); the front is open to the camera ---
  // each ring is a list of segments the pieces are laid along
  const ring = (inset: number) => [
    { // back wall, left -> right
      from: [-half + inset, -half + inset] as const,
      to: [half - inset, -half + inset] as const, rot: 0,
    },
    { // left wall, back -> front
      from: [-half + inset, -half + inset] as const,
      to: [-half + inset, half - inset] as const, rot: Math.PI / 2,
    },
    { // right wall, back -> front
      from: [half - inset, -half + inset] as const,
      to: [half - inset, half - inset] as const, rot: -Math.PI / 2,
    },
  ]

  let queue = [...walls]
  for (const inset of [1.5, 4.6]) {
    if (!queue.length) break
    const segs = ring(inset)
    const capacity = segs.map(() =>
      Math.hypot(segs[0].to[0] - segs[0].from[0], segs[0].to[1] - segs[0].from[1]))
    // distribute pieces across the three segments by cumulative footprint
    const per: (typeof queue)[] = [[], [], []]
    let si = 0
    let used = 0
    const left: typeof queue = []
    for (const it of queue) {
      const f = footprint(it.kind)
      if (used + f > capacity[si]) {
        si++
        used = 0
        if (si > 2) { left.push(it); continue }
      }
      per[si].push(it)
      used += f
    }
    per.forEach((list, k) => {
      const seg = segs[k]
      const total = list.reduce((s, i) => s + footprint(i.kind), 0)
      const len = Math.hypot(seg.to[0] - seg.from[0], seg.to[1] - seg.from[1])
      const pad = Math.max(0, (len - total) / 2)
      let cur = pad
      for (const it of list) {
        const f = footprint(it.kind)
        const tpos = (cur + f / 2) / len
        items.push({
          id: it.id, kind: it.kind, rot: seg.rot,
          x: seg.from[0] + (seg.to[0] - seg.from[0]) * tpos,
          z: seg.from[1] + (seg.to[1] - seg.from[1]) * tpos,
        })
        cur += f
      }
    })
    queue = left
  }

  // --- centre: big surfaces on a loose grid, clear of both rings ---
  const inner = half - 7.2
  centre.forEach((it, k) => {
    const cols = Math.min(3, Math.max(1, centre.length))
    const rows = Math.ceil(centre.length / cols)
    const cx = k % cols
    const cy = Math.floor(k / cols)
    items.push({
      id: it.id, kind: it.kind, rot: 0,
      x: cols === 1 ? 0 : -inner + (2 * inner * cx) / (cols - 1),
      z: rows === 1 ? 1.2 : -inner * 0.45 + (inner * 0.95 * cy) / Math.max(1, rows - 1),
    })
  })

  // anything still queued (very crowded rooms) goes on a back row
  queue.forEach((it, k) => {
    items.push({ id: it.id, kind: it.kind, rot: 0,
      x: -half + 3 + ((k * 2.6) % (room - 6)), z: half - 2.4 })
  })

  return { items, room }
}
