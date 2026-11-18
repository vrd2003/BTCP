import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import flightRoutes from './routes/flightRoutes.js';
import policyRoutes from './routes/policyRoutes.js';
import predictionRoutes from './routes/predictionRoutes.js';
import oracleRoutes from './routes/oracleRoutes.js';
import compensationRoutes from './routes/compensationRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import blockchainRoutes from './routes/blockchainRoutes.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { requestContext, rejectMongoOperators } from './middleware/requestContext.js';
import { sendSuccess } from './utils/respond.js';
import { AppError } from './utils/errors.js';

export function createApp(config, databaseConnection) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS > 0 ? config.TRUST_PROXY_HOPS : false);
  app.locals.config = config;
  app.locals.databaseConnection = databaseConnection;

  app.use(helmet());
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.clientOrigins.includes(origin)) return callback(null, true);
      return callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed by the CORS policy.'));
    }
  }));
  app.use(requestContext);
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use(rejectMongoOperators);
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } }
  }));

  app.get('/api/health/live', (_request, response) => sendSuccess(response, 200, 'Service is live.', { status: 'ok' }));
  app.get('/api/health/ready', (_request, response) => {
    const ready = databaseConnection?.readyState === 1;
    return sendSuccess(response, ready ? 200 : 503, ready ? 'Service is ready.' : 'Database is unavailable.', {
      status: ready ? 'ready' : 'not_ready',
      database: ready ? 'connected' : 'disconnected',
      flightSearchConfigured: Boolean(config.FLIGHT_PROVIDER_API_KEY && config.FLIGHT_PROVIDER_URL),
      weatherConfigured: Boolean(config.OPENWEATHER_API_KEY)
    });
  });
  app.use('/api/auth', authRoutes(config));
  app.use('/api/users', userRoutes(config));
  app.use('/api/wallet', walletRoutes(config));
  app.use('/api/flights', flightRoutes(config));
  app.use('/api/policies', policyRoutes(config));
  app.use('/api/predictions', predictionRoutes(config));
  app.use('/api/oracle', oracleRoutes(config));
  app.use('/api/compensation', compensationRoutes(config));
  app.use('/api/notifications', notificationRoutes(config));
  app.use('/api/dashboard', dashboardRoutes(config));
  app.use('/api/admin', adminRoutes(config));
  app.use('/api/blockchain', blockchainRoutes(config));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
