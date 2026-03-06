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
  TextField,
  InputAdornment,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Button,
  Grid,
} from '@mui/material';
import {
  Search,
  FilterList,
  Refresh,
  Info,
  Warning,
  Error,
  CheckCircle,
  Schedule,
  Clear,
} from '@mui/icons-material';
import { logsApi } from '../services/api';

interface Log {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  category: string;
  action: string;
  user_id?: string;
  user_email?: string;
  ip_address?: string;
  details?: any;
  metadata?: any;
}

export function Logs() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [page, rowsPerPage, searchTerm, levelFilter, categoryFilter, dateFilter]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await logsApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm,
        level: levelFilter !== 'all' ? levelFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        date: dateFilter,
      });

      // Aplicar filtros localmente se necessário
      let filteredLogs = response.data || [];

      // Filtro de busca local
      if (searchTerm) {
        filteredLogs = filteredLogs.filter((log: Log) =>
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (log.user_email && log.user_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (log.category && log.category.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      // Filtro de nível local
      if (levelFilter !== 'all') {
        filteredLogs = filteredLogs.filter((log: Log) => log.level === levelFilter);
      }

      // Filtro de categoria local
      if (categoryFilter !== 'all') {
        filteredLogs = filteredLogs.filter((log: Log) => log.category === categoryFilter);
      }

      setLogs(filteredLogs);
      setTotalCount(filteredLogs.length);
    } catch (error) {
      console.error('Error loading logs:', error);
      setLogs([]);
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

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setLevelFilter('all');
    setCategoryFilter('all');
    setDateFilter('today');
    setPage(0);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info':
        return <Info fontSize="small" />;
      case 'warning':
        return <Warning fontSize="small" />;
      case 'error':
        return <Error fontSize="small" />;
      case 'success':
        return <CheckCircle fontSize="small" />;
      default:
        return <Info fontSize="small" />;
    }
  };

  const getLevelColor = (level: string): 'info' | 'warning' | 'error' | 'success' | 'default' => {
    switch (level) {
      case 'info':
        return 'info';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      case 'success':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    // Se o timestamp já está formatado (ex: "Há 2 minutos"), retornar como está
    if (timestamp && !timestamp.match(/^\d{4}-/)) {
      return timestamp;
    }

    const date = new Date(timestamp);
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      return timestamp; // Retornar o valor original se não for uma data válida
    }

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const categories = [
    'authentication',
    'license',
    'validation',
    'subscription',
    'payment',
    'security',
    'system',
    'api',
    'admin',
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1976d2', mb: 0.5 }}>
              Logs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Monitore eventos e atividades do sistema
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              variant={autoRefresh ? 'contained' : 'outlined'}
              onClick={() => setAutoRefresh(!autoRefresh)}
              startIcon={<Schedule />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            <Button
              variant="outlined"
              onClick={loadLogs}
              startIcon={<Refresh />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Atualizar
            </Button>
          </Box>
        </Box>
      </Box>

      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Buscar em logs..."
              value={searchTerm}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Nível</InputLabel>
              <Select
                value={levelFilter}
                label="Nível"
                onChange={(e) => {
                  setLevelFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="success">Success</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Categoria</InputLabel>
              <Select
                value={categoryFilter}
                label="Categoria"
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="all">Todas</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Período</InputLabel>
              <Select
                value={dateFilter}
                label="Período"
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="today">Hoje</MenuItem>
                <MenuItem value="yesterday">Ontem</MenuItem>
                <MenuItem value="week">Última semana</MenuItem>
                <MenuItem value="month">Último mês</MenuItem>
                <MenuItem value="all">Todos</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={handleClearFilters}
              startIcon={<Clear />}
              sx={{ height: '56px' }}
            >
              Limpar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : logs.length > 0 ? (
          <>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell width="180" sx={{ fontWeight: 600 }}>Timestamp</TableCell>
                  <TableCell width="100" sx={{ fontWeight: 600 }}>Nível</TableCell>
                  <TableCell width="120" sx={{ fontWeight: 600 }}>Categoria</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Ação</TableCell>
                  <TableCell width="150" sx={{ fontWeight: 600 }}>Usuário</TableCell>
                  <TableCell width="120" sx={{ fontWeight: 600 }}>IP</TableCell>
                  <TableCell width="100" align="center" sx={{ fontWeight: 600 }}>Detalhes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {formatTimestamp(log.timestamp)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.level}
                        size="small"
                        color={getLevelColor(log.level)}
                        icon={getLevelIcon(log.level)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.category}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: '400px' }}>
                        {log.action}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {log.user_email ? (
                        <Typography variant="body2" noWrap>
                          {log.user_email}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Sistema
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {log.ip_address || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {log.details && (
                        <Tooltip title={JSON.stringify(log.details, null, 2)}>
                          <IconButton size="small">
                            <Info fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Logs por página:"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`
              }
            />
          </>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Alert severity="info" sx={{ maxWidth: 400, mx: 'auto' }}>
              <Typography variant="body1" gutterBottom>
                Nenhum log encontrado
              </Typography>
              <Typography variant="body2">
                {searchTerm || levelFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Os logs aparecem conforme as atividades são realizadas no sistema'}
              </Typography>
            </Alert>
          </Box>
        )}
      </TableContainer>
    </Box>
  );
}