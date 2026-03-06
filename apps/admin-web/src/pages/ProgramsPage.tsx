import { AppFrame } from '../design/components/AppFrame';
import { ProgramsPanel } from '../features/programs/ProgramsPanel';
import { useI18n } from '../i18n';

export function ProgramsPage() {
  const { t } = useI18n();

  return (
    <AppFrame title={t('programs.page.title')} subtitle={t('programs.page.subtitle')}>
      <ProgramsPanel />
    </AppFrame>
  );
}
