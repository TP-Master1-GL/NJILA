import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { userService } from "../services/userService";

/**
 * Hook qui charge le profil de l'utilisateur connecté depuis user-service.
 * Utilise l'endpoint /api/users/{id} avec l'ID du user connecté.
 *
 * Corrections appliquées :
 * 1. Bug 403 : résolution défensive de userId (authUser peut être null pendant
 *    l'hydratation de Zustand persist) + null-check dans queryFn
 * 2. Bug 400 (double-wrap photo) : guard typeof dans mutationFn photo
 * 3. Sync locale du store après succès photo (avatar s'affiche immédiatement)
 */
export function useProfile() {
  const { user: authUser, updateUser } = useAuthStore();
  const qc = useQueryClient();

  // Résolution défensive de l'id.
  // Zustand persist hydrate le store de façon asynchrone : au premier render,
  // authUser peut être null pendant quelques ms → requête vers /api/users/undefined → 403.
  // On sécurise avec enabled:!!userId ET un null-check dans queryFn.
  const userId = authUser?.id ?? authUser?.userId ?? authUser?.sub;

  // ── Query : GET /api/users/{id} ────────────────────────────────────────────
  const query = useQuery({
    queryKey: ["profil", "me"],
    queryFn: () => {
      if (!userId) {
        throw new Error("[useProfile] userId introuvable dans le store — store pas encore hydraté ?");
      }
      return userService.getMonProfil(userId);
    },
    enabled: !!userId,
    staleTime: 30_000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // ── Mutation profil : PUT /api/users/{id} ──────────────────────────────────
  const mutation = useMutation({
    mutationFn: (payload) => userService.updateMonProfil(userId, payload, true),
    onSuccess: (data) => {
      // Invalider la query pour recharger le profil frais
      qc.invalidateQueries({ queryKey: ["profil", "me"] });
      // Sync partielle du store pour que le nom/prénom s'affichent immédiatement
      if (data) {
        updateUser({
          name:    data.name    ?? data.nom,
          surname: data.surname ?? data.prenom,
          phone:   data.phone,
          email:   data.email,
        });
      }
    },
    onError: (error) => {
      console.error("[useProfile] Erreur mise à jour profil:", error);
    },
  });

  // ── Mutation photo : PATCH /api/users/{id}/photo ───────────────────────────
  // Reçoit une URL string brute depuis PhotoUploader (via onUploaded).
  // { photoProfil: url } est construit ICI uniquement pour éviter tout double-wrap.
  // Le backend attend exactement : { "photoProfil": "https://res.cloudinary.com/..." }
  const photoMutation = useMutation({
    mutationFn: (photoUrl) => {
      // Guard défensif : si on reçoit un objet au lieu d'une string
      // (ex: { photoProfil: "url" } passé par erreur), on extrait la valeur.
      // Cela évite d'envoyer { photoProfil: { photoProfil: "url" } } → erreur Jackson 400.
      const url =
        typeof photoUrl === "string"
          ? photoUrl
          : photoUrl?.photoProfil ?? String(photoUrl);
      return userService.updateMonPhoto(userId, { photoProfil: url }, true);
    },
    onSuccess: (data) => {
      // Invalider la query pour recharger le profil depuis le backend
      qc.invalidateQueries({ queryKey: ["profil", "me"] });
      // Sync immédiate du store pour que l'avatar s'affiche sans attendre le refetch.
      // Le store utilise photoUrl (pas photo_url ni photoProfil).
      const newPhotoUrl = data?.photoProfil ?? data?.photo_url ?? data?.photoUrl;
      if (newPhotoUrl) {
        updateUser({ photoUrl: newPhotoUrl });
      }
    },
    onError: (error) => {
      console.error("[useProfile] Erreur mise à jour photo:", error);
    },
  });

  return {
    // État du profil
    profil:    query.data ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
    error:     query.error,

    // Mise à jour du profil (texte)
    updateProfil:  mutation.mutate,
    isUpdating:    mutation.isPending,
    updateError:   mutation.error,

    // Mise à jour de la photo
    // Appeler avec une URL string brute : updatePhoto("https://res.cloudinary.com/...")
    updatePhoto:      photoMutation.mutate,
    isUpdatingPhoto:  photoMutation.isPending,
    updatePhotoError: photoMutation.error,

    // Refetch manuel si besoin
    refetch: query.refetch,
  };
}

/**
 * Hook alternatif pour charger le profil d'un utilisateur spécifique.
 * ⚠️ Peut retourner 403 si vous n'avez pas les permissions nécessaires.
 * À utiliser uniquement pour Admin/Manager consultant le profil d'un autre user.
 */
export function useUserProfile(userId) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["profil", userId],
    queryFn:  () => userService.getProfil(userId),
    enabled:  !!userId,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (payload) => userService.updateProfil(userId, payload, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profil", userId] });
    },
  });

  return {
    profil:       query.data ?? null,
    isLoading:    query.isLoading,
    updateProfil: mutation.mutate,
    isUpdating:   mutation.isPending,
    refetch:      query.refetch,
  };
}
