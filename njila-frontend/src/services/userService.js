import api from "./axios";

export const userService = {
  getProfil: async (id) => {
    const { data } = await api.get(`/api/users/${id}`);
    return data;
  },

  updateProfil: async (id, payload) => {
    const { data } = await api.put(`/api/users/${id}`, payload);
    return data;
  },

  uploadPhoto: async (id, formData) => {
    const { data } = await api.post(`/api/users/${id}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  getUtilisateurs: async (params) => {
    const { data } = await api.get("/api/users", { params });
    return data;
  },
};
