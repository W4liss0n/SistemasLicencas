import SearchIcon from '@mui/icons-material/Search';
import { Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';

type Props = {
  autoFocus?: boolean;
};

export function LicenseSearchForm({ autoFocus = false }: Props) {
  const [licenseKey, setLicenseKey] = useState('');
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <Stack spacing={1.25}>
      <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
        {t('license.searchForm.caption')}
      </Typography>
      <Stack
        component="form"
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.25}
        onSubmit={(event) => {
          event.preventDefault();
          if (licenseKey.trim().length === 0) {
            return;
          }
          navigate(`/licenses/${encodeURIComponent(licenseKey.trim())}`);
        }}
      >
        <TextField
          autoFocus={autoFocus}
          size="small"
          label={t('license.searchForm.label')}
          value={licenseKey}
          onChange={(event) => setLicenseKey(event.target.value)}
          placeholder={t('license.searchForm.placeholder')}
          fullWidth
        />
        <Button type="submit" variant="contained" startIcon={<SearchIcon />}>
          {t('license.searchForm.button')}
        </Button>
      </Stack>
    </Stack>
  );
}
