import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export const dashboardApi = {
  async getStats() {
    const { data } = await api.get('/dashboard/stats');
    return data;
  },

  async getRecentEvents() {
    const { data } = await api.get('/dashboard/events');
    return data;
  },

  async getLicenseData() {
    const { data } = await api.get('/dashboard/licenses');
    return data;
  },

  async getSecurityData() {
    const { data } = await api.get('/dashboard/security');
    return data;
  },
};

export const adminApi = {
  async getAll(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await api.get('/admins', { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/admins/${id}`);
    return data;
  },

  async create(admin: any) {
    const { data } = await api.post('/admins', admin);
    return data;
  },

  async update(id: string, admin: any) {
    const { data } = await api.put(`/admins/${id}`, admin);
    return data;
  },

  async delete(id: string) {
    const { data } = await api.delete(`/admins/${id}`);
    return data;
  },

  async resetPassword(id: string) {
    const { data } = await api.post(`/admins/${id}/reset-password`);
    return data;
  },
};

export const logsApi = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    level?: string;
    category?: string;
    date?: string;
  }) {
    // Por enquanto, vamos usar o endpoint de eventos do dashboard
    // até termos um endpoint dedicado de logs
    const { data } = await api.get('/dashboard/events', { params });

    // Transformar os dados para o formato esperado pela página de Logs
    const events = Array.isArray(data) ? data : [];

    return {
      data: events.map((event: any, index: number) => ({
        id: event.id || `event-${index}`,
        timestamp: event.created_at || event.time || new Date().toISOString(),
        level: event.type || 'info',
        category: event.category || 'system',
        action: event.message || event.action || 'Unknown action',
        user_id: event.user_id,
        user_email: event.user_email || event.user,
        ip_address: event.ip || event.ip_address,
        details: event.details || event.metadata,
        metadata: event.metadata,
      })),
      total: events.length,
    };
  },

  async getById(id: string) {
    const { data } = await api.get(`/logs/${id}`);
    return data;
  },

  async getCategories() {
    // Retornar categorias padrão por enquanto
    return ['authentication', 'license', 'validation', 'subscription', 'payment', 'security', 'system', 'api', 'admin'];
  },
};

export const clienteApi = {
  async getAll(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await api.get('/clientes', { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/clientes/${id}`);
    return data;
  },

  async create(cliente: any) {
    console.log('Sending cliente data:', cliente);
    const { data } = await api.post('/clientes', cliente);
    console.log('Response:', data);
    return data;
  },

  async update(id: string, cliente: any) {
    const { data } = await api.put(`/clientes/${id}`, cliente);
    return data;
  },

  async delete(id: string) {
    const { data } = await api.delete(`/clientes/${id}`);
    return data;
  },
};

export const assinaturaApi = {
  async getAll(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await api.get('/assinaturas', { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/assinaturas/${id}`);
    return data;
  },

  async create(assinatura: any) {
    const { data } = await api.post('/assinaturas', assinatura);
    return data;
  },

  async update(id: string, assinatura: any) {
    const { data } = await api.put(`/assinaturas/${id}`, assinatura);
    return data;
  },

  async cancel(id: string) {
    const { data } = await api.post(`/assinaturas/${id}/cancel`);
    return data;
  },
};

export const licencaApi = {
  async getAll(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await api.get('/licencas', { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/licencas/${id}`);
    return data;
  },

  async create(licenca: any) {
    const { data } = await api.post('/licencas', licenca);
    return data;
  },

  async update(id: string, licenca: any) {
    const { data } = await api.put(`/licencas/${id}`, licenca);
    return data;
  },

  async block(id: string) {
    const { data } = await api.post(`/licencas/${id}/block`);
    return data;
  },

  async unblock(id: string) {
    const { data } = await api.post(`/licencas/${id}/unblock`);
    return data;
  },

  async unbindDevice(licenseKey: string, deviceFingerprint: any) {
    const { data } = await api.post('/license/deactivate', {
      license_key: licenseKey,
      device_fingerprint: deviceFingerprint
    });
    return data;
  },

  async getDevices(licenseKey: string) {
    const { data } = await api.get(`/licencas/key/${licenseKey}/devices`);
    return data;
  },

  async deactivateDevice(licenseKey: string, fingerprintHash: string) {
    const { data } = await api.post(`/licencas/key/${licenseKey}/devices/${fingerprintHash}/deactivate`);
    return data;
  },
};

export const programaApi = {
  async getAll(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await api.get('/programas', { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/programas/${id}`);
    return data;
  },

  async create(programa: any) {
    const { data } = await api.post('/programas', programa);
    return data;
  },

  async update(id: string, programa: any) {
    const { data } = await api.put(`/programas/${id}`, programa);
    return data;
  },

  async delete(id: string) {
    const { data } = await api.delete(`/programas/${id}`);
    return data;
  },
};

export const planoApi = {
  async getAll(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await api.get('/planos', { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/planos/${id}`);
    return data;
  },

  async create(plano: any) {
    const { data } = await api.post('/planos', plano);
    return data;
  },

  async update(id: string, plano: any) {
    const { data } = await api.put(`/planos/${id}`, plano);
    return data;
  },

  async delete(id: string) {
    const { data } = await api.delete(`/planos/${id}`);
    return data;
  },

  async getProgramas(id: string) {
    const { data } = await api.get(`/planos/${id}/programas`);
    return data;
  },

  async addPrograma(planoId: string, programaId: string) {
    const { data } = await api.post(`/planos/${planoId}/programas`, { programa_id: programaId });
    return data;
  },

  async removePrograma(planoId: string, programaId: string) {
    const { data } = await api.delete(`/planos/${planoId}/programas/${programaId}`);
    return data;
  },
};

export default api;