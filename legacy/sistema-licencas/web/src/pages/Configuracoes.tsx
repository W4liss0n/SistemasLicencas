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
  DialogActions,
  FormControl,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Tooltip,
  Grid,
} from '@mui/material';
import {
  Edit,
  Delete,
  Search,
  Add,
  Lock,
  Person,
  Email,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { adminApi } from '../services/api';

interface Admin {
  id: string;
  username: string;
  name?: string;
  email?: string;
  status: 'ativo' | 'inativo';
  last_login?: string;
  created_at: string;
}

export function Configuracoes() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    email: '',
    status: 'ativo' as const,
  });
  const [formErrors, setFormErrors] = useState<any>({});

  useEffect(() => {
    loadAdmins();
  }, [page, rowsPerPage, searchTerm]);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm,
      });
      setAdmins(response.data || []);
      setTotalCount(response.total || 0);
    } catch (error) {
      console.error('Error loading admins:', error);
      setAdmins([]);
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

  const handleOpenDialog = (admin?: Admin) => {
    if (admin) {
      setSelectedAdmin(admin);
      setFormData({
        username: admin.username,
        password: '',
        confirmPassword: '',
        name: admin.name || '',
        email: admin.email || '',
        status: admin.status,
      });
    } else {
      setSelectedAdmin(null);
      setFormData({
        username: '',
        password: '',
        confirmPassword: '',
        name: '',
        email: '',
        status: 'ativo',
      });
    }
    setFormErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedAdmin(null);
  };

  const validateForm = () => {
    const errors: any = {};

    if (!formData.username.trim()) {
      errors.username = 'Usuário é obrigatório';
    }

    if (!selectedAdmin) {
      if (!formData.password) {
        errors.password = 'Senha é obrigatória';
      } else if (formData.password.length < 6) {
        errors.password = 'Senha deve ter no mínimo 6 caracteres';
      }

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'As senhas não coincidem';
      }
    }

    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.email = 'Email inválido';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const dataToSave = {
        username: formData.username,
        name: formData.name || undefined,
        email: formData.email || undefined,
        status: formData.status,
        password: !selectedAdmin ? formData.password : undefined,
      };

      if (selectedAdmin) {
        await adminApi.update(selectedAdmin.id, dataToSave);
      } else {
        await adminApi.create(dataToSave);
      }
      handleCloseDialog();
      loadAdmins();
    } catch (error) {
      console.error('Error saving admin:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este administrador?')) {
      try {
        await adminApi.delete(id);
        loadAdmins();
      } catch (error) {
        console.error('Error deleting admin:', error);
      }
    }
  };

  const handleResetPassword = async (admin: Admin) => {
    if (window.confirm(`Resetar senha do usuário ${admin.username}?`)) {
      try {
        const response = await adminApi.resetPassword(admin.id);
        alert(`Nova senha: ${response.temporaryPassword}\n\nAnote esta senha, ela não será mostrada novamente!`);
      } catch (error) {
        console.error('Error resetting password:', error);
      }
    }
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1976d2', mb: 0.5 }}>
              Configurações
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gerencie os administradores do sistema
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Novo Administrador
          </Button>
        </Box>
      </Box>

      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Buscar por usuário, nome ou email..."
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
        ) : admins.length > 0 ? (
          <>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Usuário</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Último Acesso</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Criado em</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person fontSize="small" color="primary" />
                        <Typography variant="body2" fontWeight={500}>
                          {admin.username}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{admin.name || '-'}</TableCell>
                    <TableCell>
                      {admin.email ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Email fontSize="small" sx={{ color: 'text.secondary' }} />
                          {admin.email}
                        </Box>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={admin.status}
                        size="small"
                        color={admin.status === 'ativo' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{formatDate(admin.last_login!)}</TableCell>
                    <TableCell>{formatDate(admin.created_at)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(admin)}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Resetar Senha">
                        <IconButton
                          size="small"
                          onClick={() => handleResetPassword(admin)}
                        >
                          <Lock fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(admin.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
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
        ) : (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Nenhum administrador encontrado
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando um novo administrador'}
            </Typography>
            {!searchTerm && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenDialog()}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Adicionar Primeiro Administrador
              </Button>
            )}
          </Box>
        )}
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedAdmin ? 'Editar Administrador' : 'Novo Administrador'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Usuário"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                error={!!formErrors.username}
                helperText={formErrors.username}
                disabled={!!selectedAdmin}
                required
              />
            </Grid>

            {!selectedAdmin && (
              <>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Senha"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    error={!!formErrors.password}
                    helperText={formErrors.password}
                    required
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Confirmar Senha"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    error={!!formErrors.confirmPassword}
                    helperText={formErrors.confirmPassword}
                    required
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </>
            )}

            <Grid size={12}>
              <TextField
                fullWidth
                label="Nome"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={!!formErrors.email}
                helperText={formErrors.email || 'Opcional - pode ser usado para login'}
              />
            </Grid>

            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.status === 'ativo'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.checked ? 'ativo' : 'inativo',
                      })
                    }
                  />
                }
                label={formData.status === 'ativo' ? 'Ativo' : 'Inativo'}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained">
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}