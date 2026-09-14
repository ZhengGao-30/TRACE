



import { asset } from './asset'
import type { Health, DetectResult, MatrixRow } from '../api'

export interface StaticAttack {
  rate: number
  after: DetectResult
  surviving_groups: number
}
export interface StaticGame {
  summary: any
  events: any[]
  detect: { right: DetectResult; wrong: DetectResult }
  attacks: Record<string, StaticAttack[]>
  matrix: { rate: number; rows: MatrixRow[] }[]
}
export interface StaticManifest {
  keys: { key1: number; key2: number; wrong_key1: number; wrong_key2: number }
  tau: number
  window_mode: string
  scheme: string
  attacks: string[]
  games: any[]
}

let _manifest: StaticManifest | null = null

export async function loadStaticManifest(): Promise<StaticManifest> {
  const r = await fetch(asset('static/manifest.json'), { cache: 'no-cache' })
  if (!r.ok) throw new Error('no static manifest')
  _manifest = await r.json()
  return _manifest!
}

export async function loadStaticGame(gameId: string): Promise<StaticGame> {
  const row = (_manifest?.games || []).find((g) => g.game_id === gameId)
  const slug = (row && row.slug) || gameId
  const r = await fetch(asset('static/game/' + slug + '.json'), { cache: 'no-cache' })
  if (!r.ok) throw new Error('static game not found: ' + gameId)
  return r.json()
}

export function staticHealth(m: StaticManifest): Health {
  return {
    live: false,
    replay_records: m.games.length,
    tau: m.tau,
    window_mode: m.window_mode,
    scheme: m.scheme,
    attacks: m.attacks,
    keys: m.keys,
  }
}

function nearest<T extends { rate: number }>(list: T[] | undefined, rate: number): T | undefined {
  if (!list || !list.length) return undefined
  return list.reduce((a, b) => (Math.abs(b.rate - rate) < Math.abs(a.rate - rate) ? b : a))
}


export function staticAttack(g: StaticGame, kind: string, rate: number) {
  const before = g.detect.right
  const pick = nearest(g.attacks[kind], rate)
  if (!pick) throw new Error('No recorded evaluation exists for this attack.')
  return {
    attack: kind,
    rate: pick.rate,
    before,
    after: pick.after,
    surviving_groups: pick.surviving_groups,
  }
}


export function staticMatrix(g: StaticGame, rate: number): MatrixRow[] {
  const pick = nearest(g.matrix, rate)
  if (!pick) throw new Error('No recorded attack matrix exists for this run.')
  return pick.rows
}
