import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { appConfig, authConfig, cleanupConfig, clipConfig, ffmpegConfig, redisConfig, storageConfig } from '../../config/app.config';
import { DatabaseModule } from '../../database/database.module';
import { FfmpegModule } from '../../shared/ffmpeg/ffmpeg.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { CleanupProcessor } from '../cleanup/cleanup.processor';
import { CleanupProducer } from '../cleanup/cleanup.producer';
import { QUEUE_NAMES } from './processing.constants';
import { ClipGenerationProcessor } from './processing.processor';

/**
 * Standalone worker process module - bootstrapped from worker.main.ts.
 * Deliberately excludes anything HTTP-related (controllers, guards) so this
 * process only ever does queue consumption + ffmpeg work.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, storageConfig, clipConfig, ffmpegConfig, authConfig, cleanupConfig, redisConfig],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
        },
      }),
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.CLIP_GENERATION }, { name: QUEUE_NAMES.CLEANUP }),
    DatabaseModule,
    StorageModule,
    FfmpegModule,
  ],
  providers: [ClipGenerationProcessor, CleanupProcessor, CleanupProducer],
})
export class ProcessingWorkerModule {}
