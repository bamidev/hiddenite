/**
 * NestJS module wiring together the mix-source controller and service,
 * pulling in the queue module since mix sources play songs from queues.
 */
import { Module } from '@nestjs/common';
import { MixSourceController } from './controller';
import { MixSourceService } from './service';
import { QueueModule } from '../queue/module';

/**
 * Feature module for mix sources (playback state machines). Imports the
 * queue module and exposes `MixSourceController`.
 */
@Module({
  imports: [QueueModule],
  controllers: [MixSourceController],
  providers: [MixSourceService],
})
export class MixSourceModule {}
