import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import { userService } from "../../services/userService";
import PublicLayout from "../../components/layout/PublicLayout";
import { useNavigate } from "react-router-dom";
import {
  User, Mail, Phone, MapPin, Camera, Save, ArrowLeft,
  Shield, Bell, ChevronRight, LogOut, Star, Ticket,
  Home, Search, Edit3, Check, X, Lock, Eye, EyeOff
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import toast from "react-hot-toast";

const MENU_ITEMS = [
  { icon: Bell,    label: "Notifications",        sub: "Gérez vos alertes email et SMS", action: null },
  { icon: Shield,  label: "Sécurité",              sub: "Mot de passe, 2FA, sessions",   action: "securite" },
  { icon: Ticket,  label: "Mes billets",            sub: "Historique complet",            action: "billets" },
  { icon: Star,    label: "Programme de fidélité",  sub: "Voir mes points et avantages",  action: "fidelite" },
];

export default function MonProfil() {
  const { user, setUser } = useAuthStore();
  const { logout } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    nom:       user?.nom      || "",
    prenom:    user?.prenom   || "",
    telephone: user?.telephone|| "",
    adresse:   user?.adresse  || "",
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => userService.updateProfil(user.id, form),
    onSuccess: (data) => {
      setUser({ ...user, ...data });
      setEditing(false);
      toast.success("Profil mis à jour !");
      qc.invalidateQueries(["profil"]);
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const initiales = `${user?.nom?.[0] || ""}${user?.prenom?.[0] || ""}`.toUpperCase();

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">

        {/* Header mobile */}
        <div className="flex items-center gap-3 mb-6 md:hidden">
          <button onClick={() => navigate("/voyageur")} className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h1 className="text-xl font-extrabold text-slate-900">Mon Profil</h1>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 mb-6 hidden md:block">Mon Profil</h1>

        {/* ── Avatar card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 bg-gradient-to-br from-[#135bec] to-blue-700 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-lg shadow-[#135bec]/30">
                {initiales}
              </div>
              <button className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-white border-2 border-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-50 shadow-sm">
                <Camera className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-extrabold text-slate-900 truncate">
                {user?.prenom} {user?.nom}
              </h2>
              <p className="text-sm text-slate-400 truncate mt-0.5">{user?.email}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-xs text-emerald-600 font-semibold">Compte vérifié</span>
              </div>
            </div>
            <button
              onClick={() => setEditing(!editing)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                editing ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {editing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            </button>
          </div>

          {/* Champs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "nom",       label: "Nom",       icon: User,  placeholder: "Dupont" },
              { key: "prenom",    label: "Prénom",     icon: User,  placeholder: "Jean" },
              { key: "telephone", label: "Téléphone",  icon: Phone, placeholder: "+237 6XX XXX XXX" },
              { key: "adresse",   label: "Adresse",    icon: MapPin, placeholder: "Akwa, Douala" },
            ].map(({ key, label, icon: Icon, placeholder }) => (
              <div key={key}>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
                {editing ? (
                  <div className="relative">
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full pl-9 pr-4 py-2.5 border-2 border-[#135bec]/30 rounded-xl text-sm focus:outline-none focus:border-[#135bec] bg-blue-50/30 transition-colors"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-xl">
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 truncate">{form[key] || "—"}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Email (readonly) */}
          <div className="mt-4">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-xl">
              <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-sm text-slate-700 truncate">{user?.email || "—"}</span>
              <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Vérifié</span>
            </div>
          </div>

          {editing && (
            <button
              onClick={() => save()}
              disabled={isPending}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-[#135bec] text-white font-bold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isPending ? "Sauvegarde..." : "Sauvegarder les modifications"}
            </button>
          )}
        </div>

        {/* ── Menu items ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">
          {MENU_ITEMS.map(({ icon: Icon, label, sub, action }, i) => (
            <button
              key={label}
              onClick={() => action === "billets" ? navigate("/voyageur/reservations") : null}
              className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left ${
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

        {/* ── Sécurité card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
          <h3 className="font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#135bec]" /> Sécurité du compte
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-800">Mot de passe</p>
                <p className="text-xs text-slate-400 mt-0.5">Dernière modification : il y a 30 jours</p>
              </div>
              <button className="text-xs font-bold text-[#135bec] hover:underline">Modifier</button>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-800">Double authentification</p>
                <p className="text-xs text-slate-400 mt-0.5">Code SMS à la connexion</p>
              </div>
              <button className="text-xs font-bold text-[#135bec] hover:underline">Activer</button>
            </div>
          </div>
        </div>

        {/* ── Déconnexion ── */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-4 text-red-500 font-bold text-sm bg-red-50 rounded-2xl border border-red-100 hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>

        {/* Mobile bottom spacer */}
        <div className="h-20 md:hidden" />
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-slate-100 z-50">
        <div className="grid grid-cols-4 px-2">
          {[
            { icon: Home,   label: "Accueil",  path: "/voyageur" },
            { icon: Search, label: "Recherche",path: "/recherche" },
            { icon: Ticket, label: "Billets",  path: "/voyageur/reservations" },
            { icon: User,   label: "Profil",   path: "/voyageur/profil" },
          ].map(({ icon: Icon, label, path }) => {
            const active = window.location.pathname === path;
            return (
              <button key={path} onClick={() => navigate(path)}
                className={`flex flex-col items-center justify-center py-3 gap-1 ${active ? "text-[#135bec]" : "text-slate-400"}`}>
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