import api from '../api';

export const planoApi = {
  getAll: async (params?: any) => {
    const response = await api.get('/planos', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/planos/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/planos', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/planos/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/planos/${id}`);
    return response.data;
  },

  getProgramas: async (id: string) => {
    const response = await api.get(`/planos/${id}/programas`);
    return response.data;
  },

  addPrograma: async (planoId: string, programaId: string) => {
    const response = await api.post(`/planos/${planoId}/programas`, { programa_id: programaId });
    return response.data;
  },

  removePrograma: async (planoId: string, programaId: string) => {
    const response = await api.delete(`/planos/${planoId}/programas/${programaId}`);
    return response.data;
  },
};