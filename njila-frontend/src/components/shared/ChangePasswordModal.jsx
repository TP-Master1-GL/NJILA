import { useState } from "react";
import { X, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { authService } from "../../services/authService";
import toast from "react-hot-toast";

/**
 * Modal de modification du mot de passe.
 * Appelle authService.changePassword(oldPassword, newPassword).
 *
 * Props :
 *   isOpen   {boolean}  — affiche ou masque le modal
 *   onClose  {function} — ferme le modal
 */
export default function ChangePasswordModal({ isOpen, onClose }) {
  const [form, setForm]       = useState({
    oldPassword:     "",
    newPassword:     "",
    confirmPassword: "",
  });
  const [show, setShow]         = useState({
    old: false, new: false, confirm: false,
  });
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error,   setError]     = useState("");

  if (!isOpen) return null;

  // ── Règles de validation du nouveau mot de passe ──────────────────────────
  const rules = [
    { label: "Au moins 8 caractères",          ok: form.newPassword.length >= 8         },
    { label: "Au moins une lettre majuscule",   ok: /[A-Z]/.test(form.newPassword)       },
    { label: "Au moins une lettre minuscule",   ok: /[a-z]/.test(form.newPassword)       },
    { label: "Au moins un chiffre",             ok: /[0-9]/.test(form.newPassword)       },
    { label: "Confirmation identique",          ok: form.newPassword === form.confirmPassword && form.confirmPassword !== "" },
  ];
  const allRulesOk  = rules.every(r => r.ok);
  const formValid   = form.oldPassword.length > 0 && allRulesOk;

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValid) return;

    setLoading(true);
    setError("");
    try {
      await authService.changePassword(form.oldPassword, form.newPassword);
      setSuccess(true);
      toast.success("Mot de passe modifié avec succès !");
      setTimeout(() => {
        setSuccess(false);
        setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
        onClose();
      }, 2000);
    } catch (err) {
      const msg =
        err?.response?.data?.error  ||
        err?.response?.data?.detail ||
        "Mot de passe actuel incorrect ou erreur serveur.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setError("");
    setSuccess(false);
    onClose();
  };

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#135bec]/10 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#135bec]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Modifier le mot de passe</h2>
              <p className="text-xs text-slate-400">Choisissez un mot de passe sécurisé</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-slate-400 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Succès ── */}
        {success ? (
          <div className="px-6 py-12 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="font-bold text-slate-900">Mot de passe modifié !</p>
            <p className="text-sm text-slate-400">Vous allez être redirigé automatiquement.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {/* Erreur globale */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* ── Mot de passe actuel ── */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Mot de passe actuel
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input
                  type={show.old ? "text" : "password"}
                  name="oldPassword"
                  value={form.oldPassword}
                  onChange={handleChange}
                  placeholder="Votre mot de passe actuel"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent text-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => ({ ...s, old: !s.old }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {show.old ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ── Nouveau mot de passe ── */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input
                  type={show.new ? "text" : "password"}
                  name="newPassword"
                  value={form.newPassword}
                  onChange={handleChange}
                  placeholder="Nouveau mot de passe"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent text-sm"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => ({ ...s, new: !s.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {show.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ── Confirmation ── */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Confirmer le nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input
                  type={show.confirm ? "text" : "password"}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Répétez le nouveau mot de passe"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent text-sm"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {show.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ── Règles de validation ── */}
            {form.newPassword.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                {rules.map(({ label, ok }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                      ok ? "bg-emerald-500" : "bg-slate-200"
                    }`}>
                      {ok && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-xs ${ok ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Boutons ── */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!formValid || loading}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-[#135bec] hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Modification...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Modifier
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}