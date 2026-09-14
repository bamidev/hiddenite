import { Injectable } from '@nestjs/common';

@Injectable()
export class MixSourceService {
  hoi(): string {
    return 'Hello World!';
  }
}
