import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import { BusinessRejectedException } from 'src/common/exceptions';
import { getAppPublicDomain } from 'src/common/utils/domain.util';
import { Between, IsNull, Like, Repository } from 'typeorm';
import {
  InitChunkUploadDto,
  MergeChunkUploadDto,
} from './dto/chunk-upload.dto';
import { QueryFilePageDto } from './dto/query-file-page.dto';
import { SysFile } from './entities/file.entity';

type MulterFile = Express.Multer.File;

type UploadContext = {
  module: string;
  uploadUserId?: number;
  uploadUserName?: string;
};

type UploadPolicy = {
  /** 最大文件大小（字节） */
  maxSize?: number;
  /** 允许的扩展名白名单（不带点，如 ['png','jpg','mp4']） */
  allowedExts?: string[];
};

type UploadPolicyInput = Pick<MulterFile, 'originalname' | 'size'> & {
  buffer?: Buffer;
};

/**
 * FileService（文件管理服务）
 *
 * 可公开给业务层调用的方法：
 *
 * 1) `toFullUrl(pathOrRelPath)`
 * - 入参：相对路径/绝对URL/空值
 * - 返回：拼接站点根域名后的完整URL（开发用 DOMAIN_DEV，生产用 DOMAIN；若本身已是 http/https 则原样返回）
 * - 示例：`fileService.toFullUrl('/uploads/2026/03/26/a.png')`
 *
 * 2) `pageFiles(query)`
 * - 入参：`QueryFilePageDto`
 * - 字段：`page/pageSize/fileName/fileType/module/fileSizeMin/fileSizeMax`
 * - 返回：分页数据（每条包含 `fileUrl`）
 *
 * 3) `getFileInfoById(id)`
 * - 入参：文件ID（string/number）
 * - 返回：文件详情 + `filePathRaw`(原始相对路径) + `fileUrl`(完整地址)
 *
 * 4) `deleteFileById(id)`
 * - 入参：文件ID（string/number）
 * - 行为：软删除（`isActive=false` + `deletedAt=now`）
 *
 * 5) `uploadFile(file, body, policy?)`
 * - file：`Express.Multer.File`
 * - body：`{ module, uploadUserId?, uploadUserName? }`
 * - policy（可选）：
 *   - `maxSize`：最大字节数
 *   - `allowedExts`：扩展名白名单（不带点）
 * - 结果：保存至 `public/uploads/年/月/日/哈希.后缀`，并入库
 *
 * 6) 分片上传三件套
 * - `initChunkUpload(body)`：初始化并返回已上传分片索引
 * - `uploadChunk(fileHash, index, file, policy?)`：上传单个分片
 * - `mergeChunks(body, policy?)`：合并分片并入库
 *
 * 内部定时方法（非业务调用）：
 * - `cleanupExpiredSoftDeletedFiles()`：清理软删超过24小时的文件与记录
 * - `cleanupExpiredChunkDirs()`：清理过期未完成分片目录
 */
@Injectable()
export class FileService {
  constructor(
    @InjectRepository(SysFile)
    private readonly fileRepository: Repository<SysFile>,
  ) {}

  private getPublicRoot() {
    return join(process.cwd(), 'public');
  }

  private toRelPath(absPath: string): string {
    const rel = absPath.replace(this.getPublicRoot(), '').replace(/\\/g, '/');
    return rel.startsWith('/') ? rel : `/${rel}`;
  }

  /**
   * 内部拼接域名方法。对外请使用 `toFullUrl()`。
   */
  private withDomain(relPath: string): string {
    const domain = getAppPublicDomain();
    return domain ? `${domain}${relPath}` : relPath;
  }

  /**
   * 将相对路径（例如 /uploads/2026/03/26/a.png）拼接为完整URL。
   * 兼容输入为空、绝对URL输入等场景。
   */
  toFullUrl(pathOrRelPath?: string | null): string {
    const p = String(pathOrRelPath ?? '').trim();
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    const rel = p.startsWith('/') ? p : `/${p}`;
    return this.withDomain(rel);
  }

  private getSaveDirByDate(date = new Date()) {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return join(this.getPublicRoot(), 'uploads', y, m, d);
  }

  private async ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
  }

  private md5FromBuffer(buf: Buffer) {
    const md5 = createHash('md5');
    md5.update(buf);
    return md5.digest('hex');
  }

  private async md5FromFile(filePath: string) {
    const hash = createHash('md5');
    const stream = createReadStream(filePath);
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });
    return hash.digest('hex');
  }

  /**
   * 统一归一化上传上下文参数，兼容：
   * - controller 直接传 UploadFileDto
   * - 其他 service 传自定义对象
   */
  private normalizeUploadContext(body: UploadContext): UploadContext {
    const module = String(body?.module ?? '').trim();
    if (!module) throw new BusinessRejectedException('module 不能为空');
    return {
      module,
      uploadUserId: body?.uploadUserId,
      uploadUserName: body?.uploadUserName,
    };
  }

  /**
   * 上传策略校验（可选）：大小限制、扩展名白名单。
   */
  private validateUploadPolicy(
    fileLike: UploadPolicyInput,
    policy?: UploadPolicy,
  ) {
    if (!policy) return;
    const fileSize = Number(fileLike.size ?? fileLike.buffer?.length ?? 0);
    if (policy.maxSize && fileSize > policy.maxSize) {
      throw new BusinessRejectedException(
        `文件大小超过限制：${policy.maxSize} 字节`,
      );
    }

    if (policy.allowedExts?.length) {
      const ext = (extname(String(fileLike.originalname ?? '')) || '')
        .replace('.', '')
        .toLowerCase();
      const allowSet = new Set(
        policy.allowedExts.map((e) => String(e).replace('.', '').toLowerCase()),
      );
      if (!allowSet.has(ext)) {
        throw new BusinessRejectedException(
          `不支持的文件类型：${ext || 'unknown'}`,
        );
      }
    }
  }

  async pageFiles(query: QueryFilePageDto) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const fileName = String(query.fileName ?? '').trim();
    const fileType = String(query.fileType ?? '').trim();
    const module = String(query.module ?? '').trim();

    const where: any = {
      isActive: true,
      deletedAt: IsNull(),
    };
    if (fileName) where.fileName = Like(`%${fileName}%`);
    if (fileType) where.fileType = Like(`%${fileType}%`);
    if (module) where.module = Like(`%${module}%`);

    if (
      query.fileSizeMin !== undefined &&
      query.fileSizeMax !== undefined &&
      query.fileSizeMin <= query.fileSizeMax
    ) {
      where.fileSize = Between(
        Number(query.fileSizeMin),
        Number(query.fileSizeMax),
      );
    } else if (query.fileSizeMin !== undefined) {
      where.fileSize = Between(
        Number(query.fileSizeMin),
        Number.MAX_SAFE_INTEGER,
      );
    } else if (query.fileSizeMax !== undefined) {
      where.fileSize = Between(0, Number(query.fileSizeMax));
    }

    const [list, total] = await this.fileRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      withDeleted: false,
    });

    const rows = list.map((item) => ({
      ...item,
      fileUrl: this.withDomain(item.filePath),
    }));

    return {
      list: rows,
      total,
      pageSize,
      currentPage: page,
      totalPages: Math.ceil(total / pageSize) || 0,
    };
  }

  /**
   * 通过文件系统ID查询文件详情，返回原始相对路径与完整URL。
   */
  async getFileInfoById(id: string | number) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) {
      throw new BusinessRejectedException('文件 id 参数错误');
    }

    const file = await this.fileRepository.findOne({
      where: { id: numId },
      withDeleted: true,
    });
    if (!file) throw new BusinessRejectedException('文件不存在');

    return {
      ...file,
      filePathRaw: file.filePath,
      fileUrl: this.toFullUrl(file.filePath),
    };
  }

  /**
   * 软删除文件（支持 controller 与 service 直接调用）
   * @param removeDiskFile 为 true 时同时删除磁盘文件并硬删数据库记录
   */
  async deleteFileById(
    id: string | number,
    options?: { removeDiskFile?: boolean },
  ) {
    const result = await this.deleteFilesByIds([Number(id)], options);
    if (result.failed > 0) {
      throw new BusinessRejectedException(
        result.errors?.[0]?.reason ?? '删除失败',
      );
    }
    return { id: Number(id) };
  }

  /**
   * 批量删除文件
   */
  async deleteFilesByIds(
    ids: Array<string | number>,
    options?: { removeDiskFile?: boolean },
  ) {
    const uniqueIds = [
      ...new Set(
        ids
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
    if (uniqueIds.length === 0) {
      throw new BusinessRejectedException('文件 id 参数错误');
    }

    const removeDiskFile = Boolean(options?.removeDiskFile);
    const errors: Array<{ id: number; reason: string }> = [];
    let deleted = 0;

    for (const numId of uniqueIds) {
      try {
        await this.deleteOneFile(numId, removeDiskFile);
        deleted += 1;
      } catch (error: any) {
        errors.push({
          id: numId,
          reason: String(error?.message ?? error ?? '删除失败'),
        });
      }
    }

    return {
      total: uniqueIds.length,
      deleted,
      failed: errors.length,
      removeDiskFile,
      errors,
    };
  }

  private async deleteOneFile(id: number, removeDiskFile: boolean) {
    const file = await this.fileRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!file) throw new BusinessRejectedException('文件不存在');

    if (removeDiskFile) {
      const absFilePath = join(
        this.getPublicRoot(),
        file.filePath.replace(/^\//, ''),
      );
      try {
        await fs.rm(absFilePath, { force: true });
      } catch (error: any) {
        throw new BusinessRejectedException(
          `磁盘文件删除失败：${String(error?.message ?? error ?? 'unknown')}`,
        );
      }
      await this.fileRepository.delete(id);
      return;
    }

    file.isActive = false;
    file.deletedAt = new Date();
    await this.fileRepository.save(file);
  }

  /**
   * 普通上传：
   * - 兼容 controller 调用：uploadFile(file, dto)
   * - 兼容其他 service 调用：uploadFile(file, context, policy)
   */
  async uploadFile(
    file: MulterFile,
    body: UploadContext,
    policy?: UploadPolicy,
  ) {
    if (!file?.buffer || !file.originalname) {
      throw new BusinessRejectedException('请选择要上传的文件');
    }
    const ctx = this.normalizeUploadContext(body);
    this.validateUploadPolicy(file, policy);

    const dir = this.getSaveDirByDate();
    await this.ensureDir(dir);

    const ext = extname(file.originalname) || '';
    const hash = this.md5FromBuffer(file.buffer);
    const absFilePath = join(dir, `${hash}${ext}`);

    await fs.writeFile(absFilePath, file.buffer);
    const relPath = this.toRelPath(absFilePath);

    const entity = await this.fileRepository.save({
      fileName: file.originalname,
      filePath: relPath,
      fileType: ext ? ext.replace('.', '') : '',
      fileSize: Number(file.size || file.buffer.length || 0),
      fileHash: hash,
      uploadUserId: ctx.uploadUserId,
      uploadUserName: ctx.uploadUserName,
      module: ctx.module,
      isActive: true,
    });

    return {
      ...entity,
      filePathRaw: entity.filePath,
      fileUrl: this.toFullUrl(entity.filePath),
    };
  }

  private getChunkRoot(fileHash: string) {
    return join(this.getPublicRoot(), 'uploads', '.chunks', fileHash);
  }

  private getChunksBaseDir() {
    return join(this.getPublicRoot(), 'uploads', '.chunks');
  }

  /**
   * 分片上传初始化：
   * 可选 policy（当前主要用于服务层参数统一，init 阶段不校验大小/类型）
   */
  async initChunkUpload(body: InitChunkUploadDto, _policy?: UploadPolicy) {
    const chunkRoot = this.getChunkRoot(body.fileHash);
    await this.ensureDir(chunkRoot);
    const files = await fs.readdir(chunkRoot).catch(() => []);

    const uploadedChunkIndexes = files
      .map((name) => Number(name))
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);

    return {
      fileHash: body.fileHash,
      uploadedChunkIndexes,
    };
  }

  /**
   * 上传单个分片：
   * 兼容 controller 调用与 service 调用，可传 policy 做大小/类型控制。
   */
  async uploadChunk(
    fileHash: string,
    index: string | number,
    file: MulterFile,
    policy?: UploadPolicy,
  ) {
    const idx = Number(index);
    if (!fileHash || !Number.isInteger(idx) || idx < 0) {
      throw new BusinessRejectedException('分片参数错误');
    }
    if (!file?.buffer) {
      throw new BusinessRejectedException('分片文件不能为空');
    }
    this.validateUploadPolicy(file, policy);

    const chunkRoot = this.getChunkRoot(fileHash);
    await this.ensureDir(chunkRoot);

    const chunkPath = join(chunkRoot, String(idx));
    await fs.writeFile(chunkPath, file.buffer);

    return { fileHash, index: idx };
  }

  /**
   * 合并分片：
   * 兼容 controller 调用与 service 调用，可传 policy 做大小/类型控制。
   */
  async mergeChunks(body: MergeChunkUploadDto, policy?: UploadPolicy) {
    const ctx = this.normalizeUploadContext(body);
    const chunkRoot = this.getChunkRoot(body.fileHash);
    const chunkFiles = await fs.readdir(chunkRoot).catch(() => []);
    if (chunkFiles.length === 0) {
      throw new BusinessRejectedException('未找到可合并的分片');
    }

    const sorted = chunkFiles
      .map((name) => Number(name))
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);

    if (sorted.length !== body.totalChunks) {
      throw new BusinessRejectedException('分片数量不完整，无法合并');
    }

    const dir = this.getSaveDirByDate();
    await this.ensureDir(dir);

    const ext = extname(body.fileName) || '';
    this.validateUploadPolicy(
      {
        originalname: body.fileName,
        size: Number(body.totalChunks || 0), // 合并阶段不可靠，主要用于类型校验
      },
      policy,
    );
    const absFilePath = join(dir, `${body.fileHash}${ext}`);

    const buffers: Buffer[] = [];
    for (const idx of sorted) {
      const buf = await fs.readFile(join(chunkRoot, String(idx)));
      buffers.push(buf);
    }

    await fs.writeFile(absFilePath, Buffer.concat(buffers));

    const fileHash = await this.md5FromFile(absFilePath);
    const relPath = this.toRelPath(absFilePath);
    await fs.rm(chunkRoot, { recursive: true, force: true });

    const stat = await fs.stat(absFilePath);

    const entity = await this.fileRepository.save({
      fileName: basename(body.fileName),
      filePath: relPath,
      fileType: ext ? ext.replace('.', '') : '',
      fileSize: Number(stat.size || 0),
      fileHash,
      uploadUserId: ctx.uploadUserId,
      uploadUserName: ctx.uploadUserName,
      module: ctx.module,
      isActive: true,
    });

    return {
      ...entity,
      filePathRaw: entity.filePath,
      fileUrl: this.toFullUrl(entity.filePath),
    };
  }

  /**
   * 清理已软删除超过24小时的文件数据：
   * - 条件：isActive=false 且 deletedAt 非空且 <= 24小时前
   * - 每次最多处理1000条
   * - 单条顺序：先删磁盘文件，再删数据库记录
   */
  @Cron('0 0 3 * * *', {
    name: 'sys_清理已软删除超过24小时的文件数据',
    disabled: false,
  })
  private async cleanupExpiredSoftDeletedFiles() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const candidates = await this.fileRepository
      .createQueryBuilder('f')
      .withDeleted()
      .where('f.isActive = :isActive', { isActive: false })
      .andWhere('f.deletedAt IS NOT NULL')
      .andWhere('f.deletedAt <= :cutoff', { cutoff })
      .orderBy('f.deletedAt', 'ASC')
      .take(1000)
      .getMany();

    if (candidates.length === 0) {
      return { total: 0, deleted: 0, skipped: 0 };
    }

    const results = await Promise.all(
      candidates.map(async (item) => {
        const absFilePath = join(
          this.getPublicRoot(),
          item.filePath.replace(/^\//, ''),
        );
        try {
          await fs.rm(absFilePath, { force: true });
        } catch (error: any) {
          // 文件删除失败，不删数据库，避免“库已删但磁盘残留”
          return {
            id: item.id,
            ok: false,
            reason: String(error?.message ?? error ?? '文件删除失败'),
          };
        }

        await this.fileRepository.delete(item.id);
        return { id: item.id, ok: true };
      }),
    );

    const deleted = results.filter((r) => r.ok).length;
    const skipped = results.length - deleted;
    return { total: results.length, deleted, skipped };
  }

  /**
   * 每两小时清理一次超6小时未完成的分片目录
   */
  @Cron('0 0 */2 * * *', {
    name: 'sys_清理已软删除超过6小时未完成的分片目录',
  })
  private async cleanupExpiredChunkDirs() {
    const baseDir = this.getChunksBaseDir();
    const now = Date.now();
    const expireMs = 6 * 60 * 60 * 1000;

    const entries = await fs
      .readdir(baseDir, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = join(baseDir, entry.name);
      const stat = await fs.stat(dirPath).catch(() => null);
      if (!stat) continue;

      // 目录最后修改时间超过6小时，视为过期分片
      if (now - stat.mtimeMs >= expireMs) {
        await fs
          .rm(dirPath, { recursive: true, force: true })
          .catch(() => null);
      }
    }
  }
}
