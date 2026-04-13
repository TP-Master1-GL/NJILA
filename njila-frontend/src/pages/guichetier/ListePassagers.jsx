import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, CheckCircle, Clock, Bus } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { bookingService } from "../../services/bookingService";

const MOCK_PASSAGERS = [
  { id: 1, nom: "Jean Dupont",   place: "05", statut: "EMBARQUEE", heure: "08:25" },
  { id: 2, nom: "Marie Kamga",   place: "12", statut: "CONFIRMEE", heure: "—" },
  { id: 3, nom: "Paul Biya Jr",  place: "21", statut: "EMBARQUEE", heure: "08:28" },
  { id: 4, nom: "Fatou Ndiaye",  place: "03", statut: "CONFIRMEE", heure: "—" },
  { id: 5, nom: "Ahmed Moussa",  place: "18", statut: "EMBARQUEE", heure: "08:30" },
];

export default function ListePassagers() {
  const [search, setSearch] = useState("");
  const [voyage] = useState({ heure: "08:30", destination: "Yaoundé", bus: "NJ-VIP-042", total: 45, embarques: 3 });

  const filtered = MOCK_PASSAGERS.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Liste des passagers</h1>
        <p className="text-slate-500 mt-1">Voyage {voyage.heure} → {voyage.destination}</p>
      </div>

      {/* Info voyage */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#135bec]/10 rounded-xl flex items-center justify-center">
            <Bus className="w-5 h-5 text-[#135bec]" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Bus</p>
            <p className="font-bold text-slate-900">{voyage.bus}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Embarqués</p>
            <p className="font-bold text-slate-900">{voyage.embarques} / {voyage.total}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400">En attente</p>
            <p className="font-bold text-slate-900">{voyage.total - voyage.embarques}</p>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un passager..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              {["Passager", "Place", "Statut", "Heure embarquement"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#135bec]/10 rounded-full flex items-center justify-center text-[#135bec] text-xs font-bold">
                      {p.nom[0]}
                    </div>
                    <span className="font-medium text-slate-900 text-sm">{p.nom}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">{p.place}</span>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={p.statut === "EMBARQUEE" ? "success" : "warning"}>
                    {p.statut === "EMBARQUEE" ? "Embarqué" : "En attente"}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-sm text-slate-500">{p.heure}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
          {filtered.length} passager(s) affiché(s)
        </div>
      </Card>
    </DashboardLayout>
  );
}
