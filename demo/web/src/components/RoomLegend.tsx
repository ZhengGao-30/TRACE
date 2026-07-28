import { CAT_COLOR, CAT_LABEL } from '../three/blocks'
import type { Category } from '../three/blocks'

const ORDER: Category[] = ['storage', 'appliance', 'surface', 'water', 'comfort', 'misc']

/** Explains the floor-plate colours so a 34-receptacle room stays scannable. */
export default function RoomLegend() {
  return (
    <div className="card p-2">
      <div className="eyebrow mb-2">Room legend</div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {ORDER.map((c) => (
          <div key={c} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: CAT_COLOR[c] }} />
            <span className="text-[10px] text-slate-500 truncate">
              {CAT_LABEL[c]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
