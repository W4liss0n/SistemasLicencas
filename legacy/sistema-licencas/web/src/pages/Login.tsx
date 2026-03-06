import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useAuthStore } from '../store/authStore';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [userOrEmail, setUserOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(userOrEmail, password);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
        padding: 2,
      }}
    >
      <Container component="main" maxWidth="xs">
        <Paper
          elevation={6}
          sx={{
            padding: 4,
            borderRadius: 2,
            background: '#ffffff',
          }}
        >
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography
              component="h1"
              variant="h4"
              sx={{
                fontWeight: 700,
                color: '#1976d2',
                mb: 1,
              }}
            >
              Sistema de Licenças
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Faça login para continuar
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="userOrEmail"
              label="Usuário ou Email"
              name="userOrEmail"
              autoComplete="username"
              autoFocus
              value={userOrEmail}
              onChange={(e) => setUserOrEmail(e.target.value)}
              disabled={loading}
              helperText="Digite seu nome de usuário ou email"
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Senha"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                mt: 3,
                mb: 2,
                py: 1.5,
                fontWeight: 600,
                fontSize: '1rem',
                textTransform: 'none',
              }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Entrar'}
            </Button>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" align="center">
              Esqueceu sua senha? Entre em contato com o suporte.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}