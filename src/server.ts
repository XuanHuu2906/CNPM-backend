// Ensure env validation runs FIRST on import
import { env } from './config/env';
import app from './app';
import { logger } from './utils/logger';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
    logger.info(`🚀 Server is successfully running in [${env.NODE_ENV}] mode on http://localhost:${PORT}`);
});

// Handle graceful shutdown
const gracefulShutdown = (signal: string) => {
    logger.warn(`Received ${signal}. Shutting down server gracefully...`);
    server.close(() => {
        logger.info('Closed out remaining active connections. Exiting process.');
        process.exit(0);
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
