import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, MoreVertical, User, Phone, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { fleetService } from "../../services/fleetService";

const MOCK_CHAUFFEURS = [
  { id: 1, nom: "Amadou Kouassi",  telephone: "+237677001001", permis: "2027-06-15", statut: "DISPONIBLE", voyages: 142 },
  { id: 2, nom: "Jean-Paul Ngwa",  telephone: "+237677001002", permis: "2026-03-10", statut: "EN_VOYAGE",   voyages: 98  },
  { id: 3, nom: "Fabrice Tagne",   telephone: "+237677001003", permis: "2025-12-31", statut: "DISPONIBLE", voyages: 215 },
  { id: 4, nom: "Samuel Etoa",     telephone: "+237677001004", permis: "2024-08-20", statut: "REPOS",       voyages: 67  },
];

const statutConfig = {
  DISPONIBLE: { label: "Disponible",variant: "success" },
  EN_VOYAGE:  { label: "En voyage", variant: "primary" },
  REPOS:      { label: "En repos",  variant: "gray"    },
};

const FORM_INIT = { nom: "", prenom: "", telephone: "", permis: "", adresse: "" };

export default function GestionChauffeurs() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(FORM_INIT);
  const today = new Date();

  const { mutate: ajouterChauffeur, isPending } = useMutation({
    mutationFn: fleetService.getChauffeurs, // Sera remplacé par fleetService.ajouterChauffeur
    onSuccess: () => {
      toast.success("Chauffeur ajouté !");
      qc.invalidateQueries({ queryKey: ["chauffeurs"] });
      setIsModalOpen(false);
      setForm(FORM_INIT);
    },
    onError: () => toast.error("Erreur lors de l'ajout du chauffeur."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nom || !form.telephone) return toast.error("Nom et téléphone requis.");
    ajouterChauffeur(form);
  };

  const filtered = MOCK_CHAUFFEURS.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase())
  );

  const isExpirant = (dateStr) => {
    const d = new Date(dateStr);
    const diff = (d - today) / (1000 * 60 * 60 * 24);
    return diff < 90;
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Chauffeurs</h1>
          <p className="text-slate-400 mt-1 text-sm">{MOCK_CHAUFFEURS.length} chauffeurs enregistrés</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Ajouter un chauffeur
        </button>
      </div>

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un chauffeur..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              {["Chauffeur", "Téléphone", "Permis (expiration)", "Voyages", "Statut", "Actions"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const cfg = statutConfig[c.statut] || {};
              const expirant = isExpirant(c.permis);
              return (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#135bec]/10 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-[#135bec]" />
                      </div>
                      <span className="font-semibold text-slate-900 text-sm">{c.nom}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500 flex items-center gap-1 mt-3">
                    <Phone className="w-3.5 h-3.5" />{c.telephone}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      {expirant && <AlertCircle className="w-4 h-4 text-amber-500" />}
                      <span className={`text-sm ${expirant ? "text-amber-600 font-semibold" : "text-slate-600"}`}>{c.permis}</span>
                    </div>
                    {expirant && <p className="text-xs text-amber-500 mt-0.5">Expire bientôt</p>}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-700">{c.voyages}</td>
                  <td className="px-5 py-4"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                  <td className="px-5 py-4">
                    <button className="p-1.5 hover:bg-slate-100 rounded-lg"><MoreVertical className="w-4 h-4 text-slate-400" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Modal Ajout Chauffeur */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Enregistrer un Chauffeur"
        size="md"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Annuler</button>
            <button onClick={handleSubmit} disabled={isPending} className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
              {isPending ? "Ajout…" : "Enregistrer"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom *</label>
              <input placeholder="Kouassi" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prénom</label>
              <input placeholder="Amadou" value={form.prenom} onChange={e=>setForm(f=>({...f,prenom:e.target.value}))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone *</label>
              <input placeholder="+237 6XX XXX XXX" value={form.telephone} onChange={e=>setForm(f=>({...f,telephone:e.target.value}))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Permis (expiration)</label>
              <input type="date" value={form.permis} onChange={e=>setForm(f=>({...f,permis:e.target.value}))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Adresse</label>
              <input placeholder="Quartier, ville" value={form.adresse} onChange={e=>setForm(f=>({...f,adresse:e.target.value}))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
