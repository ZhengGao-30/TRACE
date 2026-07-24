/**
 * TRACE mascot — a cute kawaii robot.
 *
 * It IS the agent that walks the room and leaves the watermarked trajectory.
 * Two hidden meanings for the paper: its two glowing eyes are the two channels
 * (left indigo = selection, right violet = tally), and the antenna orb is the
 * watermark being emitted. Rounded, friendly, reads well down to 16px.
 */
export default function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none"
         className={className} aria-label="TRACE robot">
      <defs>
        <linearGradient id="tr-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f9ff" />
          <stop offset="1" stopColor="#e4eaff" />
        </linearGradient>
        <linearGradient id="tr-orb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* antenna: stem + emitted watermark orb (with soft halo) */}
      <path d="M24 12 V6.5" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="5" r="4" fill="#8b5cf6" opacity="0.16" />
      <circle cx="24" cy="5" r="2.6" fill="url(#tr-orb)" />

      {/* side ears / bolts */}
      <circle cx="9.5" cy="26" r="3.1" fill="#c7d2fe" />
      <circle cx="9.5" cy="26" r="1.4" fill="#818cf8" />
      <circle cx="38.5" cy="26" r="3.1" fill="#ddd6fe" />
      <circle cx="38.5" cy="26" r="1.4" fill="#a78bfa" />

      {/* head */}
      <rect x="11" y="11.5" width="26" height="25" rx="9" fill="url(#tr-head)"
            stroke="#cdd8f5" strokeWidth="1.6" />

      {/* cheek blush */}
      <ellipse cx="16.5" cy="27.5" rx="2.1" ry="1.3" fill="#fca5c4" opacity="0.55" />
      <ellipse cx="31.5" cy="27.5" rx="2.1" ry="1.3" fill="#fca5c4" opacity="0.55" />

      {/* visor / screen face */}
      <rect x="14.5" y="16.5" width="19" height="13" rx="6" fill="#242c47" />

      {/* eyes = the two channels, each with a kawaii sparkle */}
      <circle cx="20.2" cy="22.6" r="3" fill="#6366f1" opacity="0.35" />
      <circle cx="20.2" cy="22.6" r="2.2" fill="#818cf8" />
      <circle cx="19.5" cy="21.9" r="0.8" fill="#fff" />
      <circle cx="27.8" cy="22.6" r="3" fill="#8b5cf6" opacity="0.35" />
      <circle cx="27.8" cy="22.6" r="2.2" fill="#a78bfa" />
      <circle cx="27.1" cy="21.9" r="0.8" fill="#fff" />

      {/* smile */}
      <path d="M21 26.4 Q24 28.4 27 26.4" stroke="#93a4e8" strokeWidth="1.5"
            strokeLinecap="round" fill="none" />
    </svg>
  )
}
