import { AppFrame } from '../design/components/AppFrame';
import { PlansPanel } from '../features/plans/PlansPanel';
import { useI18n } from '../i18n';

export function PlansPage() {
  const { t } = useI18n();

  return (
    <AppFrame title={t('plans.page.title')} subtitle={t('plans.page.subtitle')}>
      <PlansPanel />
    </AppFrame>
  );
}
