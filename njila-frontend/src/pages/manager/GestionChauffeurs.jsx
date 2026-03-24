import { useState } from "react";
import { Plus, Search, MoreVertical, User, Phone, AlertCircle } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";

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

export default function GestionChauffeurs() {
  const [search, setSearch] = useState("");
  const today = new Date();

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
          <p className="text-slate-500 mt-1">{MOCK_CHAUFFEURS.length} chauffeurs enregistrés</p>
        </div>
        <Button><Plus className="w-4 h-4" /> Ajouter un chauffeur</Button>
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
    </DashboardLayout>
  );
}
