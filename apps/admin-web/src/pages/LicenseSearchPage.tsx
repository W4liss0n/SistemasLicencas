import { Alert, Stack } from '@mui/material';
import { AppFrame } from '../design/components/AppFrame';
import { SectionCard } from '../design/components/SectionCard';
import { LicenseSearchForm } from '../features/license-search/LicenseSearchForm';
import { useI18n } from '../i18n';

export function LicenseSearchPage() {
  const { t } = useI18n();

  return (
    <AppFrame title={t('licenseSearch.page.title')} subtitle={t('licenseSearch.page.subtitle')}>
      <Stack spacing={2}>
        <SectionCard title={t('licenseSearch.page.cardTitle')} subtitle={t('licenseSearch.page.cardSubtitle')}>
          <LicenseSearchForm autoFocus />
        </SectionCard>
        <Alert severity="info">{t('licenseSearch.page.tip')}</Alert>
      </Stack>
    </AppFrame>
  );
}
