import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';

const CHUNK_BODY_LIMIT = '10mb';
const JSON_BODY_LIMIT = '1mb';

async function Bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  app.use(helmet());
  app.use(cookieParser());

  // Chunk uploads need a raw binary body; everything else gets JSON parsing.
  app.use('/api/v1/uploads/:uploadId/chunks/:chunkIndex', express.raw({ type: '*/*', limit: CHUNK_BODY_LIMIT }));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get<string>('app.corsOrigin', 'http://localhost:3000'),
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  const port = configService.get<number>('app.port', 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/api/v1`);
}

Bootstrap().catch((error: unknown) => {
  console.error('API failed to start:', error);
  process.exit(1);
});
