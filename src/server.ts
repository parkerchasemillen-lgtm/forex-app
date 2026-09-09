import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import { HybridForexPredictor } from './inference';

dotenv.config();

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

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

interface MonitoringState {
  isRunning: boolean;
  startedAt: string | null;
  predictionsCount: number;
  lastPredictionAt: string | null;
  lastAlert: any | null;
  alerts: any[];
  lastError: string | null;
}

const state: MonitoringState = {
  isRunning: false,
  startedAt: null,
  predictionsCount: 0,
  lastPredictionAt: null,
  lastAlert: null,
  alerts: [],
  lastError: null
};

let monitoringInterval: NodeJS.Timeout | null = null;
let predictor: HybridForexPredictor | null = null;

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
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
  });
});

app.get('/status', (req: Request, res: Response) => {
  res.status(200).json({
    isRunning: state.isRunning,
    startedAt: state.startedAt,
    predictionsCount: state.predictionsCount,
    lastPredictionAt: state.lastPredictionAt,
    lastAlert: state.lastAlert,
    alertCount: state.alerts.length,
    lastError: state.lastError,
    hasApiCredentials: !!(process.env.OANDA_API_KEY && process.env.OANDA_ACCOUNT_ID)
  });
});

app.get('/alerts', (req: Request, res: Response) => {
  res.status(200).json({
    count: state.alerts.length,
    predictionsCount: state.predictionsCount,
    alerts: state.alerts
  });
});

async function startMonitoring(): Promise<void> {
  if (state.isRunning) return;

  if (!process.env.OANDA_API_KEY || !process.env.OANDA_ACCOUNT_ID) {
    log('ERROR', 'Cannot start: missing OANDA credentials');
    return;
  }

  predictor = new HybridForexPredictor();
  state.isRunning = true;
  state.startedAt = new Date().toISOString();
  state.predictionsCount = 0;
  state.lastError = null;

  await runPrediction();
  monitoringInterval = setInterval(runPrediction, 60000);

  log('INFO', 'Monitoring started', { startedAt: state.startedAt });
}

app.post('/start', async (req: Request, res: Response) => {
  if (state.isRunning) {
    return res.status(400).json({ error: 'Monitoring already running' });
  }

  try {
    await startMonitoring();
    res.status(200).json({
      message: 'Monitoring started successfully',
      startedAt: state.startedAt,
      status: 'RUNNING'
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('ERROR', 'Failed to start monitoring', { error: errorMsg });
    state.lastError = errorMsg;
    res.status(500).json({ error: 'Failed to start monitoring', details: errorMsg });
  }
});

app.post('/stop', (req: Request, res: Response) => {
  if (!state.isRunning) {
    return res.status(400).json({ error: 'Monitoring not running' });
  }

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
});

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

    log('DEBUG', 'Prediction completed', {
      probability: (result.popProbability * 100).toFixed(2) + '%',
      predicted: result.popPredicted,
      price: result.marketStructure.currentPrice.toFixed(5),
      trend: result.marketStructure.trend,
      zone: result.marketStructure.priceZone
    });

    if (result.alert.shouldAlert) {
      state.lastAlert = {
        timestamp: new Date().toISOString(),
        message: result.alert.message,
        severity: result.alert.severity,
        price: result.marketStructure.currentPrice,
        probability: result.popProbability
      };

      state.alerts.unshift(state.lastAlert);
      if (state.alerts.length > 100) state.alerts.pop();

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

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

function gracefulShutdown(signal: string): void {
  log('INFO', `Received ${signal}, shutting down gracefully`);

  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  server.close(() => {
    log('INFO', 'Server closed successfully');
    process.exit(0);
  });

  setTimeout(() => {
    log('ERROR', 'Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const server = app.listen(PORT, () => {
  log('INFO', `Server started on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    hasOandaKey: !!process.env.OANDA_API_KEY,
    hasOandaId: !!process.env.OANDA_ACCOUNT_ID,
    endpoints: ['/health', '/status', '/alerts', '/start', '/stop']
  });

  startMonitoring().catch((error) => {
    log('ERROR', 'Auto-start failed', { error: String(error) });
    state.lastError = String(error);
  });
});

export default app;
