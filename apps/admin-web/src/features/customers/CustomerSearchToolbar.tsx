import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { Button, Stack, TextField } from '@mui/material';
import { useI18n } from '../../i18n';

type Props = {
  searchInput: string;
  mutationsEnabled: boolean;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onOpenOnboarding: () => void;
};

export function CustomerSearchToolbar({
  searchInput,
  mutationsEnabled,
  onSearchInputChange,
  onSearch,
  onOpenOnboarding
}: Props) {
  const { t } = useI18n();

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
      <TextField
        label={t('customers.list.searchLabel')}
        size="small"
        value={searchInput}
        onChange={(event) => onSearchInputChange(event.target.value)}
      />
      <Button variant="outlined" startIcon={<SearchOutlinedIcon />} onClick={onSearch}>
        {t('common.search')}
      </Button>
      <Button
        variant="contained"
        startIcon={<AddCircleOutlineOutlinedIcon />}
        onClick={onOpenOnboarding}
        disabled={!mutationsEnabled}
      >
        {t('customers.create.open')}
      </Button>
    </Stack>
  );
}
