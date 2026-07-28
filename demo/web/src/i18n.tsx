import type { ReactNode } from 'react'

/**
 * UI strings (English only).
 *
 * Terminology follows the PAPER, not the code:
 *   selection channel = which action is chosen  (code: layer1 / EXP)
 *   tally channel     = how many records a decision group holds (code: layer2)
 */
const DICT = {
  // --- shell -------------------------------------------------------------
  appName: 'TRACE',
  appSub: 'Two-Channel Robust Attribution Watermark · distortion-free · ALFWorld',
  paperTitle: 'TRACE: A Two-Channel Robust Attribution Watermark via Complementary Embeddings for LLM-Agent Trajectories',
  live: 'LIVE · running now',
  offline: 'OFFLINE · replaying a logged run',
  realtimeNote: 'detection & attacks computed live',

  // --- backend connection ------------------------------------------------
  connErrTitle: 'Backend not reachable',
  connErrBody: 'This demo needs a running backend. If you are the presenter, open the TRACE Backend launcher, click Start, then Retry. If someone shared this demo with you, paste the backend URL they gave you below and click Connect.',
  connErrTrying: 'Currently trying: {api}',
  connErrPlaceholder: 'Paste backend URL, e.g. https://xxxx.trycloudflare.com',
  connErrConnect: 'Connect',
  connErrRetry: 'Retry',
  staticNote: 'Offline demo · real trajectories and detection are precomputed, no backend needed. Live mode (real-time LLM) needs a local backend.',

  // --- channels ----------------------------------------------------------
  selChannel: 'selection channel',
  tallyChannel: 'tally channel',
  selSub: 'which action · keyed on local content · deletion-robust (resyncs)',
  tallySub: 'records per group · keyed on the log skeleton · rewrite-invariant',

  // --- task picker -------------------------------------------------------
  modeLive: 'Live',
  modeOffline: 'Offline',
  liveHint: 'ALFWorld games · {n} local · real LLM calls',
  offlineHint: 'Logged real trajectories · {n} · no LLM calls',
  startLive: 'Run live',
  startReplay: 'Start replay',
  runningNow: 'Running…',
  goal: 'Task goal',
  groupsUnit: ' groups',
  succeeded: 'success',
  failed: 'failed',
  speed: 'Playback speed',

  // --- keys --------------------------------------------------------------
  rightKey: 'Correct keys',
  wrongKey: 'Wrong keys',

  // --- trace feed --------------------------------------------------------
  group: 'GROUP',
  emptyTitle: 'Pick a task to begin',
  emptySubLive: 'real LLM · real sampling · real detection',
  emptySubOffline: 'replaying a real run · detection recomputed live',
  thinking: 'Reasoning',
  executed: 'executed',
  confirmStep: 'tally channel · read-only · no decision in front',

  // --- EXP race ----------------------------------------------------------
  raceTitle: 'Selection channel · distortion-free draw',
  raceCands: '{n} candidates · showing top {k}',
  legendP: 'p[b] model prob',
  legendR: 'r[b] keyed draw',
  legendScore: 'score = −log r / p (lowest wins)',

  // --- detection ---------------------------------------------------------
  detected: 'DETECTED',
  notDetected: 'NOT DETECTED',
  waiting: 'waiting for the first decision group…',
  evidence: 'Evidence per additional decision group',
  audit: 'log ↔ execution consistency audit',
  auditRate: 'mismatch',
  robustPath: 'detection reads the executed stream · candidate sets come from the non-attackable per-group record',

  // --- attacks -----------------------------------------------------------
  attackStrength: 'Attack strength',
  runMatrix: 'Run full orthogonality matrix',
  runningMatrix: 'running full matrix…',
  matrixTitle: 'Orthogonality · the adversary cannot win both',
  colSel: 'z₁ selection',
  colTally: 'z₂ tally',
  colAudit: 'mismatch',
  matrixNote: 'Deletion kills the tally channel while selection survives; rewriting kills selection while the tally channel is untouched. Only doing both kills both, and then the consistency audit spikes, exposing the reseller.',
  atk_clean: 'clean',
  atk_deletion: 'random deletion',
  atk_deletion_h: 'drop executed records → hits the tally channel',
  atk_strip_redundant: 'targeted strip',
  atk_strip_redundant_h: 'surgically removes the tally records',
  atk_semantic_rewrite: 'semantic rewrite',
  atk_semantic_rewrite_h: 'LLM paraphrases observations, count preserved',
  atk_llm_substitute: 'identity substitution',
  atk_llm_substitute_h: 'LLM swaps the chosen action → hits selection',
  atk_combined: 'combined',
  atk_combined_h: 'delete + rewrite → both channels, at a visible cost',

  newGroups: '{n} new groups · jump to latest',

  // --- mobile gate -------------------------------------------------------
  mobileTitle: 'The interactive demo is built for desktop',
  mobileBody: 'The live trajectory, 3D room and attack panels need a wider screen. Open this page on a computer for the full demo. The project site itself reads fine on mobile.',
  mobileBack: '← Back to the project site',
  menu: 'Menu',

  // --- room HUD ----------------------------------------------------------
  standby: 'standby…',
  step: 'STEP {n}',
  holding: 'holding',
  taskDone: 'task complete',
  taskFailed: 'not completed',
  tallyReadOnly: 'tally · read-only',

  // --- room verbs --------------------------------------------------------
  v_goto: 'go to {t}',
  v_open: 'open {t}',
  v_close: 'close {t}',
  v_take: 'take {o} from {t}',
  v_put: 'put {o} in {t}',
  v_cool: 'cool {o} with {t}',
  v_heat: 'heat {o} with {t}',
  v_clean: 'clean {o} with {t}',
  v_use: 'use {t}',
  v_examine: 'examine {o}',
  v_look: 'look around',
  v_inventory: 'check inventory',
} as const

export type Key = keyof typeof DICT

/**
 * The site is English-only. This provider is kept as a passthrough so the tree
 * shape stays stable (and a second language could be reintroduced here alone).
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useI18n() {
  const t = (k: Key, vars?: Record<string, string | number>) => {
    let s: string = DICT[k] ?? String(k)
    if (vars) for (const [n, v] of Object.entries(vars)) s = s.replaceAll(`{${n}}`, String(v))
    return s
  }
  return { t }
}
