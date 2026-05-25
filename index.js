require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('./src/auth');
const { getMetrics } = require('./src/metrics');
const { getProcesses } = require('./src/processes');
const { sendAlertEmail } = require('./src/alert');
const httpStatusCodes = require('./src/constants/httpStatusCodes');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS === '*'
    ? '*'
    : process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Authorization', 'Content-Type'],
};

app.use(cors(corsOptions));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

app.get('/health', (req, res) => {
  return res.json({ status: 'ok' });
});

app.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [metrics, processes] = await Promise.all([getMetrics(), getProcesses()]);

    return res.json({ ...metrics, processes });
  } catch (error) {
    return res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
});

app.post('/alert', authMiddleware, async (req, res) => {
  try {
    const alert = req.body;

    if (!alert || typeof alert !== 'object') {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ error: 'Alert payload is required' });
    }

    if (!alert.message && !alert.title && !alert.subject) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ error: 'Alert payload must include message, title, or subject' });
    }

    const email = await sendAlertEmail(alert);

    return res.status(httpStatusCodes.OK).json({
      status: 'sent',
      id: email?.id
    });
  } catch (error) {
    return res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
});

app.use((req, res) => {
  return res
    .status(httpStatusCodes.NOT_FOUND)
    .json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
  console.error(error);

  return res
    .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: error.message || 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`VPSInsight agent listening on port ${PORT}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down VPSInsight agent...`);

  server.close((error) => {
    if (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }

    console.log('VPSInsight agent stopped.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  shutdown('unhandledRejection');
});
