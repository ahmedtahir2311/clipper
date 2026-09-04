import { Module } from '@nestjs/common';
import { YtDlpService } from './yt-dlp.service';

@Module({
  providers: [YtDlpService],
  exports: [YtDlpService],
})
export class YtDlpModule {}
