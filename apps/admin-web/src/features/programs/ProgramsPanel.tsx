import { zodResolver } from '@hookform/resolvers/zod';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { queryClient } from '../../app/query-client';
import { isMutationsEnabled } from '../../app/runtime-config';
import { getOperatorName } from '../../app/session';
import { SectionCard } from '../../design/components/SectionCard';
import { useI18n } from '../../i18n';
import { ApiError } from '../../lib/http/api-error';
import { createIdempotencyKey } from '../../lib/idempotency/create-idempotency-key';
import { StatusChip } from '../../design/components/StatusChip';
import { createProgram, listPrograms, queryKeys } from '../api';

const formSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  description: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

export function ProgramsPanel() {
  const operator = getOperatorName() || 'operator';
  const mutationsEnabled = isMutationsEnabled();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { t } = useI18n();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: ''
    }
  });

  const programsQuery = useQuery({
    queryKey: queryKeys.programs(1, 20, search),
    queryFn: () => listPrograms({ page: 1, pageSize: 20, q: search })
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const idempotencyKey = createIdempotencyKey();
      return createProgram(
        {
          name: values.name,
          description: values.description || undefined,
          requested_by: operator
        },
        idempotencyKey
      );
    },
    onSuccess: (response) => {
      setCreatedCode(response.program.code);
      setIsCreateOpen(false);
      form.reset({
        name: '',
        description: ''
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.programs(1, 20, search) });
      queryClient.invalidateQueries({ queryKey: queryKeys.programs(1, 100, '') });
    }
  });

  return (
    <>
      <SectionCard
        title={t('programs.list.title')}
        subtitle={t('programs.list.subtitle')}
        actions={
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <TextField
              label={t('programs.list.searchLabel')}
              size="small"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Button variant="outlined" startIcon={<SearchOutlinedIcon />} onClick={() => setSearch(searchInput)}>
              {t('common.search')}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineOutlinedIcon />}
              onClick={() => setIsCreateOpen(true)}
              disabled={!mutationsEnabled}
            >
              {t('programs.create.open')}
            </Button>
          </Stack>
        }
      >
        <Stack spacing={1.25}>
          {!mutationsEnabled ? <Alert severity="warning">{t('mutations.disabled')}</Alert> : null}

          {createdCode ? (
            <Alert icon={<CheckCircleOutlineOutlinedIcon fontSize="inherit" />} severity="success">
              {t('programs.create.success', { code: createdCode })}
            </Alert>
          ) : null}

          {programsQuery.status === 'pending' ? <Alert severity="info">{t('programs.list.loading')}</Alert> : null}

          {programsQuery.error instanceof ApiError ? (
            <Alert severity="error">
              {programsQuery.error.problem.title}: {programsQuery.error.problem.detail || t('programs.list.errorDefault')}
            </Alert>
          ) : null}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('programs.table.code')}</TableCell>
                  <TableCell>{t('programs.table.name')}</TableCell>
                  <TableCell>{t('programs.table.status')}</TableCell>
                  <TableCell>{t('programs.table.createdAt')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(programsQuery.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="mono">{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      <StatusChip status={item.status} />
                    </TableCell>
                    <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {programsQuery.data && programsQuery.data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                        {t('programs.list.empty')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </SectionCard>

      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('programs.create.title')}</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            spacing={1.2}
            sx={{ pt: 1 }}
            onSubmit={form.handleSubmit((values) => {
              if (!mutationsEnabled) {
                return;
              }
              createMutation.mutate(values);
            })}
          >
            <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
              {t('programs.create.subtitle')}
            </Typography>

            {createMutation.error instanceof ApiError ? (
              <Alert severity="error">
                {createMutation.error.problem.title}: {createMutation.error.problem.detail || t('programs.create.errorDefault')}
              </Alert>
            ) : null}

            <TextField
              label={t('programs.create.name')}
              size="small"
              fullWidth
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <TextField label={t('programs.create.description')} size="small" fullWidth {...form.register('description')} />

            <DialogActions sx={{ px: 0, pb: 0 }}>
              <Button type="button" variant="outlined" onClick={() => form.reset()} disabled={createMutation.isPending}>
                {t('common.clear')}
              </Button>
              <Button type="submit" variant="contained" disabled={!mutationsEnabled || createMutation.isPending}>
                {createMutation.isPending ? t('programs.create.submitting') : t('programs.create.submit')}
              </Button>
            </DialogActions>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
