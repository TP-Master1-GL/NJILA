import { useState, useEffect } from "react";
import { X, Check, Building2, Phone, Mail, MapPin, Loader2 } from "lucide-react";
import PhotoUploader from "./PhotoUploader";

export default function EditAgenceModal({ isOpen, onClose, agence, onSave, isSaving, onLogoUploaded }) {
  const [form, setForm] = useState({ name: "", adresse: "", telephone: "", email_officiel: "" });

  useEffect(() => {
    if (agence) {
      setForm({
        name:           agence.name            || "",
        adresse:        agence.adresse         || "",
        telephone:      agence.telephone       || "",
        email_officiel: agence.email_officiel  || "",
      });
    }
  }, [agence]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  // Initiales du logo
  const short = agence?.name
    ? agence.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "AG";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-extrabold text-slate-900 text-lg">Modifier l'agence</h2>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Logo */}
        <div className="flex justify-center pt-6 pb-2">
          <PhotoUploader
            currentUrl={agence?.logo_url || agence?.logo_image}
            initiales={short}
            onUploaded={onLogoUploaded}
            folder="logos"
            size="w-24 h-24"
            shape="rounded-2xl"
            bgColor="bg-[#135bec]"
          />
        </div>
        <p className="text-center text-xs text-slate-400 mb-4">Cliquez pour changer le logo</p>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {[
            { key: "name",           label: "Nom de l'agence", icon: Building2, placeholder: "Express Voyages" },
            { key: "adresse",        label: "Adresse",         icon: MapPin,    placeholder: "123 Boulevard..." },
            { key: "telephone",      label: "Téléphone",       icon: Phone,     placeholder: "+237 6XX XXX XXX" },
            { key: "email_officiel", label: "Email officiel",  icon: Mail,      placeholder: "contact@agence.cm" },
          ].map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key}>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
              <div className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#135bec] transition-colors"
                />
              </div>
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isSaving}
              className="flex-1 py-2.5 bg-[#135bec] text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isSaving ? "Sauvegarde..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
