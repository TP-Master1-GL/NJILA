import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle, Download, Printer, Share2, Phone } from "lucide-react";
import { useBookingStore } from "../../store/bookingStore";
import { useAuthStore } from "../../store/authStore";
import { bookingService } from "../../services/bookingService";
import { paymentService } from "../../services/paymentService";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { formatMontant } from "../../utils/formatters";
import toast from "react-hot-toast";

export default function PaymentPage() {
  const navigate = useNavigate();
  const { voyageSelectionne, placesSelectionnees, passagers, reservationEnCours, setReservationEnCours, resetBooking } = useBookingStore();
  const { user } = useAuthStore();
  const [operateur, setOperateur] = useState("ORANGE_MONEY");
  const [telephone, setTelephone] = useState("");
  const [etape, setEtape] = useState("paiement"); // "paiement" | "succes"
  const [ticketInfo, setTicketInfo] = useState(null);

  const prixTotal = placesSelectionnees.length * (voyageSelectionne?.prix || 5000);

  const { mutate: payer, isPending } = useMutation({
    mutationFn: async () => {
      // 1. Créer la réservation
      const reservation = await bookingService.creerReservation({
        idVoyage:     voyageSelectionne.id,
        idVoyageur:   user.id,
        nombrePlaces: placesSelectionnees.length,
        canal:        "WEB",
        codeAgence:   voyageSelectionne.codeAgence || "GEN",
        codeFiliale:  voyageSelectionne.codeFiliale || "BYDE",
        typeTarif:    "STANDARD",
      });
      setReservationEnCours(reservation);

      // 2. Initier le paiement
      await paymentService.initierPaiement({
        bookingId:   reservation.id,
        montant:     prixTotal,
        operateur,
        telephone,
        voyageurId:  user.id,
      });
      return reservation;
    },
    onSuccess: (reservation) => {
      setTicketInfo({
        numero:      `GEN-WEB-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-BYDE-000${reservation.id}`,
        operateur:   voyageSelectionne?.agenceNom || "General Voyage",
        classe:      voyageSelectionne?.type || "VIP Premium",
        origine:     voyageSelectionne?.origine || "Douala",
        destination: voyageSelectionne?.destination || "Yaoundé",
        date:        voyageSelectionne?.heureDepart?.slice(0,10) || "",
        heure:       voyageSelectionne?.heureDepart?.slice(11,16) || "",
        place:       placesSelectionnees[0]?.numero || 1,
        passager:    passagers[0]?.nom || user?.nom || "Passager",
        ref:         `NJL-${reservation.id}-${Date.now()}`,
      });
      setEtape("succes");
      resetBooking();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Erreur lors du paiement");
    },
  });

  if (etape === "succes" && ticketInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Succès */}
            <div className="bg-success-50 border-b border-success-100 p-6 flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-success-600" />
              <div>
                <p className="font-bold text-success-800">Paiement réussi !</p>
                <p className="text-sm text-success-600">Votre réservation #{ticketInfo.ref} est confirmée.</p>
              </div>
            </div>

            {/* Billet */}
            <div className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Opérateur de bus</p>
                  <p className="text-xl font-bold text-primary-600">{ticketInfo.operateur}</p>
                  <p className="text-sm text-gray-500">{ticketInfo.classe}</p>
                </div>
                <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center">
                  <div className="w-14 h-14 bg-gray-800 rounded grid grid-cols-3 gap-0.5 p-1">
                    {Array(9).fill(0).map((_, i) => (
                      <div key={i} className={`rounded-sm ${Math.random() > 0.5 ? "bg-white" : "bg-gray-800"}`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{ticketInfo.origine.slice(0,3).toUpperCase()}</p>
                  <p className="text-sm text-gray-400">{ticketInfo.origine}</p>
                </div>
                <div className="flex-1 flex flex-col items-center px-4">
                  <div className="flex items-center w-full">
                    <div className="flex-1 h-px bg-gray-300" />
                    <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mx-2">
                      <div className="w-2 h-2 bg-primary-600 rounded-full" />
                    </div>
                    <div className="flex-1 h-px bg-gray-300" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">4h30</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{ticketInfo.destination.slice(0,3).toUpperCase()}</p>
                  <p className="text-sm text-gray-400">{ticketInfo.destination}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl mb-6">
                {[
                  ["Date", ticketInfo.date],
                  ["Départ", ticketInfo.heure],
                  ["Place", `Siège ${ticketInfo.place}`],
                  ["Passager", ticketInfo.passager],
                  ["N° Billet", ticketInfo.numero],
                  ["Réf.", ticketInfo.ref],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs text-gray-400 uppercase">{l}</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{v}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 text-center mb-6">
                ✉️ Une copie de ce billet a été envoyée à <strong>{user?.email}</strong>
              </p>

              <div className="flex gap-3">
                <Button variant="primary" size="lg" className="flex-1">
                  <Download className="w-4 h-4" /> Télécharger PDF
                </Button>
                <Button variant="secondary" size="lg" className="flex-1">
                  <Printer className="w-4 h-4" /> Imprimer
                </Button>
                <Button variant="secondary" size="md">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Stepper */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          {[["1", "Sélection"], ["2", "Passager"], ["3", "Paiement & Billet"]].map(([n, l], i) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                n === "3" ? "bg-primary-600 text-white" : "bg-gray-200 text-gray-500"
              }`}>{n}</div>
              <span className={`text-sm font-medium ${n === "3" ? "text-gray-900" : "text-gray-400"}`}>{l}</span>
              {i < 2 && <div className="w-12 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulaire paiement */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Finaliser votre réservation</h2>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-6">
            <span className="text-sm text-gray-500">Montant total</span>
            <span className="text-2xl font-bold text-primary-600">{formatMontant(prixTotal)}</span>
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-3">Sélectionnez votre opérateur Mobile Money</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "ORANGE_MONEY", label: "Orange Money", color: "orange" },
                { id: "MTN_MONEY",    label: "MTN MoMo",     color: "yellow" },
              ].map(op => (
                <button
                  key={op.id}
                  onClick={() => setOperateur(op.id)}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    operateur === op.id
                      ? "border-primary-600 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    op.color === "orange" ? "bg-orange-500" : "bg-yellow-500"
                  }`}>
                    {op.label[0]}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{op.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Numéro de téléphone"
            placeholder="+237 6XX XXX XXX"
            icon={Phone}
            value={telephone}
            onChange={e => setTelephone(e.target.value)}
          />

          <Button
            size="full"
            className="mt-6"
            loading={isPending}
            disabled={!telephone}
            onClick={() => payer()}
          >
            Confirmer le paiement →
          </Button>

          <p className="text-xs text-warning-600 mt-3 text-center">
            ⚠️ Après avoir cliqué, vérifiez votre téléphone pour valider la transaction.
          </p>
          <p className="text-xs text-gray-400 text-center mt-2">🔒 PAIEMENT SÉCURISÉ ET CHIFFRÉ</p>
        </div>

        {/* Récapitulatif */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4">Votre billet</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500">Trajet</span>
              <span className="text-sm font-semibold">
                {voyageSelectionne?.origine || "—"} → {voyageSelectionne?.destination || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500">Date & heure</span>
              <span className="text-sm font-semibold">
                {voyageSelectionne?.heureDepart?.slice(0, 16).replace("T", " à ") || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500">Places</span>
              <div className="flex gap-1">
                {placesSelectionnees.map(p => (
                  <span key={p.id} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                    {p.numero}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500">Passager</span>
              <span className="text-sm font-semibold">{passagers[0]?.nom || user?.nom || "—"}</span>
            </div>
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <span className="font-bold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-primary-600">{formatMontant(prixTotal)}</span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-primary-50 rounded-lg text-xs text-primary-700">
            💡 Besoin d'aide ? <a href="#" className="font-semibold underline">Appeler le support</a> ou <a href="#" className="font-semibold underline">Chat en direct</a>
          </div>
        </div>
      </div>
    </div>
  );
}
