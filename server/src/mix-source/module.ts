import { Module } from '@nestjs/common';
import { MixSourceController } from './controller';
import { MixSourceService } from './service';

@Module({
  controllers: [MixSourceController],
  providers: [MixSourceService],
})
export class MixSourceModule {}
