/**
 * GestionFiliales.jsx – Manager Global
 * Création filiale et assignation d'un manager local sont deux opérations distinctes :
 *   1. Créer la filiale  → POST /api/filiales/
 *   2. Assigner un manager local à une filiale existante → POST /api/users/agences/{agenceId}/managers-locaux
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, MapPin, Users, Bus, TrendingUp,
  ArrowRight, Download, ToggleLeft, ToggleRight, UserPlus,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { filialeService } from "../../services/filialeService";
import { userService } from "../../services/userService";
import { formatMontant } from "../../utils/formatters";
import { useAuthStore } from "../../store/authStore";

const PLANS_LIMITES = { ESSAI: 1, MENSUEL: 3, TRIMESTRIEL: 5, ANNUEL: Infinity };

const VILLES_CM = [
  "Douala", "Yaoundé", "Bafoussam", "Garoua", "Ngaoundéré",
  "Bamenda", "Maroua", "Kribi", "Limbe", "Ebolowa", "Dschang",
];

const FILIALE_FORM_INIT = {
  nom: "", code: "", ville: "Douala", adresse: "", telephone: "", email: "",
};

const MANAGER_FORM_INIT = {
  managerNom: "", managerPrenom: "", managerEmail: "", managerTelephone: "",
};

function StatPill({ icon: Icon, value, label, color }) {
  return (
    <div className="flex flex-col items-center bg-slate-50 rounded-xl p-2.5 text-center">
      <Icon className={`w-4 h-4 ${color} mb-1`} />
      <p className="text-sm font-extrabold text-slate-900 leading-tight">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function GestionFiliales() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  // ── Modals ─────────────────────────────────────────────────────────────────
  // Modal 1 : Créer une filiale
  const [isFilialeModalOpen, setIsFilialeModalOpen] = useState(false);
  const [filialeForm, setFilialeForm] = useState(FILIALE_FORM_INIT);

  // Modal 2 : Assigner un manager local à une filiale existante
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [selectedFiliale, setSelectedFiliale] = useState(null); // filiale cible
  const [managerForm, setManagerForm] = useState(MANAGER_FORM_INIT);

  const agenceId      = user?.agenceId;
  const planActuel    = user?.plan || "MENSUEL";
  const limiteFiliales = PLANS_LIMITES[planActuel] || 3;

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: filiales = [], isLoading, isError } = useQuery({
    queryKey: ["filiales", agenceId],
    queryFn:  () => filialeService.getFiliales({ agence: agenceId }),
    enabled:  !!agenceId,
    retry: 1,
  });

  // ── Mutation 1 : Créer une filiale (sans manager) ─────────────────────────
  const { mutate: creerFiliale, isPending: isCreatingFiliale } = useMutation({
    mutationFn: (payload) =>
      filialeService.creerFiliale({
        nom:       payload.nom,
        code:      payload.code,
        ville:     payload.ville,
        adresse:   payload.adresse,
        telephone: payload.telephone,
        email:     payload.email,
        agence:    agenceId,
      }),
    onSuccess: (nouvelleFiliale) => {
      toast.success("Filiale créée avec succès !");
      qc.invalidateQueries({ queryKey: ["filiales"] });
      setIsFilialeModalOpen(false);
      setFilialeForm(FILIALE_FORM_INIT);

      // Proposer d'assigner un manager immédiatement après la création
      if (nouvelleFiliale?.id_filiale) {
        setSelectedFiliale(nouvelleFiliale);
        setIsManagerModalOpen(true);
      }
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Erreur lors de la création de la filiale."),
  });

  // ── Mutation 2 : Assigner un manager local (opération indépendante) ────────
  const { mutate: assignerManager, isPending: isAssigningManager } = useMutation({
    mutationFn: (payload) =>
      userService.createManagerLocal(agenceId, {
        name:      payload.managerNom,
        surname:   payload.managerPrenom,
        email:     payload.managerEmail,
        phone:     payload.managerTelephone,
        filialeId: selectedFiliale?.id_filiale,
      }),
    onSuccess: () => {
      toast.success("Manager local assigné avec succès !");
      qc.invalidateQueries({ queryKey: ["filiales"] });
      setIsManagerModalOpen(false);
      setSelectedFiliale(null);
      setManagerForm(MANAGER_FORM_INIT);
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Erreur lors de l'assignation du manager."),
  });

  // ── Mutation 3 : Toggle activation filiale ─────────────────────────────────
  const { mutate: toggleFiliale } = useMutation({
    mutationFn: ({ id, est_active }) => filialeService.toggleFiliale(id, est_active),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      qc.invalidateQueries({ queryKey: ["filiales"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour."),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSubmitFiliale = (e) => {
    e?.preventDefault();
    if (!filialeForm.nom || !filialeForm.code)
      return toast.error("Nom et code de filiale requis.");
    if (filiales.length >= limiteFiliales)
      return toast.error(`Limite de ${limiteFiliales} filiale(s) atteinte pour votre plan.`);
    creerFiliale(filialeForm);
  };

  const handleSubmitManager = (e) => {
    e?.preventDefault();
    if (!managerForm.managerEmail)
      return toast.error("L'email du manager est requis.");
    if (!selectedFiliale?.id_filiale)
      return toast.error("Aucune filiale sélectionnée.");
    assignerManager(managerForm);
  };

  const openManagerModal = (filiale) => {
    setSelectedFiliale(filiale);
    setManagerForm(MANAGER_FORM_INIT);
    setIsManagerModalOpen(true);
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handlePDF = () => {
    const content = `
      <!DOCTYPE html><html><head><title>Rapport Filiales</title>
      <style>
        body{font-family:Arial;padding:30px;color:#1e293b}
        h1{color:#135bec}
        table{width:100%;border-collapse:collapse;margin-top:20px}
        th{background:#135bec;color:#fff;padding:10px;text-align:left;font-size:12px}
        td{padding:10px;border-bottom:1px solid #f1f5f9;font-size:13px}
      </style></head><body>
      <h1>Rapport des Filiales</h1>
      <p>Agence : ${user?.agenceNom || "—"} | Date : ${new Date().toLocaleDateString("fr-FR")}</p>
      <table>
        <thead><tr><th>Nom</th><th>Ville</th><th>Code</th><th>Email</th><th>Statut</th></tr></thead>
        <tbody>
          ${filiales.map(f => `
            <tr>
              <td><strong>${f.nom}</strong></td>
              <td>${f.ville}</td>
              <td>${f.code}</td>
              <td>${f.email || "—"}</td>
              <td style="color:${f.est_active !== false ? "#10b981" : "#dc2626"};font-weight:bold">
                ${f.est_active !== false ? "Active" : "Inactive"}
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
      <p style="margin-top:40px;font-size:10px;color:#94a3b8;text-align:center">
        Généré automatiquement par NJILA Cloud
      </p></body></html>`;
    const win = window.open("", "_blank");
    win.document.write(content);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const actives = filiales.filter((f) => f.est_active !== false).length;

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Mes Filiales</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {isLoading ? "Chargement…" : `${actives} active(s) sur ${filiales.length}`} — Plan{" "}
            <span className="font-bold text-[#135bec]">{planActuel}</span>{" "}
            ({limiteFiliales === Infinity ? "illimité" : `max ${limiteFiliales}`})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePDF}
            className="flex items-center gap-2 border border-slate-200 bg-white text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Rapport PDF
          </button>
          <button
            onClick={() => setIsFilialeModalOpen(true)}
            disabled={filiales.length >= limiteFiliales}
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-[#135bec]/20"
          >
            <Plus className="w-4 h-4" /> Nouvelle Filiale
          </button>
        </div>
      </div>

      {/* KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total filiales", value: filiales.length,           color: "text-slate-900",   bg: "bg-slate-50"   },
          { label: "Actives",        value: actives,                   color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Inactives",      value: filiales.length - actives, color: "text-red-500",     bg: "bg-red-50"     },
          { label: "Plan actuel",    value: planActuel,                color: "text-[#135bec]",   bg: "bg-blue-50"    },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-5`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-sm text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Liste */}
      {isLoading ? (
        <Spinner size="lg" className="py-20" />
      ) : isError ? (
        <div className="text-center py-20 text-slate-400 text-sm">Impossible de charger les filiales.</div>
      ) : filiales.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          Aucune filiale enregistrée.{" "}
          <button onClick={() => setIsFilialeModalOpen(true)} className="text-[#135bec] font-semibold hover:underline">
            Créer la première
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filiales.map((f) => {
            const isActif  = f.est_active !== false;
            const taux     = f.taux_occupation || 0;
            const tauxColor =
              taux >= 85 ? "text-emerald-600 bg-emerald-50"
              : taux >= 70 ? "text-blue-600 bg-blue-50"
              : "text-amber-600 bg-amber-50";

            return (
              <div
                key={f.id_filiale}
                className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all ${
                  isActif ? "border-slate-100" : "border-red-100 opacity-75"
                }`}
              >
                {/* En-tête */}
                <div className="flex items-start gap-3 mb-4">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(f.nom)}&background=135bec&color=fff&size=40&bold=true`}
                    alt={f.nom}
                    className="w-11 h-11 rounded-xl flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-slate-900 text-sm truncate">{f.nom}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isActif ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                        {isActif ? "Actif" : "Inactif"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{f.ville}
                    </p>
                    {f.code && (
                      <p className="text-[10px] font-mono text-slate-300 mt-0.5">#{f.code}</p>
                    )}
                  </div>
                  {taux > 0 && (
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg ${tauxColor}`}>{taux}%</div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <StatPill icon={Bus}        value={f.nb_bus      || "—"} label="Bus"      color="text-[#135bec]"   />
                  <StatPill icon={TrendingUp} value={f.nb_voyages  || "—"} label="Voyages"  color="text-emerald-500" />
                  <StatPill icon={Users}      value={f.nb_employes || "—"} label="Employés" color="text-violet-500"  />
                </div>

                {/* Barre taux occupation */}
                {taux > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Taux d'occupation</span>
                      <span className="font-bold">{taux}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${taux}%`,
                          backgroundColor: taux >= 85 ? "#10b981" : taux >= 70 ? "#135bec" : "#f59e0b",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="flex items-center gap-3">
                    {/* Toggle activation */}
                    <button
                      onClick={() => toggleFiliale({ id: f.id_filiale, est_active: !isActif })}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {isActif
                        ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                        : <ToggleLeft  className="w-4 h-4 text-slate-300"   />}
                      {isActif ? "Désactiver" : "Activer"}
                    </button>
                    {/* Assigner manager — opération distincte */}
                    <button
                      onClick={() => openManagerModal(f)}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 transition-colors"
                      title="Assigner un manager local"
                    >
                      <UserPlus className="w-4 h-4" /> Manager
                    </button>
                  </div>
                  <button className="text-xs text-[#135bec] font-bold hover:underline flex items-center gap-1">
                    Détails <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Carte "Ajouter" */}
          {filiales.length < limiteFiliales && (
            <button
              onClick={() => setIsFilialeModalOpen(true)}
              className="border-2 border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:border-[#135bec] hover:bg-blue-50/30 transition-all group min-h-[220px]"
            >
              <div className="w-12 h-12 bg-slate-100 group-hover:bg-[#135bec]/10 rounded-2xl flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6 text-slate-400 group-hover:text-[#135bec]" />
              </div>
              <p className="text-sm font-semibold text-slate-400 group-hover:text-[#135bec]">Ajouter une filiale</p>
            </button>
          )}
        </div>
      )}

      {/* ── Modal 1 : Créer une filiale ──────────────────────────────────────── */}
      <Modal
        open={isFilialeModalOpen}
        onClose={() => { setIsFilialeModalOpen(false); setFilialeForm(FILIALE_FORM_INIT); }}
        title="Créer une Nouvelle Filiale"
        size="lg"
        footer={
          <>
            <button
              onClick={() => { setIsFilialeModalOpen(false); setFilialeForm(FILIALE_FORM_INIT); }}
              className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmitFiliale}
              disabled={isCreatingFiliale}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {isCreatingFiliale ? "Création…" : "Créer la filiale"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Informations de la filiale
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom *</label>
              <input
                placeholder="Ex: General Mvan"
                value={filialeForm.nom}
                onChange={e => setFilialeForm(f => ({ ...f, nom: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Code unique *</label>
              <input
                placeholder="Ex: MVAN-01"
                value={filialeForm.code}
                onChange={e => setFilialeForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ville</label>
              <select
                value={filialeForm.ville}
                onChange={e => setFilialeForm(f => ({ ...f, ville: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              >
                {VILLES_CM.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone</label>
              <input
                placeholder="+237 6XX XXX XXX"
                value={filialeForm.telephone}
                onChange={e => setFilialeForm(f => ({ ...f, telephone: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                placeholder="filiale@agence.cm"
                value={filialeForm.email}
                onChange={e => setFilialeForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Adresse</label>
              <input
                placeholder="Quartier, rue, point de repère"
                value={filialeForm.adresse}
                onChange={e => setFilialeForm(f => ({ ...f, adresse: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            <strong>Info :</strong> Après la création, vous pourrez assigner un Manager Local directement depuis la carte filiale.
          </div>
        </div>
      </Modal>

      {/* ── Modal 2 : Assigner un Manager Local ──────────────────────────────── */}
      <Modal
        open={isManagerModalOpen}
        onClose={() => { setIsManagerModalOpen(false); setSelectedFiliale(null); setManagerForm(MANAGER_FORM_INIT); }}
        title={`Assigner un Manager Local${selectedFiliale?.nom ? ` — ${selectedFiliale.nom}` : ""}`}
        size="md"
        footer={
          <>
            <button
              onClick={() => { setIsManagerModalOpen(false); setSelectedFiliale(null); setManagerForm(MANAGER_FORM_INIT); }}
              className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmitManager}
              disabled={isAssigningManager}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {isAssigningManager ? "Assignation…" : "Assigner le manager"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Filiale cible — affichée en lecture seule */}
          {selectedFiliale && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedFiliale.nom)}&background=135bec&color=fff&size=36&bold=true`}
                className="w-9 h-9 rounded-lg"
                alt={selectedFiliale.nom}
              />
              <div>
                <p className="text-sm font-bold text-slate-900">{selectedFiliale.nom}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{selectedFiliale.ville}
                  {selectedFiliale.code && <span className="font-mono ml-1">#{selectedFiliale.code}</span>}
                </p>
              </div>
            </div>
          )}

          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Informations du Manager Local
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom</label>
              <input
                placeholder="Dupont"
                value={managerForm.managerNom}
                onChange={e => setManagerForm(f => ({ ...f, managerNom: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prénom</label>
              <input
                placeholder="Jean"
                value={managerForm.managerPrenom}
                onChange={e => setManagerForm(f => ({ ...f, managerPrenom: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email professionnel *</label>
              <input
                type="email"
                placeholder="manager@agence.cm"
                value={managerForm.managerEmail}
                onChange={e => setManagerForm(f => ({ ...f, managerEmail: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone</label>
              <input
                placeholder="6XX XXX XXX"
                value={managerForm.managerTelephone}
                onChange={e => setManagerForm(f => ({ ...f, managerTelephone: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-700">
            <strong>Info :</strong> Un email d'invitation sera envoyé au Manager Local avec ses identifiants de connexion.
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
