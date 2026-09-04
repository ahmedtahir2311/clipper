import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { appConfig, cleanupConfig, clipConfig, ffmpegConfig, redisConfig, storageConfig, youtubeImportConfig } from '../../config/app.config';
import { ValidateEnv } from '../../config/env';
import { FfmpegModule } from '../../shared/ffmpeg/ffmpeg.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { StoreModule } from '../../shared/store/store.module';
import { YtDlpModule } from '../../shared/yt-dlp/yt-dlp.module';
import { CaptionBurnProcessor } from '../captions/caption-burn.processor';
import { CleanupProcessor } from '../cleanup/cleanup.processor';
import { CleanupProducer } from '../cleanup/cleanup.producer';
import { QUEUE_NAMES } from './processing.constants';
import { ProcessingProducer } from './processing.producer';
import { ClipGenerationProcessor } from './processing.processor';
import { SourceDownloadProcessor } from './source-download.processor';

/**
 * Standalone worker process module - bootstrapped from worker.main.ts.
 * Deliberately excludes anything HTTP-related (controllers, guards) so this
 * process only ever does queue consumption + ffmpeg/yt-dlp work.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: ValidateEnv,
      load: [appConfig, storageConfig, clipConfig, ffmpegConfig, cleanupConfig, redisConfig, youtubeImportConfig],
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
    BullModule.registerQueue(
      { name: QUEUE_NAMES.SOURCE_DOWNLOAD },
      { name: QUEUE_NAMES.CLIP_GENERATION },
      { name: QUEUE_NAMES.CAPTION_BURN },
      { name: QUEUE_NAMES.CLEANUP }
    ),
    StorageModule,
    StoreModule,
    FfmpegModule,
    YtDlpModule,
  ],
  providers: [
    ProcessingProducer,
    SourceDownloadProcessor,
    ClipGenerationProcessor,
    CaptionBurnProcessor,
    CleanupProcessor,
    CleanupProducer,
  ],
})
export class ProcessingWorkerModule {}
