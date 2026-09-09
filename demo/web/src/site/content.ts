/**
 * Landing-page copy (English). Storyline = CSIRO Tech4HSE (Health, Safety &
 * Environment) accountability for AI agents, from the project slides. Plain
 * language, no formulas; every idea framed through a real HSE stake. The
 * reseller / log-holder is mentioned only as the adversary in the threat model.
 *
 * The project is a CSIRO's Data61 x UNSW collaboration; the paper's author list
 * is broader (see BIBTEX) but the PROJECT affiliations are those two only.
 */

// Copy is English-only. `t` is kept so the call sites read the same and a
// second language could be reintroduced in one place if it is ever wanted.
type L = string
const t = (en: string): L => en

/** Scene metadata only. No generated trajectory, outcome or watermark scores. */
export const CONSTRUCTION_CASES = [
  { key: 'CS01', gameId: 'hse_construction-CS01-scaffold__shift_fault_demo', title: 'Scaffold duty shift', taskType: 'construction_ppe_shift' },
  { key: 'CS02', gameId: 'hse_construction-CS02-timber_yard__shift_fault_demo', title: 'Timber-yard duty shift', taskType: 'construction_ppe_shift' },
] as const

type RecordedPolicyMetadata = {
  policy_source?: string
  provenance?: { policy_source?: string; agent_source?: string; source?: string }
}

/** Describe the recorded source, not a source inferred from the scenario. */
export function constructionPolicyCopy(record?: RecordedPolicyMetadata | null) {
  const source = record?.provenance?.policy_source ?? record?.provenance?.agent_source
    ?? record?.provenance?.source ?? record?.policy_source
  if (source === 'codex_llm') return {
    source, label: 'Codex LLM replay',
    detail: 'Codex LLM-elicited action weights from synthetic text observations, normalized before sampling; not token probabilities.',
  }
  if (source === 'api') return {
    source, label: 'API LLM replay',
    detail: 'Model-elicited action weights from synthetic text observations, normalized before sampling; not token probabilities.',
  }
  if (source === 'scenario_policy') return {
    source, label: 'Authored policy replay',
    detail: 'Authored scenario weights, not LLM probabilities.',
  }
  return { source, label: 'Source unverified', detail: 'The policy source has not been verified for this record.' }
}

export function constructionRunSummary(rows: (RecordedPolicyMetadata & { game_id?: string; task_type?: string })[]) {
  const shifts = rows.filter((row) => CONSTRUCTION_CASES.some((sample) => sample.taskType === 'construction_ppe_shift'
    && row.game_id === sample.gameId && row.task_type === sample.taskType))
  const copies = [...new Map(shifts.map((row) => {
    const copy = constructionPolicyCopy(row)
    return [copy.source, copy] as const
  })).values()]
  const sourceNote = copies.length === 1 ? `Available duty-shift records: ${copies[0].label}. ${copies[0].detail}`
    : copies.length > 1 ? `Available duty-shift sources: ${copies.map((copy) => copy.label).join('; ')}. Each replay identifies its action-weight source.`
      : 'Each replay identifies its recorded policy source and action weights when available.'
  return `${sourceNote} Controller faults and physical events are not watermark samples. The controlled fault is not evidence of a natural LLM failure.`
}

export const SITE = {
  brand: t('CSIRO Tech4HSE Project · CSIRO’s Data61 × UNSW'),

  nav: {
    hse: t('Why HSE'),
    scenarios: t('Scenarios'),
    how: t('How it works'),
    guarantees: t('Properties'),
    results: t('Results'),
    team: t('Team'),
    demo: t('Interactive demo'),
  },

  hero: {
    eyebrow: t('CSIRO Tech4HSE · Traceable records for AI agents'),
    title1: t('AI agents leave a record.'),
    title2: t('Trace where it came from.'),
    lede: t(
      'TRACE embeds two complementary watermarks in an agent’s action and observation records. Explore two construction sites in 3D through complete duty-shift demonstrations with explicit fault injection.'),
    ctaDemo: t('Explore the demo'),
    ctaPaper: t('Read the paper'),
    tagline: t('Two channels. One trajectory. Statistical evidence of its source.'),
  },

  // slide 2: HSE domains
  domains: {
    eyebrow: t('Why HSE'),
    title: t('AI agents are entering the records that safety decisions rest on.'),
    lede: t('Across Health, Safety & Environment, AI agents can help assemble records for human review. Traceable action logs help reviewers examine where a record came from. Its factual accuracy still depends on the underlying evidence.'),
    items: [
      t('Incident reporting'),
      t('Risk assessment'),
      t('Environmental monitoring'),
      t('Compliance auditing'),
      t('Equipment inspection'),
      t('AI-assisted decisions'),
    ],
    audience: t('For workplace-safety regulators, public-health agencies and hospitals, AI vendors building HSE platforms, and public-sector bodies.'),
  },

  // slide 3: the problem
  problem: {
    eyebrow: t('The problem'),
    title: t('An edited log can hide what the agent did.'),
    lede: t('Evidence checks and incident summaries leave an action trail. If someone deletes a check or rewrites a finding, reviewers need a way to test the source of the remaining record.'),
    rows: [
      { a: t('Evidence-review agent'), d: t('source found / missing'), img: 'permit' },
      { a: t('Inspection agent'), d: t('observed / uncertain'), img: 'inspection' },
      { a: t('Incident-review agent'), d: t('verified / needs review'), img: 'incident' },
      { a: t('Env-monitoring agent'), d: t('recorded / not established'), img: 'env' },
      { a: t('Risk-assessment agent'), d: t('supported / unresolved'), img: 'risk' },
      { a: t('Compliance-audit agent'), d: t('consistent / conflicting'), img: 'compliance' },
    ],
  },

  // Two synthetic engineering samples, separate from the paper benchmarks.
  scenarios: {
    eyebrow: t('Two synthetic construction samples'),
    title: t('Explore the scene.'),
    lede: t('Follow inspections, an explicitly injected faulty admission, and the same robot’s patrol, discovery and incident report. Inspect the recorded action weights and their source in each replay.'),
    sel: {
      badge: t('Sample 01 · Scaffold'),
      title: t('Scaffold duty shift'),
      lead: t('Old clearance records do not match current PPE. The robot checks identity, qualifications and replacement equipment. A separately injected controller fault admits the worker; patrol then records the falling timber and foot injury.'),
      workLabel: t('From decision to traceable record'),
      steps: [
        t('Check current credentials'),
        t('Verify PPE and rectification'),
        t('Retain recommendation and fault receipt'),
        t('Observe and report the incident'),
        t('Check record attribution'),
      ],
      how: t('Each replay identifies who supplied the weights over legal actions. TRACE retains the paper’s EXP and L2 methods. The controller fault is not a sampled choice and is excluded from detection. This is not a naturally occurring LLM failure.'),
      attackLabel: t('Try deleting a record'),
      attack: t('Remove a PPE-check record and recompute detection on the remaining log. The displayed statistics determine whether enough watermark evidence remains to support attribution.'),
      takeaway: t('Separate what the agent decided from which candidate key matches its log.'),
      caption: t('Controlled fault demo · the same robot inspects, patrols and reports.'),
    },
    tally: {
      badge: t('Sample 02 · Timber yard'),
      title: t('Timber-yard duty shift'),
      lead: t('An obscured footwear view, a limited authorization and an unsuitable equipment replacement need distinct checks. The controlled episode continues through the faulty admission, injury alert and the robot’s incident report.'),
      workLabel: t('From uncertain evidence to a recorded response'),
      steps: [
        t('Verify authorization scope'),
        t('Inspect distinct current views'),
        t('Keep the original recommendation'),
        t('Observe the event and report'),
        t('Check record attribution'),
      ],
      how: t('Prerequisites require each check to use evidence already available. Source time and observation time remain separate. An extra L2 record is an inert copy: it does not inspect again, advance the site clock or manufacture another incident.'),
      attackLabel: t('Try rewriting a finding'),
      attack: t('Change a recorded PPE finding and recompute detection. The L2 statistic stays unchanged when only content is rewritten and group counts are preserved; whether attribution is supported still depends on the measured evidence and threshold.'),
      takeaway: t('A source attribution result does not certify that an edited finding is true.'),
      caption: t('Controlled fault demo · observed conditions and source evidence stay separate.'),
    },
  },

  // slide 6: the key insight (why it's hard)
  insight: {
    eyebrow: t('Why it’s hard'),
    title: t('Two ways to alter a log.'),
    lede: t('Deleting records and rewriting their content disturb different parts of a trajectory. TRACE combines two channels with complementary dependencies.'),
    cols: [
      {
        tag: t('Deletion · shifts positions'),
        body: t('Deleting records shifts later positions. The selection channel uses content-based context to recover alignment where enough unchanged context remains.'),
      },
      {
        tag: t('Rewriting · changes content'),
        body: t('Rewording records changes their content. The counting channel uses group position and observation counts; content-only rewriting leaves those carriers unchanged.'),
      },
    ],
    resolve: t('Both channels contribute statistical evidence. After an attack, detection must be recomputed from the retained records; the result can weaken or fall below the threshold.'),
  },

  // slide 7: pipeline
  pipeline: {
    eyebrow: t('How it works'),
    title: t('Keep the method. Constrain the workflow.'),
    steps: [
      {
        n: '1', k: t('Embed'),
        body: t('First enforce the stage and causal prerequisites. Apply the paper’s EXP selection channel to the executable action distribution, and L2 to the observation count.'),
      },
      {
        n: '2', k: t('Produce'),
        body: t('Record each choice, its action weights and score, and the observations available at that time. Compare the actual checks, judgments and admission decisions; the two runs need not reach the same outcome.'),
      },
      {
        n: '3', k: t('Detect'),
        body: t('Reconstruct both channel inputs from the available log and score them with the key. Report the measured evidence against the configured detection threshold.'),
      },
    ],
    note: t('These two samples demonstrate the engineering workflow. They do not replace the paper’s benchmark evaluation, and attribution does not establish factual accuracy.'),
  },

  // slide 11: guarantees
  guarantees: {
    eyebrow: t('Method properties'),
    title: t('What the comparison shows.'),
    cards: [
      {
        title: t('Same action policy'),
        body: t('At the same observable state, both runs use the same executable action weights. The watermark changes the sampling choice, not those weights. Later states may differ.'),
      },
      {
        title: t('Causal order, evaluated decisions'),
        body: t('Both runs obey the same tool prerequisites. That does not guarantee safe judgments: omissions and admission decisions are evaluated against the supplied rules after execution.'),
      },
      {
        title: t('Complementary channels'),
        body: t('EXP marks the action selection. L2 marks the observation count. Content-only rewriting preserves the L2 carrier when group counts and order remain intact.'),
      },
      {
        title: t('Measured attribution'),
        body: t('Use the actual scores and threshold after deletion or rewriting. A positive result supports attribution under the detector’s assumptions; it does not prove every statement in the log.'),
      },
    ],
  },

  // slide 12: results
  results: {
    eyebrow: t('Results'),
    title: t('Almost lossless, yet an overwhelming signal.'),
    lede: t('Evaluated on ToolBench and ALFWorld against the unwatermarked agent and prior baselines.'),
    stats: [
      { v: '≈ 0', k: t('performance drop vs. the unwatermarked agent') },
      { v: 'z ≈ 100', k: t('detection strength on long trajectories') },
      { v: '70%', k: t('records deleted, still detected') },
      { v: '0', k: t('change in the counting channel under any rewriting') },
    ],
    utilityTitle: t('Utility preserved'),
    utilityCaption: t('Per-task success rate on ALFWorld (in- and out-of-distribution) and ToolBench. TRACE (rightmost) tracks the unwatermarked Base; the biased baseline (RG) drops by up to 8.1 points.'),
    robustTitle: t('Robust under attack'),
    robustCaption: t('Detection z under (a) deletion and (b) LLM rewriting. The selection channel withstands deletion; the counting channel (Trace tally) is exactly invariant to rewriting: a flat line no attack can move.'),
    takeaways: [
      {
        k: t('Deletion'),
        v: t('The selection channel stays above the detection threshold even after most observation records are removed.'),
      },
      {
        k: t('Rewriting'),
        v: t('The counting channel is a flat line: its detection score does not move at any rewriting strength (exactly invariant).'),
      },
      {
        k: t('Both at once'),
        v: t('Crippling both channels requires deleting and rewriting the whole trajectory, which destroys the very product being handed over.'),
      },
    ],
  },

  cta: {
    eyebrow: t('Explore the demo'),
    title: t('From scene to record.'),
    body: t('Replay a complete construction duty shift, from inspection through a controlled fault and incident report. Compare the recorded actions with and without watermarks, and inspect their weights and scores. Each replay identifies its source and limitations.'),
    button: t('Open the interactive demo'),
  },

  team: {
    eyebrow: t('Team'),
    title: t('The people behind TRACE.'),
    members: [
      { name: 'Zheng Gao', aff: 'UNSW', url: 'https://zhenggao-30.github.io/' },
      { name: 'Xiaoyu Li', aff: 'UNSW' },
      { name: 'Xiaoyan Feng', aff: 'Griffith University' },
      { name: 'Jiaojiao Jiang', aff: 'UNSW' },
      { name: 'Yang Song', aff: 'UNSW' },
      { name: 'Yulei Sui', aff: 'UNSW' },
      { name: 'Zhenchang Xing', aff: 'CSIRO’s Data61' },
      { name: 'Liming Zhu', aff: 'CSIRO’s Data61' },
    ],
    affiliations: t('A CSIRO’s Data61 × UNSW collaboration, supporting the CSIRO Tech4HSE program.'),
  },

  cite: {
    eyebrow: t('Citation'),
    title: t('Cite TRACE'),
  },

  footer: t('TRACE: Two-Channel Robust Attribution via Complementary Embeddings for LLM-Agent Trajectories. A CSIRO Tech4HSE project.'),
}

export const BIBTEX = `@article{gao2026trace,
  title   = {TRACE: A Two-Channel Robust Attribution Watermark via
             Complementary Embeddings for LLM-Agent Trajectories},
  author  = {Gao, Zheng and Li, Xiaoyu and Feng, Xiaoyan and Jiang, Jiaojiao
             and Song, Yang and Sui, Yulei and Xing, Zhenchang and Zhu, Liming},
  journal = {arXiv preprint arXiv:2607.08400},
  year    = {2026}
}`
