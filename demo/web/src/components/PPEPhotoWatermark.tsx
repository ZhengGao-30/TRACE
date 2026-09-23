import { useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ArrowRight, Camera, Check, CheckCircle2, ChevronDown, ChevronUp, Fingerprint, Lock, RotateCcw, Save, ScanLine } from 'lucide-react'
import inspectionPhoto from '../assets/ppe-inspection-photo.png'
import type { PairedTrajectoryStep } from './PairedWorkflowStrip'
import { ppeActionLabel } from '../lib/ppeInspection'
import './PPEPhotoWatermark.css'

type Phase = 'idle' | 'adding' | 'watermarked' | 'saving' | 'saved' | 'selected' | 'detecting' | 'matching' | 'matched'

interface Props {
  steps: PairedTrajectoryStep[]
  openRequest: number
  onShowStep: (step: PairedTrajectoryStep) => void
}

// Illustrative payload only: neither a real detector output nor the method's actual bit length.
const DEMO_BITS = '1011010010110101'

function BinaryPayload({ count, detected = false }: { count: number; detected?: boolean }) {
  const spokenBits = Array.from(DEMO_BITS).slice(0, count).join(' ')
  const label = count
    ? `${detected ? 'Detected' : 'Embedded'} demo bits: ${spokenBits}${count < DEMO_BITS.length ? '. Remaining bits pending.' : '.'}`
    : 'Demo bits not shown yet.'
  return <div className="pph-bit-string" role="img" aria-label={label}>
    {Array.from(DEMO_BITS).map((bit, index) => <span key={index} data-visible={index < count} data-match={detected && index < count} data-group-start={index > 0 && index % 4 === 0} aria-hidden="true">{index < count ? bit : '·'}</span>)}
  </div>
}

/** A labelled illustration: no pixel embedding, extraction or source attribution is performed. */
export default function PPEPhotoWatermark({ steps, openRequest, onShowStep }: Props) {
  const contentId = useId()
  const addTitleId = useId()
  const detectTitleId = useId()
  const photoPickerId = useId()
  const panel = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const capture = steps.find(step => step.requirement_id === 'initial_workwear')
  const archive = steps.find(step => step.requirement_id === 'preserve_evidence')
  const captureNumber = capture ? capture.i + 1 : null
  const archiveNumber = archive ? archive.i + 1 : null
  const captureLabel = capture ? ppeActionLabel(capture.action, capture.label) : 'Clothing check unavailable'
  const [expanded, setExpanded] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [embeddedBits, setEmbeddedBits] = useState(0)
  const [detectedBits, setDetectedBits] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const adding = phase === 'adding'
  const saving = phase === 'saving'
  const detecting = phase === 'detecting' || phase === 'matching'
  const watermarkAdded = !['idle', 'adding'].includes(phase)
  const saved = ['saved', 'selected', 'detecting', 'matching', 'matched'].includes(phase)
  const photoSelected = ['selected', 'detecting', 'matching', 'matched'].includes(phase)
  const detected = phase === 'matched'
  const busy = adding || saving || detecting
  const activePart = saved ? 'detect' : 'watermark'
  const partOneState = saved ? 'complete' : 'active'
  const partTwoState = saved ? 'active' : 'locked'

  function cancel() { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => cancel, [])
  useEffect(() => {
    if (openRequest > 0) { setExpanded(true); panel.current?.scrollIntoView({ block: 'start' }) }
  }, [openRequest])

  function later(callback: () => void, delay: number) {
    timers.current.push(setTimeout(callback, delay))
  }

  function reset() {
    cancel()
    setEmbeddedBits(0)
    setDetectedBits(0)
    setPickerOpen(false)
    setPhase('idle')
  }

  function addWatermark() {
    if (phase !== 'idle' || !imageLoaded || imageError || !capture) return
    cancel()
    setDetectedBits(0)
    if (reducedMotion) {
      setEmbeddedBits(DEMO_BITS.length)
      setPhase('watermarked')
      return
    }
    setEmbeddedBits(0)
    setPhase('adding')
    Array.from(DEMO_BITS).forEach((_, index) => later(() => {
      setEmbeddedBits(index + 1)
      if (index === DEMO_BITS.length - 1) setPhase('watermarked')
    }, 70 + (index + 1) * 26))
  }

  function savePhoto() {
    if (phase !== 'watermarked' || !archive) return
    cancel()
    if (reducedMotion) {
      setPhase('saved')
      return
    }
    setPhase('saving')
    later(() => setPhase('saved'), 240)
  }

  function togglePhotoPicker() {
    if (phase !== 'saved' || imageError || !imageLoaded) return
    setPickerOpen(value => !value)
  }

  function selectPhoto() {
    if (phase !== 'saved' || !pickerOpen || imageError || !imageLoaded) return
    cancel()
    setDetectedBits(0)
    setPickerOpen(false)
    setPhase('selected')
  }

  function detectWatermark() {
    if (!photoSelected || detecting) return
    cancel()
    setDetectedBits(0)
    if (reducedMotion) {
      setDetectedBits(DEMO_BITS.length)
      setPhase('matched')
      return
    }
    setPhase('detecting')
    later(() => setPhase('matching'), 580)
    Array.from(DEMO_BITS).forEach((_, index) => later(() => {
      setDetectedBits(index + 1)
      if (index === DEMO_BITS.length - 1) setPhase('matched')
    }, 580 + (index + 1) * 26))
  }

  const addTitle = phase === 'adding' ? 'Adding watermark…'
    : phase === 'watermarked' ? 'Watermark added'
      : phase === 'saving' ? 'Saving photo…'
        : saved ? 'Photo saved' : 'Add watermark'
  const addNote = phase === 'adding' ? 'Adding the 16 demo bits to the step 10 photo.'
    : phase === 'watermarked' ? 'The watermark is ready. Save the photo with the inspection evidence.'
      : phase === 'saving' ? `Saving the watermarked photo at step ${archiveNumber ?? '—'}.`
        : saved ? `Saved at step ${archiveNumber ?? '—'} and ready for watermark detection.`
          : `Add a watermark to the photo from step ${captureNumber ?? '—'}.`
  const detectTitle = phase === 'saved' ? 'Select saved photo'
    : phase === 'detecting' ? 'Detecting watermark…'
      : phase === 'matching' ? 'Matching detected bits…'
        : detected ? 'Watermark detected' : 'Detect watermark'
  const detectNote = !saved ? 'Save the watermarked photo first.'
    : !photoSelected ? `Choose the saved photo from step ${archiveNumber ?? '—'}.`
      : phase === 'detecting' ? 'Scanning the selected photo for the demo watermark.'
        : phase === 'matching' ? 'Comparing the detected bits with Key A.'
          : detected ? `${detectedBits} / ${DEMO_BITS.length} demo bits matched · Key A.`
            : 'The selected photo is ready to check.'
  const announcement = phase === 'watermarked' ? 'Watermark added.'
    : phase === 'saved' ? `Photo saved at step ${archiveNumber ?? '—'}. Select it to continue.`
      : phase === 'selected' ? 'Saved photo selected. Watermark detection is now available.'
        : phase === 'detecting' ? 'Detecting watermark.'
          : phase === 'matched' ? `Demo watermark detected. ${DEMO_BITS.length} of ${DEMO_BITS.length} demo bits matched.` : ''

  return <section ref={panel} data-comparison-box="photo" className="ppe-photo-watermark" data-photo-phase={phase} data-active-photo-part={activePart} data-photo-capture-step={captureNumber ?? undefined} data-photo-selected={photoSelected}>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    <header className="pph-header">
      <h3><span className="pph-number">4</span>Photo watermark</h3>
      <span className="pph-demo">Illustrative demo</span>
      {capture && <span className="pph-origin">Linked to steps {captureNumber} and {archiveNumber ?? '—'} · With watermark</span>}
      <button type="button" className="pph-toggle" aria-expanded={expanded} aria-controls={contentId} aria-label={expanded ? 'Collapse photo watermark' : 'Expand photo watermark'} onClick={() => setExpanded(value => !value)}>
        {expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}{expanded ? 'Collapse' : 'Expand'}
      </button>
    </header>
    <div id={contentId} hidden={!expanded}>
      <ol className="pph-workflow" aria-label="Add and detect the photo watermark">
        <li data-active={activePart === 'watermark'} data-complete={saved} aria-current={activePart === 'watermark' ? 'step' : undefined}>
          <div><small>PART 1 · STEPS {captureNumber ?? '—'} + {archiveNumber ?? '—'}</small><strong>{saved ? 'Watermark added · photo saved' : 'Add watermark · save photo'}</strong></div>
          <ArrowRight size={16} aria-hidden="true" />
        </li>
        <li data-active={activePart === 'detect'} data-locked={!saved} aria-current={activePart === 'detect' ? 'step' : undefined}>
          <div><small>PART 2 · LATER</small><strong>Detect watermark</strong></div>
        </li>
      </ol>

      <div className="pph-layout">
        <figure className="pph-photo">
          <div className="pph-photo-frame" data-watermark-added={watermarkAdded} data-photo-selected={photoSelected} data-detecting={detecting} data-detected={detected}>
            <img src={inspectionPhoto} alt="Sample inspection photo of a worker wearing a white hard hat, dark long-sleeved shirt, jeans and shoes at a building site" onLoad={() => { setImageLoaded(true); setImageError(false) }} onError={() => { reset(); setImageLoaded(false); setImageError(true) }} />
            <span className="pph-photo-label"><Camera size={13} aria-hidden="true" />Step {captureNumber ?? '—'} · Sample photo</span>
            {saved && <span className="pph-photo-status" data-state={detected ? 'success' : detecting ? 'active' : photoSelected ? 'selected' : 'saved'}>
              {detected ? <CheckCircle2 size={13} aria-hidden="true" /> : detecting ? <ScanLine size={13} aria-hidden="true" /> : photoSelected ? <CheckCircle2 size={13} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
              {phase === 'detecting' ? 'Scanning photo…' : phase === 'matching' ? 'Matching bits…' : detected ? 'Watermark detected · demo' : photoSelected ? 'Selected for detection' : `Step ${archiveNumber} · Photo saved · demo`}
            </span>}
            {adding && <div className="pph-add-effect" aria-hidden="true"><span className="pph-add-grid" /><span className="pph-effect-label"><Fingerprint size={14} />Adding watermark…</span></div>}
            {phase === 'detecting' && <div className="pph-detect-effect" data-detection-effect="scan" aria-hidden="true"><span className="pph-scan-plane" /></div>}
            {imageError && <div className="pph-image-error" role="alert">Photo could not load. Refresh to try again.</div>}
          </div>
          <figcaption>{captureLabel}<button type="button" disabled={!capture} onClick={() => capture && onShowStep(capture)} aria-label={`Show photo capture step ${captureNumber} in workflow`}>View step {captureNumber} <ArrowRight size={12} aria-hidden="true" /></button></figcaption>
        </figure>

        <div className="pph-parts">
          <section className="pph-part" data-photo-part="watermark" data-part-state={partOneState} aria-labelledby={addTitleId}>
            <div className="pph-part-heading">
              <span className="pph-part-number">1</span>
              <div><small>ADD WATERMARK</small><h4 id={addTitleId}>{addTitle}</h4></div>
              {saved && <CheckCircle2 className="pph-part-check" size={19} aria-hidden="true" />}
            </div>
            <p className="pph-part-note">{addNote}</p>
            <div className="pph-payload pph-add-payload">
              <div className="pph-payload-caption"><span>Demo watermark</span><small>16 bits</small></div>
              <figure><figcaption>Bits added to the photo</figcaption><BinaryPayload count={embeddedBits} /></figure>
            </div>
            <div className="pph-controls pph-add-controls">
              <button type="button" className="pph-primary" data-photo-action="add-watermark" disabled={phase !== 'idle' || imageError || !imageLoaded || !capture} onClick={addWatermark}>
                {watermarkAdded ? <Check size={15} aria-hidden="true" /> : <Fingerprint size={15} aria-hidden="true" />}{adding ? 'Adding watermark…' : watermarkAdded ? 'Watermark added' : 'Add watermark'}
              </button>
              <button type="button" className="pph-primary pph-save" data-photo-action="save-photo" disabled={phase !== 'watermarked' || !archive} onClick={savePhoto}>
                {saved ? <Check size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}{saving ? 'Saving photo…' : saved ? 'Photo saved' : 'Save photo'}
              </button>
            </div>
          </section>

          <div className="pph-handoff" data-ready={saved} aria-label={saved ? `Photo saved at step ${archiveNumber ?? 'unknown'}. Detection unlocked.` : 'Save the photo to unlock detection.'}>
            {saved ? <CheckCircle2 size={16} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
            <span>{saved ? 'Photo saved' : 'Save first'}</span>
            <button type="button" className="pph-step-link" disabled={!archive} onClick={() => archive && onShowStep(archive)} aria-label={`Show photo evidence step ${archiveNumber} in workflow`} title={`View evidence step ${archiveNumber}`}><span className="pph-step-link-label">Step {archiveNumber}</span><ArrowRight size={13} aria-hidden="true" /></button>
          </div>

          <section className="pph-part" data-photo-part="detect" data-part-state={partTwoState} data-photo-selected={photoSelected} data-detection-result={detected ? 'match' : 'pending'} data-recovered-bits={detectedBits} aria-labelledby={detectTitleId} aria-busy={detecting}>
            <div className="pph-part-heading">
              <span className="pph-part-number">2</span>
              <div><small>DETECT WATERMARK</small><h4 id={detectTitleId}>{detectTitle}</h4></div>
              {!saved ? <Lock className="pph-part-lock" size={17} aria-hidden="true" /> : detected ? <CheckCircle2 className="pph-part-check" size={19} aria-hidden="true" /> : photoSelected ? <ScanLine className="pph-part-ready" size={18} aria-hidden="true" /> : <Camera className="pph-part-ready" size={18} aria-hidden="true" />}
            </div>
            <p className="pph-part-note">{detectNote}</p>
            <div className="pph-picker-shell">
              <button type="button" className="pph-photo-choice" data-photo-action="select-photo" data-available={saved} data-selected={photoSelected} disabled={!saved || photoSelected || detecting} aria-haspopup="listbox" aria-expanded={pickerOpen} aria-controls={photoPickerId} onClick={togglePhotoPicker}>
                <span className="pph-choice-icon"><Camera size={15} aria-hidden="true" /></span>
                <span className="pph-choice-copy"><strong>{photoSelected ? `Step ${archiveNumber ?? '—'} · Saved photo` : 'Choose a saved photo'}</strong><small>{photoSelected ? 'Watermarked inspection evidence' : '1 photo available'}</small></span>
                <span className="pph-choice-state">{photoSelected ? <><Check size={12} aria-hidden="true" />Selected</> : pickerOpen ? <>Close<ChevronUp size={12} aria-hidden="true" /></> : <>Select photo<ChevronDown size={12} aria-hidden="true" /></>}</span>
              </button>
              {pickerOpen && <div id={photoPickerId} className="pph-photo-options" role="listbox" aria-label="Saved inspection photos">
                <button type="button" className="pph-photo-option" data-photo-action="choose-photo-option" role="option" aria-selected="false" onClick={selectPhoto}>
                  <img src={inspectionPhoto} alt="" />
                  <span className="pph-option-copy"><strong>Step {archiveNumber ?? '—'} · Saved photo</strong><small>Watermarked inspection evidence</small></span>
                  <span className="pph-option-use">Use photo<ArrowRight size={12} aria-hidden="true" /></span>
                </button>
              </div>}
            </div>
            <div className="pph-payload">
              <div className="pph-payload-caption"><span>Watermark check</span><small>Key A · demo</small></div>
              <figure><figcaption>Embedded bits</figcaption><BinaryPayload count={photoSelected ? DEMO_BITS.length : 0} /></figure>
              <figure><figcaption>Detected bits</figcaption><BinaryPayload count={detectedBits} detected /></figure>
              <div className="pph-bit-progress" data-complete={detected} aria-hidden="true">
                <span>{detected ? <CheckCircle2 size={13} /> : <ScanLine size={13} />}{detected ? `${detectedBits} / ${DEMO_BITS.length} bits matched · Key A` : detecting ? `${detectedBits} / ${DEMO_BITS.length} bits detected` : photoSelected ? 'Ready to detect watermark' : saved ? 'Select a saved photo' : 'Waiting for saved photo'}</span>
                <div><i style={{ transform: `scaleX(${detectedBits / DEMO_BITS.length})` }} /></div>
              </div>
            </div>
            <div className="pph-controls">
              <button type="button" className="pph-primary" data-photo-action="detect-watermark" disabled={!photoSelected || detecting || imageError || !imageLoaded} onClick={detectWatermark}>
                <ScanLine size={15} aria-hidden="true" />{detecting ? 'Detecting watermark…' : detected ? 'Detect again' : 'Detect watermark'}
              </button>
              <button type="button" className="pph-reset" onClick={reset} disabled={phase === 'idle' || busy} aria-label="Start the photo watermark demo over"><RotateCcw size={15} aria-hidden="true" />Start over</button>
            </div>
          </section>
        </div>
      </div>
      <p className="pph-disclosure">Photo capture and watermarking are illustrated additions to the recorded steps, not photos from the original log. This sample photo is not being processed by an image-watermark detector.</p>
    </div>
  </section>
}
