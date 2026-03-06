import { AppFrame } from '../design/components/AppFrame';
import { OperationalSummaryPanel } from '../features/operational-summary/OperationalSummaryPanel';
import { useI18n } from '../i18n';

export function DashboardPage() {
  const { t } = useI18n();

  return (
    <AppFrame title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>
      <OperationalSummaryPanel />
    </AppFrame>
  );
}
