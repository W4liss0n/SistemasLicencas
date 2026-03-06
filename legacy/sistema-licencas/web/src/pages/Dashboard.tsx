import { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, Card, CardContent, CircularProgress } from '@mui/material';
import {
  People,
  Assignment,
  VpnKey,
  TrendingUp,
  Warning,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { dashboardApi } from '../services/api';

const monthTranslations: Record<string, string> = {
  'january': 'Janeiro',
  'february': 'Fevereiro',
  'march': 'Março',
  'april': 'Abril',
  'may': 'Maio',
  'june': 'Junho',
  'july': 'Julho',
  'august': 'Agosto',
  'september': 'Setembro',
  'october': 'Outubro',
  'november': 'Novembro',
  'december': 'Dezembro',
  'jan': 'Jan',
  'feb': 'Fev',
  'mar': 'Mar',
  'apr': 'Abr',
  'may': 'Mai',
  'jun': 'Jun',
  'jul': 'Jul',
  'aug': 'Ago',
  'sep': 'Set',
  'oct': 'Out',
  'nov': 'Nov',
  'dec': 'Dez',
};

const translateMonth = (month: string): string => {
  const lowerMonth = month.toLowerCase();
  return monthTranslations[lowerMonth] || month;
};

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClientes: 0,
    assinaturasAtivas: 0,
    licencasAtivas: 0,
    receitaMensal: 0,
  });
  const [licenseData, setLicenseData] = useState([]);
  const [securityData, setSecurityData] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [statsRes, licenseRes, securityRes, eventsRes] = await Promise.all([
        dashboardApi.getStats().catch(() => ({
          totalClientes: 0,
          assinaturasAtivas: 0,
          licencasAtivas: 0,
          receitaMensal: 0,
        })),
        dashboardApi.getLicenseData().catch(() => []),
        dashboardApi.getSecurityData().catch(() => []),
        dashboardApi.getRecentEvents().catch(() => []),
      ]);

      setStats(statsRes);
      // Traduzir os meses para português
      const translatedLicenseData = licenseRes.map((item: any) => ({
        ...item,
        month: translateMonth(item.month),
      }));
      setLicenseData(translatedLicenseData);
      setSecurityData(securityRes);
      setRecentEvents(eventsRes);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string, category?: string) => {
    // Icon by category
    if (category) {
      switch (category) {
        case 'auth':
          return type === 'error' ? <Error color="error" /> : <CheckCircle color="success" />;
        case 'license':
        case 'validation':
          return type === 'error' ? <Error color="error" /> :
                 type === 'warning' ? <Warning color="warning" /> : <VpnKey color="primary" />;
        case 'security':
          return type === 'error' ? <Error color="error" /> : <Warning color="warning" />;
        case 'admin':
          return <Assignment color="action" />;
        case 'system':
          return <CheckCircle color="info" />;
      }
    }

    // Fallback to type-based icons
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <CheckCircle color="info" />;
    }
  };

  const statsCards = [
    {
      title: 'Total Clientes',
      value: stats.totalClientes.toLocaleString('pt-BR'),
      icon: <People />,
      color: '#1976d2',
    },
    {
      title: 'Assinaturas Ativas',
      value: stats.assinaturasAtivas.toLocaleString('pt-BR'),
      icon: <Assignment />,
      color: '#388e3c',
    },
    {
      title: 'Licenças Ativas',
      value: stats.licencasAtivas.toLocaleString('pt-BR'),
      icon: <VpnKey />,
      color: '#7b1fa2',
    },
    {
      title: 'Receita Mensal',
      value: `R$ ${stats.receitaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: <TrendingUp />,
      color: '#d32f2f',
    },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#1976d2' }}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Visão geral do sistema de licenças
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {statsCards.map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.title}>
            <Card
              elevation={2}
              sx={{
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography
                      color="textSecondary"
                      gutterBottom
                      variant="body2"
                      sx={{ fontWeight: 500, textTransform: 'uppercase', fontSize: '0.75rem' }}
                    >
                      {card.title}
                    </Typography>
                    <Typography variant="h4" component="h2" sx={{ fontWeight: 700, mt: 1 }}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      color: card.color,
                      backgroundColor: `${card.color}15`,
                      borderRadius: '12px',
                      p: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {licenseData.length > 0 && (
          <Grid size={12}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                Evolução de Licenças
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={licenseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="month" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ativas"
                    stroke="#1976d2"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#1976d2' }}
                    activeDot={{ r: 7 }}
                    name="Licenças Ativas"
                  />
                  <Line
                    type="monotone"
                    dataKey="novas"
                    stroke="#388e3c"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#388e3c' }}
                    activeDot={{ r: 7 }}
                    name="Novas Licenças"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {recentEvents.length > 0 && (
          <Grid size={12}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                Eventos Recentes - Logs de Conexão e Sistema
              </Typography>
              <Box>
                {recentEvents.map((event: any) => (
                  <Box
                    key={event.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 2,
                      borderRadius: 1,
                      mb: 1,
                      backgroundColor: '#f8f9fa',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        backgroundColor: '#e9ecef',
                      },
                      '&:last-child': { mb: 0 },
                    }}
                  >
                    <Box sx={{ mr: 2 }}>{getEventIcon(event.type, event.category)}</Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {event.message}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      sx={{
                        backgroundColor: 'white',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        fontWeight: 500,
                      }}
                    >
                      {event.time}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        )}

        {!licenseData.length && !securityData.length && !recentEvents.length && (
          <Grid size={12}>
            <Paper elevation={2} sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
              <Typography color="textSecondary" variant="body1">
                Nenhum dado disponível no momento
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}