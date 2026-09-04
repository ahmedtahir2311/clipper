import { Module } from '@nestjs/common';
import { ProcessingModule } from '../processing/processing.module';
import { ClipsController } from './clips.controller';
import { ClipsService } from './clips.service';

@Module({
  imports: [ProcessingModule],
  controllers: [ClipsController],
  providers: [ClipsService],
})
export class ClipsModule {}
