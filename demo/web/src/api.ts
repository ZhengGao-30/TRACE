export interface RaceRow { cmd: string; p: number; r: number; score: number; win: boolean }
export interface LayerStat {
  z: number; z_wrong: number; X: number; expected: number; n: number; detected: boolean
}
export interface DetectResult {
  layer1: LayerStat; layer2: LayerStat; tau: number; source: string
  key1: number; key2: number
  consistency: { total: number; mismatch: number; rate: number }
}
export interface MatrixRow {
  attack: string; param: number | null
  z1: number; z2: number; z1_wrong: number; z2_wrong: number
  n1: number; n2: number; inconsistency: number
}
export interface Health {
  live: boolean; replay_records: number; tau: number; window_mode: string
  scheme: string; attacks: string[]
  keys: { key1: number; key2: number; wrong_key1: number; wrong_key2: number }
}
export interface GameInfo { task_id: number; task_type: string; game_id: string }
export interface ReplayRow {
  game_id: string; task_type: string; query: string; success: boolean
  groups: number; k2: number; z1: number; z2: number; detected: boolean
  source: 'local' | 'bundle'
}

const J = { 'Content-Type': 'application/json' }

/**
 * Backend base URL. Resolution order:
 *   1. ?api=<url> in the page URL (the launcher's "Open demo" uses this to inject
 *      the public tunnel URL), persisted to localStorage so it survives navigation.
 *   2. a previously saved value in localStorage.
 *   3. VITE_API_BASE baked in at build time.
 *   4. http://localhost:8000 — the default. On the deployed site this makes the
 *      "Try the live demo" button just work whenever the local launcher backend
 *      is running on THIS machine (Chrome/Edge exempt http://localhost from
 *      mixed-content blocking). Remote visitors with no backend get a graceful
 *      "backend not reachable" banner instead of a silent blank page.
 */
export const DEFAULT_API_BASE = 'http://localhost:8000'

function resolveApiBase(): string {
  try {
    const q = new URLSearchParams(window.location.search).get('api')
    if (q) { localStorage.setItem('trace.api', q); return q.replace(/\/+$/, '') }
    const saved = localStorage.getItem('trace.api')
    if (saved) return saved.replace(/\/+$/, '')
  } catch { /* ignore */ }
  const env = (import.meta as any).env?.VITE_API_BASE
  return env ? String(env).replace(/\/+$/, '') : DEFAULT_API_BASE
}

export const API_BASE = resolveApiBase()
const U = (path: string) => `${API_BASE}${path}`

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(U(url), { method: 'POST', headers: J, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  return r.json()
}
async function get<T>(url: string): Promise<T> {
  const r = await fetch(U(url))
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  return r.json()
}

export const api = {
  health: () => get<Health>('/api/health'),
  games: () => get<{ live: boolean; games: GameInfo[] }>('/api/games'),
  replayList: (onlySuccess = true) =>
    get<{ records: ReplayRow[] }>(`/api/replay?only_success=${onlySuccess}`),
  run: (body: { task_id?: number; arm?: string; mode?: string; game_id?: string; key1?: number; key2?: number }) =>
    post<{ session_id: string }>('/api/run', body),
  detect: (session_id: string, key1?: number, key2?: number) =>
    post<DetectResult>('/api/detect', { session_id, key1, key2 }),
  attack: (session_id: string, kind: string, rate: number) =>
    post<{ before: DetectResult; after: DetectResult; attack: string; rate: number }>(
      '/api/attack', { session_id, kind, rate }),
  matrix: (sid: string, rate = 0.3) => get<{ rows: MatrixRow[] }>(`/api/matrix/${sid}?rate=${rate}`),
  zcurve: (sid: string) => get<{ curve: any[] }>(`/api/zcurve/${sid}`),
  golden: () => get<any>('/api/golden'),
  distortionFree: (n = 20000) => post<any>('/api/distortion_free', { n }),
}

/** Subscribe to a session's SSE event stream. Returns an unsubscribe fn. */
export function subscribe(sid: string, onEvent: (e: any) => void): () => void {
  const es = new EventSource(U(`/api/stream/${sid}`))
  es.onmessage = (m) => {
    try { onEvent(JSON.parse(m.data)) } catch { /* ignore */ }
  }
  es.onerror = () => es.close()
  return () => es.close()
}
