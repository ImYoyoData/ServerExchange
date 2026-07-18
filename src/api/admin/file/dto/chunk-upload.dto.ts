import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const InitChunkUploadSchema = z.object({
  fileName: z.string().min(1, 'fileName 不能为空'),
  fileHash: z.string().min(1, 'fileHash 不能为空'),
  fileSize: z.coerce.number().int().positive('fileSize 必须大于0'),
  chunkSize: z.coerce.number().int().positive('chunkSize 必须大于0'),
  totalChunks: z.coerce.number().int().positive('totalChunks 必须大于0'),
  module: z.string().min(1, 'module 不能为空').max(50, 'module 长度不能超过50'),
  uploadUserId: z.coerce.number().int().positive().optional(),
  uploadUserName: z.string().max(100).optional(),
});

export const MergeChunkUploadSchema = z.object({
  fileName: z.string().min(1, 'fileName 不能为空'),
  fileHash: z.string().min(1, 'fileHash 不能为空'),
  totalChunks: z.coerce.number().int().positive('totalChunks 必须大于0'),
  module: z.string().min(1, 'module 不能为空').max(50, 'module 长度不能超过50'),
  uploadUserId: z.coerce.number().int().positive().optional(),
  uploadUserName: z.string().max(100).optional(),
});

export class InitChunkUploadDto extends createZodDto(InitChunkUploadSchema) {}
export class MergeChunkUploadDto extends createZodDto(MergeChunkUploadSchema) {}
