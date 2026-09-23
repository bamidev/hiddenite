/**
 * Root NestJS application module. Wires together the mix-source and library
 * feature modules and configures serving of the pre-built static client,
 * carving out the `/webdav` paths that are instead handled by the raw
 * WebDAV middleware mounted directly on the Express instance in `main.ts`.
 */
import { MixSourceModule } from '../mix-source/module';
import { LibraryModule } from '../library/module';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';

import { join } from 'node:path';

/**
 * Root module of the application. Imports the mix-source and library
 * feature modules, and serves the built client bundle from `dist` for
 * every route except the paths reserved for WebDAV.
 */
@Module({
  imports: [
    MixSourceModule,
    LibraryModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', '..', 'dist'),
      exclude: ['/webdav/{*any}', '/webdav'],
    }),
  ],
})
export class AppModule {}
