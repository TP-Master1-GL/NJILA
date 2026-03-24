import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Bus } from "lucide-react";
import { useBookingStore } from "../../store/bookingStore";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { formatMontant } from "../../utils/formatters";

const generateSeats = (total = 40, occupied = [3, 7, 12, 15, 20]) =>
  Array.from({ length: total }, (_, i) => ({
    id: i + 1,
    numero: i + 1,
    occupe: occupied.includes(i + 1),
  }));

export default function SeatSelectionPage() {
  const { voyageId } = useParams();
  const navigate = useNavigate();
  const { voyageSelectionne, placesSelectionnees, togglePlace, setPassagers, recherche } = useBookingStore();
  const [passagersForm, setPassagersForm] = useState([]);
  const seats = generateSeats();

  const prixUnitaire = voyageSelectionne?.prix || 5000;
  const total = placesSelectionnees.length * prixUnitaire;

  const handlePassagerChange = (idx, field, value) => {
    const updated = [...passagersForm];
    updated[idx] = { ...updated[idx], [field]: value };
    setPassagersForm(updated);
  };

  const handleContinue = () => {
    setPassagers(passagersForm);
    navigate("/paiement");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/resultats" className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Retour aux résultats
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Bus className="w-4 h-4 text-primary-600" />
            {voyageSelectionne?.origine || "Douala"} → {voyageSelectionne?.destination || "Yaoundé"}
          </div>
          <p className="text-sm text-gray-400">
            Départ : {voyageSelectionne?.heureDepart?.slice(0, 10)} à {voyageSelectionne?.heureDepart?.slice(11, 16)}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
          {[["1", "Sélection", true], ["2", "Passagers", true], ["3", "Paiement", false]].map(([n, l, active]) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                active ? "bg-primary-600 text-white" : "bg-gray-200 text-gray-500"
              }`}>{n}</div>
              <span className={`text-sm font-medium ${active ? "text-gray-900" : "text-gray-400"}`}>{l}</span>
              {n !== "3" && <div className="w-16 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8 flex-col lg:flex-row">
        {/* Plan du bus */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Sélectionnez vos places</h2>
                <p className="text-sm text-gray-500">Bus VIP Executive Coach - 70 places</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-gray-300 bg-white inline-block" /> Libre</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-primary-600 inline-block" /> Sélectionné</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-200 inline-block" /> Occupé</span>
              </div>
            </div>

            {/* Représentation du bus */}
            <div className="border-2 border-gray-200 rounded-2xl p-6 max-w-sm mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <Bus className="w-4 h-4 text-gray-400" />
                  </div>
                  <span className="text-xs text-gray-400">Chauffeur</span>
                </div>
                <span className="text-xs font-medium text-gray-400">AVANT →</span>
              </div>

              <div className="grid gap-2">
                {Array.from({ length: Math.ceil(seats.length / 4) }, (_, row) => (
                  <div key={row} className="grid grid-cols-5 gap-1 items-center">
                    {[0, 1].map(col => {
                      const seat = seats[row * 4 + col];
                      if (!seat) return <div key={col} />;
                      const selected = placesSelectionnees.some(p => p.id === seat.id);
                      return (
                        <button
                          key={seat.id}
                          disabled={seat.occupe}
                          onClick={() => !seat.occupe && togglePlace(seat)}
                          className={`w-10 h-10 rounded-lg text-xs font-bold transition-all ${
                            seat.occupe   ? "bg-gray-200 text-gray-400 cursor-not-allowed" :
                            selected      ? "bg-primary-600 text-white shadow-lg scale-105" :
                            "border-2 border-gray-200 text-gray-600 hover:border-primary-400"
                          }`}
                        >
                          {seat.numero}
                        </button>
                      );
                    })}
                    <div className="flex items-center justify-center">
                      <div className="w-px h-6 bg-gray-200" />
                    </div>
                    {[2, 3].map(col => {
                      const seat = seats[row * 4 + col];
                      if (!seat) return <div key={col} />;
                      const selected = placesSelectionnees.some(p => p.id === seat.id);
                      return (
                        <button
                          key={seat.id}
                          disabled={seat.occupe}
                          onClick={() => !seat.occupe && togglePlace(seat)}
                          className={`w-10 h-10 rounded-lg text-xs font-bold transition-all ${
                            seat.occupe   ? "bg-gray-200 text-gray-400 cursor-not-allowed" :
                            selected      ? "bg-primary-600 text-white shadow-lg scale-105" :
                            "border-2 border-gray-200 text-gray-600 hover:border-primary-400"
                          }`}
                        >
                          {seat.numero}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Formulaire passagers */}
          {placesSelectionnees.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Détails des passagers</h3>
              <div className="space-y-4">
                {placesSelectionnees.map((place, idx) => (
                  <div key={place.id} className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      Passager {idx + 1} — Place {place.numero}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Nom complet"
                        placeholder="Jean Dupont"
                        value={passagersForm[idx]?.nom || ""}
                        onChange={e => handlePassagerChange(idx, "nom", e.target.value)}
                      />
                      <Input
                        label="N° CNI / Passeport"
                        placeholder="Numéro d'identité"
                        value={passagersForm[idx]?.cni || ""}
                        onChange={e => handlePassagerChange(idx, "cni", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Récapitulatif */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-primary-600 rounded-xl p-6 text-white sticky top-36">
            <h3 className="font-bold text-lg mb-4">Récapitulatif du voyage</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-primary-100">Places sélectionnées</span>
                <div className="flex gap-1">
                  {placesSelectionnees.map(p => (
                    <span key={p.id} className="bg-white/20 px-2 py-0.5 rounded text-xs">{p.numero}</span>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-100">Trajet</span>
                <span className="font-medium">{voyageSelectionne?.origine || "Douala"} → {voyageSelectionne?.destination || "Yaoundé"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-100">Tarif / place</span>
                <span className="font-medium">{formatMontant(prixUnitaire)}</span>
              </div>
            </div>
            <div className="border-t border-white/20 mt-4 pt-4 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold">{formatMontant(total)}</span>
            </div>
            <Button
              size="full"
              variant="secondary"
              className="mt-4"
              disabled={placesSelectionnees.length === 0}
              onClick={handleContinue}
            >
              Procéder au paiement →
            </Button>
            <p className="text-center text-xs text-primary-200 mt-3">SECURE CHECKOUT — NJILA PAY</p>
          </div>
        </div>
      </div>
    </div>
  );
}
