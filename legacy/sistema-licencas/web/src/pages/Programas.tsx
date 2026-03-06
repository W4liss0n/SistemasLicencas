import React, { useState, useEffect } from 'react';
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
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Edit,
  Delete,
  Search,
  Add,
  Block,
  CheckCircle,
  Code,
  FileCopy,
  Upload,
} from '@mui/icons-material';
import type { Programa } from '../types';
import { programaApi } from '../services/api';

export function Programas() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPrograma, setSelectedPrograma] = useState<Programa | null>(null);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    versao: '',
    executable_hash: '',
    status: 'ativo' as const,
  });

  // Estados para feedback
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning',
  });

  useEffect(() => {
    loadProgramas();
  }, [page, rowsPerPage, searchTerm]);

  const loadProgramas = async () => {
    try {
      setLoading(true);
      const response = await programaApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm,
      });
      setProgramas(response.data || []);
      setTotalCount(response.total || 0);
    } catch (error) {
      console.error('Error loading programas:', error);
      setProgramas([]);
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

  const handleOpenDialog = (programa?: Programa) => {
    if (programa) {
      setSelectedPrograma(programa);
      setFormData({
        nome: programa.nome,
        descricao: programa.descricao || '',
        versao: programa.versao || '',
        executable_hash: programa.executable_hash || '',
        status: programa.status,
      });
    } else {
      setSelectedPrograma(null);
      setFormData({
        nome: '',
        descricao: '',
        versao: '',
        executable_hash: '',
        status: 'ativo',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPrograma(null);
  };

  const handleSave = async () => {
    try {
      if (selectedPrograma) {
        await programaApi.update(selectedPrograma.id, formData);
        showSnackbar('Programa atualizado com sucesso', 'success');
      } else {
        await programaApi.create(formData);
        showSnackbar('Programa criado com sucesso', 'success');
      }
      handleCloseDialog();
      loadProgramas();
    } catch (error) {
      console.error('Error saving programa:', error);
      showSnackbar('Erro ao salvar programa', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este programa?')) {
      try {
        await programaApi.delete(id);
        loadProgramas();
        showSnackbar('Programa excluído com sucesso', 'success');
      } catch (error) {
        console.error('Error deleting programa:', error);
        showSnackbar('Erro ao excluir programa', 'error');
      }
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    showSnackbar('ID copiado para área de transferência', 'info');
  };

  // Função para upload de arquivo e geração de hash
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      setFormData({ ...formData, executable_hash: hashHex });
      showSnackbar('Hash SHA-256 gerado com sucesso', 'success');
    } catch (error) {
      console.error('Error generating hash:', error);
      showSnackbar('Erro ao gerar hash do arquivo', 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1976d2', mb: 0.5 }}>
              Programas
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gerencie os programas disponíveis para licenciamento
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            size="large"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Novo Programa
          </Button>
        </Box>
      </Box>

      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Buscar por nome, descrição ou versão..."
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
      </Paper>

      <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>ID do Programa</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Descrição</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Versão</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Criado em</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {programas.map((programa) => (
                  <TableRow key={programa.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Code fontSize="small" color="primary" />
                        <Typography variant="body2" fontWeight={500}>
                          {programa.nome}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            color: 'text.secondary'
                          }}
                        >
                          {programa.id}
                        </Typography>
                        <Tooltip title="Copiar ID">
                          <IconButton
                            size="small"
                            onClick={() => handleCopyId(programa.id)}
                          >
                            <FileCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>{programa.descricao || '-'}</TableCell>
                    <TableCell>
                      {programa.versao ? (
                        <Chip
                          label={programa.versao}
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={programa.status}
                        size="small"
                        color={programa.status === 'ativo' ? 'success' : 'default'}
                        icon={programa.status === 'ativo' ? <CheckCircle /> : <Block />}
                      />
                    </TableCell>
                    <TableCell>{formatDate(programa.created_at)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(programa)}
                        title="Editar"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(programa.id)}
                        title="Excluir"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Linhas por página:"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`
              }
            />
          </>
        )}
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedPrograma ? 'Editar Programa' : 'Novo Programa'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Descrição"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                label="Versão"
                value={formData.versao}
                onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                placeholder="Ex: 1.0.0"
              />
            </Grid>
            <Grid size={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ativo' | 'inativo' })}
                >
                  <MenuItem value="ativo">Ativo</MenuItem>
                  <MenuItem value="inativo">Inativo</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Hash do Executável"
                value={formData.executable_hash}
                onChange={(e) => setFormData({ ...formData, executable_hash: e.target.value })}
                placeholder="SHA-256 hash (opcional)"
                helperText="Hash SHA-256 do arquivo executável para validação de integridade"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        component="label"
                        startIcon={<Upload />}
                        size="small"
                      >
                        Upload
                        <input
                          type="file"
                          hidden
                          accept=".exe,.dll,.app,.dmg"
                          onChange={handleFileUpload}
                        />
                      </Button>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            {selectedPrograma && (
              <Grid size={12}>
                <Alert severity="info" icon={<Code />}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    ID do Programa (use no seu software):
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        bgcolor: 'grey.100',
                        p: 1,
                        borderRadius: 1,
                        flex: 1
                      }}
                    >
                      {selectedPrograma.id}
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<FileCopy />}
                      onClick={() => handleCopyId(selectedPrograma.id)}
                    >
                      Copiar
                    </Button>
                  </Box>
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained">
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar para feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}