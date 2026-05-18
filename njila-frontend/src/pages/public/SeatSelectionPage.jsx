import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bus, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { useBookingStore } from "../../store/bookingStore";
import { useAuthStore } from "../../store/authStore";
import { fleetService } from "../../services/fleetService";
import { bookingService } from "../../services/bookingService";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { formatMontant } from "../../utils/formatters";
import toast from "react-hot-toast";

// ─── Helpers pour normaliser la réponse de getSiegesVoyage ───────────────────
function parseSiegesData(data) {
  if (!data) return { occupiedSeats: [], totalSeats: null };

  if (Array.isArray(data)) {
    const occupiedSeats = data
      .filter((s) => s.statut === "occupe" || s.status === "occupied" || s.occupe === true || s.reserved === true)
      .map((s) => s.numero ?? s.number ?? s.id);
    return { occupiedSeats, totalSeats: data.length || null };
  }

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

// ─── Composant plan du bus ────────────────────────────────────────────────────
function BusPlan({ totalSeats, occupiedSeats = [], selectedSeats = [], onToggle }) {
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
      <div className="bg-gradient-to-br from-blue-50 to-blue-50/30 dark:from-slate-800 dark:to-slate-900 rounded-3xl border-2 border-blue-200 dark:border-blue-900 p-8">
        <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-dashed border-blue-200 dark:border-blue-900">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 bg-blue-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <Bus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">CHAUFFEUR</span>
          </div>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">AVANT →</span>
        </div>

        <div className="space-y-2">
          {Array.from({ length: rows }, (_, row) => {
            const startIdx = row * perRow;
            const rowSeats = seats.slice(startIdx, startIdx + perRow);
            const leftSeats = rowSeats.slice(0, leftCount);
            const rightSeats = rowSeats.slice(leftCount);

            return (
              <div key={row} className="flex items-center justify-center gap-1">
                <div className="flex gap-1">
                  {leftSeats.map((seat) => {
                    const selected = isSelected(seat.id);
                    return (
                      <button
                        key={seat.id}
                        disabled={seat.occupe}
                        onClick={() => !seat.occupe && onToggle(seat)}
                        className={`seat-btn w-10 h-10 rounded-lg text-xs font-bold transition-all ${
                          seat.occupe
                            ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60"
                            : selected
                            ? "selected bg-blue-600 dark:bg-blue-500 text-white shadow-md transform scale-105"
                            : "border-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:scale-105"
                        }`}
                      >
                        {seat.numero}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-slate-500" />
                  <span className="text-xs text-gray-400 dark:text-slate-500 font-semibold">C</span>
                  <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-slate-500" />
                </div>
                <div className="flex gap-1">
                  {rightSeats.map((seat) => {
                    if (!seat) return <div key={`empty-${row}`} className="w-10 h-10" />;
                    const selected = isSelected(seat.id);
                    return (
                      <button
                        key={seat.id}
                        disabled={seat.occupe}
                        onClick={() => !seat.occupe && onToggle(seat)}
                        className={`seat-btn w-10 h-10 rounded-lg text-xs font-bold transition-all ${
                          seat.occupe
                            ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60"
                            : selected
                            ? "selected bg-blue-600 dark:bg-blue-500 text-white shadow-md transform scale-105"
                            : "border-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:scale-105"
                        }`}
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

        <div className="mt-6 pt-6 border-t-2 border-dashed border-blue-200 dark:border-blue-900 text-center">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">← ARRIÈRE</span>
        </div>

        <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-blue-200 dark:border-blue-900">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-gray-300 bg-white dark:bg-slate-700" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Libre</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-600" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Sélectionné</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-300 dark:bg-gray-600" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Occupé</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────
export default function SeatSelectionPage() {
  const { voyageId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    voyageSelectionne,
    setPlacesSelectionnees,
    setPassagers,
  } = useBookingStore();

  const [passagersForm, setPassagersForm] = useState([]);
  const [errorsForm, setErrorsForm] = useState({});
  const [selectedSeats, setSelectedSeats] = useState([]);

  // ─── Récupérer le détail du voyage ─────────────────────────────────────────
  const { data: voyageDetails, isLoading: isLoadingVoyage } = useQuery({
    queryKey: ["voyage", voyageId],
    queryFn: async () => {
      if (!voyageId) return null;
      return await fleetService.getVoyageDetail(voyageId);
    },
    enabled: !!voyageId,
    staleTime: 1000 * 60 * 5,
  });

  // ─── Récupérer le plan des sièges via bookingService.getSiegesVoyage ───────
  const {
    data: siegesData,
    isLoading: loadingSeats,
    refetch: refetchSieges,
  } = useQuery({
    queryKey: ["sieges-voyage-selection", voyageId],
    queryFn: () => bookingService.getSiegesVoyage(voyageId),
    enabled: !!voyageId,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  // ─── Calcul des sièges occupés et de la capacité ───────────────────────────
  const { occupiedSeats, totalSeats: totalFromSieges } = parseSiegesData(siegesData);

  const getRealBusCapacity = () => {
    if (totalFromSieges) return Number(totalFromSieges);
    if (voyageDetails?.IdBus?.capacite) return Number(voyageDetails.IdBus.capacite);
    if (voyageDetails?.capacite) return Number(voyageDetails.capacite);
    return 70;
  };

  const totalSeats = getRealBusCapacity();
  const availableSeats = Math.max(0, totalSeats - occupiedSeats.length);

  // ─── Garde : on attend la fin du chargement avant de décider de rediriger ──
  useEffect(() => {
    if (isLoadingVoyage) return;

    const hasData = voyageSelectionne || voyageDetails;
    if (!hasData) {
      toast.error("Données de réservation incomplètes");
      navigate("/search");
    }
  }, [isLoadingVoyage, voyageSelectionne, voyageDetails, navigate]);

  // ─── Avertissement développeur : idAgence / idFiliale manquants ────────────
  // FIX : on vérifie idAgence et idFiliale (IDs numériques) au lieu des codes
  useEffect(() => {
    const voyage = voyageSelectionne || voyageDetails;
    if (!voyage) return;
    if (!voyage.idAgence || !voyage.idFiliale) {
      console.warn(
        "[SeatSelectionPage] idAgence ou idFiliale absent du voyage sélectionné. " +
        "Le paiement échouera si ces champs ne sont pas exposés par le backend.",
        { idAgence: voyage.idAgence, idFiliale: voyage.idFiliale }
      );
    }
  }, [voyageSelectionne, voyageDetails]);

  // ─── Désélectionner les sièges qui deviendraient occupés (gestion concurrence) ─
  useEffect(() => {
    if (occupiedSeats.length === 0) return;

    const nowOccupied = selectedSeats.filter((s) => occupiedSeats.includes(s.id));
    if (nowOccupied.length > 0) {
      toast.error(`Le(s) siège(s) ${nowOccupied.map((s) => s.numero).join(", ")} vien(nen)t d'être réservé(s).`);
      const stillFree = selectedSeats.filter((s) => !occupiedSeats.includes(s.id));
      setSelectedSeats(stillFree);
      setPassagersForm((prev) => prev.filter((_, idx) => stillFree.some((s) => s.numero === String(selectedSeats[idx]?.numero))));
    }
  }, [occupiedSeats]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Gestion des sièges ────────────────────────────────────────────────────
  const toggleSeat = (seat) => {
    if (selectedSeats.find((s) => s.id === seat.id)) {
      const seatIndex = selectedSeats.findIndex((s) => s.id === seat.id);
      const newSelected = selectedSeats.filter((s) => s.id !== seat.id);
      setSelectedSeats(newSelected);

      if (seatIndex !== -1) {
        setPassagersForm((prev) => prev.filter((_, i) => i !== seatIndex));
      }
    } else {
      setSelectedSeats((prev) => [...prev, seat]);
      setPassagersForm((prev) => [
        ...prev,
        { nom: "", prenom: "", cni: "", email: "", telephone: "" },
      ]);
    }
  };

  const handlePassagerChange = (idx, field, value) => {
    const updated = [...passagersForm];
    updated[idx] = { ...updated[idx], [field]: value };
    setPassagersForm(updated);

    const errorKey = `${idx}_${field}`;
    if (errorsForm[errorKey]) {
      const newErrors = { ...errorsForm };
      delete newErrors[errorKey];
      setErrorsForm(newErrors);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    selectedSeats.forEach((seat, idx) => {
      const passager = passagersForm[idx] || {};

      if (!passager.nom || passager.nom.trim().length < 2) {
        newErrors[`${idx}_nom`] = "Nom requis (min. 2 caractères)";
      }
      if (!passager.prenom || passager.prenom.trim().length < 2) {
        newErrors[`${idx}_prenom`] = "Prénom requis (min. 2 caractères)";
      }
      if (!passager.cni || passager.cni.trim().length < 5) {
        newErrors[`${idx}_cni`] = "N° d'identité requis";
      }
      if (passager.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passager.email)) {
        newErrors[`${idx}_email`] = "Email invalide";
      }
      if (passager.telephone && !/^\+?237[0-9]{8,}$/.test(passager.telephone)) {
        newErrors[`${idx}_telephone`] = "Numéro invalide (ex: +237600000000)";
      }
    });
    setErrorsForm(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    if (selectedSeats.length === 0) {
      toast.error("Veuillez sélectionner au moins une place");
      return;
    }
    if (!validateForm()) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    const passagersData = selectedSeats.map((seat, idx) => ({
      id: `passager_${seat.id}`,
      placeId: seat.id,
      placeNumero: seat.numero,
      nom: passagersForm[idx].nom.trim(),
      prenom: passagersForm[idx].prenom.trim(),
      cni: passagersForm[idx].cni.trim(),
      email: passagersForm[idx].email?.trim() || user?.email || "",
      telephone: passagersForm[idx].telephone?.trim() || user?.telephone || "",
    }));

    // ── Synchroniser le state local vers le store Zustand ────────────────────
    setPlacesSelectionnees(
      selectedSeats.map((s) => ({
        id: s.id,
        numero: s.numero,
        occupe: s.occupe ?? false,
      }))
    );

    setPassagers(passagersData);
    navigate("/paiement");
  };

  // ─── Variables dérivées ────────────────────────────────────────────────────
  const voyage = voyageSelectionne || voyageDetails;
  const prixUnitaire = voyage?.prix || 5000;
  const total = selectedSeats.length * prixUnitaire;

  // ─── Rendu : Chargement ────────────────────────────────────────────────────
  if (isLoadingVoyage) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Chargement en cours...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">Récupération des places disponibles</p>
        </div>
      </div>
    );
  }

  // ─── Rendu : Erreur (chargement terminé mais aucune donnée) ───────────────
  if (!voyage) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Erreur</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Impossible de charger les données du voyage
          </p>
          <Button onClick={() => navigate("/search")}>Retour à la recherche</Button>
        </div>
      </div>
    );
  }

  // ─── Rendu : Page complète ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(12px); }
          to { opacity:1; transform:translateY(0); }
        }
        .fade-in { animation: fadeUp .35s ease both; }
        .seat-btn { transition: all .15s ease; cursor: pointer; }
        .input-error { border-color: #ef4444 !important; }
        .error-text { color: #ef4444; font-size: 0.75rem; margin-top: 0.25rem; }
      `}</style>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors group"
          >
            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 rounded-xl flex items-center justify-center transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold hidden sm:inline">Retour aux résultats</span>
          </button>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-200">
            <Bus className="w-4 h-4 text-blue-600" />
            <span>{voyage?.origine || "—"} → {voyage?.destination || "—"}</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block">
            {voyage?.dateHeureDepart
              ? voyage.dateHeureDepart.slice(0, 10) + " à " + voyage.dateHeureDepart.slice(11, 16)
              : "—"}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 overflow-x-auto">
          {[
            ["1", "Sélection", true],
            ["2", "Passagers", true],
            ["3", "Paiement", false],
          ].map(([n, l, active], i) => (
            <div key={n} className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  active ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-500"
                }`}
              >
                {n}
              </div>
              <span
                className={`text-sm font-medium whitespace-nowrap ${
                  active ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-600"
                }`}
              >
                {l}
              </span>
              {i < 2 && <div className="w-12 h-px bg-gray-200 dark:bg-slate-800 hidden sm:block" />}
            </div>
          ))}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8 flex-col lg:flex-row">
        {/* Colonne gauche : Plan du bus et formulaire passagers */}
        <div className="flex-1 fade-in">
          {/* Plan du bus */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  Sélectionnez vos places
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  {voyage?.typeVoyage || "Standard"} · {totalSeats} places ·{" "}
                  {loadingSeats ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin inline-block" />
                      chargement...
                    </span>
                  ) : (
                    `${availableSeats} disponibles`
                  )}
                </p>
              </div>
              {voyageId && (
                <button
                  onClick={() => refetchSieges()}
                  title="Rafraîchir les sièges"
                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Plan du bus */}
            {loadingSeats && !siegesData ? (
              <div className="flex items-center justify-center h-80">
                <div className="text-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
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
                />
              </div>
            )}

            {selectedSeats.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-xl">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">
                  ✅ {selectedSeats.length} place(s) sélectionnée(s) :{" "}
                  <span className="text-blue-700 dark:text-blue-300">
                    {selectedSeats.map((p) => p.numero).join(", ")}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Formulaire passagers */}
          {selectedSeats.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 fade-in">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Informations des passagers ({selectedSeats.length})
              </h3>

              <div className="space-y-6">
                {selectedSeats.map((place, idx) => (
                  <div
                    key={place.id}
                    className="p-5 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700"
                  >
                    <p className="text-sm font-bold text-gray-800 dark:text-slate-200 mb-4 flex items-center justify-between">
                      <span>
                        Passager {idx + 1}{" "}
                        <span className="text-blue-600 dark:text-blue-400">(Place {place.numero})</span>
                      </span>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                        Siège {place.numero}
                      </span>
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Nom */}
                      <div>
                        <Input
                          label="Nom *"
                          placeholder="Ex: DUPONT"
                          value={passagersForm[idx]?.nom || ""}
                          onChange={(e) => handlePassagerChange(idx, "nom", e.target.value)}
                          className={errorsForm[`${idx}_nom`] ? "input-error" : ""}
                        />
                        {errorsForm[`${idx}_nom`] && (
                          <p className="error-text">{errorsForm[`${idx}_nom`]}</p>
                        )}
                      </div>

                      {/* Prénom */}
                      <div>
                        <Input
                          label="Prénom *"
                          placeholder="Ex: Jean"
                          value={passagersForm[idx]?.prenom || ""}
                          onChange={(e) => handlePassagerChange(idx, "prenom", e.target.value)}
                          className={errorsForm[`${idx}_prenom`] ? "input-error" : ""}
                        />
                        {errorsForm[`${idx}_prenom`] && (
                          <p className="error-text">{errorsForm[`${idx}_prenom`]}</p>
                        )}
                      </div>

                      {/* CNI / Passeport */}
                      <div>
                        <Input
                          label="N° CNI / Passeport *"
                          placeholder="Ex: AB123456789"
                          value={passagersForm[idx]?.cni || ""}
                          onChange={(e) => handlePassagerChange(idx, "cni", e.target.value)}
                          className={errorsForm[`${idx}_cni`] ? "input-error" : ""}
                        />
                        {errorsForm[`${idx}_cni`] && (
                          <p className="error-text">{errorsForm[`${idx}_cni`]}</p>
                        )}
                      </div>

                      {/* Téléphone */}
                      <div>
                        <Input
                          label="Téléphone"
                          placeholder="+237600000000"
                          value={passagersForm[idx]?.telephone || ""}
                          onChange={(e) => handlePassagerChange(idx, "telephone", e.target.value)}
                          className={errorsForm[`${idx}_telephone`] ? "input-error" : ""}
                        />
                        {errorsForm[`${idx}_telephone`] && (
                          <p className="error-text">{errorsForm[`${idx}_telephone`]}</p>
                        )}
                      </div>

                      {/* Email — pleine largeur */}
                      <div className="sm:col-span-2">
                        <Input
                          label="Email"
                          placeholder="optionnel@example.com"
                          type="email"
                          value={passagersForm[idx]?.email || ""}
                          onChange={(e) => handlePassagerChange(idx, "email", e.target.value)}
                          className={errorsForm[`${idx}_email`] ? "input-error" : ""}
                        />
                        {errorsForm[`${idx}_email`] && (
                          <p className="error-text">{errorsForm[`${idx}_email`]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  ⚠️ Les informations d'identité sont nécessaires pour valider votre réservation.
                  Assurez-vous que les noms correspondent exactement à vos documents d'identité.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite : Récapitulatif sticky */}
        <div className="fade-in w-full lg:w-96 flex-shrink-0" style={{ animationDelay: ".1s" }}>
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-900 rounded-2xl p-6 text-white sticky top-24">
            <h3 className="font-bold text-lg mb-5">Récapitulatif</h3>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between pb-3 border-b border-white/20">
                <span className="text-blue-100">Trajet</span>
                <span className="font-semibold">{voyage?.origine || "—"} → {voyage?.destination || "—"}</span>
              </div>

              <div className="flex justify-between pb-3 border-b border-white/20">
                <span className="text-blue-100">Date & Heure</span>
                <span className="font-semibold">
                  {voyage?.dateHeureDepart
                    ? voyage.dateHeureDepart.slice(0, 10) + " " + voyage.dateHeureDepart.slice(11, 16)
                    : "—"}
                </span>
              </div>

              <div className="pb-3 border-b border-white/20">
                <span className="text-blue-100 block mb-2">Places sélectionnées</span>
                {selectedSeats.length > 0 ? (
                  <div className="flex gap-1 flex-wrap">
                    {selectedSeats.map((p) => (
                      <span key={p.id} className="bg-white/20 px-3 py-1 rounded text-xs font-semibold">
                        #{p.numero}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-blue-200 text-xs italic">Sélectionnez au moins une place</span>
                )}
              </div>

              <div className="flex justify-between pb-3 border-b border-white/20">
                <span className="text-blue-100">Disponibles</span>
                <span className={`font-semibold ${availableSeats <= 5 ? "text-red-200" : "text-emerald-200"}`}>
                  {loadingSeats ? "..." : `${availableSeats} / ${totalSeats}`}
                </span>
              </div>

              <div className="flex justify-between pb-3 border-b border-white/20">
                <span className="text-blue-100">Tarif/place</span>
                <span className="font-semibold">{formatMontant(prixUnitaire)}</span>
              </div>

              <div className="flex justify-between pb-3 border-b border-white/20">
                <span className="text-blue-100">Passagers</span>
                <span className="font-semibold">{selectedSeats.length} passager(s)</span>
              </div>

              <div className="flex justify-between pt-2">
                <span className="font-semibold text-lg">Total</span>
                <span className="text-3xl font-bold">{formatMontant(total)}</span>
              </div>
            </div>

            <Button
              size="full"
              className="mt-6 bg-white hover:bg-gray-100 text-blue-600 font-bold"
              disabled={selectedSeats.length === 0}
              onClick={handleContinue}
            >
              Procéder au paiement →
            </Button>

            {selectedSeats.length === 0 ? (
              <p className="text-center text-xs text-blue-200 mt-3">
                Sélectionnez au moins une place pour continuer
              </p>
            ) : (
              <>
                <p className="text-center text-xs text-blue-100 mt-3">
                  ✓ Toutes les informations seront vérifiées
                </p>
                <p className="text-center text-xs text-blue-100/70 mt-1">🔒 PAIEMENT SÉCURISÉ</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}