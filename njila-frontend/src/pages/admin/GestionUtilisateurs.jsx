import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, User, Shield, UserX, Trash2, X, ChevronRight,
  Building2, MapPin, Phone, Mail, Calendar, CheckCircle,
  XCircle, AlertTriangle, RefreshCw, Eye, ArrowLeft,
  ChevronsUpDown, ChevronUp, ChevronDown, Download,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Spinner from "../../components/ui/Spinner";
import { userService } from "../../services/userService";
import { agenceService } from "../../services/agenceService";
import { filialeService } from "../../services/filialeService";
import { formatDate } from "../../utils/formatters";

// ─── Config rôles ─────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  VOYAGEUR:       { label: "Voyageur",       color: "#64748b", bg: "#f1f5f9", dot: "#94a3b8" },
  GUICHETIER:     { label: "Guichetier",     color: "#0369a1", bg: "#e0f2fe", dot: "#38bdf8" },
  CHAUFFEUR:      { label: "Chauffeur",      color: "#7c3aed", bg: "#ede9fe", dot: "#a78bfa" },
  MANAGER_LOCAL:  { label: "Manager Local",  color: "#065f46", bg: "#d1fae5", dot: "#34d399" },
  MANAGER_GLOBAL: { label: "Manager Global", color: "#92400e", bg: "#fef3c7", dot: "#fbbf24" },
  ADMINISTRATEUR: { label: "Administrateur", color: "#991b1b", bg: "#fee2e2", dot: "#f87171" },
  ADMIN:          { label: "Administrateur", color: "#991b1b", bg: "#fee2e2", dot: "#f87171" },
};

const ROLES_WITH_AGENCE  = ["MANAGER_GLOBAL", "MANAGER_LOCAL", "GUICHETIER", "CHAUFFEUR"];
const ROLES_WITH_FILIALE = ["MANAGER_LOCAL", "GUICHETIER", "CHAUFFEUR"];

// ─── Export PDF ───────────────────────────────────────────────────────────────
function exportPDF(users) {
  const now  = new Date().toLocaleDateString("fr-FR");
  const rows = users.map(u => `
    <tr>
      <td>${u.name || ""} ${u.surname || ""}</td>
      <td>${u.email || "—"}</td>
      <td>${ROLE_CONFIG[u.role]?.label || u.role || "—"}</td>
      <td>${u.isActive !== false ? "Actif" : "Inactif"}</td>
      <td>${u.dateInscription ? u.dateInscription.slice(0,10) : "—"}</td>
    </tr>`).join("");

  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>Rapport Utilisateurs NJILA – ${now}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:28px}
      h1{font-size:18px;color:#135bec;margin-bottom:4px;font-weight:800}
      .sub{color:#64748b;font-size:10px;margin-bottom:18px}
      table{width:100%;border-collapse:collapse}
      th{background:#135bec;color:#fff;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase}
      td{padding:6px 10px;border-bottom:1px solid #f1f5f9}
      tr:nth-child(even) td{background:#f8fafc}
      .footer{margin-top:20px;text-align:center;color:#94a3b8;font-size:9px;padding-top:10px;border-top:1px solid #f1f5f9}
      @media print{body{padding:0}}
    </style>
  </head><body>
    <h1>Rapport des Utilisateurs — NJILA Admin</h1>
    <p class="sub">Généré le ${now} · ${users.length} utilisateur${users.length > 1 ? "s" : ""}</p>
    <table>
      <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Inscription</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">NJILA Platform · Rapport confidentiel · ${now}</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ─── Composants utilitaires ───────────────────────────────────────────────────
function RolePill({ role }) {
  const cfg = ROLE_CONFIG[role] || { label: role, color: "#334155", bg: "#f1f5f9", dot: "#94a3b8" };
  return (
    <span style={{ backgroundColor: cfg.bg, color: cfg.color }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold">
      <span style={{ backgroundColor: cfg.dot }} className="w-1.5 h-1.5 rounded-full" />
      {cfg.label}
    </span>
  );
}

function Avatar({ name, surname, size = "md" }) {
  const initials = `${name?.[0] || ""}${surname?.[0] || ""}`.toUpperCase() || "?";
  const sz = size === "lg" ? "w-14 h-14 text-lg" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} rounded-xl bg-gradient-to-br from-[#135bec] to-[#0d4bc4] flex items-center justify-center text-white font-bold shrink-0 shadow-sm`}>
      {initials}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono = false }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <p className={`text-sm text-slate-800 font-medium mt-0.5 truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── Icône de tri de colonne ──────────────────────────────────────────────────
function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-slate-300 ml-1" />;
  return sortDir === "asc"
    ? <ChevronUp   className="w-3 h-3 text-[#135bec] ml-1" />
    : <ChevronDown className="w-3 h-3 text-[#135bec] ml-1" />;
}

// ─── Panneau détail utilisateur ───────────────────────────────────────────────
function UserDetailPanel({ user, onClose, onDelete, onToggleActive }) {
  const role      = user?.role;
  const hasAgence  = ROLES_WITH_AGENCE.includes(role);
  const hasFiliale = ROLES_WITH_FILIALE.includes(role);

  // Profil complet (contient agenceId / filialeId pour les staff)
  const { data: profil, isLoading: loadingProfil } = useQuery({
    queryKey: ["profil", user?.idUser],
    queryFn:  () => userService.getProfil(user.idUser),
    enabled:  !!user?.idUser,
  });

  // Pour MANAGER_GLOBAL : l'agenceId est dans le profil directement
  const agenceId  = profil?.agenceId  || profil?.agence_id  || user?.agenceId;
  const filialeId = profil?.filialeId || profil?.filiale_id || user?.filialeId;

  const { data: agence, isLoading: loadingAgence } = useQuery({
    queryKey: ["agence-detail", agenceId],
    queryFn:  () => agenceService.getAgenceDetail(agenceId),
    enabled:  hasAgence && !!agenceId,
  });

  const { data: filiale, isLoading: loadingFiliale } = useQuery({
    queryKey: ["filiale-detail", filialeId],
    queryFn:  () => filialeService.getFilialeDetail(filialeId),
    enabled:  hasFiliale && !!filialeId,
  });

  const isLoading = loadingProfil
    || (hasAgence  && !!agenceId  && loadingAgence)
    || (hasFiliale && !!filialeId && loadingFiliale);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col h-full animate-slide-in">

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="text-sm font-semibold text-slate-700">Détail utilisateur</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="w-6 h-6 text-[#135bec] animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-400">Chargement du profil…</p>
            </div>
          </div>
        ) : (
          <>
            {/* Identité */}
            <div className="p-5 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100 shrink-0">
              <div className="flex items-start gap-4">
                <Avatar name={user.name} surname={user.surname} size="lg" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-base truncate">{user.name} {user.surname}</h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <RolePill role={role} />
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.isActive !== false ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                    }`}>
                      {user.isActive !== false
                        ? <><CheckCircle className="w-3 h-3" />Actif</>
                        : <><XCircle    className="w-3 h-3" />Inactif</>}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Infos */}
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Coordonnées</p>
              <div className="bg-slate-50 rounded-xl px-4 py-1 mb-4">
                <InfoRow icon={Mail}     label="Email"               value={user.email} />
                <InfoRow icon={Phone}    label="Téléphone"           value={profil?.phone || user.phone} />
                <InfoRow icon={MapPin}   label="Adresse"             value={profil?.adresse || user.adresse} />
                <InfoRow icon={Calendar} label="Inscrit le"          value={user.dateInscription ? formatDate(user.dateInscription) : null} />
                <InfoRow icon={Calendar} label="Dernière connexion"  value={user.derniereConnexion ? formatDate(user.derniereConnexion) : null} />
              </div>

              {hasAgence && (
                <>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Affectation</p>
                  <div className="bg-slate-50 rounded-xl px-4 py-1 mb-4">
                    {/* Agence */}
                    {agence ? (
                      <InfoRow icon={Building2} label="Agence" value={agence.name || agence.nom} />
                    ) : agenceId ? (
                      <div className="py-2.5 flex items-center gap-2 border-b border-slate-100">
                        <RefreshCw className="w-3.5 h-3.5 text-slate-300 animate-spin" />
                        <span className="text-xs text-slate-400 italic">Chargement de l'agence…</span>
                      </div>
                    ) : (
                      <div className="py-2.5 text-xs text-slate-400 italic border-b border-slate-100 last:border-0">Aucune agence assignée</div>
                    )}

                    {/* Filiale */}
                    {hasFiliale && (
                      filiale ? (
                        <>
                          <InfoRow icon={MapPin} label="Filiale" value={filiale.nom} />
                          <InfoRow icon={MapPin} label="Ville"   value={filiale.ville} />
                        </>
                      ) : filialeId ? (
                        <div className="py-2.5 flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 text-slate-300 animate-spin" />
                          <span className="text-xs text-slate-400 italic">Chargement de la filiale…</span>
                        </div>
                      ) : (
                        <div className="py-2.5 text-xs text-slate-400 italic">Aucune filiale assignée</div>
                      )
                    )}
                  </div>
                </>
              )}

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Identifiant</p>
              <div className="bg-slate-50 rounded-xl px-4 py-1">
                <InfoRow icon={Shield} label="UUID" value={user.idUser} mono />
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-slate-100 space-y-2 shrink-0">
              <button onClick={() => onToggleActive(user)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border transition-colors ${
                  user.isActive !== false
                    ? "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
                    : "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                }`}>
                {user.isActive !== false
                  ? <><UserX className="w-4 h-4" />Désactiver le compte</>
                  : <><CheckCircle className="w-4 h-4" />Réactiver le compte</>}
              </button>
              <button onClick={() => onDelete(user)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                <Trash2 className="w-4 h-4" />Supprimer le compte
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Modal confirmation suppression ──────────────────────────────────────────
function ConfirmDeleteModal({ user, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-base font-bold text-slate-900 text-center mb-1">Confirmer la suppression</h3>
        <p className="text-sm text-slate-500 text-center mb-5">
          Supprimer définitivement le compte de{" "}
          <span className="font-semibold text-slate-700">{user?.name} {user?.surname}</span> ?
          Cette action est irréversible.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-70 flex items-center justify-center gap-2">
            {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function GestionUtilisateurs() {
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState("all");
  const [page,         setPage]         = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);

  // Tri
  const [sortField, setSortField] = useState("dateInscription");
  const [sortDir,   setSortDir]   = useState("desc");

  const queryClient = useQueryClient();

  // ── Chargement ──────────────────────────────────────────────────────────
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["utilisateurs", page, search, roleFilter],
    queryFn:  () => userService.getUtilisateurs({ page, search: search || undefined, limit: 20 }),
    keepPreviousData: true,
  });

  // ── Filtre + tri ─────────────────────────────────────────────────────────
  const filteredSorted = useMemo(() => {
    let list = roleFilter === "all" ? users : users.filter(u => u.role === roleFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        (u.name    || "").toLowerCase().includes(q) ||
        (u.surname || "").toLowerCase().includes(q) ||
        (u.email   || "").toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      let va, vb;
      switch (sortField) {
        case "name":
          va = `${a.name||""} ${a.surname||""}`.toLowerCase();
          vb = `${b.name||""} ${b.surname||""}`.toLowerCase();
          break;
        case "email":
          va = a.email || ""; vb = b.email || "";
          break;
        case "role":
          va = a.role || ""; vb = b.role || "";
          break;
        case "isActive":
          va = a.isActive !== false ? 1 : 0;
          vb = b.isActive !== false ? 1 : 0;
          break;
        case "dateInscription":
        default:
          va = a.dateInscription || ""; vb = b.dateInscription || "";
      }
      if (va < vb) return sortDir === "asc" ? -1 :  1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [users, roleFilter, search, sortField, sortDir]);

  // ── Handler tri ──────────────────────────────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // ── Suppression ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (userId) => userService.deleteUtilisateur(userId),
    onSuccess: () => {
      queryClient.invalidateQueries(["utilisateurs"]);
      setUserToDelete(null);
      setSelectedUser(null);
    },
  });

  const handleToggleActive = (user) => {
    // TODO : PATCH /api/users/{id} avec { isActive: !user.isActive }
    console.log("Toggle actif pour", user.idUser);
  };

  const handleSearch      = (e) => { setSearch(e.target.value); setPage(1); };
  const handleRoleFilter  = (e) => { setRoleFilter(e.target.value); setPage(1); };

  // ── Header de colonne triable ─────────────────────────────────────────────
  const ThSort = ({ field, children }) => (
    <th
      onClick={() => handleSort(field)}
      className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-slate-600 select-none group"
    >
      <span className="flex items-center gap-0.5">
        {children}
        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </span>
    </th>
  );

  return (
    <DashboardLayout>
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.25s cubic-bezier(.16,1,.3,1) both; }
      `}</style>

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Gestion des Utilisateurs</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {isLoading ? "Chargement…" : `${filteredSorted.length} utilisateur${filteredSorted.length > 1 ? "s" : ""} affiché${filteredSorted.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => exportPDF(filteredSorted)}
          disabled={filteredSorted.length === 0}
          title="Télécharger rapport PDF"
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" /> Rapport PDF
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-red-700 text-sm">{error.message}</p>
        </div>
      )}

      <Card padding={false}>
        {/* Filtres */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={handleSearch} placeholder="Rechercher un utilisateur…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]/30 focus:border-[#135bec] transition-all bg-slate-50" />
          </div>
          <select value={roleFilter} onChange={handleRoleFilter}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#135bec]/30 focus:border-[#135bec] transition-all">
            <option value="all">Tous les rôles</option>
            <option value="VOYAGEUR">Voyageur</option>
            <option value="GUICHETIER">Guichetier</option>
            <option value="CHAUFFEUR">Chauffeur</option>
            <option value="MANAGER_LOCAL">Manager Local</option>
            <option value="MANAGER_GLOBAL">Manager Global</option>
            <option value="ADMINISTRATEUR">Administrateur</option>
          </select>
        </div>

        {/* Tableau */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <RefreshCw className="w-7 h-7 text-[#135bec] animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">Chargement des utilisateurs…</p>
            </div>
          </div>
        ) : filteredSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-medium text-slate-500">Aucun utilisateur trouvé</p>
            <p className="text-sm mt-1">Essayez de modifier vos filtres</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <ThSort field="name">Utilisateur</ThSort>
                  <ThSort field="email">Email</ThSort>
                  <ThSort field="role">Rôle</ThSort>
                  <ThSort field="isActive">Statut</ThSort>
                  <ThSort field="dateInscription">Inscription</ThSort>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSorted.map((user) => (
                  <tr key={user.idUser}
                    className={`group hover:bg-[#135bec]/[0.02] transition-colors cursor-pointer ${
                      selectedUser?.idUser === user.idUser ? "bg-[#135bec]/[0.03]" : ""
                    }`}
                    onClick={() => setSelectedUser(user)}>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} surname={user.surname} />
                        <div>
                          <p className="font-semibold text-slate-900 text-sm leading-tight">{user.name} {user.surname}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{user.phone || "—"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-sm text-slate-500 max-w-[200px]">
                      <span className="truncate block">{user.email}</span>
                    </td>

                    <td className="px-5 py-3.5"><RolePill role={user.role} /></td>

                    <td className="px-5 py-3.5">
                      {user.isActive !== false ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" />Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                          <XCircle className="w-3 h-3" />Inactif
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-sm text-slate-400 whitespace-nowrap">
                      {user.dateInscription ? formatDate(user.dateInscription) : "—"}
                    </td>

                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedUser(user)} title="Voir les détails"
                          className="p-1.5 hover:bg-[#135bec]/10 rounded-lg transition-colors text-[#135bec] opacity-0 group-hover:opacity-100">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleActive(user)}
                          title={user.isActive !== false ? "Désactiver" : "Activer"}
                          className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                          <UserX className="w-4 h-4 text-amber-500" />
                        </button>
                        <button onClick={() => setUserToDelete(user)} title="Supprimer"
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && filteredSorted.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Page <span className="font-semibold text-slate-600">{page}</span> · {filteredSorted.length} résultat{filteredSorted.length > 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
                ← Précédent
              </button>
              <button onClick={() => setPage(page + 1)} disabled={users.length < 20}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
                Suivant →
              </button>
            </div>
          </div>
        )}
      </Card>

      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onDelete={(u) => setUserToDelete(u)}
          onToggleActive={handleToggleActive}
        />
      )}

      {userToDelete && (
        <ConfirmDeleteModal
          user={userToDelete}
          isDeleting={deleteMutation.isLoading}
          onConfirm={() => deleteMutation.mutate(userToDelete.idUser)}
          onCancel={() => setUserToDelete(null)}
        />
      )}
    </DashboardLayout>
  );
}