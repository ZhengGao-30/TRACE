import type { ReactNode } from 'react'








const DICT = {

  appName: 'TRACE',
  appSub: 'Two-Channel Robust Attribution Watermark · distortion-free',
  paperTitle: 'TRACE: A Two-Channel Robust Attribution Watermark via Complementary Embeddings for LLM-Agent Trajectories',
  live: 'LIVE · running now',
  offline: 'OFFLINE · replaying a logged run',
  realtimeNote: 'detection & attacks computed live',


  connErrTitle: 'Backend not reachable',
  connErrBody: 'This demo needs a running backend. If you are the presenter, open the TRACE Backend launcher, click Start, then Retry. If someone shared this demo with you, paste the backend URL they gave you below and click Connect.',
  connErrTrying: 'Currently trying: {api}',
  connErrPlaceholder: 'Paste backend URL, e.g. https://xxxx.trycloudflare.com',
  connErrConnect: 'Connect',
  connErrRetry: 'Retry',
  staticNote: 'Offline demo · real trajectories and detection are precomputed, no backend needed. Live mode (real-time LLM) needs a local backend.',


  selChannel: 'selection channel',
  tallyChannel: 'tally channel',
  selSub: 'which action · keyed on local content · deletion-robust (resyncs)',
  tallySub: 'records per group · keyed on the log skeleton · rewrite-invariant',


  modeLive: 'Live',
  modeOffline: 'Offline',
  liveHint: 'Household task games · {n} local · real LLM calls',
  offlineHint: 'Logged real trajectories · {n} · no LLM calls',
  startLive: 'Run live',
  startReplay: 'Start replay',
  runningNow: 'Running…',
  goal: 'Task goal',
  groupsUnit: ' groups',
  succeeded: 'success',
  failed: 'failed',
  speed: 'Playback speed',


  rightKey: 'Correct keys',
  wrongKey: 'Wrong keys',


  group: 'GROUP',
  emptyTitle: 'Pick a task to begin',
  emptySubLive: 'real LLM · real sampling · real detection',
  emptySubOffline: 'replaying a real run · detection recomputed live',
  thinking: 'Reasoning',
  executed: 'executed',
  confirmStep: 'tally channel · read-only · no decision in front',


  raceTitle: 'Selection channel · distortion-free draw',
  raceCands: '{n} candidates · showing top {k}',
  legendP: 'p[b] action probability',
  legendR: 'r[b] keyed draw',
  legendScore: 'score = −log r / p (lowest wins)',


  detected: 'DETECTED',
  notDetected: 'NOT DETECTED',
  waiting: 'waiting for the first decision group…',
  evidence: 'Evidence per additional decision group',
  audit: 'log ↔ execution consistency audit',
  auditRate: 'mismatch',
  robustPath: 'detection reads the executed stream · candidate sets come from the non-attackable per-group record',


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


  mobileTitle: 'The interactive demo is built for desktop',
  mobileBody: 'The live trajectory, 3D room and interactive panels need a wider screen. Open this page on a computer for the full demo. The project site itself reads fine on mobile.',
  mobileBack: '← Back to the project site',
  menu: 'Menu',


  permitStamped: 'steps stamped',
  permitClosed: 'record closed',
  permitIncomplete: 'not closed',
  permitEmpty: 'Pick a job to begin. Each decision the agent takes is stamped into the record below.',
  permitK1: 'one record',
  permitK2: 'two records',
  permitTallyNote: 'record count per step = the tally channel · rewriting words cannot change it',
  thisStep: 'this step',
  threatLink: 'What if someone edits the record?',
  threatHint: 'A permit, an incident, and a cover-up — told in nine panels',
  docketTitle: 'RECORD BEING BUILT',
  docketHide: 'hide record',
  docketShow: 'show record',
  docketLegend: 'blocks = records in that step · the tally channel',
  recordClosed: 'record closed',
  scenario: 'Scenario',
  sc_alfworld: 'Household Tasks',
  sc_alfworld_h: 'everyday household tasks used in the paper benchmark',
  sc_hse: 'Industrial Safety (HSE)',
  sc_hse_h: 'HSE permits, industrial safety & environmental compliance',


  standby: 'standby…',
  step: 'STEP {n}',
  holding: 'holding',
  taskDone: 'task complete',
  taskFailed: 'not completed',
  tallyReadOnly: 'tally · read-only',


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
