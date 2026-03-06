import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ width: 'min(520px, 100%)', p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h4">Pagina nao encontrada</Typography>
          <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
            A rota solicitada nao existe neste ambiente de administracao.
          </Typography>
          <Button component={Link} to="/dashboard" variant="outlined" sx={{ width: 'fit-content' }}>
            Ir para dashboard
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
