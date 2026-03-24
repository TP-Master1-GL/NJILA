import { Download, Printer, CheckCircle, Clock, XCircle } from "lucide-react";
import Badge from "../ui/Badge";
import { formatDate } from "../../utils/formatters";

const statutConfig = {
  ACTIF:    { label: "Actif",    variant: "success", icon: CheckCircle },
  VERIFIE:  { label: "Vérifié", variant: "primary",  icon: CheckCircle },
  EMBARQUEE:{ label: "Embarqué", variant: "gray",    icon: CheckCircle },
  ANNULE:   { label: "Annulé",   variant: "danger",  icon: XCircle     },
};

export default function TicketCard({ ticket, onDownload, onPrint }) {
  const cfg  = statutConfig[ticket.statut] || { label: ticket.statut, variant: "gray" };
  const Icon = cfg.icon || Clock;
  const isWEB = ticket.type === "WEB";

  return (
    <div className={`rounded-2xl overflow-hidden border-2 ${isWEB ? "border-[#135bec]/30" : "border-emerald-300"}`}>
      {/* Header coloré */}
      <div className={`px-5 py-3 flex items-center justify-between ${isWEB ? "bg-[#135bec]" : "bg-emerald-600"}`}>
        <div>
          <p className="text-white/70 text-xs uppercase font-semibold">
            {isWEB ? "Billet électronique" : "Billet d'embarquement"}
          </p>
          <p className="text-white font-mono font-bold text-sm mt-0.5">{ticket.numeroTicket}</p>
        </div>
        <Badge variant="primary" className="bg-white/20 text-white border-white/30 text-xs">
          {isWEB ? "WEB" : "EMB"}
        </Badge>
      </div>

      {/* Corps */}
      <div className="bg-white p-5">
        {/* Trajet */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-slate-900">
              {ticket.origine?.slice(0, 3).toUpperCase() || "DLA"}
            </p>
            <p className="text-xs text-slate-400">{ticket.origine}</p>
          </div>
          <div className="flex-1 flex items-center gap-2 px-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="material-icons text-slate-300 text-base">directions_bus</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-slate-900">
              {ticket.destination?.slice(0, 3).toUpperCase() || "YDE"}
            </p>
            <p className="text-xs text-slate-400">{ticket.destination}</p>
          </div>
        </div>

        {/* Infos */}
        <div className="grid grid-cols-2 gap-3 py-3 border-t border-b border-dashed border-slate-200 mb-4">
          {[
            ["Voyageur",  ticket.nomVoyageur],
            ["Date",      ticket.dateDepart],
            ["Bus",       ticket.immatriculationBus],
            ["Statut",    "—"],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">{l}</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{v || "—"}</p>
            </div>
          ))}
        </div>

        {/* Statut */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <Icon className="w-4 h-4 text-slate-500" />
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>
          <p className="text-xs text-slate-400">{formatDate(ticket.dateEmission)}</p>
        </div>

        {/* Avertissement WEB */}
        {isWEB && ticket.statut === "ACTIF" && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4 text-xs text-amber-800">
            ⚠️ Présentez ce billet + votre CNI au guichetier pour obtenir votre billet d'embarquement.
          </div>
        )}

        {/* Actions */}
        {isWEB && (
          <div className="flex gap-2">
            {onDownload && (
              <button onClick={onDownload}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#135bec] text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors">
                <Download className="w-3.5 h-3.5" /> Télécharger PDF
              </button>
            )}
            {onPrint && (
              <button onClick={onPrint}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors">
                <Printer className="w-3.5 h-3.5" /> Imprimer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
