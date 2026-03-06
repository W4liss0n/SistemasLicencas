import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  Edit,
  Add,
  Cancel,
  CheckCircle,
  Warning,
  Autorenew,
  VpnKey,
  Block,
  ContentCopy,
  Computer,
  AccessTime,
  Assignment,
  Info,
} from '@mui/icons-material';
import type { Cliente, Assinatura, Licenca, Plano } from '../types';
import { assinaturaApi, licencaApi, clienteApi } from '../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`client-tabpanel-${index}`}
      aria-labelledby={`client-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface ClientDetailsProps {
  cliente: Cliente;
  onClose: () => void;
  onUpdate: () => void;
}

export function ClientDetails({ cliente, onClose, onUpdate }: ClientDetailsProps) {
  const [tabValue, setTabValue] = useState(0);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [loadingAssinaturas, setLoadingAssinaturas] = useState(false);
  const [selectedAssinatura, setSelectedAssinatura] = useState<Assinatura | null>(null);

  // Estado para licenças
  const [licencas, setLicencas] = useState<Licenca[]>([]);
  const [loadingLicencas, setLoadingLicencas] = useState(false);
  const [openLicencasDialog, setOpenLicencasDialog] = useState(false);

  // Estado para edição de cliente
  const [editMode, setEditMode] = useState(false);
  const [clienteForm, setClienteForm] = useState({
    nome: cliente.nome,
    email: cliente.email,
    telefone: cliente.telefone || '',
    empresa: cliente.empresa || '',
    status: cliente.status,
  });

  // Estado para feedback
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning',
  });

  useEffect(() => {
    loadAssinaturas();
  }, [cliente.id]);

  const loadAssinaturas = async () => {
    try {
      setLoadingAssinaturas(true);
      const response = await assinaturaApi.getAll({
        search: cliente.email,
      });
      // Filtrar apenas as assinaturas deste cliente
      const clienteAssinaturas = response.data?.filter(
        (a: any) => a.cliente_id === cliente.id
      ) || [];
      setAssinaturas(clienteAssinaturas);
    } catch (error) {
      console.error('Error loading assinaturas:', error);
      showSnackbar('Erro ao carregar assinaturas', 'error');
    } finally {
      setLoadingAssinaturas(false);
    }
  };

  const loadLicencas = async (assinaturaId: string) => {
    try {
      setLoadingLicencas(true);
      const response = await licencaApi.getAll();
      // Filtrar apenas as licenças desta assinatura
      const assinaturaLicencas = response.data?.filter(
        (l: any) => l.assinatura_id === assinaturaId
      ) || [];
      setLicencas(assinaturaLicencas);
    } catch (error) {
      console.error('Error loading licencas:', error);
      showSnackbar('Erro ao carregar licenças', 'error');
    } finally {
      setLoadingLicencas(false);
    }
  };

  const handleOpenLicencas = async (assinatura: Assinatura) => {
    setSelectedAssinatura(assinatura);
    setOpenLicencasDialog(true);
    await loadLicencas(assinatura.id);
  };

  const handleUpdateCliente = async () => {
    try {
      await clienteApi.update(cliente.id, clienteForm);
      showSnackbar('Cliente atualizado com sucesso', 'success');
      setEditMode(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating cliente:', error);
      showSnackbar('Erro ao atualizar cliente', 'error');
    }
  };

  const handleCopyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key);
    showSnackbar('Chave copiada para área de transferência', 'info');
  };

  const handleBlockLicense = async (licenseId: string) => {
    try {
      await licencaApi.block(licenseId);
      showSnackbar('Licença bloqueada com sucesso', 'success');
      if (selectedAssinatura) {
        await loadLicencas(selectedAssinatura.id);
      }
    } catch (error) {
      console.error('Error blocking license:', error);
      showSnackbar('Erro ao bloquear licença', 'error');
    }
  };

  const handleUnblockLicense = async (licenseId: string) => {
    try {
      await licencaApi.unblock(licenseId);
      showSnackbar('Licença desbloqueada com sucesso', 'success');
      if (selectedAssinatura) {
        await loadLicencas(selectedAssinatura.id);
      }
    } catch (error) {
      console.error('Error unblocking license:', error);
      showSnackbar('Erro ao desbloquear licença', 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getStatusChip = (status: string) => {
    const statusConfig = {
      ativo: { color: 'success' as const, icon: <CheckCircle /> },
      ativa: { color: 'success' as const, icon: <CheckCircle /> },
      inativo: { color: 'default' as const, icon: <Cancel /> },
      inativa: { color: 'default' as const, icon: <Cancel /> },
      bloqueada: { color: 'error' as const, icon: <Block /> },
      expirada: { color: 'warning' as const, icon: <Warning /> },
      cancelada: { color: 'error' as const, icon: <Cancel /> },
      suspensa: { color: 'warning' as const, icon: <Warning /> },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inativo;

    return (
      <Chip
        label={status}
        color={config.color}
        size="small"
        icon={config.icon}
      />
    );
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Detalhes do Cliente: {cliente.nome}
          </Typography>
          {getStatusChip(cliente.status)}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab label="Informações" icon={<Info />} iconPosition="start" />
            <Tab label="Assinaturas" icon={<Assignment />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* Tab de Informações */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            {!editMode ? (
              <Button
                startIcon={<Edit />}
                onClick={() => setEditMode(true)}
                variant="outlined"
              >
                Editar
              </Button>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={() => setEditMode(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  onClick={handleUpdateCliente}
                >
                  Salvar
                </Button>
              </Box>
            )}
          </Box>

          <Grid container spacing={2}>
            <Grid size={6}>
              <TextField
                fullWidth
                label="Nome"
                value={clienteForm.nome}
                onChange={(e) => setClienteForm({ ...clienteForm, nome: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                label="Email"
                value={clienteForm.email}
                onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                label="Telefone"
                value={clienteForm.telefone}
                onChange={(e) => setClienteForm({ ...clienteForm, telefone: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                label="Empresa"
                value={clienteForm.empresa}
                onChange={(e) => setClienteForm({ ...clienteForm, empresa: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid size={6}>
              <FormControl fullWidth disabled={!editMode}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={clienteForm.status}
                  label="Status"
                  onChange={(e) => setClienteForm({ ...clienteForm, status: e.target.value as any })}
                >
                  <MenuItem value="ativo">Ativo</MenuItem>
                  <MenuItem value="inativo">Inativo</MenuItem>
                  <MenuItem value="suspenso">Suspenso</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                label="Criado em"
                value={formatDate(cliente.created_at)}
                disabled
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab de Assinaturas */}
        <TabPanel value={tabValue} index={1}>
          {loadingAssinaturas ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : assinaturas.length === 0 ? (
            <Alert severity="info">
              Nenhuma assinatura encontrada para este cliente.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Plano</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Período</TableCell>
                    <TableCell>Auto-renovar</TableCell>
                    <TableCell align="center">Licenças</TableCell>
                    <TableCell align="center">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assinaturas.map((assinatura) => (
                    <TableRow key={assinatura.id}>
                      <TableCell>{assinatura.plano?.nome || 'N/A'}</TableCell>
                      <TableCell>{getStatusChip(assinatura.status)}</TableCell>
                      <TableCell>
                        {formatDate(assinatura.data_inicio)} - {formatDate(assinatura.data_fim)}
                      </TableCell>
                      <TableCell>
                        {assinatura.auto_renovar ? (
                          <Chip icon={<Autorenew />} label="Sim" size="small" color="success" />
                        ) : (
                          <Chip label="Não" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          startIcon={<VpnKey />}
                          onClick={() => handleOpenLicencas(assinatura)}
                        >
                          Gerenciar
                        </Button>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small">
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error">
                          <Cancel fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
            >
              Nova Assinatura
            </Button>
          </Box>
        </TabPanel>
      </DialogContent>

      {/* Dialog de Licenças */}
      <Dialog
        open={openLicencasDialog}
        onClose={() => setOpenLicencasDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Licenças da Assinatura
        </DialogTitle>
        <DialogContent>
          {loadingLicencas ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : licencas.length === 0 ? (
            <Alert severity="info">
              Nenhuma licença encontrada para esta assinatura.
            </Alert>
          ) : (
            <List>
              {licencas.map((licenca, index) => (
                <React.Fragment key={licenca.id}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {licenca.license_key}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyLicenseKey(licenca.license_key)}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                          {getStatusChip(licenca.status)}
                          {licenca.ultimo_acesso && (
                            <Chip
                              icon={<AccessTime />}
                              label={`Último acesso: ${formatDate(licenca.ultimo_acesso)}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {licenca.device_fingerprint && (
                            <Chip
                              icon={<Computer />}
                              label="Dispositivo vinculado"
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      {licenca.status === 'bloqueada' ? (
                        <Tooltip title="Desbloquear">
                          <IconButton
                            edge="end"
                            onClick={() => handleUnblockLicense(licenca.id)}
                            color="success"
                          >
                            <CheckCircle />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Bloquear">
                          <IconButton
                            edge="end"
                            onClick={() => handleBlockLicense(licenca.id)}
                            color="error"
                          >
                            <Block />
                          </IconButton>
                        </Tooltip>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}

          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
            >
              Gerar Nova Licença
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenLicencasDialog(false)}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>

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
    </Dialog>
  );
}