import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import { SectionCard } from '../../design/components/SectionCard';
import { useI18n } from '../../i18n';
import type { AdminPlan } from '../../types/api';

type Props = {
  plan: AdminPlan;
  onEdit?: (plan: AdminPlan) => void;
  editDisabled?: boolean;
};

export function PlanSummaryCard({ plan, onEdit, editDisabled = false }: Props) {
  const { t } = useI18n();

  return (
    <SectionCard
      elevated
      actions={
        onEdit ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditOutlinedIcon />}
            onClick={() => onEdit(plan)}
            disabled={editDisabled}
          >
            {t('common.edit')}
          </Button>
        ) : null
      }
      sx={{
        height: '100%',
        backgroundColor: 'var(--controlroom-surface-elevated)'
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ gap: 1.25 }}>
          <Stack spacing={0.45}>
            <Typography variant="h6">{plan.name}</Typography>
            <Typography variant="body2" className="mono" sx={{ color: 'var(--controlroom-ink-muted)' }}>
              {plan.code}
            </Typography>
          </Stack>
          <Box
            sx={{
              px: 1.25,
              py: 1,
              borderRadius: '14px',
              border: '1px solid var(--controlroom-border-soft)',
              backgroundColor: 'var(--controlroom-surface)'
            }}
          >
            <Stack spacing={0.35} alignItems="flex-end">
              <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                {t('plans.card.limits')}
              </Typography>
              <Typography variant="body2" className="mono">
                {t('plans.card.maxDevicesValue', { value: plan.max_devices })}
              </Typography>
              <Typography variant="body2" className="mono" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                {t('plans.card.maxOfflineValue', { value: plan.max_offline_hours })}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
          {plan.description || t('plans.card.descriptionEmptyShort')}
        </Typography>

        <Divider />

        <Stack spacing={1.15}>
          <Stack spacing={0.65}>
            <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
              {t('plans.card.programs')}
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {plan.programs.map((program) => (
                <Chip key={program.id} size="small" label={program.name} />
              ))}
            </Stack>
          </Stack>

          <Stack spacing={0.65}>
            <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
              {t('plans.card.features')}
            </Typography>
            {plan.features.length > 0 ? (
              <Typography variant="body2" className="mono" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                {plan.features.join(' • ')}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                {t('common.noData')}
              </Typography>
            )}
          </Stack>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
