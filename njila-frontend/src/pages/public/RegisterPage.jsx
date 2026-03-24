import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, CheckCircle, Shield, Cloud } from "lucide-react";
import { useState } from "react";
import NjilaLogo from "../../components/ui/NjilaLogo";
import Input from "../../components/ui/Input";
import { useAuth } from "../../hooks/useAuth";
import { IMAGES } from "../../assets/images";

const schema = z.object({
  nom:      z.string().min(2, "Nom requis (min 2 caractères)"),
  prenom:   z.string().min(2, "Prénom requis (min 2 caractères)"),
  telephone:z.string().min(9, "Numéro de téléphone invalide"),
  email:    z.string().email("Adresse email invalide"),
  password: z.string().min(8, "Minimum 8 caractères"),
  cgu:      z.boolean().refine(v => v === true, "Vous devez accepter les CGU"),
});

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { cgu: false },
  });

  const password = watch("password", "");
  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColor = ["bg-slate-200", "bg-red-400", "bg-yellow-400", "bg-emerald-500"][strength];
  const strengthLabel = ["", "Faible", "Moyen", "Fort"][strength];

  return (
    <div className="min-h-screen flex">
      {/* ── Gauche ── */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden">
        <img src={IMAGES.BUS_REGISTER} alt="Bus NJILA"
          className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#135bec]/85 via-blue-700/75 to-blue-900/90" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <NjilaLogo size="lg" white />

          <div>
            <h1 className="text-4xl font-extrabold mb-4 leading-tight">
              La plateforme de référence du{" "}
              <span className="text-yellow-300">transport interurbain</span>{" "}
              au Cameroun.
            </h1>
            <p className="text-blue-100 mb-8 leading-relaxed">
              Gérez vos trajets, réservations et votre flotte en toute simplicité. Rejoignez des milliers de professionnels dès aujourd'hui.
            </p>
            <div className="space-y-4">
              {[
                { title: "Gestion Temps Réel",  desc: "Suivez vos bus et vos ventes en direct sur toute l'étendue du territoire." },
                { title: "Paiements Sécurisés", desc: "Intégration native de MTN Mobile Money et Orange Money pour vos clients." },
                { title: "Billets Électroniques",desc: "Générez et validez des billets avec numéro unique instantanément." },
              ].map(({ title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-emerald-400/20 border border-emerald-400/40 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-blue-200 text-sm leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-blue-200 text-xs">© 2026 NJILA Management. Tous droits réservés.</p>
        </div>
      </div>

      {/* ── Droite ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white relative overflow-hidden">
        {/* Filigrane bus */}
        <div className="absolute bottom-0 left-0 opacity-[0.03] pointer-events-none rotate-12">
          <img src={IMAGES.BUS_COMPORT} alt="" className="w-[500px]" />
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="flex justify-center mb-8 lg:hidden">
            <NjilaLogo size="lg" />
          </div>

          <div className="mb-7">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Créer un compte</h2>
            <p className="text-slate-500">Remplissez les informations ci-dessous pour commencer.</p>
          </div>

          <form onSubmit={handleSubmit(registerUser)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nom" placeholder="Dupont" error={errors.nom?.message} {...register("nom")} />
              <Input label="Prénom" placeholder="Jean" error={errors.prenom?.message} {...register("prenom")} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Numéro de téléphone</label>
              <div className="flex gap-2">
                <div className="flex items-center gap-1 px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-600 flex-shrink-0">
                  <span>🇨🇲</span>
                  <span className="font-medium">+237</span>
                </div>
                <input placeholder="6XX XXX XXX"
                  className={`flex-1 px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent transition-all ${errors.telephone ? "border-red-400" : "border-slate-200"}`}
                  {...register("telephone")}
                />
              </div>
              {errors.telephone && <p className="mt-1 text-xs text-red-500">{errors.telephone.message}</p>}
            </div>

            <Input label="E-mail professionnel" type="email" placeholder="nom@entreprise.cm"
              error={errors.email?.message} {...register("email")} />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} placeholder="••••••••"
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent transition-all pr-11 ${errors.password ? "border-red-400" : "border-slate-200"}`}
                  {...register("password")}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${strengthColor} transition-all`} style={{ width: `${(strength / 3) * 100}%` }} />
                  </div>
                  <span className="text-xs text-slate-500">{strengthLabel}</span>
                </div>
              )}
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-[#135bec]" {...register("cgu")} />
              <span className="text-sm text-slate-600">
                J'accepte les{" "}
                <a href="#" className="text-[#135bec] font-semibold hover:underline">Conditions Générales d'Utilisation</a>{" "}
                et la{" "}
                <a href="#" className="text-[#135bec] font-semibold hover:underline">Politique de Confidentialité</a>
              </span>
            </label>
            {errors.cgu && <p className="text-xs text-red-500">{errors.cgu.message}</p>}

            <button type="submit" disabled={isSubmitting}
              className="w-full h-12 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-[#135bec]/25 flex items-center justify-center gap-2 text-sm">
              {isSubmitting ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                  <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : <>S'inscrire →</>}
            </button>
          </form>

          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> SSL Sécurisé</span>
            <span className="flex items-center gap-1"><Cloud className="w-3 h-3" /> Cloud Based</span>
          </div>

          <p className="text-center text-sm text-slate-500 mt-5">
            Déjà un compte ?{" "}
            <Link to="/login" className="text-[#135bec] font-bold hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
