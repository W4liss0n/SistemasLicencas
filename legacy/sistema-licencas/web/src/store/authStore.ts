import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro ao fazer login' }));
        throw new Error(errorData.error || 'Usuário ou senha inválidos');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
      });
    } catch (error) {
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  setUser: (user: User) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    // Carregamento síncrono inicial
    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        // Definir o estado imediatamente com dados do localStorage
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false
        });

        // Validação assíncrona opcional com o backend
        fetch('/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        .then(response => {
          if (response.ok) {
            return response.json();
          } else if (response.status === 401) {
            // Token inválido, fazer logout
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            set({
              user: null,
              token: null,
              isAuthenticated: false
            });
            // Redirecionar para login se necessário
            window.location.href = '/admin/login';
          }
          throw new Error('Failed to fetch user');
        })
        .then(data => {
          // Extrair corretamente o user da resposta do backend
          const userData = data.user || data;
          localStorage.setItem('user', JSON.stringify(userData));
          set({ user: userData });
        })
        .catch(error => {
          // Erro na validação, manter o user do localStorage
          console.log('Failed to validate user with backend:', error);
        });
      } catch (error) {
        // Erro ao parsear o user do localStorage
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('user');
        set({ isLoading: false });
      }
    } else {
      // Não há token ou user armazenado
      set({ isLoading: false });
    }
  },
}));