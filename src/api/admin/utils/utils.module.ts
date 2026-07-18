import { Module } from '@nestjs/common';
import { UtilsService } from './utils.service';
import { UtilsController } from './utils.controller';
import { DevelopmentOnlyGuard } from '../guards/development-only.guard';

@Module({
  controllers: [UtilsController],
  providers: [UtilsService, DevelopmentOnlyGuard],
})
export class UtilsModule {}
