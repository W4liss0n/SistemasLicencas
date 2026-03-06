import { Alert, Button, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AppFrame } from '../design/components/AppFrame';
import { SectionCard } from '../design/components/SectionCard';
import { LicenseActionsPanel } from '../features/license-actions/LicenseActionsPanel';
import { LicenseDetailView } from '../features/license-detail/LicenseDetailView';
import { getLicenseDetails, queryKeys } from '../features/api';
import { ApiError } from '../lib/http/api-error';
import { readOperationTrail } from '../lib/trail/operation-trail';
import { useI18n } from '../i18n';

export function LicenseDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ licenseKey: string }>();
  const licenseKey = params.licenseKey || '';

  const query = useQuery({
    queryKey: queryKeys.license(licenseKey),
    queryFn: () => getLicenseDetails(licenseKey),
    enabled: licenseKey.length > 0
  });

  return (
    <AppFrame title={t('licenseDetail.page.title')} subtitle={t('licenseDetail.page.subtitle')}>
      <Stack spacing={2}>
        <SectionCard title={t('licenseDetail.context.title')}>
          <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
            {t('licenseDetail.context.licenseKey')}: <span className="mono">{licenseKey}</span>
          </Typography>
        </SectionCard>

        {query.isLoading ? <Alert severity="info">{t('licenseDetail.loading')}</Alert> : null}

        {query.isError ? (
          <Alert severity="error">
            {query.error instanceof ApiError && query.error.status === 404
              ? t('licenseDetail.notFound')
              : t('licenseDetail.errorDefault')}{' '}
            <Button component={Link} to="/licenses/provision" size="small">
              {t('licenseDetail.provisionNew')}
            </Button>
          </Alert>
        ) : null}

        {query.data ? (
          <>
            <LicenseActionsPanel licenseKey={licenseKey} />
            <LicenseDetailView data={query.data} trail={readOperationTrail(licenseKey)} />
          </>
        ) : null}
      </Stack>
    </AppFrame>
  );
}
