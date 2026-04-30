import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { logger } from './shared/logger';
import { ensureStorageDirectories } from './shared/storage';

const bootstrap = async (): Promise<void> => {
  await ensureStorageDirectories();
  await prisma.$connect();

  const server = app.listen(env.PORT, () => {
    logger.info(`CAIS Meeting AI backend online na porta ${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Recebido ${signal}. Encerrando servidor...`);

    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
};

bootstrap().catch(async (error) => {
  logger.error('Falha ao inicializar backend.', error);
  await prisma.$disconnect();
  process.exit(1);
});
