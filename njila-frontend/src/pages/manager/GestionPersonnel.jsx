/**
 * GestionPersonnel.jsx – Manager Local
 * Gestion des guichetiers et chauffeurs d'une filiale
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, User, Phone, Mail, MoreVertical, Shield, Truck } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { userService } from "../../services/userService";
import { useAuthStore } from "../../store/authStore";
import { ROLES } from "../../utils/constants";

const roleConfig = {
  guichetier: { label: "Guichetier",  variant: "primary", icon: Shield },
  chauffeur:  { label: "Chauffeur",   variant: "success", icon: Truck  },
};

const GUICHETIER_FORM_INIT = { name: "", surname: "", email: "", phone: "", adresse: "" };
const CHAUFFEUR_FORM_INIT  = { name: "", surname: "", email: "", phone: "", numero_permis: "", date_embauche: "" };

export default function GestionPersonnel() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const filialeId = user?.filialeId;

  const [search, setSearch]                   = useState("");
  const [onglet, setOnglet]                   = useState("guichetiers"); // "guichetiers" | "chauffeurs"
  const [isModalGuichetier, setModalGuichetier] = useState(false);
  const [isModalChauffeur,  setModalChauffeur]  = useState(false);
  const [formG, setFormG] = useState(GUICHETIER_FORM_INIT);
  const [formC, setFormC] = useState(CHAUFFEUR_FORM_INIT);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: guichetiers = [], isLoading: loadingG } = useQuery({
    queryKey: ["guichetiers", filialeId],
    queryFn:  () => userService.listGuichetiersByFiliale(filialeId),
    enabled:  !!filialeId,
    retry: 1,
  });

  const { data: chauffeurs = [], isLoading: loadingC } = useQuery({
    queryKey: ["chauffeurs-filiale", filialeId],
    queryFn:  () => userService.listChauffeursByFiliale(filialeId),
    enabled:  !!filialeId,
    retry: 1,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const { mutate: creerGuichetier, isPending: pendingG } = useMutation({
    mutationFn: (payload) => userService.createGuichetier(filialeId, payload),
    onSuccess: () => {
      toast.success("Guichetier créé et email d'invitation envoyé !");
      qc.invalidateQueries({ queryKey: ["guichetiers", filialeId] });
      setModalGuichetier(false);
      setFormG(GUICHETIER_FORM_INIT);
    },
    onError: (err) => toast.error(err?.response?.data?.error || "Erreur lors de la création."),
  });

  const { mutate: creerChauffeur, isPending: pendingC } = useMutation({
    mutationFn: (payload) => userService.createChauffeur(filialeId, payload),
    onSuccess: () => {
      toast.success("Chauffeur créé et email d'invitation envoyé !");
      qc.invalidateQueries({ queryKey: ["chauffeurs-filiale", filialeId] });
      setModalChauffeur(false);
      setFormC(CHAUFFEUR_FORM_INIT);
    },
    onError: (err) => toast.error(err?.response?.data?.error || "Erreur lors de la création."),
  });

  const handleSubmitGuichetier = (e) => {
    e.preventDefault();
    if (!formG.name || !formG.email) return toast.error("Nom et email requis.");
    creerGuichetier(formG);
  };

  const handleSubmitChauffeur = (e) => {
    e.preventDefault();
    if (!formC.name || !formC.numero_permis) return toast.error("Nom et numéro de permis requis.");
    creerChauffeur(formC);
  };

  // ── Filtres ───────────────────────────────────────────────────────────────
  const liste  = onglet === "guichetiers" ? guichetiers : chauffeurs;
  const loading = onglet === "guichetiers" ? loadingG : loadingC;
  const filtered = liste.filter(p =>
    `${p.name} ${p.surname}`.toLowerCase().includes(search.toLowerCase()) ||
    (p.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: "Guichetiers",    value: guichetiers.length, color: "text-[#135bec]",   bg: "bg-blue-50"    },
    { label: "Chauffeurs",     value: chauffeurs.length,  color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total personnel", value: guichetiers.length + chauffeurs.length, color: "text-slate-900", bg: "bg-slate-50" },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion du Personnel</h1>
          <p className="text-slate-400 text-sm mt-1">
            Personnel de votre filiale
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalGuichetier(true)}
            className="flex items-center gap-2 border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Guichetier
          </button>
          <button
            onClick={() => setModalChauffeur(true)}
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-[#135bec]/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> Chauffeur
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-5`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-sm text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Onglets + recherche */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100 gap-4 flex-wrap">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {[
              { id: "guichetiers", label: "Guichetiers" },
              { id: "chauffeurs",  label: "Chauffeurs"  },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setOnglet(id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  onglet === id ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
            />
          </div>
        </div>

        {loading ? (
          <Spinner size="lg" className="py-16" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Personnel", "Email", "Téléphone", onglet === "chauffeurs" ? "N° Permis" : "Rôle", "Actions"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                    Aucun {onglet === "guichetiers" ? "guichetier" : "chauffeur"} trouvé.
                  </td>
                </tr>
              ) : filtered.map((p, i) => (
                <tr key={p.id || i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#135bec]/10 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-[#135bec]" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{p.name} {p.surname}</p>
                        {p.date_embauche && <p className="text-xs text-slate-400">Depuis {p.date_embauche}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                      <Mail className="w-3.5 h-3.5" />{p.email || "—"}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                      <Phone className="w-3.5 h-3.5" />{p.phone || "—"}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {onglet === "chauffeurs"
                      ? <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{p.numero_permis || "—"}</span>
                      : <Badge variant="primary">Guichetier</Badge>
                    }
                  </td>
                  <td className="px-5 py-4">
                    <button className="p-1.5 hover:bg-slate-100 rounded-lg">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
          Affichage de {filtered.length} sur {liste.length} {onglet}
        </div>
      </Card>

      {/* ── Modal Guichetier ── */}
      <Modal
        open={isModalGuichetier}
        onClose={() => setModalGuichetier(false)}
        title="Créer un Guichetier"
        size="md"
        footer={
          <>
            <button onClick={() => setModalGuichetier(false)} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Annuler</button>
            <button onClick={handleSubmitGuichetier} disabled={pendingG} className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
              {pendingG ? "Création…" : "Créer"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitGuichetier} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom *</label>
              <input placeholder="Dupont" value={formG.name} onChange={e => setFormG(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prénom</label>
              <input placeholder="Jean" value={formG.surname} onChange={e => setFormG(f => ({ ...f, surname: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email *</label>
              <input type="email" placeholder="jean@agence.cm" value={formG.email} onChange={e => setFormG(f => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone</label>
              <input placeholder="+237 6XX XXX XXX" value={formG.phone} onChange={e => setFormG(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Adresse</label>
              <input placeholder="Quartier, ville" value={formG.adresse} onChange={e => setFormG(f => ({ ...f, adresse: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            <strong>Info :</strong> Un email d'invitation sera envoyé au guichetier avec ses identifiants de connexion.
          </div>
        </form>
      </Modal>

      {/* ── Modal Chauffeur ── */}
      <Modal
        open={isModalChauffeur}
        onClose={() => setModalChauffeur(false)}
        title="Créer un Chauffeur"
        size="md"
        footer={
          <>
            <button onClick={() => setModalChauffeur(false)} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Annuler</button>
            <button onClick={handleSubmitChauffeur} disabled={pendingC} className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
              {pendingC ? "Création…" : "Créer"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitChauffeur} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom *</label>
              <input placeholder="Kouassi" value={formC.name} onChange={e => setFormC(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prénom</label>
              <input placeholder="Amadou" value={formC.surname} onChange={e => setFormC(f => ({ ...f, surname: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <input type="email" placeholder="amadou@agence.cm" value={formC.email} onChange={e => setFormC(f => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone</label>
              <input placeholder="+237 6XX XXX XXX" value={formC.phone} onChange={e => setFormC(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">N° Permis *</label>
              <input placeholder="CM-2024-XXXXX" value={formC.numero_permis} onChange={e => setFormC(f => ({ ...f, numero_permis: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date d'embauche</label>
              <input type="date" value={formC.date_embauche} onChange={e => setFormC(f => ({ ...f, date_embauche: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            <strong>Info :</strong> Un email d'invitation sera envoyé au chauffeur avec ses identifiants de connexion.
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
