/**
 * Landing-page copy, EN + ZH. Storyline = Tech4HSE (Health, Safety &
 * Environment) accountability for AI agents, from the project slides. Plain
 * language, no formulas; every idea framed through a real HSE stake. The
 * reseller / log-holder is mentioned only as the adversary in the threat model.
 */
import type { Locale } from '../i18n'

type L = Record<Locale, string>
const t = (en: string, zh: string): L => ({ en, zh })

export const SITE = {
  brand: t('Tech4HSE Project · CSIRO Data61 × UNSW',
           'Tech4HSE 项目 · CSIRO Data61 × UNSW'),

  nav: {
    hse: t('Why HSE', 'HSE 背景'),
    scenarios: t('Scenarios', '真实场景'),
    how: t('How it works', '原理'),
    guarantees: t('Guarantees', '保证'),
    results: t('Results', '结果'),
    team: t('Team', '团队'),
    demo: t('Live demo', '在线演示'),
  },

  hero: {
    eyebrow: t('Tech4HSE · Trustworthy, tamper-evident records for AI agents',
               'Tech4HSE · 面向 AI Agent 的可信、防篡改记录'),
    title1: t('Safety-critical work is moving to AI agents.',
              '安全攸关的工作正在交给 AI Agent。'),
    title2: t('Make every trajectory provable.',
              '让每一条轨迹都可被证明。'),
    lede: t(
      'When an AI agent runs Health, Safety & Environment work (approving a permit, documenting a spill, filing an incident report), its behaviour trajectory is the evidence for accountability. But that log can be altered in seconds and verified by no one. TRACE layers two complementary watermarks onto the trajectory, so even the party holding the log cannot delete or rewrite their way out of it: the record still proves which agent produced it.',
      '当 AI Agent 承担 Health, Safety & Environment(HSE)工作(批准一张作业许可、记录一次泄漏、提交一份事故报告),它的行为轨迹就是问责的证据。但这份日志可以在几秒内被改动,而且无人核验。TRACE 在轨迹上叠加两个互补水印,于是即便握有日志的一方,也无法靠删除或改写脱身:记录依然能证明是哪个 Agent 产生了它。'),
    ctaDemo: t('Try the live demo', '打开在线演示'),
    ctaPaper: t('Read the paper', '阅读论文'),
    tagline: t('Two complementary channels. One trajectory. Provenance that can’t be laundered.',
               '两个互补信道,一条轨迹,无法被洗白的溯源。'),
  },

  // slide 2: HSE domains
  domains: {
    eyebrow: t('Why HSE', 'HSE 背景'),
    title: t('AI agents are entering the records that safety decisions rest on.',
             'AI Agent 正进入那些安全决策所依赖的记录。'),
    lede: t('Across Health, Safety & Environment, agents already draft the evidence that regulators, auditors and courts rely on. Robust attribution makes that evidence certifiable and traceable, and cuts the risk of tampered or forged agent logs.',
            '在 Health, Safety & Environment 的各个环节,Agent 已经在起草监管机构、审计方与法庭所依赖的证据。鲁棒的归属让这些证据可认证、可追溯,并降低日志被篡改或伪造的风险。'),
    items: [
      t('Incident reporting', '事故报告'),
      t('Risk assessment', '风险评估'),
      t('Environmental monitoring', '环境监测'),
      t('Compliance auditing', '合规审计'),
      t('Equipment inspection', '设备检查'),
      t('AI-assisted decisions', 'AI 辅助决策'),
    ],
    audience: t('For workplace-safety regulators, public-health agencies and hospitals, AI vendors building HSE platforms, and public-sector bodies.',
                '面向:职业安全监管机构、公共卫生机构与医院、构建 HSE 平台的 AI 厂商,以及公共部门。'),
  },

  // slide 3: the problem
  problem: {
    eyebrow: t('The problem', '问题'),
    title: t('The only record is the trajectory, and it can be altered in seconds.',
             '唯一的记录就是轨迹,而它能在几秒内被改动。'),
    lede: t('Inspections, permits and incident reports are now run by AI agents. When a critical HSE decision hinges on what the agent did, every trajectory must be attributable, not merely readable.',
            '检查、许可、事故报告如今由 AI Agent 执行。当一个关键 HSE 决策取决于 Agent 做了什么,每一条轨迹都必须可归属,而不仅仅是可读。'),
    rows: [
      { a: t('Permit-to-work agent', '作业许可 Agent'), d: t('granted / refused', '批准 / 拒绝'), img: 'permit' },
      { a: t('Inspection agent', '检查 Agent'), d: t('shut down / clear', '停工 / 放行'), img: 'inspection' },
      { a: t('Incident-report agent', '事故报告 Agent'), d: t('claim paid / denied', '理赔 / 拒赔'), img: 'incident' },
      { a: t('Env-monitoring agent', '环境监测 Agent'), d: t('fine / waiver', '罚款 / 豁免'), img: 'env' },
      { a: t('Risk-assessment agent', '风险评估 Agent'), d: t('rectify / pass', '整改 / 通过'), img: 'risk' },
      { a: t('Compliance-audit agent', '合规审计 Agent'), d: t('compliant / breach', '合规 / 违规'), img: 'compliance' },
    ],
  },

  // slides 4 & 5: the two real scenarios (with the infographics)
  scenarios: {
    eyebrow: t('Two real HSE scenarios', '两个真实 HSE 场景'),
    title: t('One watermark for deletion, one for rewriting.',
             '一个水印防删除,一个防改写。'),
    lede: t('TRACE stamps two independent watermarks at every decision. Each scenario below shows one channel doing its job against one kind of tampering.',
            'TRACE 在每次决策处打上两个独立水印。下面每个场景展示一个信道如何抵御一种篡改。'),
    sel: {
      badge: t('Use case 1 · Selection channel', '场景一 · 选择信道'),
      title: t('Confined-space permit-to-work: survives deletion.',
               '密闭空间作业许可:抗删除。'),
      lead: t('Entering a tank, silo or sewer is one of the most dangerous jobs on any site: low oxygen, toxic gas and no easy exit. Before anyone goes in, a permit-to-work must certify that the space is safe, and increasingly that certification is drafted by an AI safety agent.',
              '进入储罐、筒仓或下水道,是任何工地上最危险的作业之一:缺氧、有毒气体、难以撤离。任何人进入前,必须由一张「作业许可」证明该空间安全,而如今这份认证越来越多地由一个 AI 安全 Agent 起草。'),
      workLabel: t('What the agent checks, in order', 'Agent 依次检查'),
      steps: [
        t('Check worker competency', '核验作业人员资质'),
        t('Verify gas-test reading', '确认气体检测读数'),
        t('Confirm ventilation', '确认通风'),
        t('Check isolation / lockout', '检查隔离 / 上锁挂牌'),
        t('Confirm rescue standby', '确认救援待命'),
        t('Generate permit-to-work', '生成作业许可'),
      ],
      how: t('At each of these decisions, TRACE hides a keyed watermark in which action the agent takes: the selection channel. It changes nothing the agent does; the permit is issued exactly as before. Without the secret key the mark cannot be read, reproduced or forged.',
             '在上面每一次决策处,TRACE 把带密钥的水印藏进「Agent 选了哪个动作」,这就是选择信道。它不改变 Agent 的任何行为,许可照常签发。没有密钥,水印无法被读取、复现或伪造。'),
      attackLabel: t('Under deletion', '遭遇删除'),
      attack: t('Suppose someone later deletes an inconvenient step, say the gas-test that came back marginal. The watermark re-aligns on the remaining steps, so the trimmed log still provably traces to your agent. To erase the mark they would have to destroy the whole trajectory, which is exactly the evidence they wanted to keep.',
                '假设有人事后删掉一个不利步骤,比如那次读数勉强合格的气体检测。水印会在剩余步骤上重新对齐,被裁剪的日志依然可证明地追溯到你的 Agent。要抹掉水印,他们只能毁掉整条轨迹,而那恰恰是他们本想留下的证据。'),
      takeaway: t('Deleting steps can’t launder the log out of your agent’s authorship.',
                  '删除步骤,无法把日志从你的 Agent 的作者身份中洗掉。'),
      caption: t('Scenario 1: the selection channel defends against deletion.',
                 '场景一:选择信道抵御删除。'),
    },
    tally: {
      badge: t('Use case 2 · Counting channel', '场景二 · 计数信道'),
      title: t('Environmental compliance: survives rewriting.',
               '环境合规:抗改写。'),
      lead: t('When a chemical spill happens, a stream of readings, samples and remediation records becomes the regulator’s evidence, and the basis for fines, permits and liability. An AI compliance agent documents the whole response, step by step.',
              '一旦发生化学品泄漏,一连串的读数、采样与处置记录就成了监管方的证据,也是罚款、许可与责任认定的依据。一个 AI 合规 Agent 逐步记录整个处置过程。'),
      workLabel: t('What the agent records, in order', 'Agent 依次记录'),
      steps: [
        t('Read calibrated sensor', '读取校准传感器'),
        t('Capture geotagged sample', '采集带定位的样本'),
        t('Log containment', '记录围堵情况'),
        t('Compare to permit limits', '对照许可限值'),
        t('Record remediation', '记录修复处置'),
        t('File compliance report', '提交合规报告'),
      ],
      how: t('TRACE hides a second watermark in how many records the agent keeps per step: the counting channel. It reads only the log’s structure, never its content. The extra record it sometimes adds is an inert marker: no tool call, no data, no effect on the outcome.',
             'TRACE 把第二个水印藏进「Agent 每一步保留几条记录」,这就是计数信道。它只读日志的结构,从不碰内容。它偶尔多加的那条记录是惰性标记:没有工具调用、没有数据、对结果毫无影响。'),
      attackLabel: t('Under rewriting', '遭遇改写'),
      attack: t('Now suppose the holder rewrites the readings: an over-limit pH quietly edited to within-limit, wording and tool names all changed. Because rewriting words never changes how many records a step has, the counting channel is exactly unchanged. The doctored report still provably came from your agent and cannot be disowned or pinned on another source.',
                '再假设持有方改写了读数:把一个超标的 pH 值悄悄改成合格,措辞和工具名全部改掉。因为改写文字从不改变一步有几条记录,计数信道分毫未动。被篡改的报告依然可证明地来自你的 Agent,无法被抵赖,也无法嫁祸他源。'),
      takeaway: t('Rewriting the words can’t touch a structural watermark.',
                  '改写文字,动不了一个结构性水印。'),
      caption: t('Scenario 2: the counting channel defends against rewriting.',
                 '场景二:计数信道抵御改写。'),
    },
  },

  // slide 6: the key insight (why it's hard)
  insight: {
    eyebrow: t('Why it’s hard', '为何难'),
    title: t('No single watermark can resist both attacks.',
             '单一水印无法同时抵御两种攻击。'),
    lede: t('An adversary who holds the log has two moves. They defeat opposite kinds of key, which is exactly why TRACE needs two.',
            '握有日志的对手有两招。它们各自击败一种密钥,这正是 TRACE 需要两个信道的原因。'),
    cols: [
      {
        tag: t('Deletion · shifts positions', '删除 · 打乱位置'),
        body: t('Delete a span of records and every later record’s position is thrown off. To resist deletion, the key must come from content, so it can re-align automatically after a span is removed.',
                '删掉一段记录,之后每条记录的位置都被打乱。要抗删除,密钥必须来自内容,这样在一段被移除后能自动重新对齐。'),
      },
      {
        tag: t('Rewriting · changes content', '改写 · 改变内容'),
        body: t('Reword text and rename tools, changing the content of every record. To resist rewriting, the key must come from position, which no content change can move.',
                '改写文字、重命名工具,让每条记录的内容都变。要抗改写,密钥必须来自位置,而任何内容改动都动不了位置。'),
      },
    ],
    resolve: t('One trajectory has room for two watermarks: one bound to content, one bound to position, each guarding against one attack and complementing the other.',
               '一条轨迹里,恰好容得下两个水印:一个挂在内容上,一个挂在位置上,各防一种攻击,互为补充。'),
  },

  // slide 7: pipeline
  pipeline: {
    eyebrow: t('How it works', '原理'),
    title: t('Stamp two watermarks at every decision point.',
             '在每个决策点打上两个水印。'),
    steps: [
      {
        n: '1', k: t('Embed', '嵌入'),
        body: t('At each decision, stamp two watermarks at once: which action is chosen (selection channel) and how many records are kept (counting channel).',
                '在每次决策处,同时打上两个水印:选了哪个动作(选择信道),以及保留几条记录(计数信道)。'),
      },
      {
        n: '2', k: t('Produce', '产出'),
        body: t('You get a watermarked trajectory log, delivered as usual, with zero impact on how the agent is used or on task outcomes.',
                '你得到一份带水印的轨迹日志,照常交付,对 Agent 的使用和任务结果零影响。'),
      },
      {
        n: '3', k: t('Detect', '检测'),
        body: t('Replay each channel with the key and score it. If either channel is strong enough, attribution succeeds: deletion is caught by one, rewriting by the other.',
                '用密钥重放每个信道并打分。只要任一信道足够强,归属即成立:删除被一个抓住,改写被另一个抓住。'),
      },
    ],
    note: t('Two watermarks, with independent keys, different carriers and non-overlapping weaknesses. Detection trusts no self-reported field the adversary might have tampered with.',
            '两个水印,密钥独立、载体不同、弱点不重叠。检测不信任任何可能被对手篡改的自报字段。'),
  },

  // slide 11: guarantees
  guarantees: {
    eyebrow: t('The guarantees', '我们能给的保证'),
    title: t('What TRACE promises.', 'TRACE 的承诺。'),
    cards: [
      {
        title: t('No performance loss', '无性能损失'),
        body: t('The agent does exactly what it did before, with task success barely dropping, provably distortion-free.',
                'Agent 的行为和之前完全一致,任务成功率几乎不降,可证明无失真。'),
      },
      {
        title: t('Resists deletion', '抗删除'),
        body: t('Even if most observation records are deleted, the selection channel still detects the watermark.',
                '即便大多数观察记录被删除,选择信道仍能检出水印。'),
      },
      {
        title: t('Resists rewriting, exactly invariant', '抗改写,完全不变'),
        body: t('Under rewriting of any intensity, the counting channel is completely unchanged.',
                '在任意强度的改写下,计数信道完全不变。'),
      },
      {
        title: t('Joint erasure is self-defeating', '双重擦除会自曝'),
        body: t('To erase both watermarks at once, the adversary can only destroy the very trajectory it wanted to resell or hand over. Laundering this log means destroying this log.',
                '要同时擦掉两个水印,对手只能毁掉它本想转售或上交的那条轨迹。洗白这份日志,就等于毁掉这份日志。'),
      },
    ],
  },

  // slide 12: results
  results: {
    eyebrow: t('Results', '结果'),
    title: t('Almost lossless, yet an overwhelming signal.',
             '几乎无损,却是压倒性的信号。'),
    lede: t('Evaluated on ToolBench and ALFWorld against the unwatermarked agent and prior baselines.',
            '在 ToolBench 与 ALFWorld 上,对照无水印 Agent 与已有基线评测。'),
    stats: [
      { v: '≈ 0', k: t('performance drop vs. the unwatermarked agent', '相比无水印 Agent 的性能下降') },
      { v: 'z ≈ 100', k: t('detection strength on long trajectories', '长轨迹上的检测强度') },
      { v: '70%', k: t('records deleted, still detected', '删除记录后仍可检出') },
      { v: '0', k: t('change in the counting channel under any rewriting', '任意改写下计数信道的变化') },
    ],
    utilityTitle: t('Utility preserved', '效用保持'),
    utilityCaption: t('Per-task success rate on ALFWorld (in- and out-of-distribution) and ToolBench. TRACE (rightmost) tracks the unwatermarked Base; the biased baseline (RG) drops by up to 8.1 points.',
                      'ALFWorld(分布内/外)与 ToolBench 上的每任务成功率。TRACE(最右)紧贴无水印 Base;有偏基线(RG)最多下降 8.1 分。'),
    robustTitle: t('Robust under attack', '攻击下的鲁棒性'),
    robustCaption: t('Detection z under (a) deletion and (b) LLM rewriting. The selection channel withstands deletion; the counting channel (Trace tally) is exactly invariant to rewriting: a flat line no attack can move.',
                     '检测分数 z 在 (a) 删除 与 (b) LLM 改写 下的表现。选择信道抵御删除;计数信道(Trace tally)对改写完全不变:一条任何攻击都推不动的水平线。'),
    takeaways: [
      {
        k: t('Deletion', '删除'),
        v: t('The selection channel stays above the detection threshold even after most observation records are removed.',
             '即便移除大多数观察记录,选择信道仍高于检测阈值。'),
      },
      {
        k: t('Rewriting', '改写'),
        v: t('The counting channel is a flat line: its detection score does not move at any rewriting strength (exactly invariant).',
             '计数信道是一条水平线:无论改写强度多大,它的检测分数都不动(完全不变)。'),
      },
      {
        k: t('Both at once', '两者同时'),
        v: t('Crippling both channels requires deleting and rewriting the whole trajectory, which destroys the very product being handed over.',
             '要同时压制两个信道,只能又删又改整条轨迹,而那会毁掉正在交付的产品本身。'),
      },
    ],
  },

  cta: {
    eyebrow: t('See it live', '现场看'),
    title: t('Watch a watermarked agent run, then try to launder it.',
             '看一个带水印的 Agent 跑起来,再试着洗白它。'),
    body: t('An interactive dashboard runs a real agent through an ALFWorld room, shows both watermarks being stamped at every decision, then lets you delete or rewrite the log and watch detection hold or fall in real time.',
            '一个交互式看板,让真实 Agent 跑过一间 ALFWorld 房间,展示每次决策处两个水印如何打上,然后让你删除或改写日志,实时看着检测顶住或崩塌。'),
    button: t('Open the interactive demo', '打开交互演示'),
  },

  team: {
    eyebrow: t('Team', '团队'),
    title: t('The people behind TRACE.', 'TRACE 背后的团队。'),
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
    affiliations: t('A CSIRO’s Data61 × UNSW collaboration, with Griffith University, supporting the Tech4HSE program.',
                    'CSIRO Data61 × UNSW 合作,联合格里菲斯大学,支持 Tech4HSE 计划。'),
  },

  cite: {
    eyebrow: t('Citation', '引用'),
    title: t('Cite TRACE', '引用 TRACE'),
  },

  footer: t('TRACE: Two-Channel Robust Attribution via Complementary Embeddings for LLM-Agent Trajectories. A Tech4HSE project.',
            'TRACE:面向 LLM Agent 轨迹的双信道互补嵌入鲁棒溯源。Tech4HSE 项目。'),
}

export const BIBTEX = `@article{gao2026trace,
  title   = {TRACE: A Two-Channel Robust Attribution Watermark via
             Complementary Embeddings for LLM-Agent Trajectories},
  author  = {Gao, Zheng and Li, Xiaoyu and Feng, Xiaoyan and Jiang, Jiaojiao
             and Song, Yang and Sui, Yulei and Xing, Zhenchang and Zhu, Liming},
  journal = {arXiv preprint arXiv:2607.08400},
  year    = {2026}
}`
