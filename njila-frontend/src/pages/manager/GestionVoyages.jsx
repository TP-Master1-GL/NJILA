import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Calendar, Clock, Users, MoreVertical, Bus } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";

const MOCK_VOYAGES = [
  { id: 1, route: "Douala → Yaoundé",   heure: "07:30", bus: "BUS-204", chauffeur: "Jean-Paul N.",   prixVIP: 6000, prixClassic: 3000, statut: "SCHEDULED", places: 45, reservees: 38 },
  { id: 2, route: "Douala → Yaoundé",   heure: "09:00", bus: "BUS-112", chauffeur: "Non assigné",    prixClassic: 2500, statut: "PENDING",   places: 70, reservees: 12 },
  { id: 3, route: "Yaoundé → Douala",   heure: "10:30", bus: "BUS-204", chauffeur: "Marc K.",         prixVIP: 6000, statut: "CONFLICT",  places: 45, reservees: 45 },
  { id: 4, route: "Douala → Bafoussam", heure: "13:00", bus: "BUS-105", chauffeur: "Samuel E.",       prixClassic: 3500, statut: "SCHEDULED", places: 45, reservees: 21 },
];

const statutConfig = {
  SCHEDULED: { label: "Planifié",    variant: "success" },
  PENDING:   { label: "En attente",  variant: "warning" },
  CONFLICT:  { label: "Conflit bus", variant: "danger"  },
  DEPARTED:  { label: "Parti",       variant: "gray"    },
};

export default function GestionVoyages() {
  const [search, setSearch] = useState("");

  const filtered = MOCK_VOYAGES.filter(v =>
    v.route.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Voyages</h1>
          <p className="text-slate-500 mt-1">Planning et tarification des départs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary"><Calendar className="w-4 h-4" /> Exporter</Button>
          <Button><Plus className="w-4 h-4" /> Créer un voyage</Button>
        </div>
      </div>

      {/* Filtres */}
      <Card className="mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un trajet..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
          </div>
          <input type="date" className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm" />
          <select className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm">
            <option>Toutes les routes</option><option>Douala → Yaoundé</option>
          </select>
          <select className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm">
            <option>Toutes les classes</option><option>VIP</option><option>Classic</option>
          </select>
          <Button size="sm">Appliquer</Button>
        </div>
      </Card>

      <Card padding={false}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              {["Heure & Trajet", "Bus assigné", "Chauffeur", "Tarifs (FCFA)", "Remplissage", "Statut", "Actions"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(voyage => {
              const cfg = statutConfig[voyage.statut] || {};
              const fill = Math.round((voyage.reservees / voyage.places) * 100);
              return (
                <tr key={voyage.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${voyage.statut === "CONFLICT" ? "bg-red-100 text-red-600" : "bg-[#135bec]/10 text-[#135bec]"}`}>
                        {voyage.heure}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{voyage.route}</p>
                        {voyage.prixVIP && <span className="text-xs text-slate-400">VIP + Classic</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-mono ${voyage.statut === "CONFLICT" ? "text-red-600 font-bold" : "text-slate-600"}`}>
                      {voyage.bus}
                      {voyage.statut === "CONFLICT" && " ⚠️"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {voyage.chauffeur === "Non assigné" ? <span className="text-amber-500 font-medium">Non assigné</span> : voyage.chauffeur}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-600">
                    {voyage.prixVIP && <p>VIP: <span className="font-bold">{voyage.prixVIP.toLocaleString()}</span></p>}
                    {voyage.prixClassic && <p>Classic: <span className="font-bold">{voyage.prixClassic.toLocaleString()}</span></p>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${fill >= 90 ? "bg-red-500" : fill >= 70 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${fill}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{fill}%</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{voyage.reservees}/{voyage.places}</p>
                  </td>
                  <td className="px-5 py-4"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                  <td className="px-5 py-4">
                    <button className="p-1.5 hover:bg-slate-100 rounded-lg"><MoreVertical className="w-4 h-4 text-slate-400" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-5 py-3 flex items-center justify-between border-t border-slate-100">
          <span className="text-xs text-slate-400">Affichage de {filtered.length} sur {MOCK_VOYAGES.length} voyages</span>
          <div className="flex items-center gap-1">
            {[1,2,3].map(n => <button key={n} className={`w-7 h-7 rounded-lg text-xs font-bold ${n===1?"bg-[#135bec] text-white":"text-slate-500 hover:bg-slate-100"}`}>{n}</button>)}
          </div>
        </div>
      </Card>
    </DashboardLayout>
  );
}
