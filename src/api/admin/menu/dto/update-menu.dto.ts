import { createZodDto } from 'nestjs-zod';
import { CreateMenuSchema } from './create-menu.dto';

export class UpdateMenuDto extends createZodDto(CreateMenuSchema) {}
