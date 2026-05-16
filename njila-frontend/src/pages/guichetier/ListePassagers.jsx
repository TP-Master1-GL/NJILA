import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Users, Search, Bus, RefreshCw, Clock, CheckCircle, 
  Download, ArrowUpDown, ArrowUp, ArrowDown 
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { bookingService } from "../../services/bookingService";
import { fleetService } from "../../services/fleetService";
import { useAuthStore } from "../../store/authStore";
import toast from "react-hot-toast";

export default function ListePassagers() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  
  const [selectedVoyageId, setSelectedVoyageId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("TOUS");
  
  // Tri
  const [sortBy, setSortBy] = useState("siege"); // "nom" | "siege"
  const [sortOrder, setSortOrder] = useState("asc"); // "asc" | "desc"

  const today = new Date().toISOString().slice(0, 10);

  // Voyages du jour
  const { data: voyages = [], isLoading: loadingVoyages } = useQuery({
    queryKey: ["voyages-passagers", today],
    queryFn: () => fleetService.getVoyages({ status: "confirme", date: today }),
    select: (d) => {
      const list = Array.isArray(d) ? d : d?.results ?? [];
      return list.map(v => ({
        ...v,
        Id_voyage: v.Id_voyage || v.id,
        date_heure_depart: v.dateHeureDepart || v.date_heure_depart,
      }));
    },
    onSuccess: (data) => {
      if (data.length > 0 && !selectedVoyageId) {
        setSelectedVoyageId(data[0].Id_voyage);
      }
    },
  });

  // Manifeste des passagers
  const { 
    data: manifeste, 
    isLoading: loadingPassagers, 
    refetch 
  } = useQuery({
    queryKey: ["passagers", selectedVoyageId],
    queryFn: () => bookingService.getPassagersVoyage(selectedVoyageId),
    enabled: !!selectedVoyageId,
    refetchInterval: 30000,
  });

  const passagers = manifeste?.passagers || [];
  const voyageSelected = voyages.find(v => v.Id_voyage === selectedVoyageId);

  // Filtrage + Tri
  const filteredAndSortedPassagers = useMemo(() => {
    let result = [...passagers];

    // Filtre recherche + statut
    result = result.filter((p) => {
      const name = (p.nomPassager || "").toLowerCase();
      const matchSearch = name.includes(search.toLowerCase());
      if (filterStatut === "TOUS") return matchSearch;
      if (filterStatut === "EMBARQUE") return matchSearch && p.statutReservation === "EMBARQUEE";
      if (filterStatut === "ATTENTE") return matchSearch && p.statutReservation !== "EMBARQUEE";
      return matchSearch;
    });

    // Tri
    result.sort((a, b) => {
      let valA, valB;

      if (sortBy === "nom") {
        valA = (a.nomPassager || "").toLowerCase();
        valB = (b.nomPassager || "").toLowerCase();
      } else { // siege
        valA = Number(a.numeroSiege) || 0;
        valB = Number(b.numeroSiege) || 0;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [passagers, search, filterStatut, sortBy, sortOrder]);

  const embarques = passagers.filter(p => p.statutReservation === "EMBARQUEE").length;

  const formatHeure = (dt) => 
    dt ? new Date(dt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

  const initiales = (nom) =>
    (nom ?? "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  // Téléchargement CSV
  const downloadCSV = () => {
    if (!filteredAndSortedPassagers.length) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    const headers = ["Siège", "Nom Complet", "Téléphone", "Canal", "Statut"];
    const rows = filteredAndSortedPassagers.map(p => [
      p.numeroSiege,
      p.nomPassager,
      p.telephonePassager || "",
      p.canalLibelle || p.canal,
      p.statutReservation === "EMBARQUEE" ? "Embarqué" : "En attente"
    ]);

    let csvContent = headers.join(";") + "\n";
    rows.forEach(row => {
      csvContent += row.map(field => `"${field}"`).join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `passagers_${voyageSelected?.Id_voyage || 'export'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success("Liste téléchargée (CSV)");
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Manifeste des Passagers</h1>
          <p className="text-slate-500">Gestion des embarquements en temps réel</p>
        </div>
        <button onClick={refetch} className="flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Liste des voyages */}
        <div className="lg:col-span-4 xl:col-span-3">
          <Card className="h-full">
            <div className="p-4 border-b">
              <h2 className="font-bold">Voyages du jour</h2>
            </div>
            <div className="p-3 max-h-[calc(100vh-180px)] overflow-y-auto space-y-2">
              {voyages.map((v) => (
                <button
                  key={v.Id_voyage}
                  onClick={() => setSelectedVoyageId(v.Id_voyage)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selectedVoyageId === v.Id_voyage ? "border-[#135bec] bg-[#135bec]/5" : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <div className="flex justify-between">
                    <div>
                      <div className="font-bold text-lg">{formatHeure(v.date_heure_depart)}</div>
                      <div className="text-sm text-slate-600">→ {v.destination}</div>
                    </div>
                    <Badge>{v.typeVoyage || "Standard"}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Manifeste Passagers */}
        <div className="lg:col-span-8 xl:col-span-9">
          {!selectedVoyageId ? (
            <Card className="h-96 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Bus className="w-16 h-16 mx-auto mb-4 opacity-30" />
                Sélectionnez un voyage pour voir les passagers
              </div>
            </Card>
          ) : (
            <>
              {/* Header Voyage */}
              <Card className="mb-6">
                <div className="p-5 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold">
                      {formatHeure(voyageSelected?.date_heure_depart)} — {voyageSelected?.destination}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {manifeste?.capaciteTotale} sièges • {manifeste?.placesOccupees} occupés
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-600">{embarques}</div>
                    <div className="text-xs text-slate-500">Embarqués</div>
                  </div>
                </div>
              </Card>

              <Card padding={false}>
                {/* Filtres + Tri + Export */}
                <div className="p-4 border-b flex flex-wrap gap-3 items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un passager..."
                        className="w-full pl-10 py-2.5 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>

                    <div className="flex gap-2">
                      {["TOUS", "EMBARQUE", "ATTENTE"].map((val) => (
                        <button
                          key={val}
                          onClick={() => setFilterStatut(val)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium ${
                            filterStatut === val ? "bg-[#135bec] text-white" : "bg-slate-100 hover:bg-slate-200"
                          }`}
                        >
                          {val === "TOUS" ? "Tous" : val === "EMBARQUE" ? "Embarqués" : "En attente"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Tri */}
                    <div className="flex border rounded-xl overflow-hidden">
                      <button
                        onClick={() => { setSortBy("siege"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                        className={`px-3 py-2 text-sm flex items-center gap-1 hover:bg-slate-50 ${sortBy === "siege" ? "bg-slate-100" : ""}`}
                      >
                        Siège {sortBy === "siege" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>)}
                      </button>
                      <button
                        onClick={() => { setSortBy("nom"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                        className={`px-3 py-2 text-sm flex items-center gap-1 hover:bg-slate-50 ${sortBy === "nom" ? "bg-slate-100" : ""}`}
                      >
                        Nom {sortBy === "nom" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>)}
                      </button>
                    </div>

                    {/* Télécharger */}
                    <button
                      onClick={downloadCSV}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700"
                    >
                      <Download className="w-4 h-4" />
                      Exporter
                    </button>
                  </div>
                </div>

                {/* Tableau */}
                {loadingPassagers ? (
                  <div className="py-20 text-center">Chargement des passagers...</div>
                ) : filteredAndSortedPassagers.length === 0 ? (
                  <div className="py-20 text-center text-slate-400">Aucun passager trouvé</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="px-6 py-4 text-left">Siège</th>
                          <th className="px-6 py-4 text-left">Passager</th>
                          <th className="px-6 py-4 text-left">Téléphone</th>
                          <th className="px-6 py-4 text-left">Canal</th>
                          <th className="px-6 py-4 text-left">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedPassagers.map((p) => (
                          <tr key={p.reservationId || p.numeroSiege} className="border-b hover:bg-slate-50">
                            <td className="px-6 py-4 font-bold text-lg">{p.numeroSiege}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                  {initiales(p.nomPassager)}
                                </div>
                                <div>
                                  <p className="font-semibold">{p.nomPassager}</p>
                                  {p.estResponsable && <span className="text-amber-600 text-xs">• Responsable</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{p.telephonePassager || "—"}</td>
                            <td className="px-6 py-4">
                              <Badge variant={p.canal === "WEB" ? "info" : "default"}>
                                {p.canalLibelle || p.canal}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant={p.statutReservation === "EMBARQUEE" ? "success" : "warning"}>
                                {p.statutReservation === "EMBARQUEE" ? "Embarqué" : "En attente"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
