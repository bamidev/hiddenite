/**
 * NestJS module wiring together the library controller and service.
 */
import { Module } from '@nestjs/common';
import { LibraryController } from './controller';
import { LibraryService } from './service';

/**
 * Feature module for the music library. Exposes `LibraryController` and
 * makes `LibraryService` available to other modules that import this one.
 */
@Module({
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
