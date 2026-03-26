import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setOperatorContextName } from '../app/session';

export function LoginPage() {
  const [operator, setOperator] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
              Sessao local do operador para trilha de decisao. Controle principal continua no edge corporativo.
            </Typography>
          </Stack>

          <TextField
            label="Operador"
            value={operator}
            onChange={(event) => setOperator(event.target.value)}
            placeholder="ops-user"
            size="small"
            autoFocus
          />

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Button
            variant="contained"
            onClick={() => {
              if (operator.trim().length < 2) {
                setError('Informe um identificador de operador com pelo menos 2 caracteres.');
                return;
              }
              setOperatorContextName(operator);
              navigate('/dashboard');
            }}
          >
            Entrar no control room
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
