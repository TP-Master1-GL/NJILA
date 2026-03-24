import { cn } from "../../utils/cn";

// occupied : array de numéros de places occupées
// selected : array de places sélectionnées {id, numero}
// onToggle : (place) => void
export default function SeatMap({
  totalPlaces = 40,
  occupied    = [],
  selected    = [],
  onToggle,
  readOnly    = false,
}) {
  const seats = Array.from({ length: totalPlaces }, (_, i) => ({
    id:      i + 1,
    numero:  i + 1,
    occupe:  occupied.includes(i + 1),
  }));

  const isSelected = (seat) => selected.some(s => s.id === seat.id);

  const rows = Math.ceil(seats.length / 4);

  return (
    <div className="w-full">
      {/* Légende */}
      <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md border-2 border-slate-200 inline-block" />
          Libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-[#135bec] inline-block" />
          Sélectionné
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-slate-200 inline-block" />
          Occupé
        </span>
      </div>

      {/* Bus */}
      <div className="border-2 border-slate-200 rounded-2xl p-4 max-w-xs mx-auto bg-slate-50">
        {/* Avant du bus */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-dashed border-slate-300">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
              <span className="material-icons text-slate-400 text-base">person</span>
            </div>
            <span className="text-[9px] text-slate-400 mt-0.5">Chauffeur</span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
            AVANT →
          </span>
        </div>

        {/* Grille des places */}
        <div className="space-y-2">
          {Array.from({ length: rows }, (_, row) => (
            <div key={row} className="grid grid-cols-5 gap-1.5 items-center">
              {/* Côté gauche (2 places) */}
              {[0, 1].map(col => {
                const seat = seats[row * 4 + col];
                if (!seat) return <div key={col} />;
                const sel = isSelected(seat);
                return (
                  <button
                    key={seat.id}
                    disabled={seat.occupe || readOnly}
                    onClick={() => !seat.occupe && !readOnly && onToggle?.(seat)}
                    className={cn(
                      "w-10 h-10 rounded-lg text-xs font-bold transition-all duration-150",
                      seat.occupe
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : sel
                        ? "bg-[#135bec] text-white shadow-md shadow-[#135bec]/30 scale-105"
                        : "border-2 border-slate-200 text-slate-500 hover:border-[#135bec]/50 hover:text-[#135bec] bg-white"
                    )}
                  >
                    {seat.numero}
                  </button>
                );
              })}

              {/* Allée */}
              <div className="flex items-center justify-center">
                <div className="w-px h-8 bg-slate-200" />
              </div>

              {/* Côté droit (2 places) */}
              {[2, 3].map(col => {
                const seat = seats[row * 4 + col];
                if (!seat) return <div key={col} />;
                const sel = isSelected(seat);
                return (
                  <button
                    key={seat.id}
                    disabled={seat.occupe || readOnly}
                    onClick={() => !seat.occupe && !readOnly && onToggle?.(seat)}
                    className={cn(
                      "w-10 h-10 rounded-lg text-xs font-bold transition-all duration-150",
                      seat.occupe
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : sel
                        ? "bg-[#135bec] text-white shadow-md shadow-[#135bec]/30 scale-105"
                        : "border-2 border-slate-200 text-slate-500 hover:border-[#135bec]/50 hover:text-[#135bec] bg-white"
                    )}
                  >
                    {seat.numero}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Résumé */}
      {selected.length > 0 && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">Places sélectionnées :</span>
          {selected.map(s => (
            <span key={s.id}
              className="text-xs bg-[#135bec]/10 text-[#135bec] px-2.5 py-1 rounded-full font-bold">
              {s.numero}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
