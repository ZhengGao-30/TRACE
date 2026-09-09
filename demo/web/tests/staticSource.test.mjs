import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/staticSource.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source.replace("import { asset } from './asset'", 'const asset = (path: string) => path'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { staticAttack, staticMatrix } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const clean = { layer1: { z: 4 }, layer2: { z: 3 } }
const after = { layer1: { z: 1 }, layer2: { z: 2 } }
const game = {
  detect: { right: clean },
  attacks: { deletion: [{ rate: .3, after, surviving_groups: 14 }] },
  matrix: [{ rate: .3, rows: [{ attack: 'deletion', z1: 1, z2: 2 }] }],
}

test('static attacks use a recorded result and report its actual baked rate', () => {
  const result = staticAttack(game, 'deletion', .31)
  assert.equal(result.before, clean)
  assert.equal(result.after, after)
  assert.equal(result.rate, .3)
  assert.equal(result.surviving_groups, 14)
  assert.equal(game.detect.right, clean, 'original record is not mutated')
})

test('unsupported attacks cannot silently return the clean result', () => {
  assert.throws(() => staticAttack(game, 'llm_substitute', .3), /No recorded evaluation/)
  assert.throws(() => staticMatrix({ ...game, matrix: [] }, .3), /No recorded attack matrix/)
  assert.deepEqual(staticMatrix(game, .3), game.matrix[0].rows)
})
