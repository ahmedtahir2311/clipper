import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ProcessingWorkerModule } from './features/processing/processing-worker.module';
import { CleanupProducer } from './features/cleanup/cleanup.producer';

async function Bootstrap(): Promise<void> {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(ProcessingWorkerModule);

  const cleanupProducer = app.get(CleanupProducer);
  await cleanupProducer.ScheduleRepeatable();

  logger.log('Worker process started - listening for clip-generation and storage-cleanup jobs');

  const shutdown = async (): Promise<void> => {
    logger.log('Shutting down worker...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

Bootstrap().catch((error: unknown) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
