import { useId } from 'react'
import {
  BookOpen, Building2, Camera, Check, CheckCircle2, CircleHelp, ClipboardList, Eye,
  FileCheck2, FileText, Files, KeyRound, Link2, ScanLine, Send, Tablet, Tag, XCircle,
} from 'lucide-react'
import type { PairedTrajectoryStep } from './PairedWorkflowStrip'
import type { PlaybackArm } from '../lib/ppePlayback'
import { buildPPEChoiceComparison } from '../lib/ppeChoiceComparison'
import { choiceArt } from '../lib/ppeChoiceArt'
import './PPEChoiceComparison.css'

export interface PPEChoiceComparisonProps {
  selected: { standard?: PairedTrajectoryStep; trace?: PairedTrajectoryStep }
  revealed: (source: PlaybackArm, step?: PairedTrajectoryStep) => boolean
}

const ARMS: PlaybackArm[] = ['standard', 'trace']

function methodIcon(action: string) {
  if (action === 'record_ppe_pass') return CheckCircle2
  if (action === 'record_ppe_fail') return XCircle
  if (action === 'record_ppe_hold') return CircleHelp
  const method = action.split(' method=')[1]
  switch (method) {
    case 'direct': return Eye
    case 'camera': return Camera
    case 'scan': return ScanLine
    case 'desk': return Building2
    case 'tag': return Tag
    case 'register': return BookOpen
    case 'certificate': return FileCheck2
    case 'tablet': return Tablet
    case 'bundle': return Files
    case 'references': return Link2
    case 'form': return Send
    case 'record': return ClipboardList
    default: return FileText
  }
}

/** Recorded alternatives are explanatory images, never controls that change a run. */
export default function PPEChoiceComparison({ selected, revealed }: PPEChoiceComparisonProps) {
  const titleId = useId()
  const comparison = buildPPEChoiceComparison(selected, revealed)
  if (!comparison?.changed) return null

  return <section className="ppe-choice-comparison" data-choice-comparison aria-labelledby={titleId}>
    <header className="pcc-task">
      <span>Task</span>
      <h4 id={titleId}>{comparison.title}</h4>
      <span className="pcc-illustration-label">Method illustrations</span>
    </header>
    <div className="pcc-arms">
      {ARMS.map(source => {
        const arm = comparison.arms[source]
        const trace = source === 'trace'
        const armName = trace ? 'With watermark' : 'Without watermark'
        return <section className="pcc-arm" key={source} data-choice-arm={source} aria-label={armName}>
          <header className="pcc-arm-heading">
            <h5>{armName}</h5>
            <span>Step {arm.stepNumber}</span>
          </header>
          <ul className="pcc-options" style={{ gridTemplateColumns: `repeat(${arm.options.length}, minmax(0, 1fr))` }}>
            {arm.options.map(option => {
              const art = choiceArt(option.art)
              const Icon = methodIcon(option.action)
              const state = option.selected ? trace ? 'Key-guided choice' : 'Selected' : 'Not selected'
              return <li className="pcc-option" key={option.action} data-choice-action={option.action}
                data-choice-selected={option.selected} aria-label={`${option.label}: ${state}`}>
                <figure>
                  <div className="pcc-image-frame" aria-hidden="true">
                    <div className="pcc-image" data-choice-art={option.art}
                      style={{ backgroundImage: `url("${art.src}")`, backgroundPosition: art.position, backgroundSize: art.size }} />
                  </div>
                  {option.selected && <span className="pcc-selection">
                    {trace ? <KeyRound size={12} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
                    {state}
                  </span>}
                  <figcaption><Icon size={15} aria-hidden="true" /><span>{option.label}</span></figcaption>
                </figure>
              </li>
            })}
          </ul>
        </section>
      })}
    </div>
    <p className="pcc-purpose">The key guides choices. The full log is used to check the source.</p>
  </section>
}
