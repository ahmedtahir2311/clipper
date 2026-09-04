import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES } from './processing.constants';
import { ProcessingProducer } from './processing.producer';

/**
 * HTTP-side module: only registers the queues as producers so uploads can
 * enqueue work. The actual processors run in the separate worker process
 * bootstrapped from worker.main.ts (see processing-worker.module.ts) so a
 * malformed video, a slow ffmpeg run, or a slow YouTube download can never
 * block API requests.
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CLIP_GENERATION },
      { name: QUEUE_NAMES.SOURCE_DOWNLOAD },
      { name: QUEUE_NAMES.CAPTION_BURN }
    ),
  ],
  providers: [ProcessingProducer],
  exports: [ProcessingProducer],
})
export class ProcessingModule {}
