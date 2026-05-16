import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../services/axios";

async function fetchAgence(agenceId) {
  const { data } = await api.get(`/api/agences/${agenceId}`);
  return data?.data || data;
}

async function updateAgence(agenceId, payload) {
  const { data } = await api.put(`/api/agences/${agenceId}`, payload);
  return data?.data || data;
}

async function uploadAgenceLogo(agenceId, logoUrl) {
  const { data } = await api.patch(`/api/agences/${agenceId}`, { logo_url: logoUrl });
  return data?.data || data;
}

/**
 * Hook qui charge les détails de l'agence depuis fleet-service.
 * Utilisé dans la Sidebar et le dashboard manager.
 */
export function useAgence(agenceId) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["agence", agenceId],
    queryFn: () => fetchAgence(agenceId),
    enabled: !!agenceId,
    staleTime: 60_000, // 1 min
  });

  const mutation = useMutation({
    mutationFn: (payload) => updateAgence(agenceId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agence", agenceId] });
    },
  });

  const logoMutation = useMutation({
    mutationFn: (logoUrl) => uploadAgenceLogo(agenceId, logoUrl),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agence", agenceId] });
    },
  });

  return {
    agence:         query.data ?? null,
    isLoading:      query.isLoading,
    updateAgence:   mutation.mutate,
    isUpdating:     mutation.isPending,
    updateLogo:     logoMutation.mutate,
    isUpdatingLogo: logoMutation.isPending,
  };
}
