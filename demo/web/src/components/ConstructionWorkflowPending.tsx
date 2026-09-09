import { useState } from 'react'
import { ArrowRight, CheckCheck, ChevronDown, Dices, KeyRound, LockKeyhole } from 'lucide-react'
import { SHIFT_PHASES, type WorkflowStage } from '../lib/guidedSteps'

const STAGES = [
  { id: 'identify', title: 'Identify worker', description: 'Identify the worker and the site’s entry requirements using information available at that time.' },
  { id: 'inspect', title: 'Inspect PPE', description: 'The Agent chooses observations and can request a clearer view. An omitted or uncertain check must not be presented as passed.' },
  { id: 'decide', title: 'Decide entry', description: 'The Agent assesses compliance and decides whether to admit the worker. Executable does not mean safe: mistaken decisions can be recorded.' },
]

/** The real workflow contract, not an invented trajectory or a successful run. */
export default function ConstructionWorkflowPending({ taskType, stages }: { taskType?: string; stages?: WorkflowStage[] } = {}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const shift = taskType === 'construction_ppe_shift'
  const definitions = stages?.length ? stages.map((stage) => ({ ...stage, description: stage.description ?? stage.desc ?? '' }))
    : shift ? SHIFT_PHASES.map((stage) => ({ ...stage, description: stage.desc })) : STAGES
  const stage = definitions.find((item) => item.id === expanded)

  return (
    <section className="card overflow-hidden" aria-label="Watermark trajectory comparison — awaiting recorded runs">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-[13px] font-extrabold text-slate-800">Same task, two trajectories</h2>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
          <LockKeyhole size={11} /> Awaiting recorded runs
        </span>
      </div>

      <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2.5">
        <KeyRound size={15} className="shrink-0 text-indigo-500" />
        <span className="w-36 shrink-0 text-[11px] font-bold text-indigo-700">With watermark</span>
        <p className="text-[11px] text-slate-500">{shift ? 'Normal agent actions will show recorded action weights, their source and keyed scores. Injected controller actions are marked separately and excluded from detection.' : 'Recorded actions will appear here. Click an action to inspect its probabilities and keyed scores.'}</p>
      </div>

      <div className="mx-4 rounded-xl border-2 border-slate-300 bg-slate-50/70 p-3">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-slate-700">Main workflow</span>
          <span className="text-[10px] text-slate-400">Same stage rules for both agents</span>
        </div>
        <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
          {definitions.map((item, index) => (
            <div key={item.id} className="contents">
              {index > 0 && <ArrowRight size={13} className="self-center shrink-0 text-slate-300" />}
              <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                aria-expanded={expanded === item.id}
                className={`flex min-w-[100px] flex-1 items-center gap-2 rounded-lg border px-2.5 py-3 text-left transition-colors ${expanded === item.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{index + 1}</span>
                <span className="text-[11px] font-semibold text-slate-700">{item.title}</span>
                <ChevronDown size={11} className={`ml-auto shrink-0 text-slate-400 ${expanded === item.id ? 'rotate-180' : ''}`} />
              </button>
            </div>
          ))}
        </div>
        {stage && <p className="mt-2.5 rounded-lg bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-500"><b className="text-slate-700">{stage.title}: </b>{stage.description} This is the process definition, not a completed action.</p>}
      </div>

      <div className="mx-4 my-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
        <Dices size={15} className="shrink-0 text-slate-400" />
        <span className="w-36 shrink-0 text-[11px] font-bold text-slate-600">Without watermark</span>
        <p className="text-[11px] text-slate-500">The independent baseline run will appear here, with its own action-probability snapshots.</p>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-[10.5px] text-slate-400">
        <CheckCheck size={13} className="shrink-0" /> {shift ? 'Controlled synthetic scenario, not a natural LLM failure. Final recommendations, controller decisions and detector scores are unavailable until recorded playback completes.' : 'The animation will replay the original execution log. Entry decisions and site outcomes can differ between runs.'}
      </div>
    </section>
  )
}
