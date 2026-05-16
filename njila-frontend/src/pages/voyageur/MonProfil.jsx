import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import { userService } from "../../services/userService";
import { useProfile } from "../../hooks/useProfile";
import PhotoUploader from "../../components/shared/PhotoUploader";
import PublicLayout from "../../components/layout/PublicLayout";
import { useNavigate } from "react-router-dom";
import {
  User, Mail, Phone, MapPin, ArrowLeft,
  Shield, Bell, ChevronRight, LogOut, Star, Ticket,
  Home, Search, Edit3, Check, X, Lock,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import toast from "react-hot-toast";

const MENU_ITEMS = [
  { icon: Bell,   label: "Notifications",       sub: "Gérez vos alertes email et SMS", action: null },
  { icon: Shield, label: "Sécurité",             sub: "Mot de passe, 2FA, sessions",   action: "securite" },
  { icon: Ticket, label: "Mes billets",           sub: "Historique complet",            action: "billets" },
  { icon: Star,   label: "Programme de fidélité", sub: "Voir mes points et avantages",  action: "fidelite" },
];

export default function MonProfil() {
  const { user: authUser, updateUser } = useAuthStore();
  const userId = authUser?.id;
  const { logout } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [editing, setEditing]   = useState(false);
  const [form,    setForm]      = useState(null);

  // ── Hook useProfile : gère la photo (updatePhoto + isUpdatingPhoto) ─────────
  const { updatePhoto, isUpdatingPhoto } = useProfile();

  // ── Source de vérité : user-service via React Query ───────────────────────
  const { data: profil, isLoading } = useQuery({
    queryKey: ["profil", userId],
    queryFn:  () => userService.getProfil(userId),
    enabled:  !!userId,
    staleTime: 0,
  });

  // ── Valeurs courantes du formulaire ────────────────────────────────────────
  const currentForm = form ?? {
    nom:       profil?.name    || "",
    prenom:    profil?.surname || "",
    telephone: profil?.phone   || "",
    adresse:   profil?.adresse || "",
  };

  // ── Photo courante : préférer la donnée fraîche du profil, sinon le store ──
  const photoUrl =
    profil?.photoProfil ||
    profil?.photo_url   ||
    authUser?.photoUrl  ||
    null;

  // ── Initiales fallback ──────────────────────────────────────────────────────
  const initiales = `${
    profil?.name?.[0] || authUser?.name?.[0] || ""
  }${
    profil?.surname?.[0] || authUser?.surname?.[0] || ""
  }`.toUpperCase() || "?";

  // ── Callback appelé par PhotoUploader quand Cloudinary retourne l'URL ──────
  // PhotoUploader appelle onUploaded(cloudinaryUrl) — une string brute.
  // On délègue à useProfile.updatePhoto qui construit { photoProfil: url }
  // et appelle PATCH /api/users/{id}/photo.
  const handlePhotoUploaded = (cloudinaryUrl) => {
    updatePhoto(cloudinaryUrl, {
      onSuccess: (data) => {
        // Sync store pour affichage immédiat dans la sidebar / navbar
        const newUrl = data?.photoProfil ?? data?.photo_url ?? cloudinaryUrl;
        updateUser({ photoUrl: newUrl });
        // Invalider aussi la query locale de cette page
        qc.invalidateQueries({ queryKey: ["profil", userId] });
      },
    });
  };

  // ── Mutation : mise à jour des champs texte du profil ─────────────────────
  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      userService.updateProfil(
        userId,
        {
          name:    currentForm.nom,
          surname: currentForm.prenom,
          phone:   currentForm.telephone,
          adresse: currentForm.adresse,
        },
        true, // skipRefresh
      ),
    onSuccess: () => {
      setEditing(false);
      setForm(null);
      toast.success("Profil mis à jour !");
      qc.invalidateQueries({ queryKey: ["profil", userId] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto px-4 py-10 flex justify-center">
          <div className="w-8 h-8 border-4 border-[#135bec] border-t-transparent rounded-full animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pg  { animation: fadeSlideUp .35s ease both; }
        .pg2 { animation: fadeSlideUp .35s .07s ease both; }
        .pg3 { animation: fadeSlideUp .35s .14s ease both; }
        .pg4 { animation: fadeSlideUp .35s .21s ease both; }
        .pg5 { animation: fadeSlideUp .35s .28s ease both; }
      `}</style>

      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="pg flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/voyageur")}
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
            aria-label="Retour au dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">Mon Profil</h1>
        </div>

        {/* ── Carte avatar + formulaire ────────────────────────────────────── */}
        <div className="pg2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-4 mb-6">

            {/* ── PhotoUploader ─────────────────────────────────────────────
                currentUrl   : URL actuelle (Cloudinary ou DB)
                initiales    : fallback texte si pas de photo
                onUploaded   : reçoit l'URL Cloudinary et déclenche le PATCH
                folder       : dossier Cloudinary
                size / shape : dimensions et forme du composant
                bgColor      : couleur de fond quand pas de photo
            ─────────────────────────────────────────────────────────────── */}
            <PhotoUploader
              currentUrl={photoUrl}
              initiales={initiales}
              onUploaded={handlePhotoUploaded}
              folder="profiles"
              size="w-20 h-20"
              shape="rounded-2xl"
              bgColor="bg-gradient-to-br from-[#135bec] to-blue-700"
            />

            {/* ── Infos utilisateur ────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-extrabold text-slate-900 truncate">
                {profil?.surname || authUser?.surname}{" "}
                {profil?.name    || authUser?.name}
              </h2>
              <p className="text-sm text-slate-400 truncate mt-0.5">
                {profil?.email || authUser?.email}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-xs text-emerald-600 font-semibold">Compte vérifié</span>
              </div>
            </div>

            {/* ── Bouton édition ────────────────────────────────────────────── */}
            <button
              onClick={() => { setEditing(!editing); setForm(null); }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                editing
                  ? "bg-red-50 text-red-500 hover:bg-red-100"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
              aria-label={editing ? "Annuler l'édition" : "Modifier le profil"}
            >
              {editing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            </button>
          </div>

          {/* Indicateur upload photo en cours */}
          {isUpdatingPhoto && (
            <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="w-4 h-4 border-2 border-[#135bec] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-sm text-[#135bec] font-medium">
                Mise à jour de la photo en cours…
              </span>
            </div>
          )}

          {/* ── Champs du formulaire ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "nom",       label: "Nom",      icon: User,   placeholder: "Dupont" },
              { key: "prenom",    label: "Prénom",    icon: User,   placeholder: "Jean" },
              { key: "telephone", label: "Téléphone", icon: Phone,  placeholder: "+237 6XX XXX XXX" },
              { key: "adresse",   label: "Adresse",   icon: MapPin, placeholder: "Akwa, Douala" },
            ].map(({ key, label, icon: Icon, placeholder }) => (
              <div key={key}>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {label}
                </label>
                {editing ? (
                  <div className="relative">
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={currentForm[key]}
                      onChange={e =>
                        setForm(f => ({ ...(f ?? currentForm), [key]: e.target.value }))
                      }
                      placeholder={placeholder}
                      className="w-full pl-9 pr-4 py-2.5 border-2 border-[#135bec]/30 rounded-xl text-sm focus:outline-none focus:border-[#135bec] bg-blue-50/30 transition-colors"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-xl">
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 truncate">
                      {currentForm[key] || "—"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Email (lecture seule) */}
          <div className="mt-4">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-xl">
              <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-sm text-slate-700 truncate">
                {profil?.email || authUser?.email || "—"}
              </span>
              <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Vérifié
              </span>
            </div>
          </div>

          {/* Bouton sauvegarder (visible uniquement en mode édition) */}
          {editing && (
            <button
              onClick={() => save()}
              disabled={isPending}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-[#135bec] text-white font-bold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors active:scale-[0.99]"
            >
              {isPending
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Check className="w-4 h-4" />}
              {isPending ? "Sauvegarde…" : "Sauvegarder les modifications"}
            </button>
          )}
        </div>

        {/* ── Menu items ──────────────────────────────────────────────────── */}
        <div className="pg3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">
          {MENU_ITEMS.map(({ icon: Icon, label, sub, action }, i) => (
            <button
              key={label}
              onClick={() => {
                if (action === "billets") navigate("/voyageur/reservations");
              }}
              className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left active:bg-slate-100 ${
                i < MENU_ITEMS.length - 1 ? "border-b border-slate-50" : ""
              }`}
            >
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          ))}
        </div>

        {/* ── Sécurité ────────────────────────────────────────────────────── */}
        <div className="pg4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
          <h3 className="font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#135bec]" /> Sécurité du compte
          </h3>
          <div className="space-y-3">
            {[
              { label: "Mot de passe",            sub: "Dernière modification : il y a 30 jours" },
              { label: "Double authentification", sub: "Code SMS à la connexion" },
            ].map(({ label, sub }) => (
              <div key={label} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
                </div>
                <button className="text-xs font-bold text-[#135bec] hover:underline">Modifier</button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Déconnexion ──────────────────────────────────────────────────── */}
        <button
          onClick={logout}
          className="pg5 w-full flex items-center justify-center gap-2 py-4 text-red-500 font-bold text-sm bg-red-50 rounded-2xl border border-red-100 hover:bg-red-100 transition-colors active:scale-[0.99]"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>

        {/* Espace nav mobile */}
        <div className="h-20 md:hidden" />
      </div>

      {/* ── Navigation mobile ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-slate-100 z-50">
        <div className="grid grid-cols-4 px-2">
          {[
            { icon: Home,   label: "Accueil",  path: "/voyageur" },
            { icon: Search, label: "Recherche", path: "/recherche" },
            { icon: Ticket, label: "Billets",   path: "/voyageur/reservations" },
            { icon: User,   label: "Profil",    path: "/voyageur/profil" },
          ].map(({ icon: Icon, label, path }) => {
            const active = window.location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center justify-center py-3 gap-1 ${
                  active ? "text-[#135bec]" : "text-slate-400"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </PublicLayout>
  );
}
