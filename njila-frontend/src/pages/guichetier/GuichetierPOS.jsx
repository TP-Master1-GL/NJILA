import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Bus, Users, Printer, CheckCircle, ArrowRight, Clock } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { bookingService } from "../../services/bookingService";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { formatMontant } from "../../utils/formatters";
import toast from "react-hot-toast";

const MOCK_VOYAGES = [
  { id: 1, heure: "08:30", destination: "Yaoundé",   type: "VIP",     places: 12, prix: 6000  },
  { id: 2, heure: "10:00", destination: "Yaoundé",   type: "CLASSIC", places: 42, prix: 3500  },
  { id: 3, heure: "13:30", destination: "Bafoussam", type: "VIP",     places: 8,  prix: 8000  },
  { id: 4, heure: "15:00", destination: "Kribi",     type: "CLASSIC", places: 35, prix: 3000  },
];

const OCCUPIED = [3, 7, 12, 15, 20, 25, 31];

export default function GuichetierPOS() {
  const { user } = useAuthStore();
  const [voyage, setVoyage] = useState(null);
  const [selected, setSelected] = useState([]);
  const [client, setClient] = useState({ nom: "", telephone: "" });
  const [mode, setMode] = useState("ESPECES");
  const [etape, setEtape] = useState("voyage"); // voyage | billet

  const seats = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1, numero: i + 1, occupe: OCCUPIED.includes(i + 1),
  }));

  const toggle = (seat) => {
    setSelected(prev =>
      prev.find(p => p.id === seat.id)
        ? prev.filter(p => p.id !== seat.id)
        : [...prev, seat]
    );
  };

  const { mutate: emit, isPending } = useMutation({
    mutationFn: () => bookingService.creerReservation({
      idVoyage: voyage.id, idVoyageur: 1, nombrePlaces: selected.length,
      canal: "GUICHET", codeAgence: "GEN", codeFiliale: "BYDE",
      idGuichetier: user?.id || 1, typeTarif: "STANDARD",
    }),
    onSuccess: () => { setEtape("billet"); toast.success("Billet émis !"); },
    onError: () => toast.error("Erreur lors de l'émission"),
  });

  const total = selected.length * (voyage?.prix || 0);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Point de Vente</h1>
          <p className="text-sm text-slate-400 flex items-center gap-2 mt-0.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse" />
            {user?.nom} — Guichet actif
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Rechercher voyage..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#135bec]/30" />
          </div>
          <input type="date" defaultValue={new Date().toISOString().slice(0,10)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Voyages */}
        <div className="lg:col-span-3 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Départs disponibles</p>
          {MOCK_VOYAGES.map(v => (
            <button key={v.id} onClick={() => { setVoyage(v); setSelected([]); }}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                voyage?.id === v.id
                  ? "border-[#135bec] bg-[#135bec]/5 shadow-sm"
                  : "border-slate-100 bg-white hover:border-slate-200"
              }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-lg font-extrabold text-slate-900">{v.heure}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  v.type === "VIP" ? "bg-blue-50 text-[#135bec] border border-blue-200" : "bg-slate-100 text-slate-500"
                }`}>
                  {v.type}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-700">→ {v.destination}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {v.places} places
                </span>
                <span className="text-sm font-extrabold text-[#135bec]">{formatMontant(v.prix)}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Plan bus */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-slate-900">
                {voyage ? `${voyage.destination} — ${voyage.heure}` : "Sélectionnez un voyage"}
              </h3>
              {voyage && <p className="text-xs text-slate-400 mt-0.5">{selected.length} place(s) sélectionnée(s)</p>}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-md border border-slate-200 inline-block" />Libre</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-md bg-[#135bec] inline-block" />Choisi</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-md bg-slate-200 inline-block" />Pris</span>
            </div>
          </div>

          {voyage ? (
            <div className="border-2 border-slate-100 rounded-2xl p-4 bg-slate-50">
              {/* Bus front */}
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-dashed border-slate-200">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="material-icons text-slate-400 text-sm">person</span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-0.5">Chauffeur</p>
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AVANT →</span>
              </div>

              {/* Seats grid */}
              <div className="space-y-2">
                {Array.from({ length: Math.ceil(seats.length / 4) }, (_, row) => (
                  <div key={row} className="grid grid-cols-5 gap-1.5 items-center">
                    {[0,1].map(col => {
                      const seat = seats[row * 4 + col];
                      if (!seat) return <div key={col} />;
                      const sel = selected.find(s => s.id === seat.id);
                      return (
                        <button key={seat.id}
                          disabled={seat.occupe}
                          onClick={() => !seat.occupe && toggle(seat)}
                          className={`w-10 h-10 rounded-xl text-xs font-extrabold transition-all ${
                            seat.occupe ? "bg-slate-200 text-slate-400 cursor-not-allowed" :
                            sel ? "bg-[#135bec] text-white shadow-lg shadow-[#135bec]/30 scale-105" :
                            "bg-white border-2 border-slate-200 text-slate-500 hover:border-[#135bec]/50 hover:text-[#135bec]"
                          }`}>
                          {seat.numero}
                        </button>
                      );
                    })}
                    <div className="flex items-center justify-center">
                      <div className="w-px h-8 bg-slate-200" />
                    </div>
                    {[2,3].map(col => {
                      const seat = seats[row * 4 + col];
                      if (!seat) return <div key={col} />;
                      const sel = selected.find(s => s.id === seat.id);
                      return (
                        <button key={seat.id}
                          disabled={seat.occupe}
                          onClick={() => !seat.occupe && toggle(seat)}
                          className={`w-10 h-10 rounded-xl text-xs font-extrabold transition-all ${
                            seat.occupe ? "bg-slate-200 text-slate-400 cursor-not-allowed" :
                            sel ? "bg-[#135bec] text-white shadow-lg shadow-[#135bec]/30 scale-105" :
                            "bg-white border-2 border-slate-200 text-slate-500 hover:border-[#135bec]/50 hover:text-[#135bec]"
                          }`}>
                          {seat.numero}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-56 text-slate-200">
              <Bus className="w-16 h-16 mb-3" />
              <p className="text-sm text-slate-300">Sélectionnez un voyage</p>
            </div>
          )}
        </div>

        {/* Récap */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          {etape === "billet" ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">Billet émis !</h3>
              <p className="text-slate-400 text-sm mb-6">Le billet d'embarquement a été généré</p>
              <button onClick={() => toast.success("Impression lancée")}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors mb-3">
                <Printer className="w-4 h-4" /> Imprimer le billet
              </button>
              <button onClick={() => { setEtape("voyage"); setVoyage(null); setSelected([]); setClient({ nom: "", telephone: "" }); }}
                className="w-full py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                Nouvelle réservation
              </button>
            </div>
          ) : (
            <>
              <h3 className="font-extrabold text-slate-900 mb-4">Récapitulatif</h3>

              {voyage && (
                <div className="space-y-2 mb-4 text-sm bg-slate-50 rounded-xl p-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destination</span>
                    <span className="font-bold">{voyage.destination} ({voyage.type})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Départ</span>
                    <span className="font-bold">{voyage.heure}</span>
                  </div>
                  {selected.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Places</span>
                      <div className="flex gap-1">
                        {selected.map(p => (
                          <span key={p.id} className="text-xs bg-[#135bec]/10 text-[#135bec] px-2 py-0.5 rounded-full font-bold">{p.numero}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Nom du client</label>
                  <input value={client.nom} onChange={e => setClient(c => ({...c, nom: e.target.value}))}
                    placeholder="Jean Dupont"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]/30" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Téléphone</label>
                  <input value={client.telephone} onChange={e => setClient(c => ({...c, telephone: e.target.value}))}
                    placeholder="+237 6XX XXX XXX"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]/30" />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Mode de paiement</label>
                <div className="grid grid-cols-2 gap-2">
                  {[["ESPECES","💵 Espèces"],["MOBILE_MONEY","📱 Mobile Money"]].map(([v, l]) => (
                    <button key={v} onClick={() => setMode(v)}
                      className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                        mode === v ? "border-[#135bec] bg-[#135bec]/5 text-[#135bec]" : "border-slate-200 text-slate-600"
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#135bec]/5 border border-[#135bec]/10 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-600">Total</span>
                  <span className="text-2xl font-extrabold text-[#135bec]">{formatMontant(total)}</span>
                </div>
              </div>

              <button
                onClick={() => emit()}
                disabled={!voyage || selected.length === 0 || !client.nom || isPending}
                className="w-full flex items-center justify-center gap-2 bg-[#135bec] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-xl transition-colors shadow-sm shadow-[#135bec]/30"
              >
                {isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    Confirmer & Émettre
                    <span className="text-xs opacity-70 ml-1">[F12]</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
