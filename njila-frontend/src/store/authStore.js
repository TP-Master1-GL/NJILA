import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ROLES } from "../utils/constants";
import { setAccessToken, clearAuth } from "../services/axios"; // ← chemin corrigé

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:            null,
      role:            null,
      token:           null,
      isAuthenticated: false,
      isLoading:       false,

      setUser: (user, token) => {
        if (token) setAccessToken(token);

        set({
          user: {
            id:           user?.id,
            email:        user?.email,
            name:         user?.name,
            surname:      user?.surname,
            role:         user?.role,
            phone:        user?.phone,
            photoUrl:     user?.photoUrl,
            agenceId:     user?.agenceId,
            agenceNom:    user?.agenceNom,
            agenceCode:   user?.agenceCode,
            filialeId:    user?.filialeId,
            filialeNom:   user?.filialeNom,
            filialeCode:  user?.filialeCode,
            filialeVille: user?.filialeVille,
            createdAt:    user?.createdAt,
          },
          token:           token || null,
          role:            user?.role || null,
          isAuthenticated: !!user,
        });
      },

      clearUser: () => {
        clearAuth();
        set({
          user:            null,
          token:           null,
          role:            null,
          isAuthenticated: false,
        });
      },

      setLoading: (isLoading) => set({ isLoading }),

      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),

      isVoyageur:      () => get().role === ROLES.VOYAGEUR,
      isGuichetier:    () => get().role === ROLES.GUICHETIER,
      isManagerLocal:  () => get().role === ROLES.MANAGER_LOCAL,
      isManagerGlobal: () => get().role === ROLES.MANAGER_GLOBAL,
      isAdmin:         () => get().role === ROLES.ADMIN,
      isManager:       () => [ROLES.MANAGER_LOCAL, ROLES.MANAGER_GLOBAL].includes(get().role),

      getAgencyDisplay: () => {
        const role = get().role;
        const user = get().user;

        if (role === ROLES.ADMIN)
          return { text: "Administration", icon: "🏛️" };
        if (role === ROLES.MANAGER_GLOBAL)
          return { text: "Multi-agences", icon: "🌍" };
        if (user?.agenceNom) {
          if (role === ROLES.MANAGER_LOCAL || role === ROLES.GUICHETIER) {
            return user?.filialeNom
              ? { text: `${user.agenceNom} / ${user.filialeNom}`, icon: "🏢" }
              : { text: user.agenceNom, icon: "🏢" };
          }
          return { text: user.agenceNom, icon: "🏢" };
        }
        return { text: role?.replace("_", " ") || "Utilisateur", icon: "👤" };
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user:            state.user,
        token:           state.token,
        isAuthenticated: state.isAuthenticated,
        role:            state.role,
      }),
    }
  )
);