import { useNavigate } from "react-router-dom";
import { Bus, Home } from "lucide-react";
import Button from "../../components/ui/Button";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Bus className="w-10 h-10 text-primary-600" />
        </div>
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-xl font-semibold text-gray-700 mb-2">Page introuvable</p>
        <p className="text-gray-500 mb-8">Cette page n'existe pas ou a été déplacée.</p>
        <Button size="lg" onClick={() => navigate("/")}>
          <Home className="w-4 h-4" /> Retour à l'accueil
        </Button>
      </div>
    </div>
  );
}
