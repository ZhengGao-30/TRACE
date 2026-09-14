import atlas1 from '../assets/ppe-choice/atlas-1.png'
import atlas2 from '../assets/ppe-choice/atlas-2-v2.png'
import atlas3 from '../assets/ppe-choice/atlas-3.png'
import atlas4 from '../assets/ppe-choice/atlas-4.png'
import evidenceReferences from '../assets/ppe-choice/evidence-references.png'

const positions = ['0% 0%', '100% 0%', '0% 100%', '100% 100%']
const sheets: [string, string[]][] = [
  [atlas1, ['boot', 'boot-scan', 'boot-screen', 'workwear']],
  [atlas2, ['workwear-screen', 'office', 'identity', 'rules']],
  [atlas3, ['certificate', 'register', 'tablet', 'stock']],
  [atlas4, ['reply', 'checklist', 'evidence', 'receipt']],
]
const illustrations = Object.fromEntries(sheets.flatMap(([src, names]) =>
  names.map((name, index) => [name, { src, position: positions[index] }]),
))

/** CSS selects a square quadrant; source illustrations stay intact. */
export function choiceArt(art: string): { src: string; position: string; size?: string } {
  if (art === 'evidence-references') return { src: evidenceReferences, position: 'center', size: 'contain' }
  return illustrations[art] ?? illustrations.rules
}
