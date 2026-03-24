import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import NjilaLogo from "../../components/ui/NjilaLogo";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useAuth } from "../../hooks/useAuth";
import { IMAGES } from "../../assets/images";

const schema = z.object({
  email:    z.string().min(1, "Email ou téléphone requis"),
  password: z.string().min(6, "Minimum 6 caractères"),
  remember: z.boolean().optional(),
});

export default function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const [showPass, setShowPass] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { remember: false },
  });

  const from = location.state?.from?.pathname || null;

  return (
    <div className="min-h-screen flex">
      {/* ── Gauche — image + filigrane bus ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Image de fond bus */}
        <img src={IMAGES.BUS_LOGIN} alt="Bus NJILA"
          className="absolute inset-0 w-full h-full object-cover" />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#135bec]/90 via-[#135bec]/70 to-blue-900/80" />

        {/* Contenu */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <NjilaLogo size="lg" white />

          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
              NJILA – Votre voyage<br />
              <span className="text-yellow-300">commence ici</span>
            </h1>
            <p className="text-blue-100 text-lg mb-10 leading-relaxed">
              La plateforme leader pour la gestion du transport interurbain au Cameroun. Rapide, sûre et fiable.
            </p>
            <div className="grid grid-cols-3 gap-6">
              {[["50+", "Agences"], ["10k+", "Trajets/mois"], ["24/7", "Support"]].map(([v, l]) => (
                <div key={l} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/20">
                  <p className="text-3xl font-extrabold text-white">{v}</p>
                  <p className="text-blue-200 text-sm mt-1">{l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {["G","M","F","A"].map((l,i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-blue-600 flex items-center justify-center text-xs font-bold text-white">{l}</div>
              ))}
            </div>
            <p className="text-blue-100 text-sm">+10 000 voyageurs nous font confiance</p>
          </div>
        </div>
      </div>

      {/* ── Droite — formulaire ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white relative overflow-hidden">
        {/* Filigrane bus très léger */}
        <div className="absolute bottom-0 right-0 opacity-[0.04] pointer-events-none">
          <img src={IMAGES.BUS_HIGHWAY} alt="" className="w-96 h-auto" />
        </div>

        <div className="w-full max-w-md relative z-10">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <NjilaLogo size="lg" />
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Bienvenue sur NJILA</h2>
            <p className="text-slate-500">Connectez-vous pour gérer vos trajets et réservations.</p>
            {from && <p className="mt-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">Connectez-vous pour continuer votre réservation</p>}
          </div>

          <form onSubmit={handleSubmit(login)} className="space-y-5">
            <Input
              label="Email ou Numéro de téléphone"
              type="text"
              placeholder="votre@email.com ou 6xx xxx xxx"
              error={errors.email?.message}
              {...register("email")}
            />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-700">Mot de passe</label>
                <a href="#" className="text-xs text-[#135bec] hover:underline font-medium">Mot de passe oublié ?</a>
              </div>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent transition-all pr-11 ${errors.password ? "border-red-400" : "border-slate-200"}`}
                  {...register("password")}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-slate-300 text-[#135bec]" {...register("remember")} />
              <span className="text-sm text-slate-600">Se souvenir de moi</span>
            </label>

            <button type="submit" disabled={isSubmitting}
              className="w-full h-12 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-[#135bec]/25 flex items-center justify-center gap-2 text-sm">
              {isSubmitting ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                  <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <><span className="material-icons text-xl">login</span> Se connecter</>
              )}
            </button>
          </form>

          {/* Social login */}
          <div className="mt-6">
            <div className="relative flex items-center">
              <div className="flex-1 border-t border-slate-200" />
              <span className="mx-4 text-xs text-slate-400 uppercase tracking-wider">ou continuer avec</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                { icon: "https://www.google.com/favicon.ico", label: "Google" },
                { icon: "https://www.facebook.com/favicon.ico", label: "Facebook" },
              ].map(({ icon, label }) => (
                <button key={label} className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <img src={icon} alt={label} className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            Pas encore de compte ?{" "}
            <Link to="/register" className="text-[#135bec] font-bold hover:underline">S'inscrire</Link>
          </p>

          {/* Liens légaux */}
          <div className="flex items-center justify-center gap-4 mt-8 text-xs text-slate-400">
            <a href="#" className="hover:text-slate-600">Conditions</a>
            <span>·</span>
            <a href="#" className="hover:text-slate-600">Confidentialité</a>
            <span>·</span>
            <span>🇨🇲 Français (Cameroun)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
