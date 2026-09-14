import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const contentSource = await readFile(new URL('../src/site/content.ts', import.meta.url), 'utf8')
const contentModule = { exports: {} }
Function('module', 'exports', ts.transpileModule(contentSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(contentModule, contentModule.exports)
const { CONSTRUCTION_CASES, constructionPolicyCopy, constructionRunSummary, SITE } = contentModule.exports



const archivedEntries = [
  { key: 'CS01-natural', gameId: 'hse_construction-CS01-scaffold__entry_check', title: 'Scaffold entry check', taskType: 'construction_ppe_entry_check' },
  { key: 'CS02-natural', gameId: 'hse_construction-CS02-timber_yard__entry_check', title: 'Timber-yard entry check', taskType: 'construction_ppe_entry_check' },
]


const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const tree = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function appFunction(name) {
  const node = tree.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === name)
  assert.ok(node, `Missing App copy helper: ${name}`)
  const code = ts.transpileModule(node.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return Function('constructionPolicyCopy', 'CONSTRUCTION_CASES', 'PPE_TASK', `${code}; return ${name}`)(constructionPolicyCopy, CONSTRUCTION_CASES, 'construction_ppe_inspection')
}
const replayOptions = appFunction('replayOptions')
const replayOptionLabel = appFunction('replayOptionLabel')
const constructionReplayNote = appFunction('constructionReplayNote')
function row(policy_source, sample = CONSTRUCTION_CASES[0]) {
  return { game_id: sample.gameId, task_type: sample.taskType, case_title: sample.title,
    policy_source, run_kind: 'ppe_inspection', groups: 24, success: false }
}

test('record copy identifies elicited Codex weights, authored weights and unavailable provenance separately', () => {
  assert.equal(constructionPolicyCopy(row('codex_llm')).label, 'Codex LLM replay')
  assert.match(constructionPolicyCopy(row('codex_llm')).detail, /LLM-elicited action weights.*synthetic text observations.*normalized before sampling.*not token probabilities/)
  assert.match(constructionPolicyCopy(row('scenario_policy')).detail, /Authored scenario weights, not LLM probabilities/)
  assert.match(constructionPolicyCopy(row('api')).detail, /Model-elicited action weights/)
  assert.equal(constructionPolicyCopy().label, 'Source unverified')
  assert.equal(constructionPolicyCopy(row('unknown')).label, 'Source unverified')
})

test('record provenance takes precedence over a stale summary or the controlled task type', () => {
  const record = { ...row('scenario_policy'), provenance: { policy_source: 'codex_llm' } }
  assert.equal(constructionPolicyCopy(record).source, 'codex_llm')
  assert.match(replayOptionLabel(record, 0), /24 actions · Codex LLM replay/)
  assert.doesNotMatch(constructionReplayNote(record), /Authored scenario weights/)
  assert.equal(constructionPolicyCopy({ ...row('codex_llm'), provenance: { policy_source: 'fixture' } }).label, 'Source unverified')
})

test('both PPE samples remain real recorded options without revealing final outcomes', () => {
  const options = replayOptions(CONSTRUCTION_CASES.map((sample) => row('codex_llm', sample)), 'hse')
  assert.equal(options.length, 2)
  for (const option of options) {
    assert.equal(option.previewOnly, false)
    const label = replayOptionLabel(option, 0)
    assert.match(label, /24 actions · Codex LLM replay/)
    assert.doesNotMatch(label, /✓|✗|approved|denied|injury/)
  }
})

test('only the two PPE inspections remain selectable even with a stale entry-check manifest', () => {
  assert.deepEqual(CONSTRUCTION_CASES.map((sample) => sample.key), ['CS01', 'CS02'])
  const staleRows = [
    ...archivedEntries.map((sample) => ({ ...row('codex_llm', sample), groups: 7 })),
    ...CONSTRUCTION_CASES.map((sample) => row('codex_llm', sample)),
  ]
  const options = replayOptions(staleRows, 'hse')
  assert.deepEqual(options.map((option) => option.game_id), CONSTRUCTION_CASES.map((sample) => sample.gameId))
  assert.ok(options.every((option) => option.groups === 24 && option.task_type === 'construction_ppe_inspection' && !option.previewOnly))
  assert.equal(replayOptions([], 'hse').length, 2, 'missing records cannot resurrect archived entry previews')
})

test('the shipped HSE manifest agrees with the two-sample live catalogue', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/static/manifest.json', import.meta.url), 'utf8'))
  const hseRows = manifest.games.filter((record) => record.scenario === 'hse')
  assert.deepEqual(hseRows.map((record) => record.game_id).sort(), CONSTRUCTION_CASES.map((sample) => sample.gameId).sort())
  assert.ok(hseRows.every((record) => record.groups === 24 && record.task_type === 'construction_ppe_inspection'))
})

test('landing copy no longer offers archived entry-check samples', () => {
  for (const copy of [SITE.hero.lede, SITE.scenarios.lede, SITE.cta.body]) {
    assert.doesNotMatch(copy, /original|entry (?:checks|records|recordings)/)
  }
})

test('the PPE picker rejects authored and unverified records', () => {
  const authored = replayOptions([row('scenario_policy')], 'hse')[0]
  assert.equal(authored.previewOnly, true)
  assert.equal(replayOptions([row('fixture')], 'hse')[0].previewOnly, true)
  assert.equal(replayOptions([{ ...row('codex_llm'), provenance: { policy_source: 'fixture' } }], 'hse')[0].previewOnly, true)
  const natural = row('codex_llm', archivedEntries[0])
  assert.match(replayOptionLabel(natural, 0), /Codex LLM replay/)
  assert.doesNotMatch(replayOptionLabel(natural, 0), /Controlled fault/)
})

test('inspection banners identify their source and do not include incident or admission actions', () => {
  for (const source of ['codex_llm', 'api', 'scenario_policy']) {
    const note = constructionReplayNote(row(source))
    assert.ok(note.includes(constructionPolicyCopy(row(source)).detail))
    assert.match(note, /PPE inspection.*Recorded replay of checks and reporting; no worksite admission or incident/)
  }
  const note = constructionReplayNote(row('codex_llm', archivedEntries[0]))
  assert.match(note, /Recorded entry check · Codex LLM replay/)
  assert.doesNotMatch(note, /Controlled fault|Injected controller/)
})

test('pending scene guidance limits the claim to unread evidence and future-event details', () => {
  assert.ok(appSource.includes('Unread evidence and future event details are withheld.'))
  assert.doesNotMatch(appSource, /No future event is supplied/)
  assert.doesNotMatch(constructionReplayNote({ ...row('codex_llm'), provenance: {
    policy_source: 'codex_llm', input_disclosure: 'TEST_ONLY_DISCLOSURE_FOR_CLOSED_DETAILS',
  } }), /TEST_ONLY_DISCLOSURE_FOR_CLOSED_DETAILS/)
})

test('landing summaries derive sources from actual inspection manifest entries, never case metadata alone', () => {
  for (const rows of [[], CONSTRUCTION_CASES.map((sample) => ({ game_id: sample.gameId, task_type: sample.taskType })),
    [row('codex_llm', archivedEntries[0])], [{ ...row('codex_llm'), game_id: 'unrelated-record' }]]) {
    assert.doesNotMatch(constructionRunSummary(rows), /Codex LLM replay|Authored policy replay/)
  }
  const codex = constructionRunSummary(CONSTRUCTION_CASES.map((sample) => row('codex_llm', sample)))
  assert.match(codex, /Available PPE inspection records: Codex LLM replay.*not token probabilities/)
  assert.doesNotMatch(codex, /Authored scenario weights/)
  assert.match(constructionRunSummary([row('scenario_policy')]), /Authored policy replay.*not LLM probabilities/)
  const mixed = constructionRunSummary([row('scenario_policy'), row('codex_llm', CONSTRUCTION_CASES[1])])
  assert.match(mixed, /Available inspection sources: Authored policy replay; Codex LLM replay/)
  assert.match(mixed, /Source attribution is separate from judging/)
})
