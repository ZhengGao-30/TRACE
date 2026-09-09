import { AlertCircle, FileSearch, Fingerprint, LockKeyhole } from 'lucide-react'
import type { EntryAttribution, EntryAttributionScope, EntryViolation, IncidentReport, PairedTrajectoryStep, PairedWorkflowData } from './PairedWorkflowStrip'
import { decisionLabel, displayFact, effectiveEntryDecision, entryDecisionLabel, isInjectedStep } from './PairedWorkflowStrip'

/** Only observations available before the questioned action, never the final
 * report's hindsight or the later site-event record. */
export function violationContext(steps: PairedTrajectoryStep[], violation: EntryViolation, report?: IncidentReport) {
  const action = violation.action ?? effectiveEntryDecision(report)?.action
  const index = steps.findIndex((step) => step.action === action)
  if (index < 0) return { step: null, observations: [] as { label: string; result: string; evidence: string[] }[] }
  const evidenceIds = new Set(violation.evidence_ids ?? [])
  const observations = steps.slice(0, index).filter((step) => !!step.result
    && (!evidenceIds.size || (step.evidence_ids ?? []).some((id) => evidenceIds.has(id))))
    .map((step) => ({ label: step.label, result: step.result!, evidence: step.evidence_ids ?? [] }))
  return { step: steps[index], observations }
}

export function attributionSummary(attribution?: EntryAttribution): string {
  if (!attribution || !['trace_agent_actions', 'controlled_scenario_policy_actions_admission', 'controlled_scenario_policy_actions_full',
    'controlled_codex_llm_actions_admission', 'controlled_codex_llm_actions_full'].includes(attribution.record_scope)) return 'Candidate-key detection is not available for this original record.'
  const supported = attribution.candidates.filter((candidate) =>
    (candidate.n1 > 0 && Number.isFinite(candidate.z1) && candidate.z1 > attribution.threshold && candidate.layer1_detected)
    || (candidate.n2 > 0 && Number.isFinite(candidate.z2) && candidate.z2 > attribution.threshold && candidate.layer2_detected))
  // Do not choose the largest score. A candidate must pass the detector, and
  // multiple supported keys remain ambiguous even if one scores more highly.
  if (supported.length > 1 || attribution.status === 'ambiguous') return 'Multiple candidate keys have support. The source remains ambiguous.'
  if (supported.length === 1 && attribution.status === 'candidate_match'
    && attribution.matched_agent_ids.length === 1 && attribution.matched_agent_ids[0] === supported[0].agent_id) {
    return `Watermark evidence supports ${supported[0].label} among the tested candidates; this is not conclusive identity proof.`
  }
  return 'Insufficient consistent evidence to identify a candidate. The highest score alone is not a match.'
}

function score(value: number, count: number) {
  return count > 0 && Number.isFinite(value) ? value.toFixed(2) : '—'
}

function CandidateEvidence({ attribution }: { attribution?: EntryAttribution }) {
  return <>
    <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-600">{attributionSummary(attribution)}</p>
    {!!attribution?.candidates.length && <div className="mt-2 overflow-x-auto rounded-lg bg-white p-2 ring-1 ring-indigo-100">
      <table className="w-full text-left text-[9.5px] tabular-nums text-slate-600">
        <thead><tr><th className="p-1 font-semibold">Candidate</th><th className="p-1 text-right font-semibold">L1 z · n</th><th className="p-1 text-right font-semibold">L2 z · n</th><th className="p-1 text-right font-semibold">Threshold evidence</th></tr></thead>
        <tbody>{attribution.candidates.map((candidate) => {
          const first = candidate.n1 > 0 && Number.isFinite(candidate.z1) && candidate.z1 > attribution.threshold && candidate.layer1_detected
          const second = candidate.n2 > 0 && Number.isFinite(candidate.z2) && candidate.z2 > attribution.threshold && candidate.layer2_detected
          return <tr key={candidate.agent_id} className="border-t border-slate-100"><td className="p-1.5 font-semibold">{candidate.label}</td><td className="p-1.5 text-right">{score(candidate.z1, candidate.n1)} · {candidate.n1}</td><td className="p-1.5 text-right">{score(candidate.z2, candidate.n2)} · {candidate.n2}</td><td className={`p-1.5 text-right ${first || second ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>{first && second ? 'L1 + L2' : first ? 'L1 only' : second ? 'L2 only' : 'Not reached'}</td></tr>
        })}</tbody>
      </table>
      <p className="mt-1 px-1 text-[8.5px] text-slate-400">z &gt; {attribution.threshold} · n = usable samples per channel · no highest-score winner is assumed.</p>
    </div>}
    {attribution?.limitations?.length ? <details className="mt-2 text-[9px] text-slate-500"><summary className="cursor-pointer font-semibold">Detection limits</summary><ul className="mt-1 space-y-1">{attribution.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></details> : null}
  </>
}

function ScopeEvidence({ id, scope }: { id: 'admission' | 'full'; scope?: EntryAttributionScope }) {
  const title = id === 'admission' ? 'Admission prefix' : 'Full trajectory'
  const attribution = scope?.attribution && [`controlled_scenario_policy_actions_${id}`, `controlled_codex_llm_actions_${id}`].includes(scope.attribution.record_scope)
    ? scope.attribution : undefined
  return <details className="rounded-lg border border-indigo-100 bg-white/80 px-3 py-2">
    <summary className="cursor-pointer text-[10.5px] font-bold text-indigo-700">
      {title}
      <span className="ml-2 text-[9px] font-normal text-slate-500">{scope ? `${scope.action_count} normal agent actions` : 'Not recorded'}</span>
      {scope?.detect && <span className="mt-1 block pl-3 text-[9.5px] font-medium tabular-nums text-slate-600">
        L1 z {score(scope.detect.layer1.z, scope.detect.layer1.n)} · n {scope.detect.layer1.n}
        <span className="mx-2 text-slate-300">|</span>L2 z {score(scope.detect.layer2.z, scope.detect.layer2.n)} · n {scope.detect.layer2.n}
      </span>}
    </summary>
    <div className="mt-2 text-[9px] leading-relaxed text-slate-500">
      {scope?.label && <p className="font-semibold">{scope.label}</p>}
      <p>{id === 'admission' ? 'Only the recorded prefix up to admission is tested. Later duty actions cannot strengthen this earlier prefix result.' : 'This includes later duty actions. Scores need not rise with more samples; a full-log match does not establish who authored the injected controller fault.'}</p>
      <p className="mt-1">n counts usable samples separately for each channel, not displayed steps. Controller injections and physical events are excluded.</p>
      {!scope?.detect && <p className="mt-1">Detector statistics for this scope were not recorded.</p>}
    </div>
    <CandidateEvidence attribution={attribution} />
  </details>
}

export default function EntryAttributionPanel({ pair, available }: { pair: PairedWorkflowData | null; available: boolean }) {
  const shift = pair?.task_type === 'construction_ppe_shift'
  const entryCheck = shift || pair?.task_type === 'construction_ppe_entry_check'
  const report = entryCheck ? pair.trace.report : undefined
  const attribution = entryCheck && pair.attribution?.record_scope === 'trace_agent_actions' ? pair.attribution : undefined
  const violations = report?.safety?.violations ?? []
  const effectiveDecision = effectiveEntryDecision(report)
  const decisionStep = pair?.trace.steps.find((step) => step.action === effectiveDecision?.action)
  const recommendationStep = pair?.trace.steps.find((step) => step.action === report?.recommendation?.action)

  return <section className="card overflow-hidden" aria-label="Original entry record attribution">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
      <h2 className="inline-flex items-center gap-2 text-[13px] font-extrabold text-slate-800"><FileSearch size={16} className="text-indigo-500" /> Trace the decision</h2>
      <span className="text-[9.5px] font-medium text-slate-400">{shift ? 'Controlled scenario · original log · read-only' : 'Original watermarked log · read-only'}</span>
    </div>
    {!available || !entryCheck ? <div className="flex items-start gap-2 px-4 py-4 text-[11px] leading-relaxed text-slate-500">
      <LockKeyhole size={15} className="mt-0.5 shrink-0 text-indigo-400" /> Finish the replay to inspect the entry decision and test which candidate Agent’s keys match its original action log.
    </div> : <div className="space-y-3 p-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <h3 className="text-[11px] font-extrabold text-slate-700">{shift ? '1 · Recommendation vs. effective admission' : '1 · What did the Agent decide?'}</h3>
        {shift && <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 text-[10px] text-slate-600">
          <p className="font-semibold text-slate-700">Agent recommendation: {decisionLabel(report?.recommendation)}</p>
          <p className="mt-1">{report?.recommendation?.action ?? 'Recommendation action not recorded'}{recommendationStep ? ` · action ${recommendationStep.i + 1}` : ''}{report?.recommendation?.timestamp ? ` · ${report.recommendation.timestamp}` : ''}</p>
          <p className="mt-1">Assessment then: {displayFact(report?.recommendation?.assessment)}</p>
        </div>}
        <p className="mt-1 text-[11px] font-semibold text-slate-800">{entryDecisionLabel(report)}
          {decisionStep && <span className="ml-2 text-[9.5px] font-normal text-slate-400">action {decisionStep.i + 1} · {effectiveDecision?.timestamp}</span>}
        </p>
        {shift ? <p className="mt-1 text-[10px] text-amber-800">Effective controller decision: {effectiveDecision?.action ?? 'Not recorded'}.
          {decisionStep && isInjectedStep(decisionStep) ? ' Injected, not sampled by the agent; excluded from watermark detection.' : ' Controller injection linkage is not recorded.'}</p>
          : <p className="mt-1 text-[10px] text-slate-500">Assessment at that time: {displayFact(effectiveDecision?.assessment)}</p>}
        {shift && <details className="mt-2 text-[9.5px] text-slate-500">
          <summary className="cursor-pointer font-semibold">Admission-time evidence and controller fault record</summary>
          <div className="mt-2 space-y-2">
            <p>Frozen evidence available at admission, not the final report’s later observations.</p>
            {report?.admission_snapshot?.facts ? <dl className="space-y-1">{Object.entries(report.admission_snapshot.facts).map(([key, value]) => <div key={key}><dt className="inline font-semibold">{displayFact(key)}: </dt><dd className="inline">{displayFact(value)}</dd></div>)}</dl> : <p>Admission snapshot not recorded.</p>}
            {report?.fault_injections?.length ? report.fault_injections.map((fault, index) => <p key={fault.id ?? index} className="rounded-lg bg-amber-50 p-2 text-amber-800"><b>Controller fault:</b> {fault.description ?? displayFact(fault.kind)}<br />Requested: {displayFact(fault.requested_action)} → effective: {displayFact(fault.effective_action)}{fault.timestamp ? ` · ${fault.timestamp}` : ''}</p>) : <p>Controller fault details not recorded.</p>}
          </div>
        </details>}
        {!report?.safety ? <p className="mt-2 text-[10px] text-slate-500">Safety-rule evaluation was not recorded.</p>
          : !violations.length ? <p className="mt-2 text-[10px] text-slate-600">{report.safety.compliant ? 'No safety-rule violation was flagged in this record.' : 'The evaluator flagged non-compliance but did not include a detailed finding.'}</p>
            : <div className="mt-2 space-y-2">{violations.map((violation, index) => {
              const context = violationContext(pair.trace.steps, violation, report)
              return <details key={`${violation.code ?? 'issue'}-${index}`} className="rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-2">
                <summary className="cursor-pointer text-[10px] font-semibold text-amber-800">{violation.message}</summary>
                <div className="mt-2 space-y-2 text-[9.5px] leading-relaxed text-slate-600">
                  <p><b>Questioned action:</b> {context.step ? `${context.step.i + 1} · ${context.step.label}` : violation.action ?? 'Not linked in this record'}</p>
                  {violation.evidence_ids?.length ? <p><b>Rule/evidence references:</b> {violation.evidence_ids.join(', ')}</p> : null}
                  <p className="font-semibold">Relevant observations already in the log</p>
                  {context.observations.length ? <ul className="space-y-1.5">{context.observations.map((observation, observationIndex) => <li key={observationIndex}><b>{observation.label}:</b> {observation.result}{!!observation.evidence.length && <span className="ml-1 text-slate-400">[{observation.evidence.join(', ')}]</span>}</li>)}</ul>
                    : <p>No matching earlier observation was recorded. A missing check is not evidence of a pass.</p>}
                  <p className="text-slate-400">Rule findings use the synthetic scenario’s evaluator. Later site events are not observations the Agent had before this decision.{shift ? ' This finding concerns the effective controller transaction, not a naturally occurring LLM error.' : ''}</p>
                </div>
              </details>
            })}</div>}
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
        <h3 className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-indigo-700"><Fingerprint size={13} /> 2 · Which candidate Agent’s keys have support?</h3>
        {shift ? <div className="mt-2 space-y-2">
          <p className="text-[10px] leading-relaxed text-slate-600">Test the normal agent-action record in two separate scopes. A full-trajectory match does not prove authorship of the injected fault.</p>
          <ScopeEvidence id="admission" scope={pair.attribution_scopes?.admission} />
          <ScopeEvidence id="full" scope={pair.attribution_scopes?.full} />
        </div> : <CandidateEvidence attribution={attribution} />}
      </div>

      <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-slate-500"><AlertCircle size={12} className="mt-0.5 shrink-0" /> Source evidence and safety findings are separate. Watermarks do not establish factual truth or legal responsibility. This panel tests the original TRACE action log, not edited attack logs or physical site events.</p>
      {shift && <p className="text-[9px] leading-relaxed text-slate-500">This synthetic controlled fault was authored for the demonstration. The recorded consequence is not evidence of a natural LLM failure, and missing PPE is not asserted to be the sole cause of injury.</p>}
    </div>}
  </section>
}
