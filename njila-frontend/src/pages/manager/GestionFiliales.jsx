/**
 * GestionFiliales.jsx – Page Manager Global
 * Création et gestion des filiales de l'agence mère
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Building2, MapPin, Users, Bus, TrendingUp,
  ArrowRight, MoreVertical, CheckCircle, XCircle, Pencil, Download
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Modal from "../../components/ui/Modal";
import Badge from "../../components/ui/Badge";
import Spinner from "../../components/ui/Spinner";
import { filialeService } from "../../services/filialeService";
import { formatMontant } from "../../utils/formatters";
import { useAuthStore } from "../../store/authStore";

const PLANS_LIMITES = { ESSAI: 1, MENSUEL: 3, TRIMESTRIEL: 5, ANNUEL: Infinity };

const MOCK_FILIALES = [
  { id: "1", nom: "General Mvan",     ville: "Douala – Mvan",      manager: "Jean Mbarga",   bus: 8,  voyages: 142, taux: 87, recettes: 2800000, actif: true  },
  { id: "2", nom: "General Akwa",     ville: "Douala – Akwa",      manager: "Marie Ekotto",  bus: 6,  voyages: 108, taux: 79, recettes: 1950000, actif: true  },
  { id: "3", nom: "General Bassa",    ville: "Douala – Bassa",     manager: "Paul Ndjock",   bus: 4,  voyages: 76,  taux: 72, recettes: 1320000, actif: true  },
  { id: "4", nom: "General Bonaberi", ville: "Douala – Bonaberi",  manager: "Alice Fon",     bus: 5,  voyages: 95,  taux: 83, recettes: 1640000, actif: false },
];

const VILLES_CM = ["Douala", "Yaoundé", "Bafoussam", "Garoua", "Ngaoundéré", "Bamenda", "Kribi", "Bertoua", "Ebolowa", "Maroua"];

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    nom: "", ville: "Douala", adresse: "",
    managerNom: "", managerPrenom: "", managerEmail: "", managerTelephone: "",
  });

  const planActuel = user?.plan || "MENSUEL";
  const limiteFililaes = PLANS_LIMITES[planActuel] || 3;

  const { data: filiales, isLoading } = useQuery({
    queryKey: ["filiales"],
    queryFn: filialeService.getFiliales,
    retry: 1,
    // Fallback sur données mock si API indisponible
    placeholderData: MOCK_FILIALES,
  });

  const filialeListe = filiales?.length ? filiales : MOCK_FILIALES;

  const { mutate: creerFiliale, isPending } = useMutation({
    mutationFn: filialeService.creerFiliale,
    onSuccess: () => {
      toast.success("Filiale créée avec succès !");
      qc.invalidateQueries({ queryKey: ["filiales"] });
      setIsModalOpen(false);
      setForm({ nom: "", ville: "Douala", adresse: "", managerNom: "", managerPrenom: "", managerEmail: "", managerTelephone: "" });
    },
    onError: () => toast.error("Erreur lors de la création de la filiale."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nom || !form.managerEmail) return toast.error("Nom et email manager requis.");
    creerFiliale(form);
  };

  const totalRecettes = filialeListe.reduce((s, f) => s + (f.recettes || 0), 0);

  // Génération rapport PDF
  const handlePDF = () => {
    const content = `
      <html><head><title>Rapport Filiales – ${user?.agenceNom || "Mon Agence"}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
      h1{color:#135bec}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}
      th{background:#135bec;color:white}</style></head><body>
      <h1>Rapport des Filiales</h1>
      <p>Agence : ${user?.agenceNom || "—"} | Date : ${new Date().toLocaleDateString("fr-FR")}</p>
      <p>Total recettes : ${formatMontant(totalRecettes)}</p>
      <table><tr><th>Filiale</th><th>Ville</th><th>Manager</th><th>Bus</th><th>Voyages</th><th>Taux</th><th>Recettes</th></tr>
      ${filialeListe.map(f => `<tr><td>${f.nom}</td><td>${f.ville}</td><td>${f.manager||"—"}</td><td>${f.bus}</td><td>${f.voyages}</td><td>${f.taux}%</td><td>${formatMontant(f.recettes)}</td></tr>`).join("")}
      </table></body></html>
    `;
    const win = window.open("", "_blank");
    win.document.write(content);
    win.document.close();
    win.print();
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Mes Filiales</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {filialeListe.filter(f => f.actif !== false).length} active(s) sur {filialeListe.length} — Plan <span className="font-bold text-[#135bec]">{planActuel}</span> ({limiteFililaes === Infinity ? "illimité" : `max ${limiteFililaes}`})
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
            onClick={() => setIsModalOpen(true)}
            disabled={filialeListe.length >= limiteFililaes}
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-[#135bec]/20"
          >
            <Plus className="w-4 h-4" /> Nouvelle Filiale
          </button>
        </div>
      </div>

      {/* KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total filiales",   value: filialeListe.length,                   color: "text-slate-900",   bg: "bg-slate-50" },
          { label: "Actives",          value: filialeListe.filter(f=>f.actif!==false).length, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Bus total",        value: filialeListe.reduce((s,f)=>s+(f.bus||0),0),    color: "text-[#135bec]",  bg: "bg-blue-50" },
          { label: "Recettes cumulées",value: formatMontant(totalRecettes),           color: "text-violet-600", bg: "bg-violet-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-5`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-sm text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Liste filiales */}
      {isLoading ? <Spinner size="lg" className="py-20" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filialeListe.map((f) => {
            const tauxColor = f.taux >= 85 ? "text-emerald-600 bg-emerald-50" : f.taux >= 70 ? "text-blue-600 bg-blue-50" : "text-amber-600 bg-amber-50";
            const isActif = f.actif !== false;
            return (
              <div key={f.id} className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all ${isActif ? "border-slate-100" : "border-red-100 opacity-75"}`}>
                {/* En-tête filiale */}
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
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded-lg ${tauxColor}`}>{f.taux}%</div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <StatPill icon={Bus}        value={f.bus}       label="Bus"      color="text-[#135bec]"  />
                  <StatPill icon={TrendingUp} value={f.voyages}   label="Voyages"  color="text-emerald-500"/>
                  <StatPill icon={TrendingUp} value={formatMontant(f.recettes).replace("FCFA","").trim()} label="Recettes" color="text-violet-500"/>
                </div>

                {/* Taux d'occupation */}
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Taux d'occupation</span>
                    <span className="font-bold">{f.taux}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${f.taux}%`, backgroundColor: f.taux >= 85 ? "#10b981" : f.taux >= 70 ? "#135bec" : "#f59e0b" }}
                    />
                  </div>
                </div>

                {/* Manager local */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                      {f.manager?.[0] || "M"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{f.manager || "Manager local"}</p>
                      <p className="text-[10px] text-slate-400">Manager Local</p>
                    </div>
                  </div>
                  <button className="text-xs text-[#135bec] font-bold hover:underline flex items-center gap-1">
                    Détails <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Carte "Ajouter" */}
          {filialeListe.length < limiteFililaes && (
            <button
              onClick={() => setIsModalOpen(true)}
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

      {/* Modal Création Filiale */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Créer une Nouvelle Filiale"
        size="lg"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={isPending} className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors">
              {isPending ? "Création…" : "Créer la filiale"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="pb-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Informations de la filiale</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom de la filiale *</label>
                <input
                  placeholder="Ex: General Mvan"
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ville</label>
                <select
                  value={form.ville}
                  onChange={e => setForm(f => ({ ...f, ville: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                >
                  {VILLES_CM.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Adresse exacte</label>
              <input
                placeholder="Quartier, rue, point de repère"
                value={form.adresse}
                onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Assigner un Manager Local</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom *</label>
                <input
                  placeholder="Dupont"
                  value={form.managerNom}
                  onChange={e => setForm(f => ({ ...f, managerNom: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prénom</label>
                <input
                  placeholder="Jean"
                  value={form.managerPrenom}
                  onChange={e => setForm(f => ({ ...f, managerPrenom: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email professionnel *</label>
                <input
                  type="email"
                  placeholder="manager@agence.cm"
                  value={form.managerEmail}
                  onChange={e => setForm(f => ({ ...f, managerEmail: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone (+237)</label>
                <input
                  placeholder="6XX XXX XXX"
                  value={form.managerTelephone}
                  onChange={e => setForm(f => ({ ...f, managerTelephone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
            </div>
            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
              <strong>Info :</strong> Un email d'invitation sera envoyé au Manager Local avec ses identifiants de connexion. Son compte sera automatiquement rattaché à cette filiale.
            </div>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
