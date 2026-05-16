/**
 * GestionChauffeurs.jsx – Manager Local
 * Données réelles via userService pour les chauffeurs (GET/POST /api/users/filiales/{filialeId}/chauffeurs)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, MoreVertical, User, Phone, AlertCircle, Mail, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { userService } from "../../services/userService";
import { useAuthStore } from "../../store/authStore";

const statutConfig = {
  true: { label: "Disponible", variant: "success" },
  false: { label: "En mission", variant: "primary" },
};
const FORM_INIT = {
  name: "",
  surname: "",
  phone: "",
  email: "",
  numeroPermis: "",
  Adresse: "",
  date_embauche: "",
};

export default function GestionChauffeurs() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(FORM_INIT);

  const filialeId = user?.filialeId;

  // GET /api/users/filiales/{filialeId}/chauffeurs
  const { data: chauffeurs = [], isLoading, isError } = useQuery({
    queryKey: ["chauffeurs-filiale", filialeId],
    queryFn: () => userService.listChauffeursByFiliale(filialeId),
    enabled: !!filialeId,
    retry: 1,
  });

  // POST /api/users/filiales/{filialeId}/chauffeurs
  const { mutate: creerChauffeur, isPending } = useMutation({
    mutationFn: (payload) => userService.createChauffeur(filialeId, payload),
    onSuccess: () => {
      toast.success("Chauffeur créé et email d'invitation envoyé !");
      qc.invalidateQueries({ queryKey: ["chauffeurs-filiale", filialeId] });
      setIsModalOpen(false);
      setForm(FORM_INIT);
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Erreur lors de la création du chauffeur."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.numeroPermis)
      return toast.error("Nom, téléphone et numéro de permis requis.");
    if (!form.email)
      return toast.error("Email requis pour envoyer l'invitation.");
    
    creerChauffeur({
      name: form.name,
      surname: form.surname,
      phone: form.phone,
      email: form.email,
      numeroPermis: form.numeroPermis,
      Adresse: form.Adresse,
      date_embauche: form.date_embauche,
    });
  };

  const filtered = chauffeurs.filter((c) =>
    `${c.name} ${c.surname}`.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search)
  );

  const today = new Date();
  const isExpirant = (dateStr) => {
    if (!dateStr) return false;
    const diff = (new Date(dateStr) - today) / (1000 * 60 * 60 * 24);
    return diff < 90;
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Chauffeurs</h1>
          <p className="text-slate-400 mt-1 text-sm">
            {isLoading ? "Chargement…" : `${chauffeurs.length} chauffeur(s) enregistré(s)`}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-[#135bec]/20"
        >
          <Plus className="w-4 h-4" /> Ajouter un chauffeur
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total",       value: chauffeurs.length,                                    bg: "bg-slate-50",    color: "text-slate-900"   },
          { label: "Disponibles", value: chauffeurs.filter((c) => c.disponible).length,    bg: "bg-emerald-50",  color: "text-emerald-600" },
          { label: "En mission",  value: chauffeurs.filter((c) => !c.disponible).length,   bg: "bg-blue-50",     color: "text-[#135bec]"   },
        ].map(({ label, value, bg, color }) => (
          <div key={label} className={`${bg} rounded-2xl p-5`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-sm text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un chauffeur…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
            />
          </div>
        </div>

        {isLoading ? (
          <Spinner size="lg" className="py-20" />
        ) : isError ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Impossible de charger les chauffeurs.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Chauffeur", "Téléphone", "Email", "N° Permis", "Disponibilité", "Actions"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-14 text-slate-400 text-sm">
                    Aucun chauffeur trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const cfg = c.disponible ? statutConfig.true : statutConfig.false;
                  const expirant = isExpirant(c.date_expiration_permis);
                  return (
                    <tr key={c.id_chauffeur} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#135bec]/10 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-[#135bec]" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{c.name} {c.surname}</p>
                            {c.Adresse && (
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />{c.Adresse}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />{c.phone || "—"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />{c.email || "—"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          {expirant && <AlertCircle className="w-4 h-4 text-amber-500" />}
                          <span className={`font-mono text-xs px-2 py-1 rounded-md ${expirant ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                            {c.numeroPermis || "—"}
                          </span>
                        </div>
                        {expirant && <p className="text-xs text-amber-500 mt-0.5">Expire bientôt</p>}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <button className="p-1.5 hover:bg-slate-100 rounded-lg">
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {!isLoading && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            Affichage de {filtered.length} sur {chauffeurs.length} chauffeur(s)
          </div>
        )}
      </Card>

      {/* Modal Ajout Chauffeur */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Enregistrer un Chauffeur"
        size="md"
        footer={
          <>
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl"
            >
              {isPending ? "Ajout…" : "Enregistrer"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom *</label>
              <input
                placeholder="Kouassi"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prénom</label>
              <input
                placeholder="Amadou"
                value={form.surname}
                onChange={(e) => setForm((f) => ({ ...f, surname: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone *</label>
              <input
                placeholder="+237 6XX XXX XXX"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email *</label>
              <input
                type="email"
                placeholder="amadou@agence.cm"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">N° Permis *</label>
              <input
                placeholder="CM-2024-XXXXX"
                value={form.numeroPermis}
                onChange={(e) => setForm((f) => ({ ...f, numeroPermis: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date d'embauche</label>
              <input
                type="date"
                value={form.date_embauche}
                onChange={(e) => setForm((f) => ({ ...f, date_embauche: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Adresse</label>
              <input
                placeholder="Quartier, ville"
                value={form.Adresse}
                onChange={(e) => setForm((f) => ({ ...f, Adresse: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            <strong>Info :</strong> Un email d'invitation sera envoyé au chauffeur avec ses identifiants de connexion.
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
