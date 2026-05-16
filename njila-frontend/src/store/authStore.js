import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ROLES } from "../utils/constants";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:          null,
      role:          null,
      isAuthenticated: false,
      isLoading:     false,

      setUser: (user) => set({
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.name,
          surname: user?.surname,
          role: user?.role,
          phone: user?.phone,
          photoUrl: user?.photoUrl,
          agenceId: user?.agenceId,
          agenceNom: user?.agenceNom,
          agenceCode: user?.agenceCode,
          filialeId: user?.filialeId,
          filialeNom: user?.filialeNom,
          filialeCode: user?.filialeCode,
          filialeVille: user?.filialeVille,
          createdAt: user?.createdAt,
        },
        role: user?.role || null,
        isAuthenticated: !!user,
      }),

      clearUser: () => set({
        user: null,
        role: null,
        isAuthenticated: false,
      }),

      setLoading: (isLoading) => set({ isLoading }),

      // Mise à jour partielle de l'utilisateur
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),

      // Helpers rôles
      isVoyageur:      () => get().role === ROLES.VOYAGEUR,
      isGuichetier:    () => get().role === ROLES.GUICHETIER,
      isManagerLocal:  () => get().role === ROLES.MANAGER_LOCAL,
      isManagerGlobal: () => get().role === ROLES.MANAGER_GLOBAL,
      isAdmin:         () => get().role === ROLES.ADMIN,
      isManager:       () => [ROLES.MANAGER_LOCAL, ROLES.MANAGER_GLOBAL].includes(get().role),

      // Helper pour obtenir l'affichage de l'agence
      getAgencyDisplay: () => {
        const role = get().role;
        const user = get().user;
        
        if (role === ROLES.ADMIN) {
          return { text: "Administration", icon: "🏛️" };
        }
        if (role === ROLES.MANAGER_GLOBAL) {
          return { text: "Multi-agences", icon: "🌍" };
        }
        if (user?.agenceNom) {
          if (role === ROLES.MANAGER_LOCAL || role === ROLES.GUICHETIER) {
            if (user?.filialeNom) {
              return { text: `${user.agenceNom} / ${user.filialeNom}`, icon: "🏢" };
            }
            return { text: user.agenceNom, icon: "🏢" };
          }
          return { text: user.agenceNom, icon: "🏢" };
        }
        return { text: role?.replace("_", " ") || "Utilisateur", icon: "👤" };
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        role: state.role,
      }),
    }
  )
);
