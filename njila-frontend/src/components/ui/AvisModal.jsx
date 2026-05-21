import { useState } from "react";
import { X, Star } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { avisService } from "../../services/avisService";
import { useAuthStore } from "../../store/authStore";

/**
 * Modal de soumission d'avis pour un voyage.
 *
 * Props :
 *   voyage     — objet voyage normalisé (id, codeAgence, dateHeureDepart,
 *                trajetInfo, origine, destination)
 *   onClose()  — callback fermeture
 *   onSuccess() — callback après envoi réussi (optionnel)
 */
export default function AvisModal({ voyage, onClose, onSuccess }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [note, setNote] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [commentaires, setCommentaires] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      avisService.soumettrreAvis({
        Id_voyage: voyage.id,
        note,
        commentaires,
        user_id: user?.id || user?.userId || "",
        est_approuve: true,
      }),
    onSuccess: () => {
      setSubmitted(true);
      // Invalider le cache des avis pour ce voyage
      queryClient.invalidateQueries({ queryKey: ["avis", voyage.id] });
      queryClient.invalidateQueries({ queryKey: ["avis-stats", voyage.id] });
      onSuccess?.();
      setTimeout(onClose, 2000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (note === 0) return;
    mutate();
  };

  const LABELS = ["", "Mauvais", "Passable", "Correct", "Bien", "Excellent"];

  return (
    /* Overlay — position relative pour ne pas casser le layout iframe */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Laisser un avis</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {voyage.origine && voyage.destination
                ? `${voyage.origine} → ${voyage.destination}`
                : voyage.trajetInfo || ""}
              {voyage.codeAgence ? ` · ${voyage.codeAgence}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="px-6 py-5">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-emerald-600 text-2xl">✓</span>
              </div>
              <p className="font-bold text-slate-900 mb-1">Merci pour votre avis !</p>
              <p className="text-sm text-slate-500">Votre retour aide les autres voyageurs.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Étoiles */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Votre note
                </p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNote(v)}
                      onMouseEnter={() => setHovered(v)}
                      onMouseLeave={() => setHovered(0)}
                      className="focus:outline-none transition-transform hover:scale-110"
                      aria-label={`${v} étoile${v > 1 ? "s" : ""}`}
                    >
                      <Star
                        className="w-9 h-9 transition-colors"
                        fill={(hovered || note) >= v ? "#f59e0b" : "none"}
                        stroke={(hovered || note) >= v ? "#f59e0b" : "#d1d5db"}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                  {(hovered || note) > 0 && (
                    <span className="text-sm font-semibold text-amber-500 ml-2">
                      {LABELS[hovered || note]}
                    </span>
                  )}
                </div>
                {note === 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    Cliquez sur une étoile pour noter le voyage
                  </p>
                )}
              </div>

              {/* Commentaire */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Votre commentaire
                </p>
                <textarea
                  value={commentaires}
                  onChange={(e) => setCommentaires(e.target.value)}
                  placeholder="Décrivez votre expérience : ponctualité, confort, service…"
                  rows={4}
                  maxLength={500}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm border-0 focus:ring-2 focus:ring-[#135bec] resize-none placeholder:text-slate-400"
                  required
                />
                <p className="text-[10px] text-slate-400 text-right mt-1">
                  {commentaires.length}/500
                </p>
              </div>

              {/* Erreur API */}
              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl">
                  {error?.response?.data?.detail ||
                   error?.response?.data?.non_field_errors?.[0] ||
                   "Une erreur est survenue. Veuillez réessayer."}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={note === 0 || !commentaires.trim() || isPending}
                  className="flex-1 py-3 rounded-xl bg-[#135bec] text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 active:scale-95"
                >
                  {isPending ? "Envoi…" : "Envoyer mon avis →"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}