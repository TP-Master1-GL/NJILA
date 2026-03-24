import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, MoreVertical, Truck } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Spinner from "../../components/ui/Spinner";
import { fleetService } from "../../services/fleetService";

const statutConfig = {
  AVAILABLE:    { label: "Disponible",  variant: "success" },
  ON_TRIP:      { label: "En voyage",   variant: "primary" },
  MAINTENANCE:  { label: "Maintenance", variant: "warning" },
};

const MOCK_BUS = [
  { id: 1, immatriculation: "LT 789 CD", numero: "Bus #042", type: "VIP",     capacite: 45, dernierService: "12 Oct 2023", statut: "AVAILABLE" },
  { id: 2, immatriculation: "NW 123 AB", numero: "Bus #038", type: "CLASSIC", capacite: 70, dernierService: "05 Nov 2023", statut: "ON_TRIP"   },
  { id: 3, immatriculation: "CE 552 XY", numero: "Bus #012", type: "VIP",     capacite: 45, dernierService: "20 Oct 2023", statut: "MAINTENANCE"},
  { id: 4, immatriculation: "OU 001 AA", numero: "Bus #055", type: "CLASSIC", capacite: 70, dernierService: "15 Nov 2023", statut: "AVAILABLE" },
];

export default function GestionFlotte() {
  const [search, setSearch] = useState("");

  const filtered = MOCK_BUS.filter(b =>
    b.immatriculation.toLowerCase().includes(search.toLowerCase()) ||
    b.numero.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: "Total flotte",  value: MOCK_BUS.length, color: "text-gray-900" },
    { label: "Disponibles",   value: MOCK_BUS.filter(b => b.statut === "AVAILABLE").length,    color: "text-success-600" },
    { label: "En voyage",     value: MOCK_BUS.filter(b => b.statut === "ON_TRIP").length,      color: "text-primary-600" },
    { label: "Maintenance",   value: MOCK_BUS.filter(b => b.statut === "MAINTENANCE").length,  color: "text-warning-600" },
  ];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestion de la Flotte</h1>
        <Button><Plus className="w-4 h-4" /> Ajouter un bus</Button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, color }) => (
          <Card key={label} className="text-center py-4">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </Card>
        ))}
      </div>

      <Card padding={false}>
        {/* Filtres */}
        <div className="flex items-center gap-4 p-6 border-b border-gray-100">
          <Input
            placeholder="Rechercher par immatriculation..."
            icon={Search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600">
            <option>Tous les types</option>
            <option>VIP</option>
            <option>Classic</option>
          </select>
          <select className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600">
            <option>Tous les statuts</option>
            <option>Disponible</option>
            <option>En voyage</option>
            <option>Maintenance</option>
          </select>
        </div>

        {/* Table */}
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {["Info Bus", "Type", "Capacité", "Dernier service", "Statut", "Actions"].map(h => (
                <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(bus => {
              const cfg = statutConfig[bus.statut] || {};
              return (
                <tr key={bus.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Truck className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{bus.immatriculation}</p>
                        <p className="text-xs text-gray-400">{bus.numero}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={bus.type === "VIP" ? "primary" : "gray"}>{bus.type}</Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{bus.capacite} places</td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{bus.dernierService}</td>
                  <td className="px-6 py-4">
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="px-6 py-4 text-sm text-gray-400 border-t border-gray-100 flex items-center justify-between">
          <span>Affichage de {filtered.length} sur {MOCK_BUS.length} bus</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm">Précédent</Button>
            <Button variant="secondary" size="sm">Suivant</Button>
          </div>
        </div>
      </Card>
    </DashboardLayout>
  );
}
