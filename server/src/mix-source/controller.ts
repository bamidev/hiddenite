import { Controller, Put } from '@nestjs/common';
import { MixSourceService } from './service';

@Controller('mix-source')
export class MixSourceController {
  constructor(private readonly service: MixSourceService) {
    this.service = service;
  }

  @Put()
  putMixSource(): string {
    return this.service.hoi();
  }
}
