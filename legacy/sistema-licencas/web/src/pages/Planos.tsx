import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Button,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
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
  InputAdornment,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
  Stack,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  ContentCopy,
  AttachMoney,
  Schedule,
  DevicesOther,
  CheckCircle,
  Cancel,
  Apps,
  LocalOffer,
} from '@mui/icons-material';
import type { Plano, Programa } from '../types';
import { planoApi, programaApi } from '../services/api';

export function Planos() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<Plano | null>(null);
  const [formData, setFormData] = useState<{
    nome: string;
    descricao: string;
    preco: number;
    duracao_dias: number;
    max_dispositivos: number;
    max_offline_dias: number;
    status: 'ativo' | 'inativo';
  }>({
    nome: '',
    descricao: '',
    preco: 0,
    duracao_dias: 30,
    max_dispositivos: 1,
    max_offline_dias: 7,
    status: 'ativo',
  });
  const [selectedProgramas, setSelectedProgramas] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [planosRes, programasRes] = await Promise.all([
        planoApi.getAll(),
        programaApi.getAll(),
      ]);
      setPlanos(planosRes.data || []);
      setProgramas(programasRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (plano?: Plano) => {
    if (plano) {
      setSelectedPlano(plano);
      setFormData({
        nome: plano.nome,
        descricao: plano.descricao || '',
        preco: plano.preco,
        duracao_dias: plano.duracao_dias,
        max_dispositivos: plano.max_dispositivos || 1,
        max_offline_dias: plano.max_offline_dias,
        status: plano.status,
      });
      setSelectedProgramas(plano.programas?.map(p => p.id) || []);
    } else {
      setSelectedPlano(null);
      setFormData({
        nome: '',
        descricao: '',
        preco: 0,
        duracao_dias: 30,
        max_dispositivos: 1,
        max_offline_dias: 7,
        status: 'ativo',
      });
      setSelectedProgramas([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPlano(null);
    setSelectedProgramas([]);
  };

  const handleSave = async () => {
    try {
      const planoData = {
        ...formData,
        programas_ids: selectedProgramas,
      };

      if (selectedPlano) {
        await planoApi.update(selectedPlano.id, planoData);
      } else {
        await planoApi.create(planoData);
      }
      handleCloseDialog();
      loadData();
    } catch (error) {
      console.error('Error saving plano:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este plano?')) {
      try {
        await planoApi.delete(id);
        loadData();
      } catch (error) {
        console.error('Error deleting plano:', error);
      }
    }
  };

  const handleDuplicate = (plano: Plano) => {
    setSelectedPlano(null);
    setFormData({
      nome: `${plano.nome} (Cópia)`,
      descricao: plano.descricao || '',
      preco: plano.preco,
      duracao_dias: plano.duracao_dias,
      max_dispositivos: plano.max_dispositivos || 1,
      max_offline_dias: plano.max_offline_dias,
      status: 'inativo',
    });
    setSelectedProgramas(plano.programas?.map(p => p.id) || []);
    setOpenDialog(true);
  };

  const handleTogglePrograma = (programaId: string) => {
    setSelectedProgramas(prev =>
      prev.includes(programaId)
        ? prev.filter(id => id !== programaId)
        : [...prev, programaId]
    );
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    return status === 'ativo' ? 'success' : 'default';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1976d2', mb: 0.5 }}>
              Planos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gerencie os planos e pacotes de programas
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            size="large"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Novo Plano
          </Button>
        </Box>
      </Box>

      {planos.length === 0 ? (
        <Paper elevation={2} sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Nenhum plano cadastrado
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Crie seu primeiro plano para começar a vender assinaturas
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Criar Primeiro Plano
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 3 }}>
          {planos.map((plano) => (
            <Card
              key={plano.id}
              elevation={2}
              sx={{
                width: '100%',
                height: '100%',
                minHeight: 450,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                opacity: plano.status === 'inativo' ? 0.7 : 1,
                transition: 'all 0.3s',
                borderRadius: 2,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                }
              }}
            >
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h5" fontWeight="bold">
                        {plano.nome}
                      </Typography>
                      <Chip
                        label={plano.status}
                        size="small"
                        color={getStatusColor(plano.status)}
                      />
                    </Box>
                    <Box sx={{ textAlign: 'center', py: 2, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                      <Typography variant="h4" color="primary" fontWeight="bold">
                        {formatPrice(plano.preco)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        por {plano.duracao_dias} dias
                      </Typography>
                    </Box>
                  </Box>

                  {plano.descricao && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {plano.descricao}
                    </Typography>
                  )}

                  <Stack spacing={2} sx={{ mb: 3 }}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Schedule fontSize="small" color="action" />
                      <Typography variant="body1">
                        Validade: <strong>{plano.duracao_dias} dias</strong>
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <DevicesOther fontSize="small" color="action" />
                      <Typography variant="body1">
                        Dispositivos: <strong>{plano.max_dispositivos === 0 ? 'Ilimitados' : `${plano.max_dispositivos || 1} simultâneo(s)`}</strong>
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Apps fontSize="small" color="action" />
                      <Typography variant="body1">
                        Programas: <strong>{plano.programas?.length || 0} incluído(s)</strong>
                      </Typography>
                    </Box>
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <Box>
                    <Typography variant="subtitle1" gutterBottom fontWeight="medium" sx={{ mb: 2 }}>
                      Programas incluídos:
                    </Typography>
                    {plano.programas && plano.programas.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {plano.programas.map((programa) => (
                          <Chip
                            key={programa.id}
                            label={programa.nome}
                            size="medium"
                            variant="filled"
                            color="primary"
                            sx={{ fontWeight: 'medium' }}
                          />
                        ))}
                      </Box>
                    ) : (
                      <Alert severity="warning" sx={{ py: 0.5 }}>
                        <Typography variant="body2">
                          Nenhum programa selecionado
                        </Typography>
                      </Alert>
                    )}
                  </Box>
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', px: 3, py: 2, backgroundColor: 'action.hover' }}>
                  <Box>
                    <Tooltip title="Duplicar plano">
                      <IconButton onClick={() => handleDuplicate(plano)} color="default">
                        <ContentCopy />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box>
                    <Tooltip title="Editar">
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(plano)}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton
                        color="error"
                        onClick={() => handleDelete(plano.id)}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardActions>
              </Card>
          ))}
        </Box>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedPlano ? 'Editar Plano' : 'Novo Plano'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Nome do Plano"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Descrição"
                multiline
                rows={2}
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Preço"
                type="number"
                value={formData.preco}
                onChange={(e) => setFormData({ ...formData, preco: Number(e.target.value) })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                }}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Duração (dias)"
                type="number"
                value={formData.duracao_dias}
                onChange={(e) => setFormData({ ...formData, duracao_dias: Number(e.target.value) })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Máximo de Dispositivos"
                type="number"
                value={formData.max_dispositivos}
                onChange={(e) => setFormData({ ...formData, max_dispositivos: Number(e.target.value) })}
                helperText="0 para ilimitado"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Dias Offline Permitidos"
                type="number"
                value={formData.max_offline_dias}
                onChange={(e) => setFormData({ ...formData, max_offline_dias: Number(e.target.value) })}
                inputProps={{ step: 'any', min: 0 }}
                helperText="Aceita decimais (ex: 0.000208333 = 30s, 0.5 = 12h)"
              />
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <MenuItem value="ativo">Ativo</MenuItem>
                  <MenuItem value="inativo">Inativo</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Programas Incluídos no Plano
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Selecione quais programas estarão disponíveis neste plano
              </Typography>

              {programas.length === 0 ? (
                <Alert severity="info">
                  Nenhum programa cadastrado. Cadastre programas antes de criar planos.
                </Alert>
              ) : (
                <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                  <List>
                    {programas.map((programa) => (
                      <ListItem
                        key={programa.id}
                        disablePadding
                      >
                        <ListItemButton onClick={() => handleTogglePrograma(programa.id)}>
                          <ListItemIcon>
                            <Checkbox
                              edge="start"
                            checked={selectedProgramas.includes(programa.id)}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={programa.nome}
                          secondary={programa.descricao}
                        />
                        {programa.versao && (
                          <Chip label={`v${programa.versao}`} size="small" />
                        )}
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {selectedProgramas.length} programa(s) selecionado(s)
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained">
            {selectedPlano ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}