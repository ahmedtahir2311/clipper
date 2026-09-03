import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { appConfig, authConfig, cleanupConfig, clipConfig, ffmpegConfig, redisConfig, storageConfig } from './config/app.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './shared/auth/auth.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { StorageModule } from './shared/storage/storage.module';
import { UploadsModule } from './features/uploads/uploads.module';
import { JobsModule } from './features/jobs/jobs.module';
import { ClipsModule } from './features/clips/clips.module';

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
    DatabaseModule,
    StorageModule,
    AuthModule,
    UploadsModule,
    JobsModule,
    ClipsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
