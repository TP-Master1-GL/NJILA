/**
 * GestionFlotte.jsx – Manager Local / Global
 * Gestion des bus avec modal d'ajout fonctionnel
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Truck, Download, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { fleetService } from "../../services/fleetService";
import { useAuthStore } from "../../store/authStore";
import { ROLES } from "../../utils/constants";

const statutConfig = {
  AVAILABLE:   { label: "Disponible",  variant: "success" },
  ON_TRIP:     { label: "En voyage",   variant: "primary" },
  MAINTENANCE: { label: "Maintenance", variant: "warning" },
};

const MOCK_BUS = [
  { id: "1", immatriculation: "LT 789 CD", numero: "Bus #042", type: "VIP",     capacite: 45, filiale: "General Mvan",    dernierService: "12 Oct 2025", statut: "AVAILABLE"   },
  { id: "2", immatriculation: "NW 123 AB", numero: "Bus #038", type: "CLASSIC", capacite: 70, filiale: "General Akwa",    dernierService: "05 Nov 2025", statut: "ON_TRIP"     },
  { id: "3", immatriculation: "CE 552 XY", numero: "Bus #012", type: "VIP",     capacite: 45, filiale: "General Mvan",    dernierService: "20 Oct 2025", statut: "MAINTENANCE" },
  { id: "4", immatriculation: "OU 001 AA", numero: "Bus #055", type: "CLASSIC", capacite: 70, filiale: "General Bassa",   dernierService: "15 Nov 2025", statut: "AVAILABLE"   },
];

const BUS_FORM_INIT = { immatriculation: "", numero: "", type: "CLASSIC", capacite: 70, modele: "", couleur: "" };

export default function GestionFlotte() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isGlobal = user?.role === ROLES.MANAGER_GLOBAL;
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(BUS_FORM_INIT);

  const { data: busList, isLoading } = useQuery({
    queryKey: ["bus"],
    queryFn: fleetService.getBus,
    retry: 1,
    placeholderData: MOCK_BUS,
  });

  const buses = busList?.length ? busList : MOCK_BUS;
  const filtered = buses.filter(b =>
    b.immatriculation.toLowerCase().includes(search.toLowerCase()) ||
    (b.numero || "").toLowerCase().includes(search.toLowerCase())
  );

  const { mutate: ajouterBus, isPending } = useMutation({
    mutationFn: fleetService.ajouterBus,
    onSuccess: () => {
      toast.success("Bus ajouté à la flotte !");
      qc.invalidateQueries({ queryKey: ["bus"] });
      setIsModalOpen(false);
      setForm(BUS_FORM_INIT);
    },
    onError: () => toast.error("Erreur lors de l'ajout du bus."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.immatriculation || !form.capacite) return toast.error("Immatriculation et capacité requis.");
    ajouterBus({ ...form, capacite: parseInt(form.capacite, 10) });
  };

  const stats = [
    { label: "Total flotte",  value: buses.length,                                     color: "text-slate-900",   bg: "bg-slate-50"   },
    { label: "Disponibles",   value: buses.filter(b=>b.statut==="AVAILABLE").length,   color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "En voyage",     value: buses.filter(b=>b.statut==="ON_TRIP").length,     color: "text-[#135bec]",   bg: "bg-blue-50"    },
    { label: "Maintenance",   value: buses.filter(b=>b.statut==="MAINTENANCE").length, color: "text-amber-600",   bg: "bg-amber-50"   },
  ];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion de la Flotte</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isGlobal ? "Vue consolidée de toutes vos filiales" : "Flotte de votre filiale"}
          </p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-[#135bec]/20 transition-colors">
          <Plus className="w-4 h-4" /> Ajouter un bus
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {isLoading ? <Spinner size="lg" className="py-20" /> : (
        <Card padding={false}>
          <div className="flex items-center gap-4 p-5 border-b border-slate-100">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="Rechercher par immatriculation…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <select className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#135bec]">
              <option>Tous les types</option>
              <option>VIP</option>
              <option>Classic</option>
            </select>
            {isGlobal && (
              <select className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#135bec]">
                <option>Toutes les filiales</option>
                <option>General Mvan</option>
                <option>General Akwa</option>
                <option>General Bassa</option>
              </select>
            )}
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Bus", isGlobal && "Filiale", "Type", "Capacité", "Dernier service", "Statut", "Actions"].filter(Boolean).map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(bus => {
                const cfg = statutConfig[bus.statut] || {};
                return (
                  <tr key={bus.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#135bec]/10 rounded-xl flex items-center justify-center">
                          <Truck className="w-4 h-4 text-[#135bec]" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{bus.immatriculation}</p>
                          <p className="text-xs text-slate-400">{bus.numero}</p>
                        </div>
                      </div>
                    </td>
                    {isGlobal && <td className="px-5 py-4 text-sm text-slate-500">{bus.filiale || "—"}</td>}
                    <td className="px-5 py-4">
                      <Badge variant={bus.type === "VIP" ? "primary" : "gray"}>{bus.type}</Badge>
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-sm">{bus.capacite} places</td>
                    <td className="px-5 py-4 text-slate-400 text-sm">{bus.dernierService}</td>
                    <td className="px-5 py-4"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                    <td className="px-5 py-4">
                      <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="px-5 py-3 flex items-center justify-between border-t border-slate-100 text-sm text-slate-400">
            <span>Affichage de {filtered.length} sur {buses.length} bus</span>
          </div>
        </Card>
      )}

      {/* Modal Ajout Bus */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Ajouter un Bus à la Flotte"
        size="md"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Annuler</button>
            <button onClick={handleSubmit} disabled={isPending} className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
              {isPending ? "Ajout…" : "Ajouter le bus"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Immatriculation *</label>
              <input placeholder="Ex: LT 789 CD" value={form.immatriculation} onChange={e=>setForm(f=>({...f,immatriculation:e.target.value}))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Numéro interne</label>
              <input placeholder="Ex: Bus #042" value={form.numero} onChange={e=>setForm(f=>({...f,numero:e.target.value}))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Modèle</label>
              <input placeholder="Ex: Toyota Coaster" value={form.modele} onChange={e=>setForm(f=>({...f,modele:e.target.value}))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type</label>
              <div className="flex gap-2">
                {["VIP", "CLASSIC"].map(t => (
                  <button key={t} type="button" onClick={() => setForm(f=>({...f,type:t}))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${form.type===t ? "bg-[#135bec] text-white border-[#135bec]" : "border-slate-200 text-slate-500 hover:border-[#135bec]"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Capacité (places) *</label>
              <input type="number" min="10" max="100" placeholder="70" value={form.capacite} onChange={e=>setForm(f=>({...f,capacite:e.target.value}))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
