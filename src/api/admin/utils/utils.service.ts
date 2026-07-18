import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { access, mkdir, readdir, stat, writeFile } from 'fs/promises';
import * as path from 'path';
import { constants as FsConstants } from 'fs';
import { BusinessRejectedException } from 'src/common/exceptions';

export type SaveSrcFileResult = {
  created: boolean;
  /** 解析后的绝对路径（便于调试） */
  absolutePath: string;
  message: string;
};

export type SrcListItem = {
  /** 仅目录名 */
  name: string;
  /** 相对 `src` 的完整 POSIX 路径，以 / 开头，如 `/api/users` */
  relativePath: string;
  type: 'directory';
};

export type ListSrcDirectoryResult = {
  /** 请求的**目录**路径（POSIX，与 path 参数一致） */
  relativePath: string;
  /** 实际被列举子目录的绝对路径（前缀匹配时为上一级目录） */
  absolutePath: string;
  /**
   * 未传 `fileName`：目录 `path` 是否**完整存在**（前缀补全场景为 false）。
   * 传了 `fileName`：**仅表示** `path + fileName` 是否作为**文件**存在。
   */
  isExist: boolean;
  items: SrcListItem[];
  /** 应用过滤后的总数 */
  total: number;
  /** 是否因超过 50 条而被截断 */
  truncated: boolean;
  /** 若因路径未到底而在父目录做「子项名称前缀」过滤，则为该前缀 */
  namePrefixFilter?: string;
  /** 传入的纯文件名（规范化后） */
  fileName?: string;
  /** 相对 `src` 的完整文件路径（传入 fileName 时） */
  fileRelativePath?: string;
};

const LIST_LIMIT = 50;

@Injectable()
export class UtilsService {
  private readonly logger = new Logger(UtilsService.name);

  private getSrcRoot(): string {
    return path.resolve(process.cwd(), 'src');
  }

  /**
   * 校验解析后的绝对路径必须落在 `src` 目录内。
   */
  /**
   * 判断目标是否在 `srcRoot` 内（不依赖大小写/尾部分隔符，避免 Windows 上误判）。
   */
  private assertTargetInsideSrc(target: string, srcRoot: string): void {
    const resolvedRoot = path.resolve(srcRoot);
    const resolvedTarget = path.resolve(target);
    const rel = path.relative(resolvedRoot, resolvedTarget);
    const escapes =
      rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
    if (escapes) {
      throw new BadRequestException(
        '路径必须位于 src 目录内，不能越界到项目外',
      );
    }
  }

  /**
   * 将相对 `src` 的路径解析为绝对路径（用于文件，须为 .ts/.tsx）。
   */
  private resolveSafePathUnderSrc(relativePath: string): string {
    const trimmed = relativePath.trim().replace(/^[/\\]+/, '');
    if (!trimmed) {
      throw new BadRequestException('relativePath 无效');
    }
    if (trimmed.includes('..') || trimmed.includes('\0')) {
      throw new BadRequestException('路径中不允许包含 .. 或空字符');
    }
    const lower = trimmed.toLowerCase();
    if (!lower.endsWith('.ts') && !lower.endsWith('.tsx')) {
      throw new BadRequestException('仅允许写入 .ts / .tsx 文件');
    }

    const srcRoot = this.getSrcRoot();
    const target = path.resolve(srcRoot, trimmed);
    this.assertTargetInsideSrc(target, srcRoot);
    return target;
  }

  private splitSafeRelativeSegments(relativeDir: string | undefined): string[] {
    const raw = (relativeDir ?? '').trim();
    if (raw === '' || raw === '/' || raw === '\\') {
      return [];
    }
    const trimmed = raw.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
    if (trimmed.includes('..') || trimmed.includes('\0')) {
      throw new BadRequestException('路径中不允许包含 .. 或空字符');
    }
    return trimmed.split(/[/\\]+/).filter(Boolean);
  }

  private relDisplayFromSegments(segments: string[]): string {
    if (segments.length === 0) {
      return '/';
    }
    return `/${segments.join('/')}`;
  }

  /** 子项相对 `src` 的路径，如 `/api/users` */
  private entryRelPathUnderSrc(
    dirAbs: string,
    entryName: string,
    srcRoot: string,
  ): string {
    const fullAbs = path.join(dirAbs, entryName);
    const rel = path.relative(srcRoot, fullAbs).split(path.sep).join('/');
    return rel ? `/${rel}` : '/';
  }

  private async collectDirectoryItems(
    dirAbs: string,
    srcRoot: string,
    options: { namePrefix?: string; matchIncludes?: string },
  ): Promise<SrcListItem[]> {
    let dirents;
    try {
      dirents = await readdir(dirAbs, { withFileTypes: true });
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new BadRequestException('目录不存在或无法读取');
      }
      if (err.code === 'ENOTDIR') {
        throw new BadRequestException('路径不是目录');
      }
      this.logger.error(`readdir 失败: ${dirAbs}`, err);
      throw new BadRequestException(
        `无法读取目录：${err.message ?? String(err.code ?? '未知错误')}`,
      );
    }
    let items: SrcListItem[] = dirents
      .filter((d) => d.isDirectory())
      .map((d) => {
        const name = String(d.name);
        return {
          name,
          relativePath: this.entryRelPathUnderSrc(dirAbs, name, srcRoot),
          type: 'directory' as const,
        };
      });

    const prefix = options.namePrefix?.trim();
    if (prefix) {
      const pl = prefix.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().startsWith(pl));
    }

    const m = options.matchIncludes?.trim();
    if (m) {
      const lower = m.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(lower));
    }

    items.sort((a, b) => a.name.localeCompare(b.name, 'en'));

    return items;
  }

  private toListResult(
    listDirAbs: string,
    directoryRelativePath: string,
    items: SrcListItem[],
    isExist: boolean,
    namePrefixFilter?: string,
    fileMeta?: {
      fileName: string;
      fileRelativePath: string;
    },
  ): ListSrcDirectoryResult {
    const total = items.length;
    const limited = items.slice(0, LIST_LIMIT);
    return {
      relativePath: directoryRelativePath,
      absolutePath: listDirAbs,
      isExist,
      items: limited,
      total,
      truncated: total > LIST_LIMIT,
      ...(namePrefixFilter !== undefined && namePrefixFilter !== ''
        ? { namePrefixFilter }
        : {}),
      ...(fileMeta ?? {}),
    };
  }

  /** 仅允许单个文件名，禁止路径片段 */
  private sanitizeFileName(fileName: string): string {
    const t = fileName.trim();
    if (!t) {
      throw new BadRequestException('fileName 不能为空');
    }
    if (
      t.includes('/') ||
      t.includes('\\') ||
      t.includes('..') ||
      t.includes('\0')
    ) {
      throw new BadRequestException(
        'fileName 只能是文件名，不能包含路径分隔符或 ..',
      );
    }
    return t;
  }

  /** `src` 下「目录段 + 文件名」是否**存在且为文件** */
  private async fileExistsUnderDirSegments(
    srcRoot: string,
    dirSegments: string[],
    baseName: string,
  ): Promise<boolean> {
    const fileAbs = path.resolve(srcRoot, ...dirSegments, baseName);
    this.assertTargetInsideSrc(fileAbs, srcRoot);
    try {
      const st = await stat(fileAbs);
      return st.isFile();
    } catch {
      return false;
    }
  }

  private fileRelDisplayUnderSrc(
    dirSegments: string[],
    baseName: string,
  ): string {
    const parts = [...dirSegments, baseName];
    return `/${parts.join('/')}`;
  }

  private async resolveFileMeta(
    srcRoot: string,
    dirSegments: string[],
    fileName: string | undefined,
    directoryExists: boolean,
  ): Promise<{
    isExist: boolean;
    fileMeta?: { fileName: string; fileRelativePath: string };
  }> {
    const rawName =
      typeof fileName === 'string' ? fileName : String(fileName ?? '');
    if (rawName.trim() === '') {
      return { isExist: directoryExists };
    }
    const safe = this.sanitizeFileName(rawName);
    const exists = await this.fileExistsUnderDirSegments(
      srcRoot,
      dirSegments,
      safe,
    );
    return {
      isExist: exists,
      fileMeta: {
        fileName: safe,
        fileRelativePath: this.fileRelDisplayUnderSrc(dirSegments, safe),
      },
    };
  }

  /**
   * 列出 `src` 下目录内容。`path` 仅表示目录；可选 `fileName` 单独传文件名。
   * 若路径未完全存在（如 `/api/us`），则在父目录内用最后一段做子目录名前缀匹配。
   * 仅返回子目录；`isExist`：未传 fileName 时表示目录 path 是否完整存在；传了 fileName 时表示 path+fileName 是否**文件**存在。
   */
  async listSrcDirectory(
    relativeDir: string | undefined,
    match?: string,
    fileName?: string,
  ): Promise<ListSrcDirectoryResult> {
    const srcRoot = this.getSrcRoot();
    const segments = this.splitSafeRelativeSegments(relativeDir);
    const requestedDisplay = this.relDisplayFromSegments(segments);

    const finish = async (
      listDirAbs: string,
      items: SrcListItem[],
      directoryExists: boolean,
      namePrefixFilter?: string,
    ): Promise<ListSrcDirectoryResult> => {
      const { isExist, fileMeta } = await this.resolveFileMeta(
        srcRoot,
        segments,
        fileName,
        directoryExists,
      );
      return this.toListResult(
        listDirAbs,
        requestedDisplay,
        items,
        isExist,
        namePrefixFilter,
        fileMeta,
      );
    };

    if (segments.length === 0) {
      const items = await this.collectDirectoryItems(srcRoot, srcRoot, {
        matchIncludes: match,
      });
      return finish(srcRoot, items, true);
    }

    let current = srcRoot;

    for (let i = 0; i < segments.length; i++) {
      const candidate = path.join(current, segments[i]);
      let st: Awaited<ReturnType<typeof stat>>;
      try {
        st = await stat(candidate);
      } catch (e: unknown) {
        const err = e as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          const items = await this.collectDirectoryItems(current, srcRoot, {
            namePrefix: segments[i],
            matchIncludes: match,
          });
          return finish(current, items, false, segments[i]);
        }
        this.logger.warn(`stat 失败: ${candidate} (${err.code})`);
        throw new BadRequestException(
          `无法访问路径：${err.message ?? String(err.code)}`,
        );
      }

      if (st.isDirectory()) {
        current = candidate;
        continue;
      }

      const items = await this.collectDirectoryItems(current, srcRoot, {
        namePrefix: segments[i],
        matchIncludes: match,
      });
      return finish(current, items, false, segments[i]);
    }

    const items = await this.collectDirectoryItems(current, srcRoot, {
      matchIncludes: match,
    });
    return finish(current, items, true);
  }

  /**
   * 若文件已存在则不写入；不存在则创建父目录并写入。
   */
  async saveSrcFileIfNotExists(
    relativePath: string,
    content: string,
  ): Promise<SaveSrcFileResult> {
    const absolutePath = this.resolveSafePathUnderSrc(relativePath);

    try {
      await access(absolutePath, FsConstants.F_OK);
      this.logger.warn(`saveSrcFile 跳过：文件已存在 ${absolutePath}`);
      throw new BusinessRejectedException('文件已存在，未写入');
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    const dir = path.dirname(absolutePath);
    await mkdir(dir, { recursive: true });
    await writeFile(absolutePath, content, { encoding: 'utf8' });
    this.logger.log(`saveSrcFile 已创建 ${absolutePath}`);
    return {
      created: true,
      absolutePath,
      message: '文件已创建',
    };
  }
}
