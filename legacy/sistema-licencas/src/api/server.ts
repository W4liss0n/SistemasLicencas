import dotenv from 'dotenv';

// CRITICAL: Load environment variables BEFORE any other imports
// This ensures RSA keys are available when JWTService initializes
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { licenseRoutes } from './gateway/routes/integration/license.routes';
import { authRoutes } from './gateway/routes/auth.routes';
import { clientesRoutes } from './gateway/routes/clientes.routes';
import { assinaturasRoutes } from './gateway/routes/assinaturas.routes';
import { licencasRoutes } from './gateway/routes/licencas.routes';
import { dashboardRoutes } from './gateway/routes/dashboard.routes';
import { programasRoutes } from './gateway/routes/programas.routes';
import { planosRoutes } from './gateway/routes/planos.routes';
import { adminsRoutes } from './gateway/routes/admins.routes';
import { logsRoutes } from './gateway/routes/logs.routes';
import { errorHandler } from '../shared/middleware/error-handler.middleware';
import pool from '../data/database/config/postgres.config';
import redis from '../data/database/config/redis.config';

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');

    // Check Redis connection
    await redis.ping();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      services: {
        database: 'connected',
        cache: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service dependencies not available'
    });
  }
});

// API routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/license`, licenseRoutes);
app.use(`/api/${API_VERSION}/clientes`, clientesRoutes);
app.use(`/api/${API_VERSION}/assinaturas`, assinaturasRoutes);
app.use(`/api/${API_VERSION}/licencas`, licencasRoutes);
app.use(`/api/${API_VERSION}/dashboard`, dashboardRoutes);
app.use(`/api/${API_VERSION}/programas`, programasRoutes);
app.use(`/api/${API_VERSION}/planos`, planosRoutes);
app.use(`/api/${API_VERSION}/admins`, adminsRoutes);
app.use(`/api/${API_VERSION}/logs`, logsRoutes);

// Serve frontend static files from /admin
const frontendDistPath = path.join(__dirname, '../../web/dist');
app.use('/admin', express.static(frontendDistPath));

// SPA fallback for React Router - serve index.html for /admin routes
app.get(/^\/admin(\/.+)?$/, (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Redirect root to admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Catch-all: redirect common frontend routes to /admin
app.use((req, res, next) => {
  // Skip API routes and health check
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }

  // Only handle GET requests for frontend routes
  if (req.method === 'GET') {
    return res.redirect(`/admin${req.path}`);
  }

  next();
});

// 404 handler (only for API routes that don't exist)
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🔄 Starting graceful shutdown...');

  try {
    await pool.end();
    console.log('✅ Database connections closed');

    redis.disconnect();
    console.log('✅ Redis connection closed');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
app.listen(PORT, () => {
  console.log(`
====================================================
     Sistema de Licencas - API Server
====================================================
  Server running on port ${PORT}
  API Version: ${API_VERSION}
  Environment: ${process.env.NODE_ENV || 'development'}

  API Health:  http://localhost:${PORT}/health
  Admin Panel: http://localhost:${PORT}/admin
====================================================
  `);
});

export default app;