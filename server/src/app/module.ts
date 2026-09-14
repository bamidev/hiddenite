import { MixSourceModule } from '../mix-source/module';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './controller';
import { AppService } from './service';

import { join } from 'node:path';

@Module({
  imports: [
    MixSourceModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
