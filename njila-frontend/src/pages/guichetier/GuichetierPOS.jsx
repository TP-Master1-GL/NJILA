import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Bus, Users, CreditCard, Printer, CheckCircle } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { bookingService } from "../../services/bookingService";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import { formatMontant } from "../../utils/formatters";
import toast from "react-hot-toast";

const MOCK_VOYAGES = [
  { id: 1, heure: "08:30", destination: "Yaoundé",    type: "VIP",     places: 12, prix: 6000  },
  { id: 2, heure: "10:00", destination: "Yaoundé",    type: "CLASSIC", places: 42, prix: 3500  },
  { id: 3, heure: "13:30", destination: "Bafoussam",  type: "VIP",     places: 8,  prix: 8000  },
];

export default function GuichetierPOS() {
  const { user } = useAuthStore();
  const [voyageSelectionne, setVoyageSelectionne] = useState(null);
  const [placesSelectionnees, setPlacesSelectionnees] = useState([]);
  const [client, setClient] = useState({ nom: "", telephone: "" });
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const [etape, setEtape] = useState("voyage"); // voyage | billet

  const seats = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1, numero: i + 1, occupe: [3, 7, 12].includes(i + 1),
  }));

  const togglePlace = (place) => {
    setPlacesSelectionnees(prev =>
      prev.find(p => p.id === place.id)
        ? prev.filter(p => p.id !== place.id)
        : [...prev, place]
    );
  };

  const { mutate: emettreBillet, isPending } = useMutation({
    mutationFn: () => bookingService.creerReservation({
      idVoyage:     voyageSelectionne.id,
      idVoyageur:   1,
      nombrePlaces: placesSelectionnees.length,
      canal:        "GUICHET",
      codeAgence:   "GEN",
      codeFiliale:  "BYDE",
      idGuichetier: user?.id || 1,
      typeTarif:    "STANDARD",
    }),
    onSuccess: () => {
      setEtape("billet");
      toast.success("Billet émis avec succès !");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Erreur lors de l'émission");
    },
  });

  const total = placesSelectionnees.length * (voyageSelectionne?.prix || 0);

  return (
    <DashboardLayout>
      {/* Header POS */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Point de Vente</h1>
          <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
            <span className="w-2 h-2 bg-success-500 rounded-full inline-block" />
            {user?.nom} — Guichetier #{user?.id || 402}
          </p>
        </div>
        <div className="flex gap-3">
          <Input placeholder="Rechercher voyage..." icon={Search} className="w-56" />
          <input type="date" defaultValue={new Date().toISOString().slice(0,10)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Liste des voyages */}
        <div className="col-span-3 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase">Départs disponibles</p>
          {MOCK_VOYAGES.map(voyage => (
            <button
              key={voyage.id}
              onClick={() => { setVoyageSelectionne(voyage); setPlacesSelectionnees([]); }}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                voyageSelectionne?.id === voyage.id
                  ? "border-primary-600 bg-primary-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg font-bold text-gray-900">{voyage.heure}</span>
                <Badge variant={voyage.type === "VIP" ? "primary" : "gray"}>{voyage.type}</Badge>
              </div>
              <p className="font-medium text-gray-700 text-sm">→ {voyage.destination}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {voyage.places} places
                </span>
                <span className="text-sm font-bold text-primary-600">{formatMontant(voyage.prix)}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Plan du bus */}
        <div className="col-span-5 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {voyageSelectionne ? `Sélection — ${voyageSelectionne.destination}` : "Sélectionnez un voyage"}
            </h3>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-gray-300 inline-block" /> Libre</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary-600 inline-block" /> Sélectionné</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300 inline-block" /> Pris</span>
            </div>
          </div>

          {voyageSelectionne ? (
            <div className="grid grid-cols-5 gap-2">
              {seats.map(seat => {
                const selected = placesSelectionnees.find(p => p.id === seat.id);
                return (
                  <button
                    key={seat.id}
                    disabled={seat.occupe}
                    onClick={() => !seat.occupe && togglePlace(seat)}
                    className={`w-12 h-12 rounded-lg font-bold text-sm transition-all ${
                      seat.occupe ? "bg-gray-200 text-gray-400 cursor-not-allowed" :
                      selected    ? "bg-primary-600 text-white shadow-md" :
                      "border-2 border-gray-200 hover:border-primary-400 text-gray-600"
                    }`}
                  >
                    {seat.numero}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300">
              <div className="text-center">
                <Bus className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">Sélectionnez un voyage</p>
              </div>
            </div>
          )}
        </div>

        {/* Récapitulatif & paiement */}
        <div className="col-span-4 bg-white rounded-xl border border-gray-200 p-6">
          {etape === "billet" ? (
            <div className="text-center py-6">
              <CheckCircle className="w-16 h-16 text-success-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Billet émis !</h3>
              <p className="text-gray-500 mb-6">Le billet d'embarquement a été généré avec succès.</p>
              <Button size="full" onClick={() => toast.success("Impression lancée")}>
                <Printer className="w-4 h-4" /> Imprimer le billet
              </Button>
              <Button variant="secondary" size="full" className="mt-2"
                onClick={() => { setEtape("voyage"); setVoyageSelectionne(null); setPlacesSelectionnees([]); setClient({ nom: "", telephone: "" }); }}>
                Nouvelle réservation
              </Button>
            </div>
          ) : (
            <>
              <h3 className="font-bold text-gray-900 mb-4">Récapitulatif</h3>
              {voyageSelectionne && (
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Destination</span>
                    <span className="font-medium">{voyageSelectionne.destination} ({voyageSelectionne.type})</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Départ</span>
                    <span className="font-medium">Aujourd'hui, {voyageSelectionne.heure}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Places sélectionnées</span>
                    <div className="flex gap-1">
                      {placesSelectionnees.map(p => (
                        <span key={p.id} className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-xs font-medium">{p.numero}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4 mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Informations client</h4>
                <div className="space-y-2">
                  <Input placeholder="Nom complet" value={client.nom}
                    onChange={e => setClient(c => ({ ...c, nom: e.target.value }))} />
                  <Input placeholder="+237 6XX XXX XXX" value={client.telephone}
                    onChange={e => setClient(c => ({ ...c, telephone: e.target.value }))} />
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Mode de paiement</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[["ESPECES", "💵 Espèces"], ["MOBILE_MONEY", "📱 Mobile Money"]].map(([v, l]) => (
                    <button key={v} onClick={() => setModePaiement(v)}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        modePaiement === v ? "border-primary-600 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-600"
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-primary-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Montant total</span>
                  <span className="text-xl font-bold text-primary-600">{formatMontant(total)}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-400">Taxe incluse (5%)</span>
                  <span className="text-xs text-gray-500">{formatMontant(total * 0.05)}</span>
                </div>
              </div>

              <Button
                size="full"
                loading={isPending}
                disabled={!voyageSelectionne || placesSelectionnees.length === 0 || !client.nom}
                onClick={() => emettreBillet()}
              >
                <Printer className="w-4 h-4" /> Confirmer & Émettre le billet [F12]
              </Button>
              <p className="text-xs text-center text-gray-400 mt-2">
                En cliquant, vous confirmez la réservation.
              </p>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
