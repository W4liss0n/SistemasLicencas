import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export function AccessDeniedPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ width: 'min(560px, 100%)', p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h4">Acesso negado</Typography>
          <Alert severity="error">
            A API interna retornou 401/403. Verifique configuracao de proxy, credencial interna e controle de acesso no edge.
          </Alert>
          <Button component={Link} to="/dashboard" variant="outlined" sx={{ width: 'fit-content' }}>
            Voltar ao dashboard
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
