import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Search, CheckCircle, XCircle, User, Bus, Hash,
  AlertTriangle, ArrowRight, Printer, RotateCcw,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { useAuthStore } from "../../store/authStore";
import { bookingService } from "../../services/bookingService";
import toast from "react-hot-toast";

// États de l'interface
const ETAPE = {
  SAISIE:       "saisie",
  CONFIRMATION: "confirmation",
  SUCCES:       "succes",
  ERREUR:       "erreur",
};

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ etape }) {
  const steps = [
    { label: "Saisie numéro",  key: ETAPE.SAISIE },
    { label: "Vérif. CNI",    key: ETAPE.CONFIRMATION },
    { label: "Billet émis",   key: ETAPE.SUCCES },
  ];
  const etapes = steps.map((s) => s.key);
  const currentIdx = etapes.indexOf(etape);

  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map(({ label, key }, i) => {
        const thisIdx = etapes.indexOf(key);
        const done    = currentIdx > thisIdx;
        const active  = currentIdx === thisIdx;
        return (
          <div key={key} className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                done   ? "bg-emerald-500 text-white" :
                active ? "bg-[#135bec] text-white"   : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium ${active ? "text-slate-900" : "text-slate-400"}`}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-slate-200 mx-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Champ info billet ─────────────────────────────────────────────────────────
function BilletField({ label, value, icon: Icon }) {
  return (
    <div>
      <p className="text-blue-300 text-xs uppercase tracking-wide">{label}</p>
      <p className="font-semibold text-sm mt-0.5 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 opacity-70" />}
        {value || "—"}
      </p>
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function VerificationBillet() {
  const { user } = useAuthStore();
  const [etape, setEtape]                           = useState(ETAPE.SAISIE);
  const [numeroBillet, setNumeroBillet]             = useState("");
  const [ticketInfo, setTicketInfo]                 = useState(null);
  const [billetEmbarquement, setBilletEmbarquement] = useState(null);
  const [erreurMsg, setErreurMsg]                   = useState("");
  const [cniVerifiee, setCniVerifiee]               = useState(false);

  const formatDate = (dt) =>
    dt
      ? new Date(dt).toLocaleString("fr-FR", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "—";

  // ── Étape 1 : récupérer les infos du billet électronique ──────────────────
  // Utilise getTicket qui appelle GET /api/bookings/{id}/ticket
  const { mutate: verifierBillet, isPending: isVerifying } = useMutation({
    mutationFn: () => bookingService.getTicket(numeroBillet.trim()),
    onSuccess: (data) => {
      // Vérifier si le billet est déjà un billet d'embarquement
      // Adapté selon la structure retournée par l'API
      if (data.type === "EMBARQUEMENT" || data.isBoardingTicket) {
        setErreurMsg(
          "Ce numéro est déjà un billet d'embarquement. Aucune conversion nécessaire."
        );
        setEtape(ETAPE.ERREUR);
        return;
      }
      if (data.statut === "ANNULEE" || data.statut === "CANCELLED" || data.status === "cancelled") {
        setErreurMsg("Ce billet a été annulé. Il ne peut pas être converti.");
        setEtape(ETAPE.ERREUR);
        return;
      }
      setTicketInfo(data);
      setCniVerifiee(false);
      setEtape(ETAPE.CONFIRMATION);
    },
    onError: (err) => {
      setErreurMsg(
        err?.response?.data?.message ??
        err?.response?.data?.detail ??
        "Numéro de billet introuvable. Vérifiez et réessayez."
      );
      setEtape(ETAPE.ERREUR);
    },
  });

  // ── Étape 2 : confirmer CNI → générer billet d'embarquement ───────────────
  // Utilise confirmerBillet qui appelle PATCH /api/bookings/{id}/confirm
  const { mutate: genererEmbarquement, isPending: isGenerating } = useMutation({
    mutationFn: () =>
      bookingService.confirmerBillet(ticketInfo.id ?? ticketInfo.reservationId, {
        numeroTicketElectronique: numeroBillet.trim(),
        idGuichetier: user?.id,
        // Ajouter des champs supplémentaires si nécessaire selon l'API
        confirmedBy: user?.id,
        confirmedAt: new Date().toISOString(),
      }),
    onSuccess: (data) => {
      setBilletEmbarquement(data);
      setEtape(ETAPE.SUCCES);
      toast.success("Billet d'embarquement généré !");
    },
    onError: (err) => {
      setErreurMsg(
        err?.response?.data?.message ??
        "Erreur lors de la génération du billet d'embarquement."
      );
      setEtape(ETAPE.ERREUR);
    },
  });

  // ── Télécharger PDF ────────────────────────────────────────────────────────
  // Utilise telechargerBilletPdf qui appelle GET /api/bookings/{id}/ticket/pdf
  const handleImprimer = async () => {
    const id = billetEmbarquement?.id ?? billetEmbarquement?.reservationId;
    if (!id) return toast.error("ID du billet manquant");
    try {
      const blob = await bookingService.telechargerBilletPdf(id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `billet-${billetEmbarquement?.numeroTicket ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Impression lancée…");
    } catch {
      toast.error("Impossible de télécharger le PDF");
    }
  };

  const reset = () => {
    setEtape(ETAPE.SAISIE);
    setNumeroBillet("");
    setTicketInfo(null);
    setBilletEmbarquement(null);
    setErreurMsg("");
    setCniVerifiee(false);
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Vérification & Conversion de billet
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Pour les voyageurs ayant réservé en ligne — saisissez le numéro unique du billet électronique
          </p>
        </div>

        <Stepper etape={etape} />

        {/* ── ÉTAPE 1 : Saisie ──────────────────────────────────────────────── */}
        {etape === ETAPE.SAISIE && (
          <Card>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-[#135bec]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Hash className="w-10 h-10 text-[#135bec]" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Saisir le numéro unique</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
                Demandez au voyageur son billet électronique PDF et saisissez le numéro unique
                affiché dessus.
              </p>
            </div>

            {/* Exemple format */}
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 mb-6 text-center">
              <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Exemple de format</p>
              <p className="font-mono text-sm font-bold text-[#135bec]">
                GEN-WEB-20260321-BYDE-000142
              </p>
              <p className="text-xs text-slate-400 mt-1">
                AGENCE — CANAL — DATE — FILIALE — SÉQUENCE
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Numéro unique du billet électronique
                </label>
                <input
                  value={numeroBillet}
                  onChange={(e) => setNumeroBillet(e.target.value.toUpperCase())}
                  onKeyDown={(e) =>
                    e.key === "Enter" && numeroBillet.length >= 10 && verifierBillet()
                  }
                  placeholder="GEN-WEB-20260321-BYDE-000142"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-mono
                             focus:outline-none focus:border-[#135bec] transition-colors
                             placeholder-slate-300 tracking-widest"
                />
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Vérifiez également la CNI du voyageur avant de procéder
                </p>
              </div>

              <Button
                size="full"
                loading={isVerifying}
                disabled={numeroBillet.trim().length < 10}
                onClick={() => verifierBillet()}
              >
                <Search className="w-4 h-4" />
                Vérifier le billet
              </Button>
            </div>
          </Card>
        )}

        {/* ── ÉTAPE 2 : Confirmation ─────────────────────────────────────────── */}
        {etape === ETAPE.CONFIRMATION && ticketInfo && (
          <Card>
            {/* Alerte CNI */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">
                  Vérifiez l'identité du voyageur
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Comparez le nom ci-dessous avec la CNI présentée avant de générer le billet
                  d'embarquement.
                </p>
              </div>
            </div>

            {/* Carte billet électronique */}
            <div className="bg-gradient-to-br from-[#135bec] to-blue-700 rounded-2xl p-6 text-white mb-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-blue-200 text-xs uppercase font-semibold tracking-wide">
                    Billet électronique
                  </p>
                  <p className="font-mono font-extrabold text-xl mt-1 tracking-wider">
                    {ticketInfo.numeroTicket ?? ticketInfo.ticketNumber ?? numeroBillet}
                  </p>
                </div>
                <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full border border-white/30">
                  {ticketInfo.type ?? ticketInfo.ticketType ?? "WEB"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <BilletField icon={User} label="Voyageur"    value={ticketInfo.nomVoyageur ?? ticketInfo.passengerName} />
                <BilletField icon={Bus}  label="Bus"         value={ticketInfo.immatriculationBus ?? ticketInfo.busLicensePlate} />
                <BilletField             label="Origine"     value={ticketInfo.origine ?? ticketInfo.departureCity} />
                <BilletField             label="Destination" value={ticketInfo.destination ?? ticketInfo.arrivalCity} />
                <BilletField             label="Date départ" value={formatDate(ticketInfo.dateDepart ?? ticketInfo.departureDate)} />
                <BilletField             label="Téléphone"   value={ticketInfo.telephoneVoyageur ?? ticketInfo.passengerPhone} />
                {ticketInfo.nombrePlaces && (
                  <BilletField label="Nb de places" value={ticketInfo.nombrePlaces} />
                )}
                {ticketInfo.montantTotal && (
                  <BilletField label="Montant" value={`${ticketInfo.montantTotal} FCFA`} />
                )}
              </div>
            </div>

            {/* Confirmation CNI */}
            <label className="flex items-start gap-3 cursor-pointer bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <input
                type="checkbox"
                checked={cniVerifiee}
                onChange={(e) => setCniVerifiee(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-[#135bec] w-4 h-4"
              />
              <span className="text-sm text-emerald-800 font-medium">
                J'ai vérifié la CNI du voyageur et confirme que l'identité correspond au nom{" "}
                <strong>« {ticketInfo.nomVoyageur ?? ticketInfo.passengerName} »</strong>
              </span>
            </label>

            <div className="flex gap-3">
              <Button variant="secondary" size="lg" className="flex-1" onClick={reset}>
                ← Annuler
              </Button>
              <Button
                size="lg"
                className="flex-1"
                loading={isGenerating}
                disabled={!cniVerifiee}
                onClick={() => {
                  if (!cniVerifiee) {
                    toast.error("Veuillez confirmer la vérification de la CNI");
                    return;
                  }
                  genererEmbarquement();
                }}
              >
                Générer billet d'embarquement <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* ── ÉTAPE 3 : Succès ───────────────────────────────────────────────── */}
        {etape === ETAPE.SUCCES && billetEmbarquement && (
          <Card>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-xl">
                Billet d'embarquement émis !
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                Remettez ce billet imprimé au voyageur pour qu'il puisse embarquer
              </p>
            </div>

            {/* Billet d'embarquement */}
            <div className="border-2 border-dashed border-emerald-300 rounded-2xl p-6 bg-emerald-50 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-emerald-600 uppercase font-bold tracking-wide">
                    Billet d'embarquement
                  </p>
                  <p className="font-mono font-extrabold text-xl text-slate-900 mt-1 tracking-wider">
                    {billetEmbarquement.numeroTicket ?? billetEmbarquement.ticketNumber}
                  </p>
                </div>
                <div className="w-12 h-12 bg-white border-2 border-emerald-200 rounded-xl flex items-center justify-center">
                  <span className="text-[#135bec] font-extrabold text-sm">EMB</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Passager",    billetEmbarquement.nomVoyageur ?? billetEmbarquement.passengerName],
                  ["Place(s)",    Array.isArray(billetEmbarquement.numerosPlaces)
                                    ? billetEmbarquement.numerosPlaces.join(", ")
                                    : billetEmbarquement.numeroPlace ?? billetEmbarquement.seatNumber ?? "—"],
                  ["Origine",     billetEmbarquement.origine ?? billetEmbarquement.departureCity],
                  ["Destination", billetEmbarquement.destination ?? billetEmbarquement.arrivalCity],
                  ["Date départ", formatDate(billetEmbarquement.dateDepart ?? billetEmbarquement.departureDate)],
                  ["Bus",         billetEmbarquement.immatriculationBus ?? billetEmbarquement.busLicensePlate],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs text-slate-400 uppercase">{l}</p>
                    <p className="font-semibold text-slate-900 mt-0.5">{v || "—"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button size="full" onClick={handleImprimer}>
                <Printer className="w-4 h-4" /> Imprimer le billet
              </Button>
              <Button variant="secondary" size="full" onClick={reset}>
                <RotateCcw className="w-4 h-4" /> Nouveau voyageur
              </Button>
            </div>
          </Card>
        )}

        {/* ── ERREUR ─────────────────────────────────────────────────────────── */}
        {etape === ETAPE.ERREUR && (
          <Card>
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-lg mb-2">Billet invalide</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">{erreurMsg}</p>
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <Button
                  size="full"
                  onClick={() => { setEtape(ETAPE.SAISIE); setErreurMsg(""); }}
                >
                  ← Ressaisir le numéro
                </Button>
                <p className="text-xs text-slate-400">
                  Si le problème persiste, contactez le support technique NJILA.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Info bas de page */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-sm font-semibold text-[#135bec] mb-2">ℹ️ Rappel — Deux types de billets</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                emoji: "📱",
                title: "Billet électronique (WEB)",
                desc: "Généré après paiement en ligne. Contient un numéro unique. Doit être converti ici en billet d'embarquement.",
              },
              {
                emoji: "🖨️",
                title: "Billet d'embarquement (GUICHET)",
                desc: "Généré directement à l'agence. Pas besoin de conversion.",
              },
            ].map(({ emoji, title, desc }) => (
              <div key={title} className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-xs font-bold text-slate-700 mb-1">{emoji} {title}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
