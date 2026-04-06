import { Star, Users, ArrowRight, Clock } from "lucide-react";
import Badge from "../ui/Badge";
import { formatMontant } from "../../utils/formatters";

export default function TripCard({ voyage, onSelect }) {
  const hDepart  = voyage.heureDepart?.slice(11, 16) || "—";
  const hArrivee = voyage.heureArrivee?.slice(11, 16) || "—";
  const urgent   = voyage.placesDisponibles <= 5;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between gap-4">

        {/* Logo agence + infos */}
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 bg-[#135bec]/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-[#135bec] font-black text-sm">{voyage.codeAgence || "AG"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <p className="font-bold text-slate-900">{voyage.agenceNom || "Agence"}</p>
              <Badge variant={voyage.type === "VIP" ? "primary" : "gray"}>
                {voyage.type || "CLASSIC"}
              </Badge>
              <div className="flex items-center gap-0.5">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-xs text-slate-500">4.5</span>
              </div>
            </div>

            {/* Horaires */}
            <div className="flex items-center gap-3">
              <span className="text-2xl font-extrabold text-slate-900">{hDepart}</span>
              <div className="flex items-center gap-1 text-slate-300 flex-1">
                <div className="flex-1 h-px bg-slate-200" />
                <div className="flex flex-col items-center">
                  <span className="material-icons text-slate-300 text-xs">directions_bus</span>
                  <span className="text-[10px] text-slate-400">Direct</span>
                </div>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <span className="text-2xl font-extrabold text-slate-900">{hArrivee}</span>
            </div>

            <p className="text-xs text-slate-400 mt-1">
              {voyage.origine} → {voyage.destination}
            </p>
          </div>
        </div>

        {/* Prix + CTA */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-slate-400 mb-1">À partir de</p>
          <p className="text-2xl font-extrabold text-[#135bec]">
            {formatMontant(voyage.prix || 0)}
          </p>

          {urgent ? (
            <p className="text-xs text-red-500 flex items-center gap-1 justify-end mt-1">
              <Users className="w-3 h-3" />
              Plus que {voyage.placesDisponibles} place(s) !
            </p>
          ) : (
            <p className="text-xs text-emerald-600 flex items-center gap-1 justify-end mt-1">
              <Users className="w-3 h-3" />
              {voyage.placesDisponibles} places disponibles
            </p>
          )}

          <button
            onClick={() => onSelect?.(voyage)}
            className="mt-3 w-full bg-[#135bec] hover:bg-blue-700 text-white font-bold
                       text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm
                       shadow-[#135bec]/20 flex items-center justify-center gap-1"
          >
            Réserver <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
