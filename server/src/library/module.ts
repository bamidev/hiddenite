import { Module } from '@nestjs/common';
import { LibraryController } from './controller';
import { LibraryService } from './service';

@Module({
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
