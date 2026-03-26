import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Tab,
  Tabs,
  Typography
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState, type SyntheticEvent } from 'react';
import { useI18n } from '../../i18n';
import type { AdminCustomerListItem } from '../../types/api';
import { getCustomerDetails, queryKeys } from '../api';
import { CustomerLicenseCard } from './CustomerLicenseCard';

type Props = {
  customer: AdminCustomerListItem;
  onOpenOnboarding?: (customer: AdminCustomerListItem) => void;
};

function statusChip(status: string | null): { color: string; backgroundColor: string } {
  if (status === 'pending') {
    return {
      color: 'var(--controlroom-warning)',
      backgroundColor: 'var(--controlroom-warning-surface)'
    };
  }

  if (status === 'active') {
    return {
      color: 'var(--controlroom-success)',
      backgroundColor: 'var(--controlroom-success-surface)'
    };
  }

  if (status === 'blocked' || status === 'cancelled' || status === 'expired' || status === 'inactive') {
    return {
      color: 'var(--controlroom-warning)',
      backgroundColor: 'var(--controlroom-warning-surface)'
    };
  }

  return {
    color: 'var(--controlroom-ink-secondary)',
    backgroundColor: 'var(--controlroom-surface-strong)'
  };
}

export function CustomerRecordAccordion({ customer, onOpenOnboarding }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'customer' | 'licenses'>('customer');
  const { formatDateTime, t } = useI18n();
  const isPendingCustomer = customer.licenses_count === 0 || !customer.last_subscription_status;
  const summaryStatus = isPendingCustomer ? 'pending' : customer.last_subscription_status;
  const summaryStatusLabel = isPendingCustomer
    ? t('customers.detail.pendingStatus')
    : customer.last_subscription_status ?? t('common.noData');

  const detailsQuery = useQuery({
    queryKey: queryKeys.customerDetail(customer.id),
    queryFn: () => getCustomerDetails(customer.id),
    enabled: expanded
  });

  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={(_, nextExpanded) => setExpanded(nextExpanded)}
      sx={{
        border: '1px solid var(--controlroom-border-soft)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--controlroom-surface-elevated)',
        '&::before': {
          display: 'none'
        },
        '& + &': {
          mt: 1.25
        }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreOutlinedIcon />}
        sx={{
          px: 2,
          py: 1.2,
          '& .MuiAccordionSummary-content': {
            my: 0
          }
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          sx={{ width: '100%', gap: 1.25 }}
        >
          <Stack spacing={0.35}>
            <Typography variant="subtitle1">{customer.name}</Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
              <MailOutlineOutlinedIcon fontSize="small" sx={{ color: 'var(--controlroom-ink-muted)' }} />
              <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                {customer.email}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip
              size="small"
              icon={<ReceiptLongOutlinedIcon fontSize="small" />}
              label={t('customers.detail.licensesCountValue', { value: customer.licenses_count })}
            />
            <Chip
              size="small"
              label={summaryStatusLabel}
              sx={statusChip(summaryStatus)}
            />
          </Stack>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
        <Tabs
          value={tab}
          onChange={(_: SyntheticEvent, value: 'customer' | 'licenses') => setTab(value)}
          sx={{
            mb: 1.5,
            minHeight: 0,
            '& .MuiTab-root': {
              minHeight: 0,
              px: 1.2,
              py: 0.8
            }
          }}
        >
          <Tab value="customer" label={t('customers.detail.tabCustomer')} />
          <Tab value="licenses" label={t('customers.detail.tabLicenses')} />
        </Tabs>

        {detailsQuery.status === 'pending' ? <Alert severity="info">{t('customers.detail.loading')}</Alert> : null}

        {detailsQuery.status === 'error' ? <Alert severity="error">{t('customers.detail.errorDefault')}</Alert> : null}

        {detailsQuery.status === 'success' && tab === 'customer' ? (
          <Stack spacing={1.2}>
            {detailsQuery.data.licenses.length === 0 ? (
              <Alert
                severity="warning"
                action={
                  onOpenOnboarding ? (
                    <Button color="inherit" size="small" onClick={() => onOpenOnboarding(customer)}>
                      {t('customers.detail.pendingAction')}
                    </Button>
                  ) : undefined
                }
              >
                <strong>{t('customers.detail.pendingAlertTitle')}</strong> {t('customers.detail.pendingAlertBody')}
              </Alert>
            ) : null}

            <Box
              sx={{
                p: 1.35,
                borderRadius: '14px',
                border: '1px solid var(--controlroom-border-soft)',
                backgroundColor: 'var(--controlroom-surface)'
              }}
            >
              <Stack spacing={0.8}>
                <Typography variant="body2">
                  <strong>{t('customers.form.name')}:</strong> {detailsQuery.data.customer.name}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('customers.form.email')}:</strong> {detailsQuery.data.customer.email}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('customers.form.document')}:</strong>{' '}
                  {detailsQuery.data.customer.document || t('customers.detail.documentEmpty')}
                </Typography>
              </Stack>
            </Box>

            <Box
              sx={{
                p: 1.35,
                borderRadius: '14px',
                border: '1px solid var(--controlroom-border-soft)',
                backgroundColor: 'var(--controlroom-surface)'
              }}
            >
              <Stack spacing={0.8}>
                <Typography variant="body2">
                  <strong>{t('customers.detail.createdAt')}:</strong>{' '}
                  {formatDateTime(new Date(detailsQuery.data.customer.created_at))}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('customers.detail.updatedAt')}:</strong>{' '}
                  {formatDateTime(new Date(detailsQuery.data.customer.updated_at))}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('customers.detail.licensesCount')}:</strong> {detailsQuery.data.licenses.length}
                </Typography>
              </Stack>
            </Box>
          </Stack>
        ) : null}

        {detailsQuery.status === 'success' && tab === 'licenses' ? (
          detailsQuery.data.licenses.length > 0 ? (
            <Stack spacing={1.25}>
              {detailsQuery.data.licenses.map((entry) => (
                <CustomerLicenseCard key={entry.license.id} customerId={customer.id} entry={entry} />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-muted)' }}>
              {t('customers.detail.licensesEmpty')}
            </Typography>
          )
        ) : null}
      </AccordionDetails>
    </Accordion>
  );
}
