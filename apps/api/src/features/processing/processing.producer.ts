import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES, type ClipGenerationJobData } from './processing.constants';

const JOB_ATTEMPTS = 2;
const JOB_BACKOFF_MS = 10_000;

@Injectable()
export class ProcessingProducer {
  constructor(@InjectQueue(QUEUE_NAMES.CLIP_GENERATION) private readonly queue: Queue<ClipGenerationJobData>) {}

  async EnqueueClipGeneration(jobId: string): Promise<void> {
    await this.queue.add(
      'generate-clips',
      { jobId },
      {
        attempts: JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: JOB_BACKOFF_MS },
        removeOnComplete: 100,
        removeOnFail: 500,
      }
    );
  }
}
