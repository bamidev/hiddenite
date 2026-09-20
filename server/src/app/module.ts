import { MixSourceModule } from '../mix-source/module';
import { LibraryModule } from '../library/module';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';

import { join } from 'node:path';

@Module({
  imports: [
    MixSourceModule,
    LibraryModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', '..', 'dist'),
    }),
  ],
})
export class AppModule {}
