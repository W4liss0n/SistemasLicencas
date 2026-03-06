import { Stack } from '@mui/material';
import { AppFrame } from '../design/components/AppFrame';
import { ProvisionLicenseForm } from '../features/license-provision/ProvisionLicenseForm';
import { useI18n } from '../i18n';

export function LicenseProvisionPage() {
  const { t } = useI18n();

  return (
    <AppFrame title={t('provision.page.title')} subtitle={t('provision.page.subtitle')}>
      <Stack spacing={2}>
        <ProvisionLicenseForm />
      </Stack>
    </AppFrame>
  );
}
