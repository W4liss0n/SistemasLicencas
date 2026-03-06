import { Alert, Grid, Stack, Typography } from '@mui/material';
import { OperationalRail } from '../../design/components/OperationalRail';
import { SectionCard } from '../../design/components/SectionCard';
import { StatusChip } from '../../design/components/StatusChip';
import type { AdminLicenseResponse, OperationTrailEntry } from '../../types/api';

type Props = {
  data: AdminLicenseResponse;
  trail: OperationTrailEntry[];
};

function Field({ label, value, mono = false }: { label: string; value: string | number | null; mono?: boolean }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
        {label}
      </Typography>
      <Typography className={mono ? 'mono' : undefined} variant="body2" sx={{ fontWeight: 600 }}>
        {value ?? '-'}
      </Typography>
    </Stack>
  );
}

export function LicenseDetailView({ data, trail }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, xl: 8.5 }}>
        <Stack spacing={2}>
          <SectionCard
            title="Licenca"
            subtitle="Identificador, limites de sessao offline e controle de transferencia."
            actions={<StatusChip status={data.license.status} />}
          >
            <Grid container spacing={1.4}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Field label="License key" value={data.license.license_key} mono />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Field label="License id" value={data.license.id} mono />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Field label="Transfer count" value={data.license.transfer_count} mono />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Field label="Max offline hours" value={data.license.max_offline_hours} mono />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Field label="Created at" value={data.license.created_at} mono />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Field label="Updated at" value={data.license.updated_at} mono />
              </Grid>
            </Grid>
          </SectionCard>

          <SectionCard title="Assinatura / Plano / Cliente" subtitle="Composicao contratual ativa para a licenca selecionada.">
            <Grid container spacing={1.4}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Field label="Subscription status" value={data.subscription.status} mono />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Field label="Start at" value={data.subscription.start_at} mono />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Field label="End at" value={data.subscription.end_at} mono />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Field label="Plan" value={`${data.plan.name} (${data.plan.code})`} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Field label="Max devices" value={data.plan.max_devices} mono />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Field label="Customer" value={data.customer.name} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Field label="Customer email" value={data.customer.email} mono />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Field label="Document" value={data.customer.document} mono />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                  Features: {data.plan.features.length > 0 ? data.plan.features.join(', ') : 'sem features'}
                </Typography>
              </Grid>
            </Grid>
          </SectionCard>

          <SectionCard title="Dispositivos vinculados" subtitle="Inventario atual de fingerprints associados a esta chave.">
            {data.devices.length === 0 ? (
              <Alert severity="info">Nenhum dispositivo vinculado para esta licenca.</Alert>
            ) : (
              <Stack spacing={1.2}>
                {data.devices.map((device) => (
                  <SectionCard key={device.id} elevated>
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Field label="Device id" value={device.id} mono />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Field label="Fingerprint" value={device.fingerprint_hash} mono />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Field label="Status" value={device.is_active ? 'active' : 'inactive'} mono />
                      </Grid>
                    </Grid>
                  </SectionCard>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, xl: 3.5 }}>
        <OperationalRail licenseStatus={data.license.status} trail={trail} />
      </Grid>
    </Grid>
  );
}
