import { Module } from '@nestjs/common';
import { GeneratorService } from './generator.service';
import { GeneratorController } from './generator.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeTableConfig } from './entities/code-table.entity';
import { CodeFieldConfig } from './entities/code-field.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CodeTableConfig, CodeFieldConfig])],
  controllers: [GeneratorController],
  providers: [GeneratorService],
})
export class GeneratorModule {}
