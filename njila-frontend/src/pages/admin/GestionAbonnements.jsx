/**
 * GestionAbonnements.jsx – Admin NJILA
 * Source principale : GET /api/subscribe/tableau-de-bord
 * Source agences    : GET /api/agencies/agences
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, RefreshCw, Pause, Play, MoreVertical, Building2,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import Modal from "../../components/ui/Modal";
import { subscribeService } from "../../services/subscribeService";
import { formatMontant } from "../../utils/formatters";

// ── Plans ─────────────────────────────────────────────────────────────────────
const PLANS_INFO = {
  ESSAI:       { prix: 0,      label: "Essai",       color: "gray"    },
  MENSUEL:     { prix: 50000,  label: "Mensuel",     color: "primary" },
  TRIMESTRIEL: { prix: 130000, label: "Trimestriel", color: "success" },
  ANNUEL:      { prix: 450000, label: "Annuel",      color: "warning" },
};

// ── Statut ────────────────────────────────────────────────────────────────────
const STATUT_CONFIG = {
  ACTIVE:    { label: "Actif",    variant: "success" },
  SUSPENDED: { label: "Suspendu", variant: "danger"  },
  TRIAL:     { label: "Essai",    variant: "primary" },
  EXPIRED:   { label: "Expiré",   variant: "warning" },
};

// ── Fusionne agence + abonnement en une ligne ─────────────────────────────────
function mergeAgenceAbonnement(agence, abonnements = []) {
  const ab = abonnements.find(a => a.id_agence === agence.agence_id);
  return {
    id:            agence.agence_id,
    id_agence:     agence.agence_id,
    nom_agence:    agence.nom,
    email:         agence.email_officiel,
    logo:          agence.logo_image || null,
    statut_global: agence.statut_global,
    // champs abonnement (présents si l'agence a souscrit)
    plan:          ab?.plan          ?? "ESSAI",
    statut:        ab?.statut        ?? (agence.statut_global === "ACTIVE" ? "TRIAL" : "ACTIVE"),
    date_fin:      ab?.date_expiration ?? null,
    jours_restants: ab?.jours_restants ?? null,
  };
}

// ── Résumé à partir des lignes fusionnées ────────────────────────────────────
function buildResume(lignes, resumeApi) {
  // On préfère le résumé du back s'il est disponible
  if (resumeApi) {
    return {
      actifs:  resumeApi.actifs  ?? 0,
      essais:  resumeApi.essais  ?? 0,
      plan_essai:       0, // calculé ci-dessous
      plan_mensuel:     resumeApi.recettes_par_plan?.MENSUEL  !== undefined
                          ? lignes.filter(l => l.plan === "MENSUEL").length  : 0,
      plan_trimestriel: lignes.filter(l => l.plan === "TRIMESTRIEL").length,
      plan_annuel:      lignes.filter(l => l.plan === "ANNUEL").length,
      plan_essai_count: lignes.filter(l => l.plan === "ESSAI").length,
    };
  }
  // Fallback local
  const r = { actifs: 0, essais: 0, plan_essai_count: 0, plan_mensuel: 0, plan_trimestriel: 0, plan_annuel: 0 };
  lignes.forEach(l => {
    if (l.statut === "ACTIVE")  r.actifs++;
    if (l.statut === "TRIAL")   r.essais++;
    if (l.plan === "ESSAI")       r.plan_essai_count++;
    if (l.plan === "MENSUEL")     r.plan_mensuel++;
    if (l.plan === "TRIMESTRIEL") r.plan_trimestriel++;
    if (l.plan === "ANNUEL")      r.plan_annuel++;
  });
  return r;
}

function getPlanCount(resume, plan) {
  return resume[`plan_${plan.toLowerCase()}`]
      ?? resume[`plan_${plan.toLowerCase()}_count`]
      ?? 0;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function GestionAbonnements() {
  const qc = useQueryClient();
  const [actionMenuId, setActionMenuId]         = useState(null);
  const [isChangePlanModal, setIsChangePlanModal] = useState(false);
  const [selectedAgence, setSelectedAgence]     = useState(null);
  const [selectedPlan, setSelectedPlan]         = useState("");

  // ── Fetch tableau de bord ─────────────────────────────────────────────────
  const {
    data: tableau,
    isLoading: loadingTableau,
    isError: errorTableau,
  } = useQuery({
    queryKey: ["admin-tableau-bord"],
    queryFn:  subscribeService.getTableauDeBord,
    retry: 1,
  });

  // ── Fetch liste agences ───────────────────────────────────────────────────
  const {
    data: agencesRaw = [],
    isLoading: loadingAgences,
    isError: errorAgences,
  } = useQuery({
    queryKey: ["admin-agences"],
    queryFn:  subscribeService.getAgences,
    retry: 1,
  });

  const isLoading = loadingTableau || loadingAgences;
  const isError   = errorTableau   && errorAgences;   // erreur seulement si les deux échouent

  // ── Fusion agences + abonnements ─────────────────────────────────────────
  const abonnementsTableau = tableau?.abonnements_expirant_bientot ?? [];
  const lignes = agencesRaw.map(ag => mergeAgenceAbonnement(ag, abonnementsTableau));

  // Résumé
  const resume = buildResume(lignes, tableau?.resume);

  // Expirant bientôt (≤ 30 j) — depuis l'API ou depuis la fusion locale
  const expirantBientot = abonnementsTableau.length > 0
    ? lignes.filter(l => abonnementsTableau.some(a => a.id_agence === l.id_agence))
    : lignes.filter(l => l.jours_restants !== null && l.jours_restants <= 30);

  // ── Invalidation ──────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-tableau-bord"] });
    qc.invalidateQueries({ queryKey: ["admin-agences"] });
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const { mutate: suspendre, isPending: isSuspending } = useMutation({
    mutationFn: ({ id }) => subscribeService.suspendre(id, { motif: "Action admin", admin_id: "ADMIN-001" }),
    onSuccess: () => { toast.success("Agence suspendue."); invalidate(); },
    onError:   () => toast.error("Échec de la suspension."),
  });

  const { mutate: reactiver, isPending: isReactivating } = useMutation({
    mutationFn: ({ id }) => subscribeService.reactiver(id, {}),
    onSuccess: () => { toast.success("Agence réactivée."); invalidate(); },
    onError:   () => toast.error("Échec de la réactivation."),
  });

  const { mutate: souscrire, isPending: isSouscribing } = useMutation({
    mutationFn: ({ id, plan }) => subscribeService.souscrire(id, { plan }),
    onSuccess: () => {
      toast.success("Plan mis à jour.");
      invalidate();
      setIsChangePlanModal(false);
      setSelectedAgence(null);
      setSelectedPlan("");
    },
    onError: () => toast.error("Échec de la souscription."),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAction = (ligne, action) => {
    setActionMenuId(null);
    if (action === "suspendre")    suspendre({ id: ligne.id_agence });
    if (action === "reactiver")    reactiver({ id: ligne.id_agence });
    if (action === "changer_plan") {
      setSelectedAgence(ligne);
      setSelectedPlan(ligne.plan);
      setIsChangePlanModal(true);
    }
  };

  const handleChangePlan = () => {
    if (!selectedPlan) return toast.error("Choisissez un plan.");
    souscrire({ id: selectedAgence.id_agence, plan: selectedPlan });
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Abonnements</h1>
          <p className="text-slate-400 mt-1 text-sm">Suivi des plans, renouvellements et suspensions</p>
        </div>
      </div>

      {isLoading ? (
        <Spinner size="lg" className="py-20" />
      ) : isError ? (
        <Card className="py-16 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Impossible de charger les données.</p>
          <p className="text-slate-400 text-sm mt-1">Vérifiez que le service est disponible.</p>
        </Card>
      ) : (
        <>
          {/* ── Résumé par plan ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(PLANS_INFO).map(([plan, { prix, label, color }]) => {
              const count = getPlanCount(resume, plan);
              return (
                <Card key={plan} className="text-center py-4">
                  <Badge variant={color} className="mb-2">{label}</Badge>
                  <p className="text-2xl font-extrabold text-slate-900 mt-2">
                    {plan === "ESSAI" ? "Gratuit" : formatMontant(prix)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {count} abonnement{count !== 1 ? "s" : ""}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* ── Compteurs résumé (actifs / essais) ──────────────────────── */}
          {tableau?.resume && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Actifs",    value: tableau.resume.actifs,          color: "text-emerald-600" },
                { label: "Essais",    value: tableau.resume.essais,          color: "text-blue-600"    },
                { label: "Expirant",  value: tableau.resume.expirant_sous_30j, color: "text-amber-500" },
                { label: "Suspendus", value: tableau.resume.suspendus,       color: "text-red-500"     },
              ].map(({ label, value, color }) => (
                <Card key={label} className="text-center py-3">
                  <p className={`text-3xl font-extrabold ${color}`}>{value ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-1">{label}</p>
                </Card>
              ))}
            </div>
          )}

          {/* ── À renouveler bientôt ─────────────────────────────────────── */}
          {expirantBientot.length > 0 && (
            <Card className="mb-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                À renouveler bientôt
              </h3>
              <div className="space-y-3">
                {expirantBientot.map(ab => (
                  <div
                    key={ab.id}
                    className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{ab.nom_agence}</p>
                      <p className="text-xs text-slate-500">
                        Plan {ab.plan}
                        {ab.jours_restants !== null && (
                          <> — <span className="text-amber-600 font-semibold">
                            {ab.jours_restants} jour{ab.jours_restants !== 1 ? "s" : ""} restant{ab.jours_restants !== 1 ? "s" : ""}
                          </span></>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => suspendre({ id: ab.id_agence })}
                        disabled={isSuspending}
                      >
                        <Pause className="w-4 h-4 mr-1" /> Suspendre
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedAgence(ab);
                          setSelectedPlan(ab.plan);
                          setIsChangePlanModal(true);
                        }}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" /> Renouveler
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Tous les abonnements ─────────────────────────────────────── */}
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Tous les abonnements</h3>
              <span className="text-xs text-slate-400">
                {lignes.length} agence{lignes.length !== 1 ? "s" : ""}
              </span>
            </div>

            {lignes.length === 0 ? (
              <div className="py-16 text-center">
                <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Aucune agence enregistrée.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Agence", "Plan", "Statut", "Date de fin", "Actions"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map(ab => {
                    const planInfo = PLANS_INFO[ab.plan] || { label: ab.plan, color: "gray" };
                    const statut   = STATUT_CONFIG[ab.statut] || { label: ab.statut, variant: "gray" };
                    return (
                      <tr key={ab.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        {/* Agence */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {ab.logo ? (
                              <img src={ab.logo} className="w-9 h-9 rounded-xl object-cover" alt={ab.nom_agence} />
                            ) : (
                              <img
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(ab.nom_agence)}&background=135bec&color=fff&size=36&bold=true`}
                                className="w-9 h-9 rounded-xl"
                                alt={ab.nom_agence}
                              />
                            )}
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{ab.nom_agence}</p>
                              {ab.email && <p className="text-xs text-slate-400">{ab.email}</p>}
                            </div>
                          </div>
                        </td>
                        {/* Plan */}
                        <td className="px-5 py-4">
                          <Badge variant={planInfo.color}>{planInfo.label}</Badge>
                        </td>
                        {/* Statut */}
                        <td className="px-5 py-4">
                          <Badge variant={statut.variant}>{statut.label}</Badge>
                        </td>
                        {/* Date de fin */}
                        <td className="px-5 py-4 text-sm text-slate-400">
                          {ab.date_fin ? ab.date_fin.slice(0, 10) : "—"}
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-4 relative">
                          <button
                            onClick={() => setActionMenuId(actionMenuId === ab.id ? null : ab.id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg"
                          >
                            <MoreVertical className="w-4 h-4 text-slate-400" />
                          </button>

                          {actionMenuId === ab.id && (
                            <div className="absolute right-5 top-full mt-1 w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-10 py-1">
                              {ab.statut === "ACTIVE" || ab.statut === "TRIAL" ? (
                                <button
                                  onClick={() => handleAction(ab, "suspendre")}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Pause className="w-4 h-4" /> Suspendre
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAction(ab, "reactiver")}
                                  className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                                >
                                  <Play className="w-4 h-4" /> Réactiver
                                </button>
                              )}
                              <button
                                onClick={() => handleAction(ab, "changer_plan")}
                                className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                              >
                                <CreditCard className="w-4 h-4" /> Changer de plan
                              </button>
                              <button
                                onClick={() => handleAction(ab, "changer_plan")}
                                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <RefreshCw className="w-4 h-4" /> Renouveler
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {/* ── Modal Changement de plan ──────────────────────────────────────── */}
      <Modal
        open={isChangePlanModal}
        onClose={() => { setIsChangePlanModal(false); setSelectedAgence(null); }}
        title={`Changer le plan — ${selectedAgence?.nom_agence || ""}`}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setIsChangePlanModal(false)}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleChangePlan}
              disabled={isSouscribing}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl"
            >
              {isSouscribing ? "Mise à jour…" : "Confirmer"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500 mb-4">Sélectionnez le nouveau plan :</p>
          {Object.entries(PLANS_INFO).map(([plan, { label, prix, color }]) => (
            <label
              key={plan}
              className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedPlan === plan
                  ? "border-[#135bec] bg-blue-50"
                  : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="plan"
                  value={plan}
                  checked={selectedPlan === plan}
                  onChange={() => setSelectedPlan(plan)}
                  className="accent-[#135bec]"
                />
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{label}</p>
                  <p className="text-xs text-slate-400">
                    {plan === "ESSAI" ? "Gratuit" : `${formatMontant(prix)} / période`}
                  </p>
                </div>
              </div>
              <Badge variant={color}>{label}</Badge>
            </label>
          ))}
        </div>
      </Modal>
    </DashboardLayout>
  );
}
