import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Search, Bus, Users, Printer, CheckCircle, 
  Banknote, X, AlertTriangle, Download, Eye
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { bookingService } from "../../services/bookingService";
import { fleetService } from "../../services/fleetService";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { formatMontant } from "../../utils/formatters";
import toast from "react-hot-toast";

// ─── Plan de bus dynamique ────────────────────────────────────────────────────
function BusPlan({ totalSeats, occupiedSeats = [], selectedSeats = [], onToggle, voyageInfo }) {
  const isLarge = totalSeats >= 60;
  const leftCount = isLarge ? 3 : 2;
  const rightCount = 2;
  const perRow = leftCount + rightCount;
  const rows = Math.ceil(totalSeats / perRow);

  const seats = Array.from({ length: totalSeats }, (_, i) => ({
    id: i + 1,
    numero: String(i + 1).padStart(2, "0"),
    occupe: occupiedSeats.includes(i + 1),
  }));

  const isSelected = (id) => selectedSeats.some((s) => s.id === id);

  return (
    <div className="relative">
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-dashed border-slate-200 dark:border-slate-700">
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <span className="text-xl">🧑‍✈️</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">CHAUFFEUR</span>
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              AVANT → {voyageInfo?.destination || ""}
            </span>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: rightCount }).map((_, i) => (
              <div key={i} className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600" />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {Array.from({ length: rows }, (_, row) => {
            const startIdx = row * perRow;
            const rowSeats = seats.slice(startIdx, startIdx + perRow);
            const leftSeats = rowSeats.slice(0, leftCount);
            const rightSeats = rowSeats.slice(leftCount);

            return (
              <div key={row} className="flex items-center justify-center gap-2">
                <div className="flex gap-1">
                  {leftSeats.map((seat) => {
                    const selected = isSelected(seat.id);
                    return (
                      <button
                        key={seat.id}
                        disabled={seat.occupe}
                        onClick={() => !seat.occupe && onToggle(seat)}
                        className={`
                          w-10 h-10 rounded-lg text-xs font-bold transition-all duration-150
                          ${seat.occupe
                            ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            : selected
                              ? "bg-blue-600 text-white shadow-md scale-105"
                              : "border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 hover:scale-105"
                          }
                        `}
                      >
                        {seat.numero}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col items-center justify-center w-6">
                  <div className="w-px h-8 bg-slate-300 dark:bg-slate-600" />
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold mt-1">C</span>
                  <div className="w-px h-8 bg-slate-300 dark:bg-slate-600" />
                </div>

                <div className="flex gap-1">
                  {rightSeats.map((seat) => {
                    if (!seat) return <div key="empty" className="w-10 h-10" />;
                    const selected = isSelected(seat.id);
                    return (
                      <button
                        key={seat.id}
                        disabled={seat.occupe}
                        onClick={() => !seat.occupe && onToggle(seat)}
                        className={`
                          w-10 h-10 rounded-lg text-xs font-bold transition-all duration-150
                          ${seat.occupe
                            ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            : selected
                              ? "bg-blue-600 text-white shadow-md scale-105"
                              : "border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 hover:scale-105"
                          }
                        `}
                      >
                        {seat.numero}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            ← ARRIÈRE
          </span>
        </div>

        <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-slate-300 bg-white dark:bg-slate-800" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Libre</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-600" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Sélectionné</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-slate-300 dark:bg-slate-600" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Occupé</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Formulaire passager individuel ──────────────────────────────────────────
function PassengerForm({ index, seatNumber, passenger, onChange, onRemove, errors, isRemovable }) {
  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{index + 1}</span>
          </div>
          <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
            Passager - Siège {seatNumber}
          </span>
        </div>
        {isRemovable && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
            Nom *
          </label>
          <input
            type="text"
            value={passenger.nom || ""}
            onChange={(e) => onChange(index, "nom", e.target.value)}
            placeholder="DUPONT"
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-700 dark:border-slate-600 ${
              errors.nom ? "border-red-500 focus:ring-red-500/30" : "border-slate-200 dark:border-slate-600"
            }`}
          />
          {errors.nom && <p className="text-xs text-red-500 mt-1">{errors.nom}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
            Prénom *
          </label>
          <input
            type="text"
            value={passenger.prenom || ""}
            onChange={(e) => onChange(index, "prenom", e.target.value)}
            placeholder="Jean"
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-700 dark:border-slate-600 ${
              errors.prenom ? "border-red-500 focus:ring-red-500/30" : "border-slate-200 dark:border-slate-600"
            }`}
          />
          {errors.prenom && <p className="text-xs text-red-500 mt-1">{errors.prenom}</p>}
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
            Téléphone *
          </label>
          <input
            type="tel"
            value={passenger.telephone || ""}
            onChange={(e) => onChange(index, "telephone", e.target.value)}
            placeholder="+237 6XX XXX XXX"
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-700 dark:border-slate-600 ${
              errors.telephone ? "border-red-500 focus:ring-red-500/30" : "border-slate-200 dark:border-slate-600"
            }`}
          />
          {errors.telephone && <p className="text-xs text-red-500 mt-1">{errors.telephone}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Composant d'affichage du billet ──────────────────────────────────────────
function TicketDisplay({ ticket, reservation, onPrint, onNewReservation }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-4">
      {/* Ticket Card */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-2xl border-2 border-blue-200 dark:border-blue-800 overflow-hidden">
        {/* Ticket Header */}
        <div className="bg-blue-600 dark:bg-blue-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs uppercase tracking-wide">Billet d'embarquement</p>
              <p className="text-white font-mono font-bold text-sm mt-1">{ticket?.numeroTicket}</p>
            </div>
            <div className="bg-white/20 rounded-lg px-3 py-1">
              <span className="text-white text-xs font-bold">EMBARQUEMENT</span>
            </div>
          </div>
        </div>

        {/* Ticket Body */}
        <div className="p-6 space-y-4">
          {/* Passager */}
          <div className="border-b border-blue-200 dark:border-blue-800 pb-3">
            <p className="text-xs text-blue-500 dark:text-blue-400 uppercase font-bold">Passager</p>
            <p className="text-lg font-bold text-slate-800 dark:text-white">{ticket?.nomVoyageur}</p>
            <p className="text-sm text-slate-500 dark:text-slate-300">{reservation?.telephoneVoyageur}</p>
          </div>

          {/* Trajet */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-blue-500 dark:text-blue-400 uppercase font-bold">Origine</p>
              <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{ticket?.origine || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-blue-500 dark:text-blue-400 uppercase font-bold">Destination</p>
              <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{ticket?.destination || "—"}</p>
            </div>
          </div>

          {/* Date et Bus */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-blue-500 dark:text-blue-400 uppercase font-bold">Date & Heure</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatDate(ticket?.dateDepart)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-500 dark:text-blue-400 uppercase font-bold">Bus</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{ticket?.immatriculationBus || "—"}</p>
            </div>
          </div>

          {/* Siège */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-500 dark:text-blue-400 uppercase font-bold">Place</span>
              <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                {reservation?.siegesAttribues?.join(", ") || "—"}
              </span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-emerald-50 dark:bg-emerald-950 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-bold">Montant payé</span>
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatMontant(reservation?.montantTotal || 0)}
              </span>
            </div>
            <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">Paiement en espèces - Guichet</p>
          </div>
        </div>

        {/* Ticket Footer */}
        <div className="bg-blue-100 dark:bg-blue-900/50 px-6 py-3 text-center border-t border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-600 dark:text-blue-300">
            Présentez ce billet au moment de l'embarquement
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onPrint}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
        >
          <Printer className="w-4 h-4" />
          Imprimer le billet
        </button>
        <button
          onClick={onNewReservation}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Nouvelle réservation
        </button>
      </div>
    </div>
  );
}

// ─── Helpers pour normaliser la réponse de getSiegesVoyage ───────────────────
/**
 * getSiegesVoyage peut retourner différentes formes selon le backend :
 *   { occupes: [1,2,3], disponibles: [...], total: 70 }
 *   { sieges_occupes: [1,2,3], total_places: 70 }
 *   { places_occupees: [1,2,3], capacite: 70 }
 *   ou un tableau de sièges [{ numero: 1, statut: "occupe" }, ...]
 */
function parseSiegesData(data) {
  if (!data) return { occupiedSeats: [], totalSeats: null };

  // Tableau de sièges objets
  if (Array.isArray(data)) {
    const occupiedSeats = data
      .filter((s) => s.statut === "occupe" || s.status === "occupied" || s.occupe === true || s.reserved === true)
      .map((s) => s.numero ?? s.number ?? s.id);
    return { occupiedSeats, totalSeats: data.length || null };
  }

  // Objet avec différentes clés possibles
  const occupiedSeats =
    data.occupes ??
    data.sieges_occupes ??
    data.places_occupees ??
    data.occupied ??
    data.occupiedSeats ??
    [];

  const totalSeats =
    data.total ??
    data.total_places ??
    data.capacite ??
    data.totalSeats ??
    data.nombre_places ??
    null;

  return {
    occupiedSeats: Array.isArray(occupiedSeats) ? occupiedSeats : [],
    totalSeats,
  };
}

// ─── Composant principal ───────────────────────────────────────────────────────
export default function GuichetierPOS() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [voyage, setVoyage] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [passengerErrors, setPassengerErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [etape, setEtape] = useState("voyage");
  const [searchDate, setSearchDate] = useState(new Date().toISOString().slice(0, 10));
  const [searchText, setSearchText] = useState("");
  const [lastBooking, setLastBooking] = useState(null);
  const [lastTicket, setLastTicket] = useState(null);
  const [siegesAttribues, setSiegesAttribues] = useState([]);

  // ── Récupérer les voyages ────────────────────────────────────────────────────
  const { data: voyages = [], isLoading: loadingVoyages } = useQuery({
    queryKey: ["voyages-guichet", searchDate],
    queryFn: () =>
      fleetService.getVoyages({
        status: "confirme",
        date: searchDate,
      }),
    select: (d) => {
      const voyagesList = Array.isArray(d) ? d : d?.results ?? [];
      return voyagesList.map((v) => ({
        ...v,
        prix: v.prix ?? 0,
        typeVoyage: v.typeVoyage ?? v.type_voyage ?? "standard",
        date_heure_depart: v.dateHeureDepart || v.date_heure_depart,
        destination: v.destination || v.arrivalCity || "—",
      }));
    },
  });

  // ── Récupérer le plan des sièges via bookingService.getSiegesVoyage ─────────
  const {
    data: siegesData,
    isLoading: loadingSeats,
    refetch: refetchSieges,
  } = useQuery({
    queryKey: ["sieges-voyage-guichet", voyage?.Id_voyage],
    queryFn: () => bookingService.getSiegesVoyage(voyage.Id_voyage),
    enabled: !!voyage?.Id_voyage,
    // Rafraîchir toutes les 30 secondes pour refléter les réservations en cours
    refetchInterval: 30_000,
    staleTime: 0,
  });

  // ── Récupérer le détail du voyage (pour la capacité du bus si non fournie par getSiegesVoyage) ──
  const { data: voyageDetail } = useQuery({
    queryKey: ["voyage-detail-guichet", voyage?.Id_voyage],
    queryFn: () => fleetService.getVoyageDetail(voyage.Id_voyage),
    enabled: !!voyage?.Id_voyage,
  });

  // ── Calcul des sièges occupés et de la capacité ───────────────────────────
  const { occupiedSeats, totalSeats: totalFromSieges } = parseSiegesData(siegesData);

  const getRealBusCapacity = () => {
    // Priorité : données de getSiegesVoyage → détail voyage → voyage de la liste
    if (totalFromSieges) return Number(totalFromSieges);
    if (voyageDetail?.IdBus?.capacite) return Number(voyageDetail.IdBus.capacite);
    if (voyageDetail?.capacite) return Number(voyageDetail.capacite);
    if (voyage?.IdBus?.capacite) return Number(voyage.IdBus.capacite);
    if (voyage?.capacite) return Number(voyage.capacite);
    return 70;
  };

  const totalSeats = getRealBusCapacity();
  const availableSeats = Math.max(0, totalSeats - occupiedSeats.length);

  // ── Validation des passagers ───────────────────────────────────────────────
  const validatePassengers = useCallback((passengersList) => {
    const errors = {};
    let isValid = true;

    passengersList.forEach((p) => {
      if (!p.nom || p.nom.trim().length < 2) {
        errors[p.seatId] = { ...errors[p.seatId], nom: "Nom requis (min. 2 caractères)" };
        isValid = false;
      }
      if (!p.prenom || p.prenom.trim().length < 2) {
        errors[p.seatId] = { ...errors[p.seatId], prenom: "Prénom requis (min. 2 caractères)" };
        isValid = false;
      }
      if (!p.telephone || p.telephone.trim().length < 8) {
        errors[p.seatId] = { ...errors[p.seatId], telephone: "Téléphone requis (min. 8 chiffres)" };
        isValid = false;
      }
    });

    return { errors, isValid };
  }, []);

  useEffect(() => {
    const { errors, isValid } = validatePassengers(passengers);
    setPassengerErrors(errors);
    setIsFormValid(isValid);
  }, [passengers, validatePassengers]);

  // ── Désélectionner les sièges qui deviendraient occupés (concurrence) ─────
  useEffect(() => {
    if (occupiedSeats.length === 0) return;
    const nowOccupied = selectedSeats.filter((s) => occupiedSeats.includes(s.id));
    if (nowOccupied.length > 0) {
      toast.error(`Le(s) siège(s) ${nowOccupied.map((s) => s.numero).join(", ")} vien(nen)t d'être réservé(s).`);
      const stillFree = selectedSeats.filter((s) => !occupiedSeats.includes(s.id));
      setSelectedSeats(stillFree);
      setPassengers((prev) => prev.filter((p) => !nowOccupied.some((s) => s.id === p.seatId)));
    }
  }, [occupiedSeats]);

  // ── Gestion des sièges ────────────────────────────────────────────────────
  const toggleSeat = (seat) => {
    if (selectedSeats.find((s) => s.id === seat.id)) {
      const newSelected = selectedSeats.filter((s) => s.id !== seat.id);
      setSelectedSeats(newSelected);
      const passengerIndex = passengers.findIndex((p) => p.seatId === seat.id);
      if (passengerIndex !== -1) {
        const newPassengers = [...passengers];
        newPassengers.splice(passengerIndex, 1);
        setPassengers(newPassengers);
      }
    } else {
      const newSelected = [...selectedSeats, seat];
      setSelectedSeats(newSelected);
      setPassengers([
        ...passengers,
        {
          seatId: seat.id,
          seatNumber: seat.numero,
          nom: "",
          prenom: "",
          telephone: "",
        },
      ]);
    }
  };

  const updatePassenger = (index, field, value) => {
    const newPassengers = [...passengers];
    newPassengers[index] = { ...newPassengers[index], [field]: value };
    setPassengers(newPassengers);
  };

  const removePassenger = (index) => {
    const seatToRemove = passengers[index].seatId;
    setPassengers(passengers.filter((_, i) => i !== index));
    setSelectedSeats(selectedSeats.filter((s) => s.id !== seatToRemove));
  };

  // ── Récupérer les détails du ticket après création ────────────────────────
  const fetchTicketDetails = async (reservationId) => {
    try {
      const ticketData = await bookingService.getTicket(reservationId);
      setLastTicket(ticketData);
      return ticketData;
    } catch (error) {
      console.error("Erreur récupération ticket:", error);
      return null;
    }
  };

  // ── Émettre la réservation ────────────────────────────────────────────────
  const { mutate: emit, isPending } = useMutation({
    mutationFn: async () => {
      const primaryPassenger = passengers[0];

      const membresGroupe = passengers.slice(1).map((p) => ({
        nom: p.nom?.trim() || "",
        prenom: p.prenom?.trim() || "",
        telephone: p.telephone?.trim() || "",
        aBagage: false,
      }));

      const sieges = selectedSeats.map((s) => parseInt(s.numero, 10));

      const payload = {
        idVoyage: voyage.Id_voyage,
        idVoyageur: user?.id,
        nomVoyageur: primaryPassenger.nom?.trim() || "",
        prenomVoyageur: primaryPassenger.prenom?.trim() || "",
        telephoneVoyageur: primaryPassenger.telephone?.trim() || "",
        emailVoyageur: user?.email || "",
        nombrePlaces: selectedSeats.length,
        siegesDemandes: sieges,
        canal: "GUICHET",
        codeAgence: user?.agenceId ?? user?.agence_id ?? "NULL",
        codeFiliale: user?.filialeId ?? user?.filiale_id ?? "NULL",
        idGuichetier: user?.id,
        devise: "XAF",
        typeTarif: "STANDARD",
        membresGroupe: membresGroupe.length > 0 ? membresGroupe : [],
      };

      console.log("Payload envoyé:", JSON.stringify(payload, null, 2));
      return await bookingService.creerReservation(payload);
    },
    onSuccess: async (data) => {
      console.log("Réservation créée:", data);
      setLastBooking(data);
      setSiegesAttribues(selectedSeats.map((s) => s.numero));

      await fetchTicketDetails(data.id);

      setEtape("billet");
      toast.success("Billet émis avec succès !");

      // Rafraîchir le plan des sièges et la liste des voyages
      refetchSieges();
      queryClient.invalidateQueries(["voyages-guichet"]);
    },
    onError: (err) => {
      console.error("Erreur création réservation:", err);
      let message = "Erreur lors de l'émission du billet";
      if (err?.response?.data?.message) message = err.response.data.message;
      else if (err?.response?.data?.detail) message = err.response.data.detail;
      toast.error(message);
      // Rafraîchir les sièges en cas d'erreur (conflit de siège possible)
      refetchSieges();
    },
  });

  // ── Impression du billet ──────────────────────────────────────────────────
  const handlePrint = async () => {
    if (!lastBooking?.id) {
      toast.error("ID de réservation manquant");
      return;
    }
    try {
      const blob = await bookingService.telechargerBilletPdf(lastBooking.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billet-${lastTicket?.numeroTicket || lastBooking.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Téléchargement démarré");
    } catch (err) {
      console.error("Erreur impression:", err);
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>Billet ${lastTicket?.numeroTicket || lastBooking.id}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .ticket { border: 1px solid #ccc; padding: 20px; max-width: 500px; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 20px; }
              .info { margin: 10px 0; }
              .label { font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="ticket">
              <div class="header">
                <h2>NJILA - Billet d'embarquement</h2>
                <p>${lastTicket?.numeroTicket || lastBooking.id}</p>
              </div>
              <div class="info">
                <div><span class="label">Passager:</span> ${lastTicket?.nomVoyageur || "—"}</div>
                <div><span class="label">Trajet:</span> ${lastTicket?.origine || "—"} → ${lastTicket?.destination || "—"}</div>
                <div><span class="label">Date:</span> ${lastTicket?.dateDepart ? new Date(lastTicket.dateDepart).toLocaleString() : "—"}</div>
                <div><span class="label">Sièges:</span> ${siegesAttribues.join(", ")}</div>
                <div><span class="label">Bus:</span> ${lastTicket?.immatriculationBus || "—"}</div>
              </div>
              <div class="header" style="margin-top: 20px;">
                <p>Bon voyage !</p>
              </div>
            </div>
            <script>window.print();<\/script>
          </body>
        </html>
      `);
      printWindow.document.close();
      toast.success("Fenêtre d'impression ouverte");
    }
  };

  const handleNewReservation = () => {
    setEtape("voyage");
    setVoyage(null);
    setSelectedSeats([]);
    setPassengers([]);
    setPassengerErrors({});
    setIsFormValid(false);
    setLastBooking(null);
    setLastTicket(null);
    setSiegesAttribues([]);
  };

  const total = selectedSeats.length * (voyage?.prix ?? 0);
  const canEmit = voyage && selectedSeats.length > 0 && passengers.length > 0 && isFormValid && !isPending;

  const filteredVoyages = voyages.filter((v) => {
    const dest = v.destination || "";
    return dest.toLowerCase().includes(searchText.toLowerCase());
  });

  const formatHeure = (dt) => {
    if (!dt) return "—";
    return new Date(dt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDest = (v) => v?.destination || "—";

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Point de Vente</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse" />
            {user?.name} {user?.surname || ""} — Guichet actif
            {user?.agenceNom && (
              <span className="text-xs text-slate-400">· {user.agenceNom}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              placeholder="Destination..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <input
            type="date"
            value={searchDate}
            onChange={(e) => {
              setSearchDate(e.target.value);
              setVoyage(null);
              setSelectedSeats([]);
              setPassengers([]);
            }}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne voyages */}
        <div className="lg:col-span-3 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Départs disponibles
          </p>

          {loadingVoyages && (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}

          {!loadingVoyages && filteredVoyages.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <Bus className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun voyage disponible</p>
            </div>
          )}

          {filteredVoyages.map((v) => (
            <button
              key={v.Id_voyage}
              onClick={() => {
                setVoyage(v);
                setSelectedSeats([]);
                setPassengers([]);
                setPassengerErrors({});
              }}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                voyage?.Id_voyage === v.Id_voyage
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-950/50 shadow-sm"
                  : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {formatHeure(v.date_heure_depart)}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    v.typeVoyage === "vip"
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {v.typeVoyage?.toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                → {formatDest(v)}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {/* Affiche le nombre de places dispo depuis les données de sièges si ce voyage est sélectionné */}
                  {voyage?.Id_voyage === v.Id_voyage
                    ? `${availableSeats} / ${totalSeats} places`
                    : `${v.placesDisponibles ?? "—"} places`}
                </span>
                <span className="text-sm font-extrabold text-blue-600">
                  {formatMontant(v.prix)}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Plan du bus */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white">
                  {voyage
                    ? `${formatDest(voyage)} — ${formatHeure(voyage.date_heure_depart)}`
                    : "Sélectionnez un voyage"}
                </h3>
                {voyage && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedSeats.length} place(s) sélectionnée(s) ·{" "}
                    {loadingSeats ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-3 h-3 border border-slate-300 border-t-blue-500 rounded-full animate-spin inline-block" />
                        chargement...
                      </span>
                    ) : (
                      `${availableSeats} disponible(s) sur ${totalSeats}`
                    )}
                  </p>
                )}
              </div>
              {voyage && (
                <button
                  onClick={() => refetchSieges()}
                  title="Rafraîchir les sièges"
                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>

            {voyage ? (
              loadingSeats ? (
                <div className="flex items-center justify-center h-60">
                  <div className="text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm">Chargement du plan des sièges...</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <BusPlan
                    totalSeats={totalSeats}
                    occupiedSeats={occupiedSeats}
                    selectedSeats={selectedSeats}
                    onToggle={toggleSeat}
                    voyageInfo={voyage}
                  />
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-slate-300 dark:text-slate-600">
                <Bus className="w-20 h-20 mb-3 opacity-30" />
                <p className="text-sm font-medium">Sélectionnez un voyage</p>
              </div>
            )}
          </div>
        </div>

        {/* Récapitulatif et formulaire passagers */}
        <div className="lg:col-span-4">
          {etape === "billet" && lastBooking ? (
            <TicketDisplay
              ticket={lastTicket}
              reservation={{ ...lastBooking, montantTotal: total, siegesAttribues }}
              onPrint={handlePrint}
              onNewReservation={handleNewReservation}
            />
          ) : (
            <>
              {voyage && selectedSeats.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-extrabold text-slate-900 dark:text-white">
                      Informations des passagers
                    </h3>
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                      {selectedSeats.length} place(s)
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {passengers.map((p, idx) => (
                      <PassengerForm
                        key={p.seatId}
                        index={idx}
                        seatNumber={p.seatNumber}
                        passenger={p}
                        onChange={updatePassenger}
                        onRemove={removePassenger}
                        errors={passengerErrors[p.seatId] || {}}
                        isRemovable={passengers.length > 1}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                <h3 className="font-extrabold text-slate-900 dark:text-white mb-4">Récapitulatif</h3>

                {voyage && (
                  <div className="space-y-2 mb-4 text-sm bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Destination</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatDest(voyage)} ({voyage.typeVoyage?.toUpperCase()})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Départ</span>
                      <span className="font-bold">{formatHeure(voyage.date_heure_depart)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Disponibles</span>
                      <span className={`font-bold ${availableSeats <= 5 ? "text-red-500" : "text-emerald-600"}`}>
                        {loadingSeats ? "..." : `${availableSeats} / ${totalSeats}`}
                      </span>
                    </div>
                    {selectedSeats.length > 0 && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-500 flex-shrink-0">Places</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {selectedSeats.map((p) => (
                            <span
                              key={p.id}
                              className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold"
                            >
                              {p.numero}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Paiement espèces uniquement */}
                <div className="mb-4">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">
                    Mode de paiement
                  </label>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2">
                    <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">Espèces (Guichet)</span>
                  </div>
                </div>

                {/* Total */}
                <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {selectedSeats.length} × {formatMontant(voyage?.prix ?? 0)}
                    </span>
                    <span className="text-2xl font-extrabold text-blue-600">
                      {formatMontant(total)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (isFormValid) {
                      emit();
                    } else {
                      toast.error("Veuillez remplir tous les champs obligatoires des passagers");
                    }
                  }}
                  disabled={!canEmit}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-xl transition-colors shadow-sm"
                >
                  {isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      Confirmer & Émettre (Espèces)
                    </>
                  )}
                </button>

                {voyage && selectedSeats.length === 0 && (
                  <p className="text-xs text-slate-400 text-center mt-3">
                    Sélectionnez au moins un siège
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
