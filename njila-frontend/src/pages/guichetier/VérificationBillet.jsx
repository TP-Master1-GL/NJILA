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

const ETAPE = {
  SAISIE:       "saisie",
  CONFIRMATION: "confirmation",
  SUCCES:       "succes",
  ERREUR:       "erreur",
};

function Stepper({ etape }) {
  const steps = [
    { label: "Saisie numéro", key: ETAPE.SAISIE      },
    { label: "Vérif. CNI",   key: ETAPE.CONFIRMATION },
    { label: "Billet émis",  key: ETAPE.SUCCES       },
  ];
  const etapes     = steps.map((s) => s.key);
  const currentIdx = etapes.indexOf(etape);
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map(({ label, key }, i) => {
        const thisIdx = etapes.indexOf(key);
        const done    = currentIdx > thisIdx;
        const active  = currentIdx === thisIdx;
        return (
          <div key={key} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
              done   ? "bg-emerald-500 text-white" :
              active ? "bg-[#135bec] text-white"   : "bg-slate-200 text-slate-500"
            }`}>
              {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium ${active ? "text-slate-900" : "text-slate-400"}`}>
              {label}
            </span>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-slate-200 mx-2" />}
          </div>
        );
      })}
    </div>
  );
}

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

// ─── Billet d'embarquement — même design que GuichetierPOS.TicketDisplay ─────
function TicketEmbarquementDisplay({ ticket, onPrint, onReset }) {
  const formatDate = (dt) => {
    if (!dt) return "—";
    return new Date(dt).toLocaleString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200 overflow-hidden">

        <div className="bg-blue-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs uppercase tracking-wide">Billet d'embarquement</p>
              <p className="text-white font-mono font-bold text-sm mt-1 break-all">
                {ticket?.numeroTicket}
              </p>
            </div>
            <div className="bg-white/20 rounded-lg px-3 py-1 flex-shrink-0 ml-2">
              <span className="text-white text-xs font-bold">EMB</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="border-b border-blue-200 pb-3">
            <p className="text-xs text-blue-500 uppercase font-bold">Passager</p>
            <p className="text-lg font-bold text-slate-800">{ticket?.nomVoyageur || "—"}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-blue-500 uppercase font-bold">Origine</p>
              <p className="text-base font-semibold text-slate-700">{ticket?.origine || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-blue-500 uppercase font-bold">Destination</p>
              <p className="text-base font-semibold text-slate-700">{ticket?.destination || "—"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-blue-500 uppercase font-bold">Date & Heure</p>
              <p className="text-sm font-semibold text-slate-700">{formatDate(ticket?.dateDepart)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-500 uppercase font-bold">Bus</p>
              <p className="text-sm font-semibold text-slate-700">{ticket?.immatriculationBus || "—"}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-500 uppercase font-bold">Place</span>
              <span className="text-2xl font-extrabold text-blue-600">
                {ticket?.numeroPlace || "—"}
              </span>
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-600 uppercase font-bold">Statut</span>
              <span className="text-sm font-bold text-emerald-600">✓ Paiement confirmé</span>
            </div>
            <p className="text-xs text-emerald-500 mt-1">Converti depuis billet électronique</p>
          </div>
        </div>

        <div className="bg-blue-100 px-6 py-3 text-center border-t border-blue-200">
          <p className="text-xs text-blue-600">Présentez ce billet au moment de l'embarquement</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onPrint}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
        >
          <Printer className="w-4 h-4" /> Imprimer le billet
        </button>
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Nouveau voyageur
        </button>
      </div>
    </div>
  );
}

export default function VerificationBillet() {
  const { user } = useAuthStore();
  const [etape,              setEtape]              = useState(ETAPE.SAISIE);
  const [numeroBillet,       setNumeroBillet]       = useState("");
  const [ticketInfo,         setTicketInfo]         = useState(null);
  const [billetEmbarquement, setBilletEmbarquement] = useState(null);
  const [erreurMsg,          setErreurMsg]          = useState("");
  const [cniVerifiee,        setCniVerifiee]        = useState(false);

  const { mutate: verifierBillet, isPending: isVerifying } = useMutation({
    mutationFn: () => bookingService.getTicketByNumero(numeroBillet.trim()),
    onSuccess: (data) => {
      if (data.type === "EMB") {
        setErreurMsg("Ce numéro est déjà un billet d'embarquement. Aucune conversion nécessaire.");
        setEtape(ETAPE.ERREUR);
        return;
      }
      if (["ANNULE", "CANCELLED"].includes(data.statut?.toUpperCase())) {
        setErreurMsg("Ce billet a été annulé et ne peut pas être converti.");
        setEtape(ETAPE.ERREUR);
        return;
      }
      if (data.converti === true) {
        setErreurMsg("Ce billet électronique a déjà été converti en billet d'embarquement.");
        setEtape(ETAPE.ERREUR);
        return;
      }
      setTicketInfo(data);
      setCniVerifiee(false);
      setEtape(ETAPE.CONFIRMATION);
    },
    onError: (err) => {
      setErreurMsg(
        err?.response?.data?.message ||
        err?.response?.data?.detail  ||
        "Numéro de billet introuvable. Vérifiez et réessayez."
      );
      setEtape(ETAPE.ERREUR);
    },
  });

  const { mutate: genererEmbarquement, isPending: isGenerating } = useMutation({
    mutationFn: () => bookingService.convertirParNumero(numeroBillet.trim(), user?.id),
    onSuccess: (data) => {
      setBilletEmbarquement(data);
      setEtape(ETAPE.SUCCES);
      toast.success("Billet d'embarquement généré !");
    },
    onError: (err) => {
      setErreurMsg(
        err?.response?.data?.message ||
        err?.response?.data?.detail  ||
        "Erreur lors de la génération du billet d'embarquement."
      );
      setEtape(ETAPE.ERREUR);
    },
  });

  // ── Impression PDF ─────────────────────────────────────────────────────────
  // FIX : l'endpoint PDF attend l'ID de RÉSERVATION (Long).
  // TicketResponse doit exposer idReservation — si absent on fait un fallback HTML.
  const handleImprimer = async () => {
    const reservationId = billetEmbarquement?.idReservation
                       ?? billetEmbarquement?.reservationId;

    if (reservationId) {
      try {
        const blob = await bookingService.telechargerBilletPdf(reservationId);
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = `billet-${billetEmbarquement?.numeroTicket ?? reservationId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Téléchargement lancé…");
        return;
      } catch {
        // Fallback HTML ci-dessous
      }
    }

    // Fallback : impression HTML (si idReservation absent ou PDF échoue)
    const win = window.open("", "_blank");
    if (!win) { toast.error("Impossible d'ouvrir la fenêtre d'impression."); return; }
    win.document.write(`
      <html><head><title>Billet ${billetEmbarquement?.numeroTicket || ""}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;font-size:13px}
        h2{color:#1d4ed8;text-align:center;margin-bottom:4px}
        .sub{text-align:center;color:#64748b;margin-bottom:20px}
        .card{border:2px solid #bfdbfe;border-radius:12px;padding:20px;max-width:480px;margin:0 auto}
        .row{display:flex;justify-content:space-between;margin:8px 0}
        .lbl{color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:bold}
        .val{font-weight:600}
        .num{font-family:monospace;font-size:13px;font-weight:800;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 12px;text-align:center;margin:12px 0;word-break:break-all}
        .foot{text-align:center;color:#6b7280;font-size:11px;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:12px}
      </style></head><body>
      <div class="card">
        <h2>NJILA — Billet d'embarquement</h2>
        <p class="sub">EMB</p>
        <div class="num">${billetEmbarquement?.numeroTicket || "—"}</div>
        <div class="row"><span class="lbl">Passager</span>    <span class="val">${billetEmbarquement?.nomVoyageur || "—"}</span></div>
        <div class="row"><span class="lbl">Origine</span>     <span class="val">${billetEmbarquement?.origine || "—"}</span></div>
        <div class="row"><span class="lbl">Destination</span> <span class="val">${billetEmbarquement?.destination || "—"}</span></div>
        <div class="row"><span class="lbl">Date départ</span> <span class="val">${billetEmbarquement?.dateDepart ? new Date(billetEmbarquement.dateDepart).toLocaleString("fr-FR") : "—"}</span></div>
        <div class="row"><span class="lbl">Place</span>       <span class="val">${billetEmbarquement?.numeroPlace || "—"}</span></div>
        <div class="row"><span class="lbl">Bus</span>         <span class="val">${billetEmbarquement?.immatriculationBus || "—"}</span></div>
        <div class="foot">Bon voyage ! — Présentez ce billet à l'embarquement.</div>
      </div>
      <script>window.print();<\/script>
      </body></html>
    `);
    win.document.close();
    toast.success("Fenêtre d'impression ouverte.");
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
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Vérification & Conversion de billet
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Pour les voyageurs ayant réservé en ligne — saisissez le numéro unique du billet électronique
          </p>
        </div>

        <Stepper etape={etape} />

        {etape === ETAPE.SAISIE && (
          <Card>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-[#135bec]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Hash className="w-10 h-10 text-[#135bec]" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Saisir le numéro unique</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
                Demandez au voyageur son billet électronique et saisissez le numéro unique affiché dessus.
              </p>
            </div>

            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 mb-6 text-center">
              <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Exemple de format</p>
              <p className="font-mono text-sm font-bold text-[#135bec]">
                SUNSET BAF-WEB-20260516-SUNDLA-000001
              </p>
              <p className="text-xs text-slate-400 mt-1">AGENCE — CANAL — DATE — FILIALE — SÉQUENCE</p>
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
                    e.key === "Enter" && numeroBillet.trim().length >= 10 && verifierBillet()
                  }
                  placeholder="SUNSET BAF-WEB-20260516-SUNDLA-000001"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-mono
                             focus:outline-none focus:border-[#135bec] transition-colors
                             placeholder-slate-300 tracking-widest uppercase"
                />
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Vérifiez également la CNI du voyageur avant de procéder
                </p>
              </div>
              <Button size="full" loading={isVerifying}
                disabled={numeroBillet.trim().length < 10}
                onClick={() => verifierBillet()}>
                <Search className="w-4 h-4" /> Vérifier le billet
              </Button>
            </div>
          </Card>
        )}

        {etape === ETAPE.CONFIRMATION && ticketInfo && (
          <Card>
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">Vérifiez l'identité du voyageur</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Comparez le nom ci-dessous avec la CNI présentée avant de générer le billet d'embarquement.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#135bec] to-blue-700 rounded-2xl p-6 text-white mb-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-blue-200 text-xs uppercase font-semibold tracking-wide">Billet électronique</p>
                  <p className="font-mono font-extrabold text-base mt-1 tracking-wider break-all">
                    {ticketInfo.numeroTicket ?? numeroBillet}
                  </p>
                </div>
                <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full border border-white/30 flex-shrink-0 ml-2">
                  {ticketInfo.type ?? "WEB"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <BilletField icon={User} label="Voyageur"    value={ticketInfo.nomVoyageur} />
                <BilletField icon={Bus}  label="Bus"         value={ticketInfo.immatriculationBus} />
                <BilletField             label="Origine"     value={ticketInfo.origine} />
                <BilletField             label="Destination" value={ticketInfo.destination} />
                <BilletField             label="Date départ" value={
                  ticketInfo.dateDepart
                    ? new Date(ticketInfo.dateDepart).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric"
                      })
                    : "—"
                } />
                <BilletField label="Statut" value={ticketInfo.statut} />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <input type="checkbox" checked={cniVerifiee}
                onChange={(e) => setCniVerifiee(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-[#135bec] w-4 h-4" />
              <span className="text-sm text-emerald-800 font-medium">
                J'ai vérifié la CNI du voyageur et confirme que l'identité correspond au nom{" "}
                <strong>« {ticketInfo.nomVoyageur} »</strong>
              </span>
            </label>

            <div className="flex gap-3">
              <Button variant="secondary" size="lg" className="flex-1" onClick={reset}>
                ← Annuler
              </Button>
              <Button size="lg" className="flex-1" loading={isGenerating}
                disabled={!cniVerifiee}
                onClick={() => { if (!cniVerifiee) { toast.error("Veuillez confirmer la vérification de la CNI"); return; } genererEmbarquement(); }}>
                Générer le billet d'embarquement <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* ── Succès : même design que GuichetierPOS ── */}
        {etape === ETAPE.SUCCES && billetEmbarquement && (
          <Card>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-xl">Billet d'embarquement émis !</h3>
              <p className="text-slate-500 text-sm mt-1">
                Remettez ce billet au voyageur pour qu'il puisse embarquer
              </p>
            </div>
            <TicketEmbarquementDisplay
              ticket={billetEmbarquement}
              onPrint={handleImprimer}
              onReset={reset}
            />
          </Card>
        )}

        {etape === ETAPE.ERREUR && (
          <Card>
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-lg mb-2">Billet invalide</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">{erreurMsg}</p>
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <Button size="full" onClick={() => { setEtape(ETAPE.SAISIE); setErreurMsg(""); }}>
                  ← Ressaisir le numéro
                </Button>
                <p className="text-xs text-slate-400">
                  Si le problème persiste, contactez le support technique NJILA.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-sm font-semibold text-[#135bec] mb-2">ℹ️ Rappel — Deux types de billets</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { emoji: "📱", title: "Billet électronique (WEB)", desc: "Généré après paiement mobile money. Numéro format WEB. Doit être converti ici avant l'embarquement." },
              { emoji: "🖨️", title: "Billet d'embarquement (EMB)", desc: "Généré directement au guichet. Numéro format EMB. Pas de conversion nécessaire." },
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