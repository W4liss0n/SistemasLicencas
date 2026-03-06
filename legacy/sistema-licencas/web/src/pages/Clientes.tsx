import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Pagination,
  Chip,
} from '@mui/material';
import {
  Search,
  Add,
  FilterList,
  PersonAdd,
} from '@mui/icons-material';
import type { Cliente } from '../types';
import { clienteApi, planoApi } from '../services/api';
import { ClientAccordion } from '../components/ClientAccordion';

export function Clientes() {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedClientes, setExpandedClientes] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    empresa: '',
    usuario: '',
    senha: '',
    plano_id: '',
    status: 'ativo' as const,
  });
  const [planos, setPlanos] = useState<any[]>([]);

  useEffect(() => {
    loadClientes();
  }, [page, rowsPerPage, searchTerm]);

  useEffect(() => {
    loadPlanos();
  }, []); // Carrega planos apenas uma vez

  const loadPlanos = async () => {
    try {
      const response = await planoApi.getAll();
      console.log('Planos carregados:', response);
      setPlanos(response.data || []);
    } catch (error) {
      console.error('Error loading planos:', error);
    }
  };

  const loadClientes = async () => {
    try {
      setLoading(true);
      const response = await clienteApi.getAll({
        page: page,
        limit: rowsPerPage,
        search: searchTerm,
      });
      setClientes(response.data || []);
      setTotalCount(response.total || 0);
    } catch (error) {
      console.error('Error loading clientes:', error);
      setClientes([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage);
    setExpandedClientes(new Set());
  };

  const handleToggleAccordion = (clienteId: string) => {
    setExpandedClientes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clienteId)) {
        newSet.delete(clienteId);
      } else {
        newSet.add(clienteId);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    if (expandedClientes.size === clientes.length) {
      setExpandedClientes(new Set());
    } else {
      setExpandedClientes(new Set(clientes.map(c => c.id)));
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      empresa: '',
      usuario: '',
      senha: '',
      plano_id: '',
      status: 'ativo',
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSave = async () => {
    // Validação frontend - apenas nome é obrigatório
    if (!formData.nome?.trim()) {
      alert('Nome é obrigatório!');
      return;
    }

    try {
      await clienteApi.create(formData);
      handleCloseDialog();
      loadClientes();
    } catch (error: any) {
      console.error('Error saving cliente:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao salvar cliente';
      alert(errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await clienteApi.delete(id);
      setExpandedClientes(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      loadClientes();
    } catch (error) {
      console.error('Error deleting cliente:', error);
    }
  };

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1976d2', mb: 0.5 }}>
              Clientes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gerencie seus clientes e suas assinaturas
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={handleOpenDialog}
            size="large"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Novo Cliente
          </Button>
        </Box>
      </Box>

      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap={{ xs: 'wrap', sm: 'nowrap' }}>
          <TextField
            fullWidth
            placeholder="Buscar por nome, email ou empresa..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            sx={{ minWidth: 120, textTransform: 'none', fontWeight: 600 }}
          >
            Filtros
          </Button>
        </Box>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : clientes.length > 0 ? (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {totalCount} cliente{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
            </Typography>
            <Button
              size="small"
              onClick={handleExpandAll}
            >
              {expandedClientes.size === clientes.length ? 'Recolher todos' : 'Expandir todos'}
            </Button>
          </Box>

          {clientes.map((cliente) => (
            <ClientAccordion
              key={cliente.id}
              cliente={cliente}
              onUpdate={loadClientes}
              onDelete={handleDelete}
              expanded={expandedClientes.has(cliente.id)}
              onToggle={() => handleToggleAccordion(cliente.id)}
            />
          ))}

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handleChangePage}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </Box>
      ) : (
        <Paper elevation={2} sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="textSecondary" variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Nenhum cliente encontrado
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando um novo cliente'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={handleOpenDialog}
            size="large"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Adicionar Primeiro Cliente
          </Button>
        </Paper>
      )}

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle>
          Novo Cliente
        </DialogTitle>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} autoComplete="off">
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
                autoComplete="off"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Usuário (Login)"
                value={formData.usuario}
                onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                helperText="Login do cliente no sistema"
                autoComplete="off"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Senha"
                type="password"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                helperText="Deixe em branco para não alterar"
                autoComplete="new-password"
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                autoComplete="off"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                autoComplete="off"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Empresa"
                value={formData.empresa}
                onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                autoComplete="off"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Plano</InputLabel>
                <Select
                  value={formData.plano_id}
                  label="Plano"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      plano_id: e.target.value,
                    })
                  }
                >
                  <MenuItem value="">Nenhum</MenuItem>
                  {planos.length > 0 ? (
                    planos.map((plano) => (
                      <MenuItem key={plano.id} value={plano.id}>
                        {plano.nome} - R$ {plano.preco}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>Carregando planos...</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as Cliente['status'],
                    })
                  }
                >
                  <MenuItem value="ativo">Ativo</MenuItem>
                  <MenuItem value="inativo">Inativo</MenuItem>
                  <MenuItem value="suspenso">Suspenso</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" type="submit">
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}