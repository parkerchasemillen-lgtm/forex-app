import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import { HybridForexPredictor } from './inference';

dotenv.config();

// ============================================
// GLOBAL ERROR HANDLERS (TOP PRIORITY)
// ============================================

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

// ============================================
// STRUCTURED LOGGING
// ============================================

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
  message: string;
  details?: any;
}

function log(level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG', message: string, details?: any): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(details && { details })
  };
  console.log(JSON.stringify(entry));
}

// ============================================
// MONITORING STATE
// ============================================

interface MonitoringState {
  isRunning: boolean;
  startedAt: string | null;
  predictionsCount: number;
  lastPredictionAt: string | null;
  lastAlert: any | null;
  lastError: string | null;
}

const state: MonitoringState = {
  isRunning: false,
  startedAt: null,
  predictionsCount: 0,
  lastPredictionAt: null,
  lastAlert: null,
  lastError: null
};

let monitoringInterval: NodeJS.Timeout | null = null;
let predictor: HybridForexPredictor | null = null;

// ============================================
// EXPRESS SERVER SETUP
// ============================================

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// ============================================
// HEALTH CHECK ENDPOINT (For Kubernetes & Cloud Run)
// ============================================

app.get('/health', (req: Request, res: Response) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    monitoring: {
      isRunning: state.isRunning,
      startedAt: state.startedAt,
      predictionsCount: state.predictionsCount,
      lastPredictionAt: state.lastPredictionAt
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: PORT,
      hasOandaKey: !!process.env.OANDA_API_KEY,
      hasOandaId: !!process.env.OANDA_ACCOUNT_ID
    }
  };

  res.status(200).json(healthStatus);
  log('DEBUG', 'Health check requested', { uptime: process.uptime() });
});

// ============================================
// STATUS ENDPOINT
// ============================================

app.get('/status', (req: Request, res: Response) => {
  const statusData = {
    isRunning: state.isRunning,
    startedAt: state.startedAt,
    predictionsCount: state.predictionsCount,
    lastPredictionAt: state.lastPredictionAt,
    lastAlert: state.lastAlert,
    lastError: state.lastError,
    hasApiCredentials: !!(process.env.OANDA_API_KEY && process.env.OANDA_ACCOUNT_ID)
  };

  res.status(200).json(statusData);
  log('DEBUG', 'Status requested');
});

// ============================================
// START MONITORING ENDPOINT
// ============================================

app.post('/start', async (req: Request, res: Response) => {
  if (state.isRunning) {
    log('WARN', 'Monitoring already running');
    return res.status(400).json({ error: 'Monitoring already running' });
  }

  try {
    // Validate credentials
    if (!process.env.OANDA_API_KEY || !process.env.OANDA_ACCOUNT_ID) {
      log('ERROR', 'Missing OANDA credentials', {
        hasKey: !!process.env.OANDA_API_KEY,
        hasId: !!process.env.OANDA_ACCOUNT_ID
      });
      return res.status(400).json({ 
        error: 'OANDA credentials not configured in environment variables' 
      });
    }

    log('INFO', 'Starting Forex monitoring');

    // Initialize predictor
    predictor = new HybridForexPredictor();
    state.isRunning = true;
    state.startedAt = new Date().toISOString();
    state.predictionsCount = 0;
    state.lastError = null;

    // Run prediction immediately
    await runPrediction();

    // Then every 60 seconds
    monitoringInterval = setInterval(runPrediction, 60000);

    res.status(200).json({
      message: 'Monitoring started successfully',
      startedAt: state.startedAt,
      status: 'RUNNING'
    });

    log('INFO', 'Monitoring started', { startedAt: state.startedAt });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('ERROR', 'Failed to start monitoring', { error: errorMsg });
    state.lastError = errorMsg;
    res.status(500).json({ error: 'Failed to start monitoring', details: errorMsg });
  }
});

// ============================================
// STOP MONITORING ENDPOINT
// ============================================

app.post('/stop', (req: Request, res: Response) => {
  if (!state.isRunning) {
    log('WARN', 'Monitoring not running');
    return res.status(400).json({ error: 'Monitoring not running' });
  }

  try {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }

    state.isRunning = false;
    log('INFO', 'Monitoring stopped');

    res.status(200).json({
      message: 'Monitoring stopped',
      predictionsCount: state.predictionsCount,
      status: 'STOPPED'
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('ERROR', 'Failed to stop monitoring', { error: errorMsg });
    res.status(500).json({ error: 'Failed to stop monitoring' });
  }
});

// ============================================
// PREDICTION LOGIC
// ============================================

async function runPrediction(): Promise<void> {
  try {
    if (!predictor) {
      log('WARN', 'Predictor not initialized');
      state.lastError = 'Predictor not initialized';
      return;
    }

    const result = await predictor.predict();
    state.predictionsCount++;
    state.lastPredictionAt = new Date().toISOString();
    state.lastError = null;

    // Log prediction details
    log('DEBUG', 'Prediction completed', {
      probability: (result.popProbability * 100).toFixed(2) + '%',
      predicted: result.popPredicted,
      price: result.marketStructure.currentPrice.toFixed(5),
      trend: result.marketStructure.trend,
      zone: result.marketStructure.priceZone
    });

    // If alert triggered, log it prominently
    if (result.alert.shouldAlert) {
      state.lastAlert = {
        timestamp: new Date().toISOString(),
        message: result.alert.message,
        severity: result.alert.severity,
        price: result.marketStructure.currentPrice,
        probability: result.popProbability
      };

      log('WARN', 'POP ALERT DETECTED', {
        message: result.alert.message,
        severity: result.alert.severity,
        probability: (result.popProbability * 100).toFixed(2) + '%',
        price: result.marketStructure.currentPrice.toFixed(5),
        support: result.marketStructure.support.toFixed(5),
        resistance: result.marketStructure.resistance.toFixed(5),
        trend: result.marketStructure.trend,
        momentum: result.marketStructure.momentum
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('ERROR', 'Prediction failed', { error: errorMsg });
    state.lastError = errorMsg;
  }
}

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: any, req: Request, res: Response) => {
  log('ERROR', 'Unhandled error', { error: String(err) });
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req: Request, res: Response) => {
  log('WARN', 'Endpoint not found', { path: req.path, method: req.method });
  res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

function gracefulShutdown(signal: string): void {
  log('INFO', `Received ${signal}, shutting down gracefully`);

  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  server.close(() => {
    log('INFO', 'Server closed successfully');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    log('ERROR', 'Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// START SERVER
// ============================================

let server: any;

try {
  server = app.listen(PORT, () => {
    log('INFO', `Server started on port ${PORT}`, {
      environment: process.env.NODE_ENV || 'development',
      hasOandaKey: !!process.env.OANDA_API_KEY,
      hasOandaId: !!process.env.OANDA_ACCOUNT_ID,
      endpoints: ['/health', '/status', '/start', '/stop']
    });
  });
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  log('ERROR', 'Failed to start server', { error: errorMsg });
  process.exit(1);
}

export default app;