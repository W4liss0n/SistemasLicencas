import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  completeAdminAuthCallback,
  hasAdminAuthCallbackParams,
  isAdminAuthEnabled,
  startAdminAuthLogin
} from '../app/admin-auth';
import { setOperatorContextName } from '../app/session';

export function LoginPage() {
  const [operator, setOperator] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(hasAdminAuthCallbackParams());
  const navigate = useNavigate();
  const authEnabled = isAdminAuthEnabled();

  useEffect(() => {
    if (!authEnabled || !hasAdminAuthCallbackParams()) {
      return;
    }

    setIsBusy(true);
    completeAdminAuthCallback()
      .then((returnTo) => navigate(returnTo, { replace: true }))
      .catch((callbackError: unknown) => {
        setError(callbackError instanceof Error ? callbackError.message : 'Falha ao concluir login.');
        setIsBusy(false);
      });
  }, [authEnabled, navigate]);

  const submitLocalOperator = () => {
    if (operator.trim().length < 2) {
      setError('Informe um identificador de operador com pelo menos 2 caracteres.');
      return;
    }
    setOperatorContextName(operator);
    navigate('/dashboard');
  };

  const submitAuth0Login = () => {
    setError(null);
    setIsBusy(true);
    startAdminAuthLogin('/dashboard').catch((loginError: unknown) => {
      setError(loginError instanceof Error ? loginError.message : 'Falha ao iniciar login.');
      setIsBusy(false);
    });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background:
          'radial-gradient(circle at 8% 4%, rgba(24,95,167,0.18) 0, transparent 38%), radial-gradient(circle at 92% 96%, rgba(14,116,144,0.14) 0, transparent 46%), var(--controlroom-canvas)'
      }}
    >
      <Paper sx={{ width: 'min(460px, 100%)', p: 3, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--controlroom-surface-elevated)' }}>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="overline">Internal Access</Typography>
            <Typography variant="h5">Backoffice v2</Typography>
            <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
              {authEnabled
                ? 'Acesso administrativo protegido por Auth0.'
                : 'Sessao local do operador para trilha de decisao. Controle principal continua no edge corporativo.'}
            </Typography>
          </Stack>

          {authEnabled ? null : (
            <TextField
              label="Operador"
              value={operator}
              onChange={(event) => setOperator(event.target.value)}
              placeholder="ops-user"
              size="small"
              autoFocus
            />
          )}

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Button variant="contained" onClick={authEnabled ? submitAuth0Login : submitLocalOperator} disabled={isBusy}>
            {isBusy ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress color="inherit" size={18} />
                <span>Entrando...</span>
              </Stack>
            ) : authEnabled ? (
              'Entrar com Auth0'
            ) : (
              'Entrar no control room'
            )}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
