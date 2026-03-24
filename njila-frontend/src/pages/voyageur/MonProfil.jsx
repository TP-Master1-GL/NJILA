import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import { userService } from "../../services/userService";
import PublicLayout from "../../components/layout/PublicLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { User, Mail, Phone, MapPin, Camera, Save } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { formatDate } from "../../utils/formatters";

export default function MonProfil() {
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nom: user?.nom || "", prenom: user?.prenom || "", telephone: user?.telephone || "", adresse: user?.adresse || "" });

  const { mutate: saveProfile, isPending } = useMutation({
    mutationFn: () => userService.updateProfil(user.id, form),
    onSuccess: (data) => {
      setUser({ ...user, ...data });
      setEditing(false);
      toast.success("Profil mis à jour !");
      qc.invalidateQueries(["profil", user.id]);
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-8">Mon Profil</h1>

        <Card className="mb-6">
          {/* Avatar */}
          <div className="flex items-center gap-5 mb-6 pb-6 border-b border-slate-100">
            <div className="relative">
              <div className="w-20 h-20 bg-[#135bec] rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold">
                {user?.nom?.[0]}{user?.prenom?.[0]}
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-50">
                <Camera className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
            <div>
              <p className="text-xl font-extrabold text-slate-900">{user?.nom} {user?.prenom}</p>
              <p className="text-slate-500 text-sm">{user?.email}</p>
              <p className="text-xs text-slate-400 mt-1">Membre depuis {user?.dateInscription ? formatDate(user.dateInscription) : "2026"}</p>
            </div>
            <div className="ml-auto">
              {!editing ? (
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Modifier</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
                  <Button size="sm" loading={isPending} onClick={() => saveProfile()}>
                    <Save className="w-4 h-4" /> Sauvegarder
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Infos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { label: "Nom",        field: "nom",       icon: User,  type: "text" },
              { label: "Prénom",     field: "prenom",    icon: User,  type: "text" },
              { label: "Téléphone",  field: "telephone", icon: Phone, type: "tel"  },
              { label: "Adresse",    field: "adresse",   icon: MapPin,type: "text" },
            ].map(({ label, field, icon: Icon, type }) => (
              editing ? (
                <Input key={field} label={label} type={type} icon={Icon}
                  value={form[field]} onChange={e => setForm(f => ({...f, [field]: e.target.value}))} />
              ) : (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">{label}</label>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 rounded-lg">
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">{form[field] || "—"}</span>
                  </div>
                </div>
              )
            ))}
          </div>
        </Card>

        {/* Sécurité */}
        <Card>
          <h3 className="font-bold text-slate-900 mb-4">Sécurité</h3>
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-700">Mot de passe</p>
              <p className="text-xs text-slate-400">Dernière modification il y a 30 jours</p>
            </div>
            <Button variant="secondary" size="sm">Modifier</Button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Double authentification</p>
              <p className="text-xs text-slate-400">Sécurisez votre compte avec un code SMS</p>
            </div>
            <Button variant="secondary" size="sm">Activer</Button>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}
