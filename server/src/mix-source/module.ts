import { Module } from '@nestjs/common';
import { MixSourceController } from './controller';
import { MixSourceService } from './service';
import { QueueModule } from '../queue/module';

@Module({
  imports: [QueueModule],
  controllers: [MixSourceController],
  providers: [MixSourceService],
})
export class MixSourceModule {}
