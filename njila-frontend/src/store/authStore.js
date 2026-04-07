import { create } from "zustand";
import { ROLES } from "../utils/constants";

export const useAuthStore = create((set, get) => ({
  user:          null,
  role:          null,
  isAuthenticated: false,
  isLoading:     false,

  setUser: (user) => set({
    user,
    role: user?.role || null,
    isAuthenticated: !!user,
  }),

  clearUser: () => set({
    user: null,
    role: null,
    isAuthenticated: false,
  }),

  setLoading: (isLoading) => set({ isLoading }),

  // Helpers rôles
  isVoyageur:      () => get().role === ROLES.VOYAGEUR,
  isGuichetier:    () => get().role === ROLES.GUICHETIER,
  isManagerLocal:  () => get().role === ROLES.MANAGER_LOCAL,
  isManagerGlobal: () => get().role === ROLES.MANAGER_GLOBAL,
  isAdmin:         () => get().role === ROLES.ADMIN,
  isManager:       () => [ROLES.MANAGER_LOCAL, ROLES.MANAGER_GLOBAL].includes(get().role),
}));
