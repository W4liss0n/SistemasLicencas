import React, { useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  Collapse,
  Card,
  CardContent,
} from '@mui/material';
import {
  ExpandMore,
  Edit as EditIcon,
  Delete,
  Save,
  Cancel,
  CheckCircle,
  Block,
  Warning,
  Autorenew,
  VpnKey,
  ContentCopy,
  Computer,
  AccessTime,
  Add,
  Apps,
  LinkOff,
  Schedule,
  CalendarToday,
  Devices,
  Language,
} from '@mui/icons-material';
import type { Cliente, Assinatura, Licenca, Plano } from '../types';
import { assinaturaApi, licencaApi, clienteApi, planoApi } from '../services/api';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
} from '@mui/material';

interface ClientAccordionProps {
  cliente: Cliente;
  onUpdate: () => void;
  onDelete: (id: string) => void;
  expanded: boolean;
  onToggle: () => void;
}

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
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export function ClientAccordion({ cliente, onUpdate, onDelete, expanded, onToggle }: ClientAccordionProps) {
  const [tabValue, setTabValue] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [clienteForm, setClienteForm] = useState({
    nome: cliente.nome,
    email: cliente.email,
    telefone: cliente.telefone || '',
    empresa: cliente.empresa || '',
    usuario: cliente.usuario || '',
    senha: '',
    status: cliente.status,
  });
  const [editPlanoMode, setEditPlanoMode] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<string>('');

  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [loadingAssinaturas, setLoadingAssinaturas] = useState(false);
  const [licencasMap, setLicencasMap] = useState<Record<string, Licenca | null>>({});
  const [loadingLicencasMap, setLoadingLicencasMap] = useState<Record<string, boolean>>({});
  const [devicesMap, setDevicesMap] = useState<Record<string, any[]>>({});
  const [loadingDevicesMap, setLoadingDevicesMap] = useState<Record<string, boolean>>({});
  const [openAssinaturaDialog, setOpenAssinaturaDialog] = useState(false);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [selectedPlanoId, setSelectedPlanoId] = useState<string>('');
  const [assinaturaForm, setAssinaturaForm] = useState({
    cliente_id: cliente.id,
    plano_id: '',
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
    auto_renovar: false,
  });
  const [openEditTimeDialog, setOpenEditTimeDialog] = useState(false);
  const [editingAssinatura, setEditingAssinatura] = useState<Assinatura | null>(null);
  const [timeForm, setTimeForm] = useState({
    quantidade: 30,
    unidade: 'dias' as 'minutos' | 'horas' | 'dias' | 'meses',
  });

  React.useEffect(() => {
    if (expanded) {
      loadAssinaturas();
      loadPlanos();
    }
  }, [expanded, cliente.id]);

  const loadPlanos = async () => {
    try {
      const response = await planoApi.getAll();
      setPlanos(response.data?.filter((p: any) => p.status === 'ativo') || []);
    } catch (error) {
      console.error('Error loading planos:', error);
    }
  };

  const loadAssinaturas = async () => {
    try {
      setLoadingAssinaturas(true);
      const response = await assinaturaApi.getAll({
        search: cliente.email,
      });
      const clienteAssinaturas = response.data?.filter(
        (a: any) => a.cliente_id === cliente.id
      ) || [];
      setAssinaturas(clienteAssinaturas);

      // Carregar todas as licenças automaticamente
      for (const assinatura of clienteAssinaturas) {
        await loadLicenca(assinatura.id);
      }
    } catch (error) {
      console.error('Error loading assinaturas:', error);
    } finally {
      setLoadingAssinaturas(false);
    }
  };

  const loadLicenca = async (assinaturaId: string) => {
    try {
      setLoadingLicencasMap(prev => ({ ...prev, [assinaturaId]: true }));
      const response = await licencaApi.getAll();
      // Agora apenas UMA licença por assinatura
      const licenca = response.data?.find(
        (l: any) => l.assinatura_id === assinaturaId
      ) || null;
      setLicencasMap(prev => ({ ...prev, [assinaturaId]: licenca }));

      // Se tem licença, carregar os dispositivos
      if (licenca) {
        await loadDevices(licenca.license_key);
      }
    } catch (error) {
      console.error('Error loading licenca:', error);
    } finally {
      setLoadingLicencasMap(prev => ({ ...prev, [assinaturaId]: false }));
    }
  };

  const loadDevices = async (licenseKey: string) => {
    try {
      setLoadingDevicesMap(prev => ({ ...prev, [licenseKey]: true }));
      const response = await licencaApi.getDevices(licenseKey);
      setDevicesMap(prev => ({ ...prev, [licenseKey]: response.data || [] }));
    } catch (error) {
      console.error('Error loading devices:', error);
      setDevicesMap(prev => ({ ...prev, [licenseKey]: [] }));
    } finally {
      setLoadingDevicesMap(prev => ({ ...prev, [licenseKey]: false }));
    }
  };

  const handleUpdateCliente = async () => {
    try {
      await clienteApi.update(cliente.id, clienteForm);
      setEditMode(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating cliente:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setClienteForm({
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone || '',
      empresa: cliente.empresa || '',
      usuario: cliente.usuario || '',
      senha: '',
      status: cliente.status,
    });
  };

  const handleChangePlano = async () => {
    if (!selectedPlano || assinaturas.length === 0) return;

    try {
      // Atualizar a primeira assinatura ativa com o novo plano
      const activeSubscription = assinaturas.find(a => a.status === 'ativa');
      if (activeSubscription) {
        await assinaturaApi.update(activeSubscription.id, {
          ...activeSubscription,
          plano_id: selectedPlano
        });
        setEditPlanoMode(false);
        setSelectedPlano('');
        await loadAssinaturas();
      }
    } catch (error) {
      console.error('Error changing plan:', error);
    }
  };

  const handleCopyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  const handleBlockLicense = async (assinaturaId: string, licenseId: string) => {
    try {
      await licencaApi.block(licenseId);
      await loadLicenca(assinaturaId);
    } catch (error) {
      console.error('Error blocking license:', error);
    }
  };

  const handleUnblockLicense = async (assinaturaId: string, licenseId: string) => {
    try {
      await licencaApi.unblock(licenseId);
      await loadLicenca(assinaturaId);
    } catch (error) {
      console.error('Error unblocking license:', error);
    }
  };

  const handleGenerateLicense = async (assinaturaId: string) => {
    try {
      await licencaApi.create({ assinatura_id: assinaturaId });
      await loadLicenca(assinaturaId);
    } catch (error) {
      console.error('Error generating license:', error);
    }
  };

  const handleUnbindDevice = async (licenseKey: string, fingerprintHash: string, deviceName?: string) => {
    const confirmMsg = deviceName
      ? `Tem certeza que deseja remover o dispositivo "${deviceName}"?\n\nEsta ação irá deletar permanentemente o dispositivo do sistema.`
      : 'Tem certeza que deseja remover este dispositivo?\n\nEsta ação irá deletar permanentemente o dispositivo do sistema.';

    if (window.confirm(confirmMsg)) {
      try {
        await licencaApi.deactivateDevice(licenseKey, fingerprintHash);
        await loadDevices(licenseKey);
      } catch (error) {
        console.error('Error removing device:', error);
      }
    }
  };

  const calculateDaysRemaining = (dataFim: string) => {
    const endDate = new Date(dataFim);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();

    // Se a diferença for menos de 24h, retornar 0 para indicar que deve checar minutos/horas
    if (Math.abs(diffTime) < 24 * 60 * 60 * 1000) {
      // Retornar valor negativo se expirado, ou 0 se ainda tem tempo
      return diffTime < 0 ? -1 : 0;
    }

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDaysRemaining = (days: number, dataFim?: string) => {
    if (days < 0) return 'Expirada';

    // Se days === 0, significa que é menos de 24h, calcular minutos/horas
    if (days === 0 && dataFim) {
      const endDate = new Date(dataFim);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();

      if (diffTime <= 0) return 'Expirada';

      const diffMinutes = Math.floor(diffTime / (1000 * 60));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));

      // Se for menos de 1 hora, mostrar em minutos
      if (diffHours === 0) {
        return `${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''} restante${diffMinutes > 1 ? 's' : ''}`;
      }

      // Se for menos de 24 horas, mostrar em horas
      if (diffHours < 24) {
        return `${diffHours} hora${diffHours > 1 ? 's' : ''} restante${diffHours > 1 ? 's' : ''}`;
      }
    }

    if (days === 0) return 'Expira hoje';
    if (days === 1) return '1 dia restante';
    if (days <= 30) return `${days} dias restantes`;
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? 'mês' : 'meses'} restantes`;
  };

  const getDaysRemainingColor = (days: number): 'error' | 'warning' | 'success' => {
    if (days < 0) return 'error';     // Vermelho - Expirado
    if (days <= 7) return 'warning';   // Amarelo - 0 a 7 dias
    return 'success';                  // Verde - > 7 dias
  };

  const getDeviceInfo = (fingerprint: any) => {
    if (!fingerprint) return null;

    const components = fingerprint.components || {};
    return {
      os: components.platform?.value || fingerprint.os_name || 'Desconhecido',
      hostname: components.hostname?.value || fingerprint.hostname || 'Desconhecido',
      macAddress: components.mac_address?.value || fingerprint.mac_address || 'Desconhecido',
    };
  };

  const handleOpenEditTimeDialog = (assinatura: Assinatura) => {
    setEditingAssinatura(assinatura);

    // Calcular tempo restante atual
    const daysRemaining = calculateDaysRemaining(assinatura.data_fim);

    setTimeForm({
      quantidade: daysRemaining > 0 ? daysRemaining : 1,
      unidade: 'dias',
    });

    setOpenEditTimeDialog(true);
  };

  const handleCloseEditTimeDialog = () => {
    setOpenEditTimeDialog(false);
    setEditingAssinatura(null);
  };

  const calculateNewDataFim = (quantidade: number, unidade: 'minutos' | 'horas' | 'dias' | 'meses'): string => {
    const now = new Date();
    let milliseconds = 0;

    switch (unidade) {
      case 'minutos':
        milliseconds = quantidade * 60 * 1000;
        break;
      case 'horas':
        milliseconds = quantidade * 60 * 60 * 1000;
        break;
      case 'dias':
        milliseconds = quantidade * 24 * 60 * 60 * 1000;
        break;
      case 'meses':
        // Aproximadamente 30 dias por mês
        milliseconds = quantidade * 30 * 24 * 60 * 60 * 1000;
        break;
    }

    const newDate = new Date(now.getTime() + milliseconds);
    // Se for minutos ou horas, retornar data completa com timestamp
    // Se for dias/meses, retornar apenas a data
    return (unidade === 'minutos' || unidade === 'horas') ? newDate.toISOString() : newDate.toISOString().split('T')[0];
  };

  const handleUpdateTime = async () => {
    if (!editingAssinatura) return;

    try {
      const now = new Date();
      const newDataInicio = (timeForm.unidade === 'minutos' || timeForm.unidade === 'horas') ? now.toISOString() : now.toISOString().split('T')[0];
      const newDataFim = calculateNewDataFim(timeForm.quantidade, timeForm.unidade);

      await assinaturaApi.update(editingAssinatura.id, {
        ...editingAssinatura,
        data_inicio: newDataInicio,
        data_fim: newDataFim,
      });

      handleCloseEditTimeDialog();
      await loadAssinaturas();
    } catch (error) {
      console.error('Error updating subscription time:', error);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getStatusChip = (status: string) => {
    const statusConfig = {
      ativo: { color: 'success' as const, icon: <CheckCircle fontSize="small" /> },
      ativa: { color: 'success' as const, icon: <CheckCircle fontSize="small" /> },
      inativo: { color: 'default' as const, icon: <Cancel fontSize="small" /> },
      inativa: { color: 'default' as const, icon: <Cancel fontSize="small" /> },
      bloqueada: { color: 'error' as const, icon: <Block fontSize="small" /> },
      expirada: { color: 'warning' as const, icon: <Warning fontSize="small" /> },
      cancelada: { color: 'error' as const, icon: <Cancel fontSize="small" /> },
      suspensa: { color: 'warning' as const, icon: <Warning fontSize="small" /> },
      suspenso: { color: 'warning' as const, icon: <Warning fontSize="small" /> },
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

  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja excluir o cliente ${cliente.nome}?`)) {
      onDelete(cliente.id);
    }
  };

  return (
    <>
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      sx={{
        mb: 2,
        '&:before': { display: 'none' },
        boxShadow: expanded ? 3 : 1,
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore />}
        sx={{
          backgroundColor: expanded ? 'action.selected' : 'background.paper',
          '&:hover': { backgroundColor: 'action.hover' }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ minWidth: 200 }}>
              {cliente.nome}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {cliente.email}
            </Typography>
            {cliente.empresa && (
              <Chip label={cliente.empresa} size="small" variant="outlined" />
            )}
            {getStatusChip(cliente.status)}
            {assinaturas.length > 0 && (
              <Chip
                label={`${assinaturas.length} assinatura${assinaturas.length > 1 ? 's' : ''}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
          <Box
            sx={{ display: 'flex', gap: 1 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {!editMode && (
              <Tooltip title="Editar">
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    cursor: 'pointer',
                    color: 'primary.main',
                    p: 0.5,
                    borderRadius: 1,
                    '&:hover': { backgroundColor: 'action.hover' }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!expanded) onToggle();
                    setEditMode(true);
                    setTabValue(0);
                  }}
                >
                  <EditIcon fontSize="small" />
                </Box>
              </Tooltip>
            )}
            <Tooltip title="Excluir">
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  cursor: 'pointer',
                  color: 'error.main',
                  p: 0.5,
                  borderRadius: 1,
                  '&:hover': { backgroundColor: 'action.hover' }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
              >
                <Delete fontSize="small" />
              </Box>
            </Tooltip>
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Informações" />
            <Tab label="Assinaturas" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              {editMode ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    startIcon={<Cancel />}
                    onClick={handleCancelEdit}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleUpdateCliente}
                  >
                    Salvar
                  </Button>
                </Box>
              ) : (
                <Button
                  startIcon={<EditIcon />}
                  onClick={() => setEditMode(true)}
                  variant="outlined"
                >
                  Editar
                </Button>
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
                  variant={editMode ? "outlined" : "filled"}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Email"
                  value={clienteForm.email}
                  onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })}
                  disabled={!editMode}
                  variant={editMode ? "outlined" : "filled"}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Telefone"
                  value={clienteForm.telefone}
                  onChange={(e) => setClienteForm({ ...clienteForm, telefone: e.target.value })}
                  disabled={!editMode}
                  variant={editMode ? "outlined" : "filled"}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Empresa"
                  value={clienteForm.empresa}
                  onChange={(e) => setClienteForm({ ...clienteForm, empresa: e.target.value })}
                  disabled={!editMode}
                  variant={editMode ? "outlined" : "filled"}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Usuário (Login)"
                  value={clienteForm.usuario}
                  onChange={(e) => setClienteForm({ ...clienteForm, usuario: e.target.value })}
                  disabled={!editMode}
                  variant={editMode ? "outlined" : "filled"}
                  helperText="Login do cliente no sistema"
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Senha"
                  type="password"
                  value={clienteForm.senha}
                  onChange={(e) => setClienteForm({ ...clienteForm, senha: e.target.value })}
                  disabled={!editMode}
                  variant={editMode ? "outlined" : "filled"}
                  helperText={editMode ? "Deixe em branco para não alterar" : ""}
                />
              </Grid>
              <Grid size={6}>
                <FormControl fullWidth disabled={!editMode} variant={editMode ? "outlined" : "filled"}>
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
                  variant="filled"
                />
              </Grid>
            </Grid>

            {/* Seção de Troca de Plano */}
            {assinaturas.length > 0 && assinaturas.some(a => a.status === 'ativa') && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Plano Atual
                    </Typography>
                    {!editPlanoMode && (
                      <Button
                        startIcon={<EditIcon />}
                        onClick={() => {
                          setEditPlanoMode(true);
                          const activeSub = assinaturas.find(a => a.status === 'ativa');
                          if (activeSub) {
                            setSelectedPlano(activeSub.plano_id);
                          }
                        }}
                        variant="outlined"
                        size="small"
                      >
                        Alterar Plano
                      </Button>
                    )}
                  </Box>

                  {editPlanoMode ? (
                    <Grid container spacing={2}>
                      <Grid size={12}>
                        <FormControl fullWidth>
                          <InputLabel>Selecione o novo plano</InputLabel>
                          <Select
                            value={selectedPlano}
                            label="Selecione o novo plano"
                            onChange={(e) => setSelectedPlano(e.target.value)}
                          >
                            {planos.filter(p => p.status === 'ativo').map((plano) => (
                              <MenuItem key={plano.id} value={plano.id}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                  <Box>
                                    <Typography variant="body1">{plano.nome}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {plano.programas?.length || 0} programa(s) • {plano.duracao_dias} dias • {plano.max_dispositivos} dispositivo(s)
                                    </Typography>
                                  </Box>
                                  <Typography variant="subtitle1" color="primary">
                                    R$ {typeof plano.preco === 'number' ? plano.preco.toFixed(2) : parseFloat(plano.preco || '0').toFixed(2)}
                                  </Typography>
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={12}>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button
                            onClick={() => {
                              setEditPlanoMode(false);
                              setSelectedPlano('');
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="contained"
                            onClick={handleChangePlano}
                            disabled={!selectedPlano}
                          >
                            Confirmar Alteração
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                  ) : (
                    <Box>
                      {assinaturas.filter(a => a.status === 'ativa').map((assinatura) => (
                        <Card key={assinatura.id} variant="outlined" sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {assinatura.plano?.nome || 'Plano N/A'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {assinatura.plano?.programas?.length || 0} programa(s) incluído(s) • {assinatura.plano?.duracao_dias || 0} dias • {assinatura.plano?.max_dispositivos || 0} dispositivo(s)
                              </Typography>
                            </Box>
                            <Chip
                              label={formatDaysRemaining(calculateDaysRemaining(assinatura.data_fim), assinatura.data_fim)}
                              color={getDaysRemainingColor(calculateDaysRemaining(assinatura.data_fim))}
                              sx={{ fontWeight: 600 }}
                            />
                          </Box>
                        </Card>
                      ))}
                    </Box>
                  )}
                </Box>
              </>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {loadingAssinaturas ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : assinaturas.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                Nenhuma assinatura encontrada para este cliente.
              </Alert>
            ) : (
              <Box>
                {assinaturas.map((assinatura) => (
                  <Card key={assinatura.id} elevation={2} sx={{ mb: 2, borderRadius: 2 }}>
                    <CardContent sx={{ pb: 2 }}>
                      {/* Header da Assinatura */}
                      <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <Typography variant="h6" fontWeight="bold">
                            {assinatura.plano?.nome || 'Plano N/A'}
                          </Typography>
                          {getStatusChip(assinatura.status)}
                          {assinatura.auto_renovar && (
                            <Chip icon={<Autorenew />} label="Auto-renovar" size="small" color="info" variant="outlined" />
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            📅 {formatDate(assinatura.data_inicio)} - {formatDate(assinatura.data_fim)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">•</Typography>
                          {assinatura.status === 'ativa' && (
                            <Chip
                              icon={<Schedule />}
                              label={formatDaysRemaining(calculateDaysRemaining(assinatura.data_fim), assinatura.data_fim)}
                              size="small"
                              color={getDaysRemainingColor(calculateDaysRemaining(assinatura.data_fim))}
                              variant="filled"
                              onClick={() => handleOpenEditTimeDialog(assinatura)}
                              sx={{ cursor: 'pointer' }}
                            />
                          )}
                          <Tooltip title="Alterar tempo da assinatura">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEditTimeDialog(assinatura)}
                              sx={{ ml: -1 }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>

                      <Divider sx={{ mb: 2 }} />

                      {/* Programas incluídos no plano */}
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.875rem', color: 'text.secondary', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Apps fontSize="small" />
                          Programas Incluídos
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {assinatura.plano?.programas?.map((programa: any) => (
                            <Chip
                              key={programa.id}
                              label={programa.nome}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          )) || (
                            <Typography variant="body2" color="text.secondary">
                              Nenhum programa configurado no plano
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      <Divider sx={{ mb: 2 }} />

                      {/* Licença única da assinatura */}
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.875rem', color: 'text.secondary', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <VpnKey fontSize="small" />
                          Licença de Acesso
                        </Typography>

                        {loadingLicencasMap[assinatura.id] ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                            <CircularProgress size={24} />
                          </Box>
                        ) : !licencasMap[assinatura.id] ? (
                          <Box>
                            <Alert severity="warning" sx={{ mt: 1 }}>
                              Nenhuma licença gerada para esta assinatura.
                            </Alert>
                            <Button
                              size="small"
                              startIcon={<Add />}
                              variant="contained"
                              sx={{ mt: 2 }}
                              onClick={() => handleGenerateLicense(assinatura.id)}
                            >
                              Gerar Licença
                            </Button>
                          </Box>
                        ) : (
                          <Box>
                            {/* License Key */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                              <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                {licencasMap[assinatura.id].license_key}
                              </Typography>
                              <Tooltip title="Copiar chave">
                                <IconButton
                                  size="small"
                                  onClick={() => handleCopyLicenseKey(licencasMap[assinatura.id].license_key)}
                                >
                                  <ContentCopy fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>

                            {/* Status and Last Access Inline */}
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2" component="div" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                  Status: {getStatusChip(licencasMap[assinatura.id].status)}
                                </Box>
                                {licencasMap[assinatura.id].ultimo_acesso && (
                                  <>
                                    <span>•</span>
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                      <AccessTime sx={{ fontSize: 16 }} />
                                      Último acesso: {formatDate(licencasMap[assinatura.id].ultimo_acesso)}
                                    </Box>
                                  </>
                                )}
                                {licencasMap[assinatura.id].ultimo_ip && (
                                  <>
                                    <span>•</span>
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                      <Language sx={{ fontSize: 16 }} />
                                      IP: {licencasMap[assinatura.id].ultimo_ip}
                                    </Box>
                                  </>
                                )}
                              </Typography>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            {/* Devices List */}
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.875rem', color: 'text.secondary', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Devices fontSize="small" />
                              Dispositivos Vinculados
                            </Typography>

                            {loadingDevicesMap[licencasMap[assinatura.id].license_key] ? (
                              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                <CircularProgress size={24} />
                              </Box>
                            ) : (devicesMap[licencasMap[assinatura.id].license_key] || []).filter((d: any) => d.is_active).length === 0 ? (
                              <Alert severity="info" sx={{ mb: 2 }}>
                                Nenhum dispositivo vinculado a esta licença
                              </Alert>
                            ) : (
                              <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                                gap: 2,
                                mb: 2
                              }}>
                                {(devicesMap[licencasMap[assinatura.id].license_key] || []).map((device: any, idx: number) => (
                                  <Card key={device.id || idx} variant="outlined" sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column'
                                  }}>
                                    <CardContent sx={{ p: 2, flexGrow: 1, '&:last-child': { pb: 2 } }}>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                                            <Computer color="primary" fontSize="small" />
                                            <Typography variant="subtitle2" fontWeight="bold" sx={{ fontSize: '0.9rem' }}>
                                              {device.device_name || `Dispositivo ${idx + 1}`}
                                            </Typography>
                                          </Box>
                                          <Tooltip title="Remover dispositivo">
                                            <IconButton
                                              color="error"
                                              size="small"
                                              onClick={() => handleUnbindDevice(
                                                licencasMap[assinatura.id].license_key,
                                                device.fingerprint_hash,
                                                device.device_name
                                              )}
                                              sx={{ ml: 0.5 }}
                                            >
                                              <LinkOff fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        </Box>

                                        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 0.5, rowGap: 0.75, fontSize: '0.875rem' }}>
                                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>Sistema:</Typography>
                                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>
                                            {device.components?.platform?.value || 'Desconhecido'}
                                          </Typography>

                                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>Host:</Typography>
                                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                                            {device.components?.hostname?.value || 'Desconhecido'}
                                          </Typography>

                                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>MAC:</Typography>
                                          <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                                            {device.components?.mac_address?.value || 'Desconhecido'}
                                          </Typography>

                                          {device.last_seen && (
                                            <>
                                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>Último acesso:</Typography>
                                              <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>
                                                {formatDate(device.last_seen)}
                                              </Typography>
                                            </>
                                          )}

                                          {device.last_ip && (
                                            <>
                                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>IP:</Typography>
                                              <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>
                                                {device.last_ip}
                                              </Typography>
                                            </>
                                          )}
                                        </Box>
                                      </Box>
                                    </CardContent>
                                  </Card>
                                ))}
                              </Box>
                            )}

                            <Divider sx={{ my: 2 }} />

                            {/* License Action Button */}
                            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
                              {licencasMap[assinatura.id].status === 'bloqueada' ? (
                                <Button
                                  variant="contained"
                                  color="success"
                                  startIcon={<CheckCircle />}
                                  onClick={() => handleUnblockLicense(assinatura.id, licencasMap[assinatura.id].id)}
                                >
                                  Desbloquear Licença
                                </Button>
                              ) : (
                                <Button
                                  variant="contained"
                                  color="error"
                                  startIcon={<Block />}
                                  onClick={() => handleBlockLicense(assinatura.id, licencasMap[assinatura.id].id)}
                                >
                                  Bloquear Licença
                                </Button>
                              )}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </TabPanel>
        </Box>
      </AccordionDetails>
    </Accordion>

    {/* Modal para criar nova assinatura */}
    <Dialog open={openAssinaturaDialog} onClose={() => setOpenAssinaturaDialog(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Nova Assinatura</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={12}>
            <FormControl fullWidth required>
              <InputLabel>Plano</InputLabel>
              <Select
                value={assinaturaForm.plano_id}
                label="Plano"
                onChange={(e) => {
                  const planoId = e.target.value;
                  const plano = planos.find(p => p.id === planoId);
                  if (plano) {
                    const dataInicio = new Date();
                    const dataFim = new Date(dataInicio.getTime() + (plano.duracao_dias * 24 * 60 * 60 * 1000));
                    setAssinaturaForm({
                      ...assinaturaForm,
                      plano_id: planoId,
                      data_inicio: dataInicio.toISOString().split('T')[0],
                      data_fim: dataFim.toISOString().split('T')[0],
                    });
                  }
                }}
              >
                {planos.map((plano) => (
                  <MenuItem key={plano.id} value={plano.id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <Box>
                        <Typography variant="body1">{plano.nome}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {plano.programas?.length || 0} programa(s) • {plano.duracao_dias} dias
                        </Typography>
                      </Box>
                      <Typography variant="subtitle1" color="primary">
                        R$ {typeof plano.preco === 'number' ? plano.preco.toFixed(2) : parseFloat(plano.preco || '0').toFixed(2)}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {assinaturaForm.plano_id && (
            <>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Data Início"
                  type="date"
                  value={assinaturaForm.data_inicio}
                  onChange={(e) => setAssinaturaForm({ ...assinaturaForm, data_inicio: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Data Fim"
                  type="date"
                  value={assinaturaForm.data_fim}
                  onChange={(e) => setAssinaturaForm({ ...assinaturaForm, data_fim: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={assinaturaForm.auto_renovar}
                      onChange={(e) => setAssinaturaForm({ ...assinaturaForm, auto_renovar: e.target.checked })}
                    />
                  }
                  label="Auto-renovar ao expirar"
                />
              </Grid>

              {/* Mostrar programas incluídos no plano selecionado */}
              <Grid size={12}>
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Programas incluídos neste plano:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    {planos.find(p => p.id === assinaturaForm.plano_id)?.programas?.map((programa: any) => (
                      <Chip
                        key={programa.id}
                        label={programa.nome}
                        size="small"
                        color="primary"
                      />
                    ))}
                  </Box>
                </Box>
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenAssinaturaDialog(false)}>Cancelar</Button>
        <Button
          onClick={async () => {
            try {
              await assinaturaApi.create(assinaturaForm);
              setOpenAssinaturaDialog(false);
              loadAssinaturas();
            } catch (error) {
              console.error('Error creating assinatura:', error);
            }
          }}
          variant="contained"
          disabled={!assinaturaForm.plano_id}
        >
          Criar Assinatura
        </Button>
      </DialogActions>
    </Dialog>

    {/* Dialog para Editar Tempo da Assinatura */}
    <Dialog open={openEditTimeDialog} onClose={handleCloseEditTimeDialog} maxWidth="sm" fullWidth>
      <DialogTitle>Alterar Tempo da Assinatura</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Defina o novo tempo de validade da assinatura a partir de agora
          </Typography>

          <Grid container spacing={2}>
            <Grid size={6}>
              <TextField
                fullWidth
                label="Quantidade"
                type="number"
                value={timeForm.quantidade}
                onChange={(e) => setTimeForm({ ...timeForm, quantidade: Number(e.target.value) })}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid size={6}>
              <FormControl fullWidth>
                <InputLabel>Unidade</InputLabel>
                <Select
                  value={timeForm.unidade}
                  label="Unidade"
                  onChange={(e) => setTimeForm({ ...timeForm, unidade: e.target.value as 'minutos' | 'horas' | 'dias' | 'meses' })}
                >
                  <MenuItem value="minutos">Minutos</MenuItem>
                  <MenuItem value="horas">Horas</MenuItem>
                  <MenuItem value="dias">Dias</MenuItem>
                  <MenuItem value="meses">Meses</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Período da renovação:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body2">
                <strong>Início:</strong> {new Date().toLocaleString('pt-BR')}
              </Typography>
              <Typography variant="body2">
                <strong>Expira:</strong>{' '}
                {(timeForm.unidade === 'minutos' || timeForm.unidade === 'horas')
                  ? new Date(calculateNewDataFim(timeForm.quantidade, timeForm.unidade)).toLocaleString('pt-BR')
                  : formatDate(calculateNewDataFim(timeForm.quantidade, timeForm.unidade))}
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseEditTimeDialog}>Cancelar</Button>
        <Button onClick={handleUpdateTime} variant="contained" color="primary">
          Atualizar
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}