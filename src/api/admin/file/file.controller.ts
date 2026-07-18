import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessPass } from 'src/common/exceptions';
import {
  InitChunkUploadDto,
  MergeChunkUploadDto,
} from './dto/chunk-upload.dto';
import { QueryFilePageDto } from './dto/query-file-page.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { DeleteFilesDto } from './dto/delete-files.dto';
import { Permissions } from '../decorators';

type MulterFile = Express.Multer.File;

@Controller('admin/file')
@ApiTags('文件管理')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Permissions('file:list')
  @Get('page')
  @ApiOperation({ summary: '文件分页列表' })
  async page(@Query() query: QueryFilePageDto) {
    return BusinessPass(await this.fileService.pageFiles(query));
  }

  @Permissions('file:btn:delete')
  @Delete('batch')
  @ApiOperation({ summary: '批量删除文件' })
  async removeBatch(@Body() body: DeleteFilesDto) {
    const result = await this.fileService.deleteFilesByIds(body.ids, {
      removeDiskFile: body.removeDiskFile,
    });
    const msg =
      result.failed > 0
        ? `删除完成：成功 ${result.deleted} 条，失败 ${result.failed} 条`
        : '删除成功';
    return BusinessPass(result, msg);
  }

  @Permissions('file:btn:delete')
  @Delete(':id')
  @ApiOperation({ summary: '按ID删除文件（可选直接删除磁盘文件）' })
  async remove(
    @Param('id') id: string,
    @Query('removeDiskFile') removeDiskFile?: string,
  ) {
    const direct =
      removeDiskFile === 'true' ||
      removeDiskFile === '1' ||
      removeDiskFile === 'yes';
    return BusinessPass(
      await this.fileService.deleteFileById(id, { removeDiskFile: direct }),
      '删除成功',
    );
  }

  @Permissions('file:btn:upload')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '普通上传文件' })
  async upload(@UploadedFile() file: MulterFile, @Body() body: UploadFileDto) {
    return BusinessPass(
      await this.fileService.uploadFile(file, body),
      '上传成功',
    );
  }

  @Permissions('file:btn:upload')
  @Post('chunk/init')
  @ApiOperation({ summary: '初始化分片上传' })
  async initChunk(@Body() body: InitChunkUploadDto) {
    return BusinessPass(await this.fileService.initChunkUpload(body));
  }

  @Permissions('file:btn:upload')
  @Post('chunk/:fileHash/:index')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传单个分片' })
  async uploadChunk(
    @Param('fileHash') fileHash: string,
    @Param('index') index: string,
    @UploadedFile() file: MulterFile,
  ) {
    return BusinessPass(
      await this.fileService.uploadChunk(fileHash, index, file),
    );
  }

  @Permissions('file:btn:upload')
  @Post('chunk/merge')
  @ApiOperation({ summary: '合并分片上传文件' })
  async mergeChunk(@Body() body: MergeChunkUploadDto) {
    return BusinessPass(await this.fileService.mergeChunks(body), '上传成功');
  }
}
