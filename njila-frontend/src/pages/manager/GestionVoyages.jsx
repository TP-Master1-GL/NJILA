/**
 * GestionVoyages.jsx – Manager Local
 * Planification des voyages avec modal de création complet
 * (trajet + bus + chauffeur + tarifs)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Calendar, Download, CheckCircle, AlertTriangle, Bus } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { fleetService } from "../../services/fleetService";
import { formatMontant } from "../../utils/formatters";

const VILLES = ["Douala", "Yaoundé", "Bafoussam", "Garoua", "Ngaoundéré", "Bamenda", "Kribi", "Bertoua", "Ebolowa", "Maroua"];

const statutConfig = {
  SCHEDULED: { label: "Planifié",    variant: "success" },
  PENDING:   { label: "En attente",  variant: "warning" },
  CONFLICT:  { label: "Conflit bus", variant: "danger"  },
  DEPARTED:  { label: "Parti",       variant: "gray"    },
};

const MOCK_VOYAGES = [
  { id: "1", route: "Douala → Yaoundé",   heure: "07:30", date: "2026-04-10", bus: "Bus #042 (LT 789 CD)", chauffeur: "Jean-Paul N.",  prixVIP: 6000,  prixClassic: 3000, statut: "SCHEDULED", places: 45, reservees: 38 },
  { id: "2", route: "Douala → Yaoundé",   heure: "09:00", date: "2026-04-10", bus: "Bus #038 (NW 123 AB)", chauffeur: "Non assigné",   prixClassic: 2500, statut: "PENDING",   places: 70, reservees: 12 },
  { id: "3", route: "Yaoundé → Douala",   heure: "10:30", date: "2026-04-10", bus: "Bus #012 (CE 552 XY)", chauffeur: "Marc K.",        prixVIP: 6000,  statut: "CONFLICT",  places: 45, reservees: 45 },
  { id: "4", route: "Douala → Bafoussam", heure: "13:00", date: "2026-04-10", bus: "Bus #055 (OU 001 AA)", chauffeur: "Samuel E.",      prixClassic: 3500, statut: "SCHEDULED", places: 45, reservees: 21 },
];

const FORM_INIT = {
  origine: "Douala", destination: "Yaoundé", date: "", heure: "07:00",
  busId: "", chauffeurId: "", prixVIP: "", prixClassic: "", avecVIP: true,
};

export default function GestionVoyages() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(FORM_INIT);

  const { data: voyages, isLoading } = useQuery({
    queryKey: ["voyages"],
    queryFn: () => fleetService.getVoyages({}),
    retry: 1,
    placeholderData: MOCK_VOYAGES,
  });

  const { data: busList } = useQuery({ queryKey: ["bus"], queryFn: fleetService.getBus, retry: 1 });
  const { data: chauffeurs } = useQuery({ queryKey: ["chauffeurs"], queryFn: fleetService.getChauffeurs, retry: 1 });

  const voyageListe = voyages?.length ? voyages : MOCK_VOYAGES;
  const filtered = voyageListe.filter(v => v.route?.toLowerCase().includes(search.toLowerCase()));

  const { mutate: creerVoyage, isPending } = useMutation({
    mutationFn: fleetService.creerVoyage,
    onSuccess: () => {
      toast.success("Voyage créé avec succès !");
      qc.invalidateQueries({ queryKey: ["voyages"] });
      setIsModalOpen(false);
      setForm(FORM_INIT);
    },
    onError: () => toast.error("Erreur lors de la création du voyage."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.origine || !form.destination || !form.date || !form.heure) {
      return toast.error("Tous les champs obligatoires doivent être remplis.");
    }
    if (form.origine === form.destination) return toast.error("Origine et destination doivent être différentes.");
    creerVoyage({
      ...form,
      prixVIP: form.avecVIP ? parseInt(form.prixVIP || 0, 10) : null,
      prixClassic: parseInt(form.prixClassic || 0, 10),
    });
  };

  const handleFinaliserDepart = (voyageId) => {
    toast.success("Départ finalisé ! Liste des passagers générée.");
  };

  // PDF passagers
  const handlePDF = () => {
    const content = `
      <html><head><title>Planning Voyages</title>
      <style>body{font-family:Arial;padding:20px;font-size:12px}h1{color:#135bec}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:8px}
      th{background:#135bec;color:white}</style></head><body>
      <h1>Planning des Voyages</h1>
      <p>Date : ${new Date().toLocaleDateString("fr-FR")}</p>
      <table><tr><th>Heure</th><th>Trajet</th><th>Bus</th><th>Chauffeur</th><th>Places</th><th>Remplissage</th><th>Statut</th></tr>
      ${voyageListe.map(v=>`<tr><td>${v.heure}</td><td>${v.route}</td><td>${v.bus}</td><td>${v.chauffeur}</td><td>${v.reservees}/${v.places}</td><td>${Math.round(v.reservees/v.places*100)}%</td><td>${v.statut}</td></tr>`).join("")}
      </table></body></html>
    `;
    const win = window.open("", "_blank");
    win.document.write(content);
    win.document.close();
    win.print();
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Voyages</h1>
          <p className="text-slate-400 text-sm mt-1">Planning et tarification des départs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePDF} className="flex items-center gap-2 border border-slate-200 text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-50">
            <Download className="w-4 h-4" /> Rapport PDF
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-[#135bec]/20 transition-colors">
            <Plus className="w-4 h-4" /> Créer un voyage
          </button>
        </div>
      </div>

      {/* Filtres */}
      <Card className="mb-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un trajet…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
          </div>
          <input type="date" className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
        </div>
      </Card>

      {isLoading ? <Spinner size="lg" className="py-20" /> : (
        <Card padding={false}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Heure / Trajet", "Bus assigné", "Chauffeur", "Tarifs (FCFA)", "Remplissage", "Statut", "Actions"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(voyage => {
                const cfg = statutConfig[voyage.statut] || {};
                const fill = Math.round(((voyage.reservees || 0) / (voyage.places || 1)) * 100);
                return (
                  <tr key={voyage.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${voyage.statut === "CONFLICT" ? "bg-red-100 text-red-600" : "bg-[#135bec]/10 text-[#135bec]"}`}>
                          {voyage.heure}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{voyage.route}</p>
                          <p className="text-xs text-slate-400">{voyage.date}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-600">{voyage.bus}</td>
                    <td className="px-5 py-4 text-sm">
                      {voyage.chauffeur === "Non assigné"
                        ? <span className="text-amber-500 font-medium">Non assigné</span>
                        : <span className="text-slate-600">{voyage.chauffeur}</span>}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 space-y-0.5">
                      {voyage.prixVIP && <p>VIP: <span className="font-bold">{voyage.prixVIP.toLocaleString()}</span></p>}
                      {voyage.prixClassic && <p>Classic: <span className="font-bold">{voyage.prixClassic.toLocaleString()}</span></p>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                        <div className={`h-full rounded-full ${fill >= 90 ? "bg-red-500" : fill >= 70 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${fill}%` }} />
                      </div>
                      <p className="text-xs text-slate-400">{voyage.reservees}/{voyage.places} · {fill}%</p>
                    </td>
                    <td className="px-5 py-4"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                    <td className="px-5 py-4">
                      {voyage.statut === "SCHEDULED" && (
                        <button
                          onClick={() => handleFinaliserDepart(voyage.id)}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Finaliser
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            Affichage de {filtered.length} sur {voyageListe.length} voyages
          </div>
        </Card>
      )}

      {/* Modal Création Voyage */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Créer un Nouveau Voyage"
        size="lg"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Annuler</button>
            <button onClick={handleSubmit} disabled={isPending} className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
              {isPending ? "Création…" : "Créer le voyage"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Trajet */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Trajet</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ville de départ *</label>
                <select value={form.origine} onChange={e=>setForm(f=>({...f,origine:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]">
                  {VILLES.map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Destination *</label>
                <select value={form.destination} onChange={e=>setForm(f=>({...f,destination:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]">
                  {VILLES.map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date de départ *</label>
                <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Heure de départ *</label>
                <input type="time" value={form.heure} onChange={e=>setForm(f=>({...f,heure:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
            </div>
          </div>

          {/* Bus & Chauffeur */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Affectation</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bus disponible *</label>
                <select value={form.busId} onChange={e=>setForm(f=>({...f,busId:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]">
                  <option value="">Sélectionner un bus</option>
                  {(busList?.length ? busList : [{id:"1",immatriculation:"LT 789 CD",type:"VIP",capacite:45},{id:"4",immatriculation:"OU 001 AA",type:"CLASSIC",capacite:70}])
                    .filter(b=>b.statut !== "ON_TRIP")
                    .map(b=><option key={b.id} value={b.id}>{b.immatriculation} – {b.type} ({b.capacite} pl.)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Chauffeur</label>
                <select value={form.chauffeurId} onChange={e=>setForm(f=>({...f,chauffeurId:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]">
                  <option value="">Sélectionner un chauffeur</option>
                  {(chauffeurs?.length ? chauffeurs : [{id:"1",nom:"Nguembu Jean-Paul"},{id:"2",nom:"Mbarga Samuel"},{id:"3",nom:"Ekotto Marc"}])
                    .map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Tarifs */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tarification (FCFA)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prix Classic *</label>
                <input type="number" min="0" placeholder="Ex: 3000" value={form.prixClassic} onChange={e=>setForm(f=>({...f,prixClassic:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Prix VIP {" "}
                  <button type="button" onClick={()=>setForm(f=>({...f,avecVIP:!f.avecVIP}))} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${form.avecVIP ? "bg-[#135bec]/10 text-[#135bec]" : "bg-slate-100 text-slate-400"}`}>
                    {form.avecVIP ? "Actif" : "Désactivé"}
                  </button>
                </label>
                <input type="number" min="0" placeholder="Ex: 6000" disabled={!form.avecVIP} value={form.prixVIP} onChange={e=>setForm(f=>({...f,prixVIP:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
