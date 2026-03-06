import { AppFrame } from '../design/components/AppFrame';
import { CustomersPanel } from '../features/customers/CustomersPanel';
import { useI18n } from '../i18n';

export function CustomersPage() {
  const { t } = useI18n();

  return (
    <AppFrame
      title={t('customers.page.title')}
      subtitle={t('customers.page.subtitle')}
    >
      <CustomersPanel />
    </AppFrame>
  );
}
