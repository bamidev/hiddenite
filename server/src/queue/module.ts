import { Module } from '@nestjs/common';
import { QueueController } from './controller';
import { QueueService } from './service';

@Module({
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
