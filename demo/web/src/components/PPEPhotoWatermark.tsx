import { useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ArrowRight, Camera, Check, CheckCircle2, ChevronDown, ChevronUp, Fingerprint, RotateCcw, ScanLine } from 'lucide-react'
import inspectionPhoto from '../assets/ppe-inspection-photo.png'
import type { PairedTrajectoryStep } from './PairedWorkflowStrip'
import { ppeActionLabel } from '../lib/ppeInspection'
import './PPEPhotoWatermark.css'

type Phase = 'photo' | 'capturing' | 'marking' | 'saving' | 'ready' | 'scanning' | 'revealing' | 'complete'
interface Props {
  steps: PairedTrajectoryStep[]
  openRequest: number
  onShowStep: (step: PairedTrajectoryStep) => void
}
// Illustrative payload only: neither a real detector output nor the method's actual bit length.
const DEMO_BITS = '1011010010110101'

function BinaryPayload({ count, recovered = false }: { count: number; recovered?: boolean }) {
  return <div className="pph-bit-string" role="img" aria-label={count ? `${recovered ? 'Recovered' : 'Expected'} demo bits: ${DEMO_BITS.slice(0, count)}${count < DEMO_BITS.length ? ', remaining bits pending' : ''}` : 'Bits not shown yet'}>
    {Array.from(DEMO_BITS).map((bit, index) => <span key={index} data-visible={index < count} data-match={recovered && index < count} data-group-start={index > 0 && index % 4 === 0} aria-hidden="true">{index < count ? bit : '·'}</span>)}
  </div>
}

/** A labelled illustration: no pixel embedding, extraction or source attribution is performed. */
export default function PPEPhotoWatermark({ steps, openRequest, onShowStep }: Props) {
  const contentId = useId()
  const panel = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const capture = steps.find(step => step.requirement_id === 'initial_workwear')
  const archive = steps.find(step => step.requirement_id === 'preserve_evidence')
  const captureNumber = capture ? capture.i + 1 : null
  const archiveNumber = archive ? archive.i + 1 : null
  const captureLabel = capture ? ppeActionLabel(capture.action, capture.label) : 'Clothing check unavailable'
  const archiveLabel = archive ? ppeActionLabel(archive.action, archive.label) : 'Evidence step unavailable'
  const [expanded, setExpanded] = useState(false)
  const [phase, setPhase] = useState<Phase>('photo')
  const [recoveredBits, setRecoveredBits] = useState(0)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const busy = ['capturing', 'marking', 'saving', 'scanning', 'revealing'].includes(phase)
  const marked = ['saving', 'ready', 'scanning', 'revealing', 'complete'].includes(phase)
  const saved = ['ready', 'scanning', 'revealing', 'complete'].includes(phase)
  const step = ['photo', 'capturing', 'marking'].includes(phase) ? 0 : phase === 'saving' || phase === 'ready' ? 1 : 2
  const title = {
    photo: `Photo at step ${captureNumber ?? '—'}`, capturing: `Step ${captureNumber} · Capturing the photo…`, marking: 'Adding the watermark right away…',
    saving: `Step ${archiveNumber} · Saving the photo…`, ready: 'Photo saved. Check its source.', scanning: 'Reading watermark bits…', revealing: 'Matching the bits…', complete: 'Detection successful · demo',
  }[phase]
  const note = {
    photo: `In this example, the agent takes a photo during “${captureLabel}”.`, capturing: 'Capture the clothing seen during this check.', marking: 'Embed the binary watermark before storing the photo.',
    saving: 'Attach the marked photo to the inspection evidence.', ready: `Saved at step ${archiveNumber} in this example. Verify the photo later.`, scanning: 'Read the binary code from the saved photo.', revealing: 'Compare the recovered bits with the expected bits.', complete: `Demo Agent A · Photo linked to step ${captureNumber}.`,
  }[phase]

  function cancel() { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => cancel, [])
  useEffect(() => {
    if (openRequest > 0) { setExpanded(true); panel.current?.scrollIntoView({ block: 'start' }) }
  }, [openRequest])
  function later(next: Phase, delay: number) { timers.current.push(setTimeout(() => setPhase(next), delay)) }
  function reset() { cancel(); setRecoveredBits(0); setPhase('photo') }
  function start() {
    cancel()
    if (phase === 'photo') {
      if (reducedMotion) { setPhase('ready'); return }
      setPhase('capturing'); later('marking', 800); later('saving', 1900); later('ready', 3000)
    } else if (phase === 'ready' || phase === 'complete') {
      if (reducedMotion) { setRecoveredBits(DEMO_BITS.length); setPhase('complete'); return }
      setRecoveredBits(0)
      setPhase('scanning'); later('revealing', 1600)
      Array.from(DEMO_BITS).forEach((_, index) => timers.current.push(setTimeout(() => {
        setRecoveredBits(index + 1)
        if (index === DEMO_BITS.length - 1) setPhase('complete')
      }, 1600 + (index + 1) * 100)))
    }
  }

  return <section ref={panel} data-comparison-box="photo" className="ppe-photo-watermark" data-photo-phase={phase} data-photo-capture-step={captureNumber ?? undefined}>
    <header className="pph-header">
      <h3><span className="pph-number">4</span>Photo watermark</h3>
      <span className="pph-demo">Illustrative demo</span>
      {capture && <span className="pph-origin">Linked to step {captureNumber} · With watermark</span>}
      <button type="button" className="pph-toggle" aria-expanded={expanded} aria-controls={contentId} aria-label={expanded ? 'Collapse photo watermark' : 'Expand photo watermark'} onClick={() => setExpanded(value => !value)}>
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{expanded ? 'Collapse' : 'Expand'}
      </button>
    </header>
    <div id={contentId} hidden={!expanded}>
      <ol className="pph-workflow" aria-label="Where the photo fits in the watermarked workflow">
        <li data-active={step === 0}><button type="button" disabled={!capture} onClick={() => capture && onShowStep(capture)} aria-label={`Show photo capture step ${captureNumber} in workflow`}>
          <small>STEP {captureNumber ?? '—'} · INSPECT</small><strong>{captureLabel}</strong><span><Camera size={13} />Take photo + add watermark</span>
        </button><ArrowRight size={16} aria-hidden="true" /></li>
        <li data-active={step === 1}><button type="button" disabled={!archive} onClick={() => archive && onShowStep(archive)} aria-label={`Show photo evidence step ${archiveNumber} in workflow`}>
          <small>STEP {archiveNumber ?? '—'} · SAVE</small><strong>{archiveLabel}</strong><span>Keep photo with the report</span>
        </button><ArrowRight size={16} aria-hidden="true" /></li>
        <li data-active={step === 2}><div><small>LATER · VERIFY</small><strong>Check the photo’s source</strong><span>Extract and match the bits</span></div></li>
      </ol>
      <div className="pph-layout">
        <figure className="pph-photo">
          <div className="pph-photo-frame">
            <img src={inspectionPhoto} alt="Sample inspection photo of a worker wearing a white hard hat, dark long-sleeved shirt, jeans and shoes at a building site" onLoad={() => { setImageLoaded(true); setImageError(false) }} onError={() => { reset(); setImageLoaded(false); setImageError(true) }} />
            <span className="pph-photo-label"><Camera size={13} />Step {captureNumber ?? '—'} · Sample photo</span>
            {saved && <span className="pph-saved"><Check size={12} />Step {archiveNumber} · Saved with evidence · demo</span>}
            {phase === 'capturing' && <div className="pph-flash" aria-hidden="true" />}
            {(phase === 'marking' || phase === 'scanning') && <div className="pph-scan" aria-hidden="true" />}
            {imageError && <div className="pph-image-error" role="alert">Photo could not load. Refresh to try again.</div>}
          </div>
          <figcaption>{captureLabel}<button type="button" disabled={!capture} onClick={() => capture && onShowStep(capture)}>View step {captureNumber} <ArrowRight size={12} /></button></figcaption>
        </figure>
        <div className="pph-check">
          <div className="pph-status" role="status" aria-live="polite">
            <span className="pph-status-icon">{phase === 'complete' ? <CheckCircle2 size={21} /> : marked ? <ScanLine size={21} /> : <Camera size={21} />}</span>
            <h4>{title}</h4><p>{note}</p>
          </div>
          <div className="pph-payload">
            <div className="pph-payload-caption"><span>Binary watermark</span><small>16 demo bits</small></div>
            <figure><figcaption>Expected bits</figcaption><BinaryPayload count={marked ? DEMO_BITS.length : 0} /></figure>
            <figure><figcaption>Recovered bits</figcaption><BinaryPayload count={recoveredBits} recovered /></figure>
            <div className="pph-bit-progress" data-complete={phase === 'complete'}>
              <span>{phase === 'complete' ? <CheckCircle2 size={13} /> : <ScanLine size={13} />}{phase === 'revealing' || phase === 'complete' ? `${recoveredBits} / ${DEMO_BITS.length} bits match · demo` : 'Waiting to read the code'}</span>
              <div aria-hidden="true"><i style={{ width: `${recoveredBits / DEMO_BITS.length * 100}%` }} /></div>
            </div>
          </div>
          <div className="pph-owner" data-found={phase === 'complete'}><Fingerprint size={18} /><span>{phase === 'complete' ? 'Source: Demo Agent A' : 'Sample source: Demo Agent A'}</span>{phase === 'complete' && <Check size={15} />}</div>
          <div className="pph-controls">
            <button type="button" className="pph-primary" disabled={busy || imageError || !imageLoaded || !capture || !archive} onClick={start}>
              {!saved ? <Camera size={15} /> : <ScanLine size={15} />}
              {busy ? 'Playing photo flow…' : phase === 'photo' ? 'Play photo flow' : phase === 'complete' ? 'Check again' : 'Check watermark'}
            </button>
            {phase !== 'photo' && <button type="button" className="pph-reset" onClick={reset} aria-label="Reset photo watermark demo"><RotateCcw size={15} />Reset</button>}
          </div>
        </div>
      </div>
      <p className="pph-disclosure">Photo capture and watermarking are illustrated additions to the recorded steps, not photos from the original log. This sample photo is not being processed by an image-watermark detector.</p>
    </div>
  </section>
}
