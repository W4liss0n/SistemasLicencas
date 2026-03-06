import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Search,
  Add,
  Block,
  Check,
  ContentCopy,
  Info,
  Warning,
  Computer,
  AccessTime,
} from '@mui/icons-material';
import type { Licenca } from '../types';
import { licencaApi } from '../services/api';

export function Licencas() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [selectedLicenca, setSelectedLicenca] = useState<Licenca | null>(null);
  const [licencas, setLicencas] = useState<Licenca[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadLicencas();
  }, [page, rowsPerPage, searchTerm]);

  const loadLicencas = async () => {
    try {
      setLoading(true);
      const response = await licencaApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm,
      });
      setLicencas(response.data || []);
      setTotalCount(response.total || 0);
    } catch (error) {
      console.error('Error loading licencas:', error);
      setLicencas([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleBlock = async (id: string) => {
    if (window.confirm('Tem certeza que deseja bloquear esta licença?')) {
      try {
        await licencaApi.block(id);
        loadLicencas();
      } catch (error) {
        console.error('Error blocking licenca:', error);
      }
    }
  };

  const handleUnblock = async (id: string) => {
    if (window.confirm('Tem certeza que deseja desbloquear esta licença?')) {
      try {
        await licencaApi.unblock(id);
        loadLicencas();
      } catch (error) {
        console.error('Error unblocking licenca:', error);
      }
    }
  };

  const handleViewDetails = (licenca: Licenca) => {
    setSelectedLicenca(licenca);
    setOpenDetailsDialog(true);
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  const getStatusChip = (status: string) => {
    const statusConfig = {
      ativa: { color: 'success' as const, icon: <Check fontSize="small" /> },
      inativa: { color: 'default' as const, icon: <Block fontSize="small" /> },
      bloqueada: { color: 'error' as const, icon: <Block fontSize="small" /> },
      transferida: { color: 'info' as const, icon: <Computer fontSize="small" /> },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inativa;

    return (
      <Chip
        label={status}
        color={config.color}
        size="small"
        icon={config.icon}
      />
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getOfflineDaysRemaining = (maxOfflineHours: number, lastAccess: string | null) => {
    if (!lastAccess) return maxOfflineHours / 24;

    const last = new Date(lastAccess);
    const now = new Date();
    const hoursOffline = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
    const remainingHours = maxOfflineHours - hoursOffline;

    if (remainingHours <= 0) return 0;
    return Math.ceil(remainingHours / 24);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Licenças</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
        >
          Nova Licença
        </Button>
      </Box>

      <Paper>
        <Box p={2}>
          <TextField
            fullWidth
            placeholder="Buscar por chave de licença, cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : licencas.length > 0 ? (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Chave de Licença</TableCell>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Programa</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Último Acesso</TableCell>
                    <TableCell>Offline Restante</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {licencas.map((licenca) => (
                    <TableRow key={licenca.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {licenca.license_key.substring(0, 8)}...
                          </Typography>
                          <Tooltip title="Copiar chave">
                            <IconButton
                              size="small"
                              onClick={() => handleCopyKey(licenca.license_key)}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {licenca.assinatura?.cliente?.nome || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {licenca.programa?.nome || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>{getStatusChip(licenca.status)}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {formatDate(licenca.ultimo_acesso)}
                          </Typography>
                          {licenca.ultimo_ip && (
                            <Typography variant="caption" color="textSecondary">
                              IP: {licenca.ultimo_ip}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${getOfflineDaysRemaining(
                            licenca.max_offline_hours,
                            licenca.ultimo_acesso
                          )} dias`}
                          size="small"
                          icon={<AccessTime fontSize="small" />}
                          color={
                            getOfflineDaysRemaining(
                              licenca.max_offline_hours,
                              licenca.ultimo_acesso
                            ) <= 1
                              ? 'warning'
                              : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Ver detalhes">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => handleViewDetails(licenca)}
                          >
                            <Info />
                          </IconButton>
                        </Tooltip>
                        {licenca.status === 'ativa' ? (
                          <Tooltip title="Bloquear licença">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleBlock(licenca.id)}
                            >
                              <Block />
                            </IconButton>
                          </Tooltip>
                        ) : licenca.status === 'bloqueada' ? (
                          <Tooltip title="Desbloquear licença">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleUnblock(licenca.id)}
                            >
                              <Check />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        ) : (
          <Box p={3} textAlign="center">
            <Typography color="textSecondary">
              Nenhuma licença encontrada
            </Typography>
          </Box>
        )}
      </Paper>

      <Dialog
        open={openDetailsDialog}
        onClose={() => setOpenDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Detalhes da Licença</DialogTitle>
        <DialogContent>
          {selectedLicenca && (
            <Box>
              <Typography variant="subtitle2" color="textSecondary">
                Chave de Licença
              </Typography>
              <Typography
                variant="body1"
                sx={{ fontFamily: 'monospace', mb: 2 }}
              >
                {selectedLicenca.license_key}
              </Typography>

              <Typography variant="subtitle2" color="textSecondary">
                Device Fingerprint
              </Typography>
              <Paper sx={{ p: 1, mb: 2 }}>
                <pre style={{ margin: 0, fontSize: '0.9rem' }}>
                  {JSON.stringify(selectedLicenca.device_fingerprint, null, 2)}
                </pre>
              </Paper>

              <Typography variant="subtitle2" color="textSecondary">
                Informações de Acesso
              </Typography>
              <Typography variant="body2">
                Último Acesso: {formatDate(selectedLicenca.ultimo_acesso)}
              </Typography>
              <Typography variant="body2">
                Último IP: {selectedLicenca.ultimo_ip || 'N/A'}
              </Typography>
              <Typography variant="body2">
                Max Offline: {selectedLicenca.max_offline_hours} horas
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}