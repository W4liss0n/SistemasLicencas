import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuthStore } from './store/authStore';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Clientes } from './pages/Clientes';
import { Programas } from './pages/Programas';
import { Planos } from './pages/Planos';
import { Logs } from './pages/Logs';
import { Configuracoes } from './pages/Configuracoes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 1,
      },
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/admin/login" />;
}

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Routes>
            <Route path="/admin/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <PrivateRoute>
                  <MainLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="programas" element={<Programas />} />
              <Route path="planos" element={<Planos />} />
              <Route path="logs" element={<Logs />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="perfil" element={<div>Página de Perfil</div>} />
            </Route>
            <Route path="*" element={<Navigate to="/admin/dashboard" />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App
