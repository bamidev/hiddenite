/**
 * NestJS module wiring together the queue controller and service.
 */
import { Module } from '@nestjs/common';
import { QueueController } from './controller';
import { QueueService } from './service';

/**
 * Feature module for playback queues. Exposes `QueueController` and makes
 * `QueueService` available to other modules that import this one (e.g. the
 * mix-source module).
 */
@Module({
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
