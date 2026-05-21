import { Star, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { avisService } from "../../services/avisService";

/**
 * Affiche la note moyenne + les avis d'un voyage en lecture.
 * Compact, utilisable dans une card ou un drawer.
 *
 * Props :
 *   voyageId  — UUID du voyage
 *   compact   — si true, affiche seulement la note moyenne (pas la liste)
 */
export default function AvisSection({ voyageId, compact = false }) {
  const { data: avis = [], isLoading } = useQuery({
    queryKey: ["avis", voyageId],
    queryFn: () => avisService.getAvisVoyage(voyageId),
    enabled: !!voyageId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Star className="w-3.5 h-3.5" />
        <span>Chargement…</span>
      </div>
    );
  }

  if (avis.length === 0) {
    if (compact) return null;
    return (
      <div className="text-center py-8 text-slate-400">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Aucun avis pour ce voyage</p>
      </div>
    );
  }

  const moyenne = avis.reduce((acc, a) => acc + a.note, 0) / avis.length;

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
        <span className="font-bold text-slate-700">{moyenne.toFixed(1)}</span>
        <span className="text-slate-400">({avis.length})</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Résumé */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div className="text-center">
          <p className="text-3xl font-extrabold text-slate-900">{moyenne.toFixed(1)}</p>
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <Star
                key={v}
                className="w-3.5 h-3.5"
                fill={moyenne >= v ? "#f59e0b" : moyenne >= v - 0.5 ? "#fcd34d" : "none"}
                stroke="#f59e0b"
                strokeWidth={1.5}
              />
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          <p className="font-semibold text-slate-700">{avis.length} avis</p>
          <p>tous vérifiés</p>
        </div>
      </div>

      {/* Liste des avis */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {avis.map((a) => (
          <div key={a.id_avis} className="bg-slate-50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <Star
                  key={v}
                  className="w-3 h-3"
                  fill={a.note >= v ? "#f59e0b" : "none"}
                  stroke={a.note >= v ? "#f59e0b" : "#d1d5db"}
                  strokeWidth={2}
                />
              ))}
              <span className="text-[10px] text-slate-400 ml-auto">
                {a.date_avis
                  ? new Date(a.date_avis).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : ""}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{a.commentaires}</p>
          </div>
        ))}
      </div>
    </div>
  );
}