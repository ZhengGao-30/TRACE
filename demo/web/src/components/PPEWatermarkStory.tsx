import { useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, KeyRound, Play, XCircle } from 'lucide-react'
import type { PairedTrajectoryStep, PairedWorkflowData } from './PairedWorkflowStrip'
import type { PlaybackArm } from '../lib/ppePlayback'
import { ppeActionOptionLabel } from '../lib/ppeInspection'
import { buildPPEWatermarkStory } from '../lib/ppeWatermarkStory'
import { buildPPEChoiceComparison, optionArt } from '../lib/ppeChoiceComparison'
import { buildChoiceReplay, choiceReplayCandidates, TASK_SUCCESS } from '../lib/ppeChoiceReplay'
import { choiceArt } from '../lib/ppeChoiceArt'
import './PPEWatermarkStory.css'

export interface PPEWatermarkStoryProps {
  pair: PairedWorkflowData
  selected: { standard?: PairedTrajectoryStep; trace?: PairedTrajectoryStep }
  revealed: (source: PlaybackArm, step?: PairedTrajectoryStep) => boolean
  onSelect: (step: PairedTrajectoryStep) => void
  appliedCandidateId?: string
  selectedCandidateId?: string
  onCandidateChange?: (candidateId: string) => void
}
type ReplayState = { phase: 'idle' | 'running' | 'complete' | 'invalid'; candidateId: string; count: number }

function publicKeyLabel(candidates: ReturnType<typeof choiceReplayCandidates>, candidateId?: string) {
  const index = candidates.findIndex(candidate => candidate.agent_id === candidateId)
  return index >= 0 ? `Key ${String.fromCharCode(65 + index)}` : 'Key unavailable'
}

function Illustration({ action, art }: { action?: string; art?: string }) {
  const image = choiceArt(art ?? optionArt(action ?? ''))
  return <div className="pws-image" data-story-art={art ?? optionArt(action ?? '')} aria-hidden="true"
    style={{ backgroundImage: `url("${image.src}")`, backgroundPosition: image.position, backgroundSize: image.size }} />
}

/** Plays exported sampler results; it never runs an agent or changes the detection log. */
export default function PPEWatermarkStory({ pair, selected, revealed, onSelect, appliedCandidateId, selectedCandidateId, onCandidateChange }: PPEWatermarkStoryProps) {
  const titleId = useId(), contentId = useId()
  const reducedMotion = useReducedMotion()
  const candidates = choiceReplayCandidates(pair), first = candidates[0]
  const initialCandidate = candidates.find(candidate => candidate.agent_id === selectedCandidateId)
    ?? candidates.find(candidate => candidate.agent_id === appliedCandidateId) ?? first
  const [candidateId, setCandidateId] = useState(() => initialCandidate?.agent_id ?? '')
  const [check, setCheck] = useState<ReplayState>({ phase: 'idle', candidateId: '', count: 0 })
  const [expanded, setExpanded] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const story = buildPPEWatermarkStory(pair, selected, revealed)
  const differences = story.differences.filter(choice => choice.keyGuided && !choice.forced)
  const current = differences.find(choice => choice.key === story.current?.key) ?? differences[0]
  const replay = buildChoiceReplay(pair, differences, check.candidateId, true)
  const activeRow = check.phase === 'running' ? replay.rows[Math.max(0, check.count - 1)] : undefined
  const shownChoice = activeRow?.choice ?? current
  const comparison = shownChoice ? buildPPEChoiceComparison({ standard: shownChoice.standard, trace: shownChoice.trace }, revealed) : null
  const detailRow = activeRow ?? replay.rows.find(row => row.choice.key === current?.key)
  const detailVisible = !!detailRow && (check.phase === 'complete' || check.phase === 'running' && check.count > 0)
  const selectedIndex = differences.findIndex(choice => choice.key === current?.key)
  const checkedCandidate = candidates.find(candidate => candidate.agent_id === check.candidateId)
  const activeCandidate = candidates.find(candidate => candidate.agent_id === candidateId)
  const appliedCandidate = appliedCandidateId === undefined ? first : candidates.find(candidate => candidate.agent_id === appliedCandidateId)
  const activeKeyLabel = publicKeyLabel(candidates, activeCandidate?.agent_id)
  const appliedKeyLabel = publicKeyLabel(candidates, appliedCandidate?.agent_id)
  const checkedKeyLabel = publicKeyLabel(candidates, checkedCandidate?.agent_id)
  const matchesShown = replay.rows.slice(0, check.count).filter(row => row.match).length

  function cancel() { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => {
    cancel()
    const available = choiceReplayCandidates(pair)
    const next = available.find(candidate => candidate.agent_id === selectedCandidateId)
      ?? available.find(candidate => candidate.agent_id === appliedCandidateId) ?? available[0]
    setCandidateId(next?.agent_id ?? '')
    setCheck({ phase: 'idle', candidateId: '', count: 0 })
    return cancel
  }, [pair, reducedMotion, selectedCandidateId, appliedCandidateId])

  function changeCandidate(nextCandidateId: string) {
    cancel()
    setCandidateId(nextCandidateId)
    setCheck({ phase: 'idle', candidateId: '', count: 0 })
    onCandidateChange?.(nextCandidateId)
  }
  function verify() {
    cancel()
    const candidate = candidates.find(item => item.agent_id === candidateId)
    const data = buildChoiceReplay(pair, differences, candidate?.agent_id ?? '', true)
    if (!candidate || data.status !== 'ready') { setCheck({ phase: 'invalid', candidateId: '', count: 0 }); return }
    if (reducedMotion) { setCheck({ phase: 'complete', candidateId: candidate.agent_id, count: data.rows.length }); return }
    setCheck({ phase: 'running', candidateId: candidate.agent_id, count: 0 })
    const delay = Math.max(180, Math.min(420, 4000 / data.rows.length))
    data.rows.forEach((_, index) => timers.current.push(setTimeout(() => {
      setCheck({ phase: index === data.rows.length - 1 ? 'complete' : 'running', candidateId: candidate.agent_id, count: index + 1 })
    }, delay * (index + 1))))
  }
  function move(direction: -1 | 1) {
    if (differences.length) onSelect(differences[(selectedIndex + direction + differences.length) % differences.length].trace)
  }
  const verification = check.phase === 'complete' && replay.status === 'ready' && replay.total > 0
    ? replay.matches === replay.total ? 'successful' : 'failed'
    : 'pending'
  const resultTitle = check.phase === 'invalid' ? 'No recorded replay for this key'
    : check.phase === 'running' ? `Replaying choice ${check.count} / ${differences.length}`
      : verification === 'successful' ? 'Verification successful'
        : verification === 'failed' ? 'Verification failed'
        : 'Can this key reproduce the choices?'
  const resultNote = check.phase === 'invalid' ? 'Use one of the registered demo key pairs.'
    : verification !== 'pending' ? `${checkedKeyLabel} · ${replay.matches} / ${replay.total} choices reproduced. ${verification === 'successful' ? 'All displayed choices match.' : 'Different choices are circled below.'}`
      : check.phase === 'running' ? `${matchesShown} choices line up so far.` : `${activeKeyLabel} is selected. The recorded log stays unchanged.`

  return <section className="ppe-watermark-story" data-watermark-story data-expanded={expanded} data-replay-state={check.phase} aria-labelledby={titleId}>
    <header className="pws-toolbar"><h3 id={titleId}><span className="pws-number">3</span>What changed?</h3>
      <span className="pws-current-key"><KeyRound size={13} />{appliedCandidate ? `${appliedKeyLabel} applied` : 'Applied key not recorded'}</span>
      {expanded && <nav className="pws-differences" aria-label="Browse different choices">
        <button type="button" aria-label="Previous difference" disabled={!differences.length || check.phase === 'running'} onClick={() => move(-1)}><ChevronLeft size={16} /></button>
        <span>{differences.length ? `${selectedIndex + 1} of ${differences.length} different choices` : 'No different choices'}</span>
        <button type="button" aria-label="Next difference" disabled={!differences.length || check.phase === 'running'} onClick={() => move(1)}><ChevronRight size={16} /></button>
      </nav>}
      <button type="button" className="pws-expand" aria-label={expanded ? 'Collapse comparison' : 'Expand comparison'}
        aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}>
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{expanded ? 'Collapse' : 'Expand'}
      </button>
    </header>
    <div id={contentId} hidden={!expanded}>{expanded && <>
    {comparison && <div className="pws-choice-comparison"><p className="pws-task">{comparison.title}<span>Same task. Different choice.</span></p>
      <div className="pws-arms">{(['standard', 'trace'] as const).map(arm => <section key={arm} data-choice-arm={arm}>
        <h4>{arm === 'trace' ? <><KeyRound size={15} />With watermark{appliedCandidate ? ` · ${appliedKeyLabel}` : ''}</> : 'Without watermark'}</h4>
        <ul className="pws-options" data-story-options style={{ gridTemplateColumns: `repeat(${comparison.arms[arm].options.length}, minmax(0, 1fr))` }}>
          {comparison.arms[arm].options.map(option => <li key={option.action} className="pws-option" data-story-choice={option.action} data-selected={option.selected}>
            <figure><div className="pws-image-frame"><Illustration art={option.art} /></div><figcaption>{option.label}<small>{option.selected ? <><Check size={12} />Chosen</> : 'Available'}</small></figcaption></figure>
          </li>)}
        </ul><p className="pws-arm-note">{arm === 'trace' ? appliedCandidate ? `${appliedKeyLabel} guides the recorded selection.` : 'Applied key metadata is unavailable.' : 'Standard selection.'}</p>
      </section>)}</div>
    </div>}
    <div className="pws-bridge"><ArrowDown size={15} /><span>{appliedCandidate ? `${appliedKeyLabel} was used above. Check it against the recorded choices.` : 'Choose a demo key to replay the recorded choices.'}</span><small>Same recorded log</small></div>
    <section className="pws-replay" aria-label="Reproduce different choices with a key">
      <div className="pws-key-line">
        <div className="pws-key-copy"><strong>Check the watermark key</strong><span>{appliedCandidate ? `Start with ${appliedKeyLabel}, or try another demo key.` : 'Choose one of the available demo keys.'}</span></div>
        <div className="pws-key-presets" role="group" aria-label="Choose a demo key to check">{candidates.map((candidate, index) => {
          const label = `Key ${String.fromCharCode(65 + index)}`
          return <button key={candidate.agent_id} type="button" aria-pressed={activeCandidate?.agent_id === candidate.agent_id}
            data-applied={candidate.agent_id === appliedCandidate?.agent_id} onClick={() => changeCandidate(candidate.agent_id)}>{label}</button>
        })}</div>
        <button type="button" className="pws-verify" data-replay-verify onClick={verify} disabled={!differences.length || !activeCandidate || check.phase === 'running'}><Play size={14} />Replay with {activeKeyLabel}</button>
      </div>
      <div className="pws-replay-result" data-replay-result={verification} role="status" aria-live="polite">
        {verification === 'successful' ? <CheckCircle2 size={24} /> : verification === 'failed' ? <XCircle size={24} /> : <KeyRound size={21} />}
        <div><strong>{resultTitle}</strong><p>{resultNote}</p></div>
      </div>
      <div className="pws-grid-caption"><span>{differences.length} different choices · {pair.trace.steps.length - differences.length} other steps hidden</span><span><i />Different on replay</span></div>
      <div className="pws-replay-grid" role="group" aria-label="Compare choices reproduced by the key with recorded choices">
        {differences.map((choice, index) => {
          const row = replay.rows[index], visible = !!row && index < check.count && (check.phase === 'running' || check.phase === 'complete')
          return <button key={choice.key} type="button" className="pws-replay-choice" data-replay-step={choice.trace.i} data-replay-match={visible ? String(row.match) : 'pending'} data-active={check.phase === 'running' && index === check.count - 1}
            aria-pressed={choice.key === current?.key} disabled={check.phase === 'running'} aria-label={`Action ${choice.trace.i + 1}: ${choice.title}${visible ? row.match ? ' · Match' : ' · Different on replay' : ''}`} onClick={() => onSelect(choice.trace)}>
            <span className="pws-step-number">{String(choice.trace.i + 1).padStart(2, '0')}</span>
            <span className="pws-replayed-art" data-visible={visible}>{visible ? <Illustration action={row.replayed} /> : <KeyRound size={19} />}</span>
            <span className="pws-match-mark">{visible ? row.match ? <Check size={15} /> : <span>≠</span> : <span>·</span>}</span><Illustration action={choice.trace.action} />
          </button>
        })}
      </div>
      <p className="pws-grid-legend">Top: replayed with the key <span>Bottom: recorded in the log</span></p>
      {detailVisible && detailRow && <div className="pws-choice-detail" data-match={detailRow.match}><strong>Action {detailRow.choice.trace.i + 1} · {detailRow.choice.title}</strong>
        <div><span>Key chooses: <b>{ppeActionOptionLabel(detailRow.replayed, detailRow.replayed)}</b></span><ArrowRight size={15} /><span>Log records: <b>{ppeActionOptionLabel(detailRow.chosen, detailRow.chosen)}</b></span></div>
      </div>}
      <details className="pws-replay-details"><summary>How this comparison works</summary><p>Only different choices with more than one available action are shown. The selected demo key replays each saved decision using its recorded probabilities and preceding history. It does not run a new inspection or change the recorded log. Reproducing choices is separate from statistical watermark detection.</p></details>
    </section>
    <section className="pws-success" aria-label="Task success in our tests"><h4>Task success in our tests<span>Task success maintained</span></h4>
      <div className="pws-success-values"><div><span>Without watermark</span><strong>≈{TASK_SUCCESS.without.toFixed(1)}%</strong><div className="pws-success-track"><i style={{ width: `${TASK_SUCCESS.without}%` }} /></div></div>
        <div><span>With watermark</span><strong>≈{TASK_SUCCESS.with.toFixed(1)}%</strong><div className="pws-success-track"><i style={{ width: `${TASK_SUCCESS.with}%` }} /></div></div></div>
      <details><summary>Test details</summary><p>Approximate task-count-weighted summary of our reported main experiments: weights 140, 134 and 150, using the rounded Table 2 means. GPT-5.4-mini, three seeds; scores are 1 for solved, 0.5 for unsure and 0 for unsolved. These are the reported experiments, not a new measurement of the two HSE examples. <a href={TASK_SUCCESS.source} target="_blank" rel="noreferrer">Source and method</a></p></details>
    </section>
    </>}</div>
  </section>
}
