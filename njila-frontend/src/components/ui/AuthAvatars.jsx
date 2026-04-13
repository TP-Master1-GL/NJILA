/**
 * AuthAvatars – 3 avatars aux couleurs du Cameroun (Vert, Rouge, Jaune)
 * Quand isPasswordFocused = true, ils se couvrent les yeux.
 */

const avatars = [
  { couleur: "#16a34a", labelColor: "#fff", emoji: "👦", name: "Gars 1" }, // Vert
  { couleur: "#dc2626", labelColor: "#fff", emoji: "👧", name: "Fille"  }, // Rouge
  { couleur: "#ca8a04", labelColor: "#fff", emoji: "👦", name: "Gars 2" }, // Jaune
];

function Avatar({ couleur, isHiding, delay }) {
  return (
    <div
      className="relative flex flex-col items-center"
      style={{ animationDelay: delay }}
    >
      {/* Corps */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-[3px] border-white transition-all duration-300"
        style={{ backgroundColor: couleur }}
      >
        {/* Visage */}
        <div className="relative w-10 h-10 bg-[#ffd6a5] rounded-full flex items-center justify-center overflow-hidden">
          {/* Yeux */}
          {isHiding ? (
            /* Mains sur les yeux */
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-2xl transition-all duration-300"
                style={{ transform: "translateY(-2px)" }}
              >
                🙈
              </span>
            </div>
          ) : (
            /* Yeux normaux + sourire */
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
              </div>
              <svg viewBox="0 0 16 8" className="w-4 h-2 mt-0.5">
                <path
                  d="M2 2 Q8 8 14 2"
                  fill="none"
                  stroke="#78350f"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Bandeau couleur Cameroun sous l'avatar */}
      <div
        className="w-2 h-2 rounded-full mt-1 opacity-70"
        style={{ backgroundColor: couleur }}
      />
    </div>
  );
}

export default function AuthAvatars({ isPasswordFocused }) {
  return (
    <div className="flex items-end justify-center gap-4 mb-6">
      {avatars.map(({ couleur }, i) => (
        <Avatar
          key={i}
          couleur={couleur}
          isHiding={isPasswordFocused}
          delay={`${i * 60}ms`}
        />
      ))}
    </div>
  );
}
