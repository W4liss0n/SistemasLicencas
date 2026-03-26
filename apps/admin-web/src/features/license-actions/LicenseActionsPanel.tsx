import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { queryClient } from '../../app/query-client';
import { isMutationsEnabled } from '../../app/runtime-config';
import { getOperatorContextName } from '../../app/session';
import { createIdempotencyKey } from '../../lib/idempotency/create-idempotency-key';
import { ApiError } from '../../lib/http/api-error';
import { appendOperationTrail } from '../../lib/trail/operation-trail';
import type { OperationAction } from '../../types/api';
import { blockLicense, cancelLicense, queryKeys, renewLicense, unblockLicense } from '../api';
import { SectionCard } from '../../design/components/SectionCard';

const renewSchema = z.object({
  new_end_at: z.string().min(10),
  reason: z.string().optional()
});

const actionSchema = z.object({
  reason: z.string().optional()
});

type Props = {
  licenseKey: string;
};

export function LicenseActionsPanel({ licenseKey }: Props) {
  const operator = getOperatorContextName() || 'operator';
  const mutationsEnabled = isMutationsEnabled();
  const [dialog, setDialog] = useState<OperationAction | null>(null);

  const renewForm = useForm<z.infer<typeof renewSchema>>({
    resolver: zodResolver(renewSchema),
    defaultValues: { new_end_at: '', reason: '' }
  });

  const actionForm = useForm<z.infer<typeof actionSchema>>({
    resolver: zodResolver(actionSchema),
    defaultValues: { reason: '' }
  });

  const mutation = useMutation({
    mutationFn: async (payload: { action: OperationAction; reason?: string; new_end_at?: string }) => {
      const idempotencyKey = createIdempotencyKey();

      if (payload.action === 'renew') {
        return renewLicense(
          licenseKey,
          {
            new_end_at: payload.new_end_at || '',
            requested_by: operator,
            reason: payload.reason
          },
          idempotencyKey
        );
      }

      if (payload.action === 'block') {
        return blockLicense(licenseKey, { requested_by: operator, reason: payload.reason }, idempotencyKey);
      }

      if (payload.action === 'unblock') {
        return unblockLicense(licenseKey, { requested_by: operator, reason: payload.reason }, idempotencyKey);
      }

      return cancelLicense(licenseKey, { requested_by: operator, reason: payload.reason }, idempotencyKey);
    },
    onSuccess: (_, variables) => {
      appendOperationTrail({
        licenseKey,
        action: variables.action,
        requestedBy: operator,
        reason: variables.reason,
        timestamp: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.license(licenseKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.summary(7) });
      setDialog(null);
      renewForm.reset();
      actionForm.reset();
    }
  });

  const getDialogTitle = (action: OperationAction): string => {
    if (action === 'renew') return 'Renovar licenca';
    if (action === 'block') return 'Bloquear licenca';
    if (action === 'unblock') return 'Desbloquear licenca';
    return 'Cancelar licenca';
  };

  const isDestructive = dialog === 'cancel';

  return (
    <SectionCard
      title="Acoes administrativas"
      subtitle="Bloqueio, desbloqueio, renovacao e cancelamento com idempotencia e trilha local."
    >
      <Stack spacing={1.5}>
        {!mutationsEnabled ? (
          <Alert severity="warning">
            Mutacoes desabilitadas por feature flag (VITE_ADMIN_WEB_ENABLE_MUTATIONS=false).
          </Alert>
        ) : null}

        {mutation.error instanceof ApiError ? (
          <Alert severity="error">
            {mutation.error.problem.title}: {mutation.error.problem.detail || 'Falha ao executar acao'}
          </Alert>
        ) : null}

        <Grid container spacing={1}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Button fullWidth variant="contained" onClick={() => setDialog('renew')} disabled={!mutationsEnabled || mutation.isPending}>
              Renovar
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Button fullWidth variant="outlined" color="warning" onClick={() => setDialog('block')} disabled={!mutationsEnabled || mutation.isPending}>
              Bloquear
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Button fullWidth variant="outlined" color="success" onClick={() => setDialog('unblock')} disabled={!mutationsEnabled || mutation.isPending}>
              Desbloquear
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Button fullWidth variant="outlined" color="error" onClick={() => setDialog('cancel')} disabled={!mutationsEnabled || mutation.isPending}>
              Cancelar
            </Button>
          </Grid>
        </Grid>
      </Stack>

      <Dialog open={dialog !== null} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{dialog ? getDialogTitle(dialog) : ''}</DialogTitle>
        <DialogContent>
          {dialog === 'renew' ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Nova data fim"
                size="small"
                placeholder="2027-03-31T23:59:59.000Z"
                {...renewForm.register('new_end_at')}
              />
              <TextField label="Motivo" size="small" {...renewForm.register('reason')} />
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ color: isDestructive ? 'var(--controlroom-danger)' : 'var(--controlroom-ink-secondary)' }}>
                {isDestructive
                  ? 'Acao irreversivel. Confirme o motivo antes de continuar.'
                  : 'Confirme o motivo operacional para registrar na auditoria.'}
              </Typography>
              <TextField label="Motivo" size="small" {...actionForm.register('reason')} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialog(null)}>Fechar</Button>
          <Button
            variant="contained"
            color={isDestructive ? 'error' : 'primary'}
            disabled={mutation.isPending}
            onClick={() => {
              if (!dialog) return;

              if (dialog === 'renew') {
                const values = renewForm.getValues();
                mutation.mutate({ action: 'renew', reason: values.reason, new_end_at: values.new_end_at });
                return;
              }

              const values = actionForm.getValues();
              mutation.mutate({ action: dialog, reason: values.reason });
            }}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </SectionCard>
  );
}
