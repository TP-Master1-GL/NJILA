import { Link } from "react-router-dom";
import { Bus, Facebook, Twitter, Instagram, Phone, Mail, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Bus className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl">NJILA</span>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            La plateforme de référence du transport interurbain au Cameroun.
          </p>
          <div className="flex gap-3">
            {[Facebook, Twitter, Instagram].map((Icon, i) => (
              <a key={i} href="#" className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-primary-600 transition-colors">
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">Liens rapides</h4>
          <ul className="space-y-2 text-sm">
            {["Rechercher un trajet", "Nos agences", "Offres spéciales", "Application mobile"].map(item => (
              <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">Support</h4>
          <ul className="space-y-2 text-sm">
            {["Centre d'aide", "Nous contacter", "Politique de remboursement", "Conditions d'utilisation"].map(item => (
              <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">Contact</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary-400" /> +237 650 123 456</li>
            <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary-400" /> contact@njila.cm</li>
            <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary-400" /> Douala, Cameroun</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-800 py-4 text-center text-xs text-gray-500">
        © 2026 NJILA — Plateforme de transport interurbain au Cameroun
      </div>
    </footer>
  );
}
