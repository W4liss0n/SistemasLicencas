import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { Box, Divider, Stack, Typography } from '@mui/material';
import type { OperationTrailEntry } from '../../types/api';
import { SectionCard } from './SectionCard';

type Props = {
  licenseStatus: string;
  trail: OperationTrailEntry[];
};

const steps = ['Provisionada', 'Ativa', 'Bloqueada/Desbloqueada', 'Cancelada'];

export function OperationalRail({ licenseStatus, trail }: Props) {
  return (
    <SectionCard title="Trilho de Decisao Operacional" subtitle="Sequencia de decisoes e responsaveis por licenca.">
      <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)', mb: 0.5 }}>
        Estado atual: <span className="mono">{licenseStatus.toUpperCase()}</span>
      </Typography>
      <Stack spacing={1.25}>
        {steps.map((step, index) => (
          <Stack
            key={step}
            direction="row"
            spacing={1.5}
            alignItems="flex-start"
            sx={{ position: 'relative', pl: 0.2 }}
          >
            <Box sx={{ mt: 0.2, color: trail[index] ? 'var(--controlroom-accent)' : 'var(--controlroom-ink-muted)' }}>
              {trail[index] ? <TaskAltOutlinedIcon fontSize="small" /> : <CircleOutlinedIcon fontSize="small" />}
            </Box>
            <Stack spacing={0.3}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {step}
              </Typography>
              {trail[index] ? (
                <Typography variant="caption" className="mono" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                  {trail[index].timestamp} - {trail[index].requestedBy}
                </Typography>
              ) : (
                <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                  Sem registro local nesta sessao
                </Typography>
              )}
            </Stack>
          </Stack>
        ))}
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
        A trilha local mostra as ultimas decisoes executadas nesta sessao de operacao.
      </Typography>
    </SectionCard>
  );
}
