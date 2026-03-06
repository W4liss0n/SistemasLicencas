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
  CircularProgress,
} from '@mui/material';
import {
  Search,
  Add,
  Edit,
  Cancel,
  CheckCircle,
  Warning,
  Autorenew,
} from '@mui/icons-material';
import type { Assinatura } from '../types';
import { assinaturaApi } from '../services/api';

export function Assinaturas() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadAssinaturas();
  }, [page, rowsPerPage, searchTerm]);

  const loadAssinaturas = async () => {
    try {
      setLoading(true);
      const response = await assinaturaApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm,
      });
      setAssinaturas(response.data || []);
      setTotalCount(response.total || 0);
    } catch (error) {
      console.error('Error loading assinaturas:', error);
      setAssinaturas([]);
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

  const handleCancel = async (id: string) => {
    if (window.confirm('Tem certeza que deseja cancelar esta assinatura?')) {
      try {
        await assinaturaApi.cancel(id);
        loadAssinaturas();
      } catch (error) {
        console.error('Error canceling assinatura:', error);
      }
    }
  };

  const getStatusChip = (status: string, autoRenovar: boolean) => {
    const statusConfig = {
      ativa: { color: 'success' as const, icon: <CheckCircle fontSize="small" /> },
      expirada: { color: 'error' as const, icon: <Warning fontSize="small" /> },
      cancelada: { color: 'default' as const, icon: <Cancel fontSize="small" /> },
      suspensa: { color: 'warning' as const, icon: <Warning fontSize="small" /> },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.cancelada;

    return (
      <Box display="flex" gap={1}>
        <Chip
          label={status}
          color={config.color}
          size="small"
          icon={config.icon}
        />
        {autoRenovar && status === 'ativa' && (
          <Chip
            label="Auto-renovação"
            size="small"
            icon={<Autorenew fontSize="small" />}
            variant="outlined"
          />
        )}
      </Box>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return 'Expirada';
    if (diff === 0) return 'Expira hoje';
    if (diff === 1) return '1 dia';
    return `${diff} dias`;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Assinaturas</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
        >
          Nova Assinatura
        </Button>
      </Box>

      <Paper>
        <Box p={2}>
          <TextField
            fullWidth
            placeholder="Buscar por cliente, plano..."
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
        ) : assinaturas.length > 0 ? (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Plano</TableCell>
                    <TableCell>Início</TableCell>
                    <TableCell>Fim</TableCell>
                    <TableCell>Validade</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assinaturas.map((assinatura) => (
                    <TableRow key={assinatura.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {assinatura.cliente?.nome || 'N/A'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {assinatura.cliente?.email}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {assinatura.plano?.nome || 'N/A'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            R$ {assinatura.plano?.preco?.toFixed(2) || '0,00'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{formatDate(assinatura.data_inicio)}</TableCell>
                      <TableCell>{formatDate(assinatura.data_fim)}</TableCell>
                      <TableCell>
                        <Chip
                          label={getDaysRemaining(assinatura.data_fim)}
                          size="small"
                          color={
                            getDaysRemaining(assinatura.data_fim) === 'Expirada'
                              ? 'error'
                              : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {getStatusChip(assinatura.status, assinatura.auto_renovar)}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="primary">
                          <Edit />
                        </IconButton>
                        {assinatura.status === 'ativa' && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleCancel(assinatura.id)}
                          >
                            <Cancel />
                          </IconButton>
                        )}
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
              Nenhuma assinatura encontrada
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}