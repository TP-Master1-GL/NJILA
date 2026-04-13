import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, CheckCircle, XCircle, User, Bus, Hash, AlertTriangle, ArrowRight } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useAuthStore } from "../../store/authStore";
import { bookingService } from "../../services/bookingService";
import toast from "react-hot-toast";

// États de l'interface
const ETAPE = {
  SAISIE:       "saisie",       // Guichetier saisit le numéro unique
  CONFIRMATION: "confirmation", // Affiche les infos du billet — guichetier vérifie la CNI
  SUCCES:       "succes",       // Billet d'embarquement généré
  ERREUR:       "erreur",       // Billet invalide
};

export default function VerificationBillet() {
  const { user } = useAuthStore();
  const [etape, setEtape]               = useState(ETAPE.SAISIE);
  const [numeroBillet, setNumeroBillet] = useState("");
  const [ticketInfo, setTicketInfo]     = useState(null);       // infos du billet électronique
  const [billetEmbarquement, setBilletEmbarquement] = useState(null); // billet généré
  const [erreurMsg, setErreurMsg]       = useState("");

  // ── Étape 1 : vérifier le billet électronique (juste afficher les infos) ──
  const { mutate: verifierBillet, isPending: isVerifying } = useMutation({
    mutationFn: () => bookingService.getTicket(
      // On passe le numéro — le service retrouve la réservation correspondante
      numeroBillet
    ),
    onSuccess: (data) => {
      if (data.type !== "WEB") {
        setErreurMsg("Ce numéro correspond à un billet d'embarquement, pas à un billet électronique.");
        setEtape(ETAPE.ERREUR);
        return;
      }
      setTicketInfo(data);
      setEtape(ETAPE.CONFIRMATION);
    },
    onError: (err) => {
      setErreurMsg(err.response?.data?.message || "Numéro de billet introuvable. Vérifiez et réessayez.");
      setEtape(ETAPE.ERREUR);
    },
  });

  // ── Étape 2 : confirmer CNI vérifiée → générer le billet d'embarquement ──
  const { mutate: genererEmbarquement, isPending: isGenerating } = useMutation({
    mutationFn: () => bookingService.confirmerBillet(ticketInfo.id, {
      numeroTicketElectronique: numeroBillet,
      idGuichetier: user?.id || 1,
    }),
    onSuccess: (data) => {
      setBilletEmbarquement(data);
      setEtape(ETAPE.SUCCES);
      toast.success("Billet d'embarquement généré !");
    },
    onError: (err) => {
      setErreurMsg(err.response?.data?.message || "Erreur lors de la génération du billet.");
      setEtape(ETAPE.ERREUR);
    },
  });

  const reset = () => {
    setEtape(ETAPE.SAISIE);
    setNumeroBillet("");
    setTicketInfo(null);
    setBilletEmbarquement(null);
    setErreurMsg("");
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Vérification & Conversion de billet
          </h1>
          <p className="text-slate-500 mt-1">
            Pour les voyageurs ayant réservé en ligne — saisissez le numéro unique du billet électronique
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { label: "Saisie numéro",   key: ETAPE.SAISIE },
            { label: "Vérif. CNI",      key: ETAPE.CONFIRMATION },
            { label: "Billet émis",     key: ETAPE.SUCCES },
          ].map(({ label, key }, i) => {
            const steps = [ETAPE.SAISIE, ETAPE.CONFIRMATION, ETAPE.SUCCES];
            const currentIdx = steps.indexOf(etape);
            const thisIdx    = steps.indexOf(key);
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
                <span className={`text-sm font-medium ${active ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
                {i < 2 && <div className="flex-1 h-px bg-slate-200 mx-2" />}
              </div>
            );
          })}
        </div>

        {/* ── ÉTAPE 1 : Saisie du numéro unique ── */}
        {etape === ETAPE.SAISIE && (
          <Card>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-[#135bec]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Hash className="w-10 h-10 text-[#135bec]" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Saisir le numéro unique</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
                Demandez au voyageur de vous présenter son billet électronique PDF.
                Saisissez le numéro unique affiché dessus.
              </p>
            </div>

            {/* Exemple de format */}
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 mb-6 text-center">
              <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Format du numéro</p>
              <p className="font-mono text-sm font-bold text-[#135bec]">GEN-WEB-20260321-BYDE-000142</p>
              <p className="text-xs text-slate-400 mt-1">AGENCE — WEB — DATE — FILIALE — SÉQUENCE</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Numéro unique du billet électronique
                </label>
                <input
                  value={numeroBillet}
                  onChange={e => setNumeroBillet(e.target.value.toUpperCase().trim())}
                  onKeyDown={e => e.key === "Enter" && numeroBillet.length > 10 && verifierBillet()}
                  placeholder="GEN-WEB-20260321-BYDE-000142"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-mono
                             focus:outline-none focus:border-[#135bec] focus:ring-0 transition-colors
                             placeholder-slate-300 tracking-widest"
                />
                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  Vérifiez également la CNI du voyageur avant de procéder
                </p>
              </div>

              <Button
                size="full"
                loading={isVerifying}
                disabled={numeroBillet.length < 10}
                onClick={() => verifierBillet()}
              >
                <Search className="w-4 h-4" />
                Vérifier le billet
              </Button>
            </div>
          </Card>
        )}

        {/* ── ÉTAPE 2 : Confirmation — vérification CNI ── */}
        {etape === ETAPE.CONFIRMATION && ticketInfo && (
          <Card>
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-800">Vérifiez l'identité du voyageur</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Comparez le nom affiché ci-dessous avec la CNI présentée avant de générer le billet d'embarquement.
                </p>
              </div>
            </div>

            {/* Infos du billet électronique */}
            <div className="bg-gradient-to-br from-[#135bec] to-blue-700 rounded-2xl p-6 text-white mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-blue-200 text-xs uppercase font-semibold">Billet électronique</p>
                  <p className="font-mono font-bold text-lg mt-0.5">{ticketInfo.numeroTicket}</p>
                </div>
                <Badge variant="primary" className="bg-white/20 text-white border-white/30">WEB</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: User, label: "Voyageur",    value: ticketInfo.nomVoyageur },
                  { icon: Bus,  label: "Bus",          value: ticketInfo.immatriculationBus },
                  { label: "Origine",     value: ticketInfo.origine     },
                  { label: "Destination", value: ticketInfo.destination },
                  { label: "Date départ", value: ticketInfo.dateDepart  },
                  { label: "Téléphone",   value: ticketInfo.telephoneVoyageur },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label}>
                    <p className="text-blue-300 text-xs uppercase">{label}</p>
                    <p className="font-semibold text-sm mt-0.5 flex items-center gap-1">
                      {Icon && <Icon className="w-3.5 h-3.5 opacity-70" />}
                      {value || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirmation CNI */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" id="cni-check" className="mt-0.5 rounded border-slate-300 text-[#135bec] w-4 h-4" />
                <span className="text-sm text-emerald-800 font-medium">
                  J'ai vérifié la CNI du voyageur et confirme que l'identité correspond au nom{" "}
                  <strong>« {ticketInfo.nomVoyageur} »</strong>
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" size="lg" className="flex-1" onClick={reset}>
                ← Annuler
              </Button>
              <Button
                size="lg"
                className="flex-1"
                loading={isGenerating}
                onClick={() => {
                  const checked = document.getElementById("cni-check")?.checked;
                  if (!checked) {
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

        {/* ── ÉTAPE 3 : Succès — billet d'embarquement généré ── */}
        {etape === ETAPE.SUCCES && billetEmbarquement && (
          <Card>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-xl">Billet d'embarquement émis !</h3>
              <p className="text-slate-500 text-sm mt-1">
                Remettez ce billet imprimé au voyageur — il peut embarquer dans le bus
              </p>
            </div>

            {/* Billet d'embarquement */}
            <div className="border-2 border-dashed border-emerald-300 rounded-2xl p-6 bg-emerald-50 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-emerald-600 uppercase font-bold">Billet d'embarquement</p>
                  <p className="font-mono font-extrabold text-xl text-slate-900 mt-1">
                    {billetEmbarquement.numeroTicket}
                  </p>
                </div>
                <div className="w-12 h-12 bg-white border-2 border-slate-200 rounded-xl flex items-center justify-center">
                  <span className="text-[#135bec] font-extrabold text-sm">EMB</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Passager",     billetEmbarquement.nomVoyageur],
                  ["Place",        billetEmbarquement.numeroPlace || "—"],
                  ["Origine",      billetEmbarquement.origine],
                  ["Destination",  billetEmbarquement.destination],
                  ["Date départ",  billetEmbarquement.dateDepart],
                  ["Bus",          billetEmbarquement.immatriculationBus],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs text-slate-400 uppercase">{l}</p>
                    <p className="font-semibold text-slate-900 mt-0.5">{v || "—"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button size="full" onClick={() => toast.success("Impression lancée…")}>
                🖨️ Imprimer le billet d'embarquement
              </Button>
              <Button variant="secondary" size="full" onClick={reset}>
                Nouveau voyageur
              </Button>
            </div>
          </Card>
        )}

        {/* ── ERREUR ── */}
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

        {/* Info box en bas */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-sm font-semibold text-[#135bec] mb-1">ℹ️ Rappel — Deux types de billets</p>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs font-bold text-slate-700 mb-1">📱 Billet électronique (WEB)</p>
              <p className="text-xs text-slate-500">Généré après paiement en ligne. Contient un numéro unique. <strong>Doit être converti</strong> en billet d'embarquement ici.</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs font-bold text-slate-700 mb-1">🖨️ Billet d'embarquement (GUICHET)</p>
              <p className="text-xs text-slate-500">Généré directement pour les réservations physiques à l'agence. <strong>Pas besoin de conversion.</strong></p>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

