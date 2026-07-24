import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export type Locale = 'zh' | 'en'

/**
 * Terminology follows the PAPER, not the code:
 *   selection channel = which action is chosen  (code: layer1 / EXP)
 *   tally channel     = how many records a decision group holds (code: layer2)
 */
const DICT = {
  // --- shell -------------------------------------------------------------
  appName: { zh: 'TRACE', en: 'TRACE' },
  appSub: {
    zh: '双信道鲁棒溯源水印 · 无失真 · ALFWorld',
    en: 'Two-Channel Robust Attribution Watermark · distortion-free · ALFWorld',
  },
  paperTitle: {
    zh: 'TRACE：面向 LLM Agent 轨迹的双信道互补嵌入鲁棒溯源水印',
    en: 'TRACE: A Two-Channel Robust Attribution Watermark via Complementary Embeddings for LLM-Agent Trajectories',
  },
  live: { zh: '在线 · 现场运行', en: 'LIVE · running now' },
  offline: { zh: '离线 · 回放真实轨迹', en: 'OFFLINE · replaying a logged run' },
  realtimeNote: { zh: '检测与攻击均为实时计算', en: 'detection & attacks computed live' },

  // --- backend connection ------------------------------------------------
  connErrTitle: { zh: '连接不上后端', en: 'Backend not reachable' },
  connErrBody: {
    zh: '这个 demo 需要连到一台正在运行的后端。如果你就是演示者,请打开 TRACE Backend 启动器点 Start,再点重试。如果是别人把 demo 发给你,把对方给的后端地址粘贴到下面,再点连接。',
    en: 'This demo needs a running backend. If you are the presenter, open the TRACE Backend launcher, click Start, then Retry. If someone shared this demo with you, paste the backend URL they gave you below and click Connect.',
  },
  connErrTrying: { zh: '当前尝试连接:{api}', en: 'Currently trying: {api}' },
  connErrPlaceholder: {
    zh: '粘贴后端地址,如 https://xxxx.trycloudflare.com',
    en: 'Paste backend URL, e.g. https://xxxx.trycloudflare.com',
  },
  connErrConnect: { zh: '连接', en: 'Connect' },
  connErrRetry: { zh: '重试', en: 'Retry' },
  staticNote: {
    zh: '离线演示 · 真实轨迹与检测已预先算好,无需后端。实时(现场调 LLM)模式需要在本机启动后端。',
    en: 'Offline demo · real trajectories and detection are precomputed, no backend needed. Live mode (real-time LLM) needs a local backend.',
  },

  // --- channels ----------------------------------------------------------
  selChannel: { zh: '选择信道', en: 'selection channel' },
  tallyChannel: { zh: '计数信道', en: 'tally channel' },
  selSub: {
    zh: '选哪个动作 · 挂局部内容 · 抗删除（删除后自同步）',
    en: 'which action · keyed on local content · deletion-robust (resyncs)',
  },
  tallySub: {
    zh: '每组几条记录 · 只挂日志骨架 · 抗改写（改写完全无效）',
    en: 'records per group · keyed on the log skeleton · rewrite-invariant',
  },

  // --- task picker -------------------------------------------------------
  modeLive: { zh: '在线', en: 'Live' },
  modeOffline: { zh: '离线', en: 'Offline' },
  liveHint: { zh: 'ALFWorld 任务 · 本地 {n} 局 · 现场调 LLM', en: 'ALFWorld games · {n} local · real LLM calls' },
  offlineHint: { zh: '已记录的真实轨迹 · {n} 条 · 不调 LLM', en: 'Logged real trajectories · {n} · no LLM calls' },
  startLive: { zh: '开始现场运行', en: 'Run live' },
  startReplay: { zh: '开始回放', en: 'Start replay' },
  runningNow: { zh: '运行中…', en: 'Running…' },
  goal: { zh: '任务目标', en: 'Task goal' },
  groupsUnit: { zh: '组', en: ' groups' },
  succeeded: { zh: '成功', en: 'success' },
  failed: { zh: '失败', en: 'failed' },
  speed: { zh: '播放速度', en: 'Playback speed' },

  // --- keys --------------------------------------------------------------
  rightKey: { zh: '正确密钥', en: 'Correct keys' },
  wrongKey: { zh: '错误密钥', en: 'Wrong keys' },

  // --- trace feed --------------------------------------------------------
  group: { zh: '决策组', en: 'GROUP' },
  emptyTitle: { zh: '选一个任务开始', en: 'Pick a task to begin' },
  emptySubLive: { zh: '真 LLM · 真采样 · 真检测', en: 'real LLM · real sampling · real detection' },
  emptySubOffline: { zh: '回放真实轨迹 · 检测实时重算', en: 'replaying a real run · detection recomputed live' },
  thinking: { zh: '思考', en: 'Reasoning' },
  executed: { zh: '执行', en: 'executed' },
  confirmStep: {
    zh: '计数信道 · 只读 · 无决策领头',
    en: 'tally channel · read-only · no decision in front',
  },

  // --- EXP race ----------------------------------------------------------
  raceTitle: { zh: '选择信道 · 无失真采样赛跑', en: 'Selection channel · distortion-free draw' },
  raceCands: { zh: '候选 {n} 个 · 显示前 {k}', en: '{n} candidates · showing top {k}' },
  legendP: { zh: 'p[b] 模型概率', en: 'p[b] model prob' },
  legendR: { zh: 'r[b] 密钥随机数', en: 'r[b] keyed draw' },
  legendScore: { zh: 'score = −log r / p（越小越赢）', en: 'score = −log r / p (lowest wins)' },

  // --- detection ---------------------------------------------------------
  detected: { zh: '已检出', en: 'DETECTED' },
  notDetected: { zh: '未检出', en: 'NOT DETECTED' },
  waiting: { zh: '等待第一组决策…', en: 'waiting for the first decision group…' },
  evidence: { zh: '证据累积（每多一组决策）', en: 'Evidence per additional decision group' },
  audit: { zh: '日志↔执行 一致性审计', en: 'log ↔ execution consistency audit' },
  auditRate: { zh: '异常率', en: 'mismatch' },
  robustPath: {
    zh: '检测走执行流鲁棒路径 · 候选集取自不可攻击的逐组记录',
    en: 'detection reads the executed stream · candidate sets come from the non-attackable per-group record',
  },

  // --- attacks -----------------------------------------------------------
  attackStrength: { zh: '攻击强度', en: 'Attack strength' },
  runMatrix: { zh: '跑完整正交矩阵', en: 'Run full orthogonality matrix' },
  runningMatrix: { zh: '跑完整攻击矩阵…', en: 'running full matrix…' },
  matrixTitle: { zh: '正交性矩阵 · 攻击者顾此失彼', en: 'Orthogonality · the adversary cannot win both' },
  colSel: { zh: 'z₁ 选择', en: 'z₁ selection' },
  colTally: { zh: 'z₂ 计数', en: 'z₂ tally' },
  colAudit: { zh: '异常率', en: 'mismatch' },
  matrixNote: {
    zh: '删除类攻击杀计数信道而选择信道存活；改写类攻击杀选择信道而计数信道纹丝不动；两者同时上才能都杀掉,但一致性异常率会飙升，转售方伪造日志的行为当场暴露。',
    en: 'Deletion kills the tally channel while selection survives; rewriting kills selection while the tally channel is untouched. Only doing both kills both, and then the consistency audit spikes, exposing the reseller.',
  },
  atk_clean: { zh: '未攻击', en: 'clean' },
  atk_deletion: { zh: '随机删步', en: 'random deletion' },
  atk_deletion_h: { zh: '按比例丢弃执行记录 → 打计数信道', en: 'drop executed records → hits the tally channel' },
  atk_strip_redundant: { zh: '定向删冗余', en: 'targeted strip' },
  atk_strip_redundant_h: { zh: '精确摘掉计数信道的冗余记录', en: 'surgically removes the tally records' },
  atk_semantic_rewrite: { zh: '语义改写', en: 'semantic rewrite' },
  atk_semantic_rewrite_h: { zh: 'LLM 改写观察文本，保持计数', en: 'LLM paraphrases observations, count preserved' },
  atk_llm_substitute: { zh: '身份替换', en: 'identity substitution' },
  atk_llm_substitute_h: { zh: 'LLM 换掉所选动作，保持计数 → 打选择信道', en: 'LLM swaps the chosen action → hits selection' },
  atk_combined: { zh: '组合攻击', en: 'combined' },
  atk_combined_h: { zh: '删+改同时上 → 两信道都打，但代价暴露', en: 'delete + rewrite → both channels, at a visible cost' },

  newGroups: { zh: '{n} 个新决策组 · 跳到最新', en: '{n} new groups · jump to latest' },

  // --- mobile gate -------------------------------------------------------
  mobileTitle: { zh: '交互演示为桌面设计', en: 'The interactive demo is built for desktop' },
  mobileBody: {
    zh: '实时轨迹、3D 房间与攻击面板需要较宽的屏幕。请在电脑上打开这个页面来体验完整演示。项目主页在手机上可以正常浏览。',
    en: 'The live trajectory, 3D room and attack panels need a wider screen. Open this page on a computer for the full demo. The project site itself reads fine on mobile.',
  },
  mobileBack: { zh: '← 返回项目主页', en: '← Back to the project site' },
  menu: { zh: '菜单', en: 'Menu' },

  // --- room HUD ----------------------------------------------------------
  standby: { zh: '待命中…', en: 'standby…' },
  step: { zh: '第 {n} 步', en: 'STEP {n}' },
  holding: { zh: '手持', en: 'holding' },
  taskDone: { zh: '任务完成', en: 'task complete' },
  taskFailed: { zh: '未完成', en: 'not completed' },
  tallyReadOnly: { zh: '计数信道 · 只读', en: 'tally · read-only' },

  // --- room verbs --------------------------------------------------------
  v_goto: { zh: '走向 {t}', en: 'go to {t}' },
  v_open: { zh: '打开 {t}', en: 'open {t}' },
  v_close: { zh: '关上 {t}', en: 'close {t}' },
  v_take: { zh: '从 {t} 拿起 {o}', en: 'take {o} from {t}' },
  v_put: { zh: '把 {o} 放到 {t}', en: 'put {o} in {t}' },
  v_cool: { zh: '用 {t} 冷却 {o}', en: 'cool {o} with {t}' },
  v_heat: { zh: '用 {t} 加热 {o}', en: 'heat {o} with {t}' },
  v_clean: { zh: '用 {t} 清洗 {o}', en: 'clean {o} with {t}' },
  v_use: { zh: '使用 {t}', en: 'use {t}' },
  v_examine: { zh: '端详 {o}', en: 'examine {o}' },
  v_look: { zh: '环顾四周', en: 'look around' },
  v_inventory: { zh: '检查随身物品', en: 'check inventory' },
} as const

export type Key = keyof typeof DICT

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: 'zh', setLocale: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  // Public site defaults to English; the choice persists across the two pages.
  const [locale, setLocale] = useState<Locale>(() => {
    const v = localStorage.getItem('trace.locale')
    return v === 'zh' || v === 'en' ? v : 'en'
  })
  const set = (l: Locale) => { localStorage.setItem('trace.locale', l); setLocale(l) }
  return <Ctx.Provider value={{ locale, setLocale: set }}>{children}</Ctx.Provider>
}

export function useI18n() {
  const { locale, setLocale } = useContext(Ctx)
  const t = (k: Key, vars?: Record<string, string | number>) => {
    let s: string = DICT[k]?.[locale] ?? String(k)
    if (vars) for (const [n, v] of Object.entries(vars)) s = s.replaceAll(`{${n}}`, String(v))
    return s
  }
  return { t, locale, setLocale }
}
