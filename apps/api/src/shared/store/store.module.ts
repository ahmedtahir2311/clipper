import { Global, Module } from '@nestjs/common';
import { JobStoreService } from './job-store.service';

@Global()
@Module({
  providers: [JobStoreService],
  exports: [JobStoreService],
})
export class StoreModule {}
