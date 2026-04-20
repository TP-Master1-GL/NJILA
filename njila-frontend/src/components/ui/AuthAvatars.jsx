/**
 * AuthAvatars – Animated human-like characters covering their eyes.
 * When isPasswordFocused = true, they raise their hands to hide their eyes.
 */

const avatars = [
  { color: "#16a34a", skin: "#ffd6a5", hair: "#4b2c20" }, // Green + Brown hair
  { color: "#dc2626", skin: "#ffdbac", hair: "#1a1a1a" }, // Red + Black hair
  { color: "#ca8a04", skin: "#f1c27d", hair: "#2d1b10" }, // Yellow + Dark brown
];

function HumanAvatar({ color, skin, hair, isHiding, delay }) {
  return (
    <div 
      className="relative flex flex-col items-center group"
      style={{ animationDelay: delay }}
    >
      <div 
        className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl border-4 border-white dark:border-slate-800 transition-all duration-500 overflow-hidden relative"
        style={{ backgroundColor: color }}
      >
        {/* Face SVG */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Hair back */}
          <path d="M20 40 Q20 10 50 10 Q80 10 80 40 L80 60 Q80 80 50 80 Q20 80 20 60 Z" fill={hair} />
          
          {/* Face */}
          <circle cx="50" cy="55" r="35" fill={skin} />
          
          {/* Eyes */}
          <g className={`transition-opacity duration-300 ${isHiding ? 'opacity-0' : 'opacity-100'}`}>
            <circle cx="40" cy="50" r="3" fill="#1e293b" />
            <circle cx="60" cy="50" r="3" fill="#1e293b" />
          </g>

          {/* Mouth */}
          <path 
            d={isHiding ? "M40 70 Q50 65 60 70" : "M40 70 Q50 80 60 70"} 
            fill="none" 
            stroke="#78350f" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
          />

          {/* Hands Animation */}
          <g 
            className="transition-transform duration-500 ease-in-out"
            style={{ 
              transform: isHiding ? 'translateY(0)' : 'translateY(40px)',
            }}
          >
            {/* Left Hand */}
            <rect x="25" y="45" width="20" height="15" rx="8" fill={skin} stroke={skin} strokeWidth="1" />
            {/* Right Hand */}
            <rect x="55" y="45" width="20" height="15" rx="8" fill={skin} stroke={skin} strokeWidth="1" />
          </g>
        </svg>
      </div>

      <div className={`mt-2 h-1.5 w-6 rounded-full transition-all duration-300 ${isHiding ? 'bg-amber-400 w-8' : 'bg-white/20'}`} />
    </div>
  );
}

export default function AuthAvatars({ isPasswordFocused }) {
  return (
    <div className="flex items-end justify-center gap-6 mb-8 py-2">
      {avatars.map((props, i) => (
        <HumanAvatar
          key={i}
          {...props}
          isHiding={isPasswordFocused}
          delay={`${i * 80}ms`}
        />
      ))}
    </div>
  );
}
