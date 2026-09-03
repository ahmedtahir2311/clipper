import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES } from './processing.constants';
import { ProcessingProducer } from './processing.producer';

/**
 * HTTP-side module: only registers the queue as a producer so uploads can
 * enqueue work. The actual processor runs in the separate worker process
 * bootstrapped from worker.main.ts (see processing-worker.module.ts) so a
 * malformed video or a slow ffmpeg run can never block API requests.
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.CLIP_GENERATION })],
  providers: [ProcessingProducer],
  exports: [ProcessingProducer],
})
export class ProcessingModule {}
