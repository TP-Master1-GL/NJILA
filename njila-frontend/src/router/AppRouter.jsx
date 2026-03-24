import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ROLES } from "../utils/constants";
import { ProtectedRoute } from "./ProtectedRoute";
import { RoleGuard } from "./RoleGuard";

// Public
import LandingPage        from "../pages/public/LandingPage";
import LoginPage          from "../pages/public/LoginPage";
import RegisterPage       from "../pages/public/RegisterPage";
import SearchResultsPage  from "../pages/public/SearchResultsPage";
import SeatSelectionPage  from "../pages/public/SeatSelectionPage";
import PaymentPage        from "../pages/public/PaymentPage";
import NotFoundPage       from "../pages/public/NotFoundPage";

// Voyageur
import VoyageurDashboard  from "../pages/voyageur/VoyageurDashboard";
import MesReservations    from "../pages/voyageur/MesReservations";
import MonProfil          from "../pages/voyageur/MonProfil";
import MonBillet          from "../pages/voyageur/MonBillet";

// Guichetier
import GuichetierPOS      from "../pages/guichetier/GuichetierPOS";
import ScanBillet         from "../pages/guichetier/VérificationBillet";
import ListePassagers     from "../pages/guichetier/ListePassagers";

// Manager
import ManagerDashboard   from "../pages/manager/ManagerDashboard";
import GestionFlotte      from "../pages/manager/GestionFlotte";
import GestionVoyages     from "../pages/manager/GestionVoyages";
import GestionChauffeurs  from "../pages/manager/GestionChauffeurs";
import Statistiques       from "../pages/manager/Statistiques";

// Admin
import AdminDashboard     from "../pages/admin/AdminDashboard";
import GestionAgences     from "../pages/admin/GestionAgences";
import GestionAbonnements from "../pages/admin/GestionAbonnements";
import GestionUtilisateurs from "../pages/admin/GestionUtilisateurs";

const MANAGER_ROLES = [ROLES.MANAGER_LOCAL, ROLES.MANAGER_GLOBAL, ROLES.ADMIN];

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public ────────────────────────────────────────────────────── */}
        <Route path="/"                    element={<LandingPage />} />
        <Route path="/login"               element={<LoginPage />} />
        <Route path="/register"            element={<RegisterPage />} />
        <Route path="/recherche"           element={<SearchResultsPage />} />
        <Route path="/selection-places/:voyageId" element={<SeatSelectionPage />} />
        <Route path="/paiement"            element={<PaymentPage />} />

        {/* ── Voyageur ──────────────────────────────────────────────────── */}
        <Route path="/voyageur" element={
          <ProtectedRoute>
            <RoleGuard roles={[ROLES.VOYAGEUR]}>
              <VoyageurDashboard />
            </RoleGuard>
          </ProtectedRoute>
        } />
        <Route path="/voyageur/reservations" element={
          <ProtectedRoute><RoleGuard roles={[ROLES.VOYAGEUR]}><MesReservations /></RoleGuard></ProtectedRoute>
        } />
        <Route path="/voyageur/profil" element={
          <ProtectedRoute><RoleGuard roles={[ROLES.VOYAGEUR]}><MonProfil /></RoleGuard></ProtectedRoute>
        } />
        <Route path="/voyageur/billet/:id" element={
          <ProtectedRoute><RoleGuard roles={[ROLES.VOYAGEUR]}><MonBillet /></RoleGuard></ProtectedRoute>
        } />

        {/* ── Guichetier ────────────────────────────────────────────────── */}
        <Route path="/guichet" element={
          <ProtectedRoute><RoleGuard roles={[ROLES.GUICHETIER]}><GuichetierPOS /></RoleGuard></ProtectedRoute>
        } />
        <Route path="/guichet/scan" element={
          <ProtectedRoute><RoleGuard roles={[ROLES.GUICHETIER]}><ScanBillet /></RoleGuard></ProtectedRoute>
        } />
        <Route path="/guichet/passagers" element={
          <ProtectedRoute><RoleGuard roles={[ROLES.GUICHETIER]}><ListePassagers /></RoleGuard></ProtectedRoute>
        } />

        {/* ── Manager ───────────────────────────────────────────────────── */}
        <Route path="/manager" element={
          <ProtectedRoute><RoleGuard roles={MANAGER_ROLES}><ManagerDashboard /></RoleGuard></ProtectedRoute>
        } />
        <Route path="/manager/flotte" element={
          <ProtectedRoute><RoleGuard roles={MANAGER_ROLES}><GestionFlotte /></RoleGuard></ProtectedRoute>
        } />
        <Route path="/manager/voyages" element={
          <ProtectedRoute><RoleGuard roles={MANAGER_ROLES}><GestionVoyages /></RoleGuard></ProtectedRoute>
        } />
        <Route path="/manager/chauffeurs" element={
          <ProtectedRoute><RoleGuard roles={MANAGER_ROLES}><GestionChauffeurs /></RoleGuard></ProtectedRoute>
        } />
        <Route path="/manager/stats" element={
          <ProtectedRoute><RoleGuard roles={MANAGER_ROLES}><Statistiques /></RoleGuard></ProtectedRoute>
        } />

        {/* ── Admin NJILA ───────────────────────────────────────────────── */}
        <Route path="/admin" element={
          <ProtectedRoute><RoleGuard roles={[ROLES.ADMIN]}><AdminDashboard /></RoleGuard></ProtectedRoute>
        } />
        <Route path="/admin/agences" element={
          <ProtectedRoute><RoleGuard roles={[ROLES.ADMIN]}><GestionAgences /></RoleGuard></ProtectedRoute>
        } />
        <Route path="/admin/abonnements" element={
          <ProtectedRoute><RoleGuard roles={[ROLES.ADMIN]}><GestionAbonnements /></RoleGuard></ProtectedRoute>
        } />
        <Route path="/admin/utilisateurs" element={
          <ProtectedRoute><RoleGuard roles={[ROLES.ADMIN]}><GestionUtilisateurs /></RoleGuard></ProtectedRoute>
        } />

        {/* ── Fallback ──────────────────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
