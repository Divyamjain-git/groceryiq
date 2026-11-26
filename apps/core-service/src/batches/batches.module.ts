import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';

@Module({
  controllers: [BatchesController],
  providers: [BatchesService],
  exports: [BatchesService], // core-service transactions module will need findOldestAvailable
})
export class BatchesModule {}
