import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Like, Repository } from 'typeorm';
import { BusinessRejectedException } from 'src/common/exceptions';
import { LocalKvService } from 'src/common/cache';
import { Dict, DictData } from './entities/dict.entity';
import { CreateDictDto } from './dto/create-dict.dto';
import { UpdateDictDto } from './dto/update-dict.dto';
import { QueryDictDto } from './dto/query-dict.dto';
import { type DictItemInputDto } from './dto/create-dict-item.dto';
import { UpdateDictItemDto } from './dto/update-dict-item.dto';
import { QueryDictItemDto } from './dto/query-dict-item.dto';
import { QueryDictTreeDto } from './dto/query-dict-tree.dto';
import { QueryDictTreesDto } from './dto/query-dict-trees.dto';

@Injectable()
export class DictService {
  private getDictTreeRedisKey(dictCode: string, status: boolean) {
    // 状态过滤会影响返回内容，因此缓存时必须区分
    return `admin:dict:tree:${status ? 1 : 0}:${dictCode}`;
  }

  private getDictTreeLockRedisKey(dictCode: string, status: boolean) {
    // 用于防止缓存击穿：同一 dictCode+status 同一时间只允许一个请求重建
    return `admin:dict:tree:lock:${status ? 1 : 0}:${dictCode}`;
  }

  private async delDictTreeRedisKeys(rootCodes: Set<string>) {
    const codes = Array.from(rootCodes);
    if (codes.length === 0) return;

    const keys: string[] = [];
    for (const code of codes) {
      keys.push(this.getDictTreeRedisKey(code, true));
      keys.push(this.getDictTreeRedisKey(code, false));
    }

    try {
      await this.kv.del(...keys);
    } catch {
      // 缓存失效不影响主流程，忽略异常
    }
  }

  /**
   * 清除全部字典树缓存（含重建锁 key），供后台手动刷新。
   */
  async clearAllDictTreeCache() {
    const deletedTrees = await this.kv.clearByPrefix('admin:dict:tree:');
    // 锁已改为进程内互斥，清前缀可顺带去掉历史残留的锁 key
    return { deleted: deletedTrees };
  }

  private async tryAcquireLock(
    lockKey: string,
    ttlMs: number,
  ): Promise<string | null> {
    return this.kv.tryAcquireLock(lockKey, ttlMs);
  }

  private async releaseLock(lockKey: string, token: string): Promise<void> {
    await this.kv.releaseLock(lockKey, token);
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private normalizeId(val: unknown): number | undefined {
    if (val === undefined || val === null || val === '') return undefined;
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.trunc(n);
  }

  /**
   * 当 sys_dict_data 发生变化时，计算哪些 sys_dict.code 的树会受到影响。
   * 逻辑：向上按“父节点的 parentCode == 当前节点的 code”关系回溯（最多回溯 5 层）。
   */
  private async collectAffectedRootCodesFromDictData(
    startParentId: number,
    maxDepthFromRoot = 5,
  ): Promise<Set<string>> {
    const start = this.normalizeId(startParentId);
    if (!start) return new Set<string>();

    const visited = new Set<number>();
    const roots = new Set<string>();

    // currentIds 表示当前层级可能映射到 sys_dict.id 或 sys_dict_data.id
    let currentIds: number[] = [start];

    for (let depth = 1; depth <= maxDepthFromRoot; depth++) {
      // 1) currentIds 可能直接对应 sys_dict.id
      const dicts = await this.dictRepository.find({
        where: { id: In(currentIds) },
        select: ['id', 'code'],
      });
      for (const d of dicts) roots.add(d.code);

      if (depth >= maxDepthFromRoot) break;

      // 2) 找到 id in currentIds 的数据项，它们的 parentId 会成为下一轮 currentIds
      const parentNodes = await this.dictDataRepository.find({
        where: { id: In(currentIds) },
        select: ['id', 'parentId'],
        loadEagerRelations: false,
      });

      const nextIds = new Set<number>();
      for (const n of parentNodes) {
        const p = this.normalizeId(n.parentId);
        if (!p) continue;
        if (visited.has(p)) continue;
        visited.add(p);
        nextIds.add(p);
      }

      currentIds = Array.from(nextIds);
      if (currentIds.length === 0) break;
    }

    return roots;
  }

  constructor(
    @InjectRepository(Dict) private readonly dictRepository: Repository<Dict>,
    @InjectRepository(DictData)
    private readonly dictDataRepository: Repository<DictData>,
    private readonly dataSource: DataSource,
    private readonly kv: LocalKvService,
  ) {}

  /**
   * 统一把传入的各种“编码字段”（string/number/boolean）规整成可参与树关系的字符串。
   * 返回 `undefined` 表示该字段缺失/无效。
   */
  private normalizeKey(val: unknown): string | undefined {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'string') {
      const s = val.trim();
      return s ? s : undefined;
    }
    if (typeof val === 'number' || typeof val === 'boolean') {
      const s = String(val).trim();
      return s ? s : undefined;
    }
    return undefined;
  }

  /**
   * 同一 parentCode 下 value 不可重复（与表联合唯一约束一致）
   */
  private async assertDictItemValueUniqueUnderParent(
    parentId: number,
    value: string,
    excludeId?: number,
  ): Promise<void> {
    const dup = await this.dictDataRepository.findOne({
      where: { parentId, value },
      select: ['id'],
      loadEagerRelations: false,
    });
    if (dup && (excludeId === undefined || dup.id !== excludeId)) {
      throw new BusinessRejectedException(
        '同一父节点（parentId）下字典值 value 不能重复',
      );
    }
  }

  /**
   * sys_dict 分页查询：
   * - 按 `createdAt` 倒序
   * - 支持根据 `code/name/status` 做模糊/精确过滤
   */
  async pageDict(queryDto: QueryDictDto) {
    const {
      page = 1,
      pageSize = 10,
      code = '',
      name = '',
      status,
    } = queryDto as any;

    const where: any = {};
    if (code) where.code = Like(`%${code}%`);
    if (name) where.name = Like(`%${name}%`);
    if (status !== undefined && status !== null && status !== '')
      where.status = status;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [list, total] = await this.dictRepository.findAndCount({
      where,
      skip,
      take,
      order: { createdAt: 'DESC' },
      loadEagerRelations: false,
    });

    return {
      list,
      total,
      pageSize: Number(pageSize),
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(pageSize)),
    };
  }

  /**
   * sys_dict 列表查询（不分页）：
   * - 按 `createdAt` 倒序
   * - 支持 `code/name/status` 过滤
   */
  async listDict(queryDto: QueryDictDto) {
    const { code = '', name = '', status } = queryDto as any;

    const where: any = {};
    if (code) where.code = Like(`%${code}%`);
    if (name) where.name = Like(`%${name}%`);
    if (status !== undefined && status !== null && status !== '')
      where.status = status;

    return await this.dictRepository.find({
      where,
      order: { createdAt: 'DESC' },
      loadEagerRelations: false,
    });
  }

  /**
   * 新增 sys_dict：
   * - 业务要求 `code` 唯一
   * - 由于主键从 `code` 迁移到 `id`，这里需要显式校验 `code` 是否已存在
   */
  async saveDict(createDictDto: CreateDictDto) {
    const code = this.normalizeKey((createDictDto as any).code);
    if (!code) throw new BusinessRejectedException('字典code不能为空');

    const exists = await this.dictRepository.findOne({ where: { code } });
    if (exists) {
      throw new BusinessRejectedException('字典code已存在');
    }

    const saved = await this.dictRepository.save(
      createDictDto as Partial<Dict>,
    );
    // dict-tree 缓存失效：新增/修改的 sys_dict.code 对应一棵树
    await this.delDictTreeRedisKeys(new Set([code]));
    return saved;
  }

  /**
   * 更新 sys_dict（主键 id）：
   * - 若 code 发生变化，仅校验唯一性并更新 sys_dict
   */
  async updateDict(updateDictDto: UpdateDictDto) {
    const id = updateDictDto.id;
    if (!id) throw new BusinessRejectedException('字典id不能为空');

    const existing = await this.dictRepository.findOne({ where: { id } });
    if (!existing) throw new BusinessRejectedException('字典不存在');

    const { id: _id, ...rest } = updateDictDto;
    const updateData: Partial<Dict> = { ...(rest as Partial<Dict>) };
    // 防止未传字段覆盖成 undefined
    for (const key of Object.keys(updateData)) {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    }

    const merged = this.dictRepository.merge(existing, updateData);

    // 如果 code 发生变化：校验唯一性
    const oldCodeRaw = String(existing.code ?? '');
    const oldCodeTrimmed = oldCodeRaw.trim();
    const newCode = this.normalizeKey(merged.code);

    if (newCode && oldCodeTrimmed && newCode !== oldCodeTrimmed) {
      const codeConflict = await this.dictRepository.findOne({
        where: { code: newCode },
      });
      if (codeConflict && codeConflict.id !== existing.id) {
        throw new BusinessRejectedException('字典code已存在');
      }

      // 统一把 dict.code 规整为 trim 后的值，避免后续匹配歧义
      merged.code = newCode;

      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Dict).save(merged);
      });

      const updated = await this.dictRepository.findOne({
        where: { id: existing.id },
      });
      const invalidateCodes = new Set<string>();
      if (oldCodeTrimmed) invalidateCodes.add(oldCodeTrimmed);
      if (newCode) invalidateCodes.add(newCode);
      await this.delDictTreeRedisKeys(invalidateCodes);
      return updated;
    }

    const saved = await this.dictRepository.save(merged);
    const invalidateCode = this.normalizeKey(merged.code) ?? oldCodeTrimmed;
    if (invalidateCode) {
      await this.delDictTreeRedisKeys(new Set([invalidateCode]));
    }
    return saved;
  }

  /**
   * 删除 sys_dict（主键 id）：
   * - 这里不再允许通过 code 删除（因为 code 不再是主键）
   */
  async delDict(id: string) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new BusinessRejectedException('字典id不能为空');
    }
    const existing = await this.dictRepository.findOne({
      where: { id: numId },
      select: ['code'],
    });

    await this.dictRepository.delete(numId);
    if (existing?.code) {
      await this.delDictTreeRedisKeys(new Set([existing.code]));
    }
    return { message: 'ok' };
  }

  /**
   * 把扁平的 sys_dict_data（以 parentId 组织）组装成嵌套树：
   * - 最大递归深度 `maxDepth=5`
   * - 遇到可能的环形引用（同一层重复 value）会跳过以避免死循环
   * - 返回结构中使用字段名 `children` 供前端渲染
   */
  private async attachDictItemChildren(
    roots: DictData[],
    opts: {
      maxDepth: number;
      cache: Map<string, DictData[]>;
      status?: boolean;
    },
  ): Promise<any[]> {
    const { maxDepth, cache, status } = opts;

    const buildChildren = async (
      parentKey: number,
      depth: number,
      visitedIds: Set<number>,
    ): Promise<any[]> => {
      if (depth > maxDepth) return [];
      if (!parentKey || parentKey <= 0) return [];

      // 缓存同一 parentKey（+status过滤条件）下的直接 children，避免重复查询
      const cacheKey = `${parentKey}::${status === undefined ? 'any' : String(status)}`;
      const cached = cache.get(cacheKey);

      const where: any = { parentId: parentKey };
      if (status !== undefined) where.status = status;

      const children = cached
        ? cached
        : await this.dictDataRepository.find({
            where,
            order: {
              sort: 'ASC' as any,
              value: 'ASC' as any,
            },
            loadEagerRelations: false,
          });

      if (!cached) cache.set(cacheKey, children);

      const result: any[] = [];
      for (const child of children) {
        // value 作为访问标识，防止在极端数据情况下形成 value->children 的环
        if (visitedIds.has(child.id)) continue;
        visitedIds.add(child.id);
        const derivedNextParentKey = this.normalizeId(child.dictId);

        // 只有配置了嵌套 dictId 才继续向下组装 children
        const grandChildren =
          depth < maxDepth && derivedNextParentKey
            ? await buildChildren(derivedNextParentKey, depth + 1, visitedIds)
            : [];

        if (grandChildren.length > 0) {
          result.push({
            ...child,
            children: grandChildren,
          });
        } else {
          result.push({
            ...child,
          });
        }

        visitedIds.delete(child.id);
      }

      return result;
    };

    const output: any[] = [];
    for (const root of roots) {
      const visited = new Set<number>([root.id]);
      const derivedNextParentKey = this.normalizeId(root.dictId);

      const children =
        maxDepth >= 2 && derivedNextParentKey
          ? await buildChildren(derivedNextParentKey, 2, visited)
          : [];

      if (children.length > 0) {
        output.push({
          ...root,
          children,
        });
      } else {
        output.push({
          ...root,
        });
      }
    }

    return output;
  }

  /**
   * 添加/更新字典项时，如果传入嵌套dictId，则在最多5层内检测重复引用，避免递归死循环。
   */
  private async assertDictItemNestedDictNoLoop(
    virtualItem: DictItemInputDto,
    opts: { maxDepth: number },
  ) {
    const nestedDictId = this.normalizeId((virtualItem as any).dictId);
    if (!nestedDictId) return;

    const maxDepth = opts.maxDepth;
    const visitedParentIds = new Set<number>();

    const virtualId = this.normalizeId((virtualItem as any).id);
    const virtualParentId = this.normalizeId((virtualItem as any).parentId);

    if (virtualId) visitedParentIds.add(virtualId);
    if (virtualParentId) visitedParentIds.add(virtualParentId);
    visitedParentIds.add(nestedDictId);

    const getChildrenWithVirtual = async (parentId: number) => {
      const children = await this.dictDataRepository.find({
        where: { parentId },
        loadEagerRelations: false,
      });

      if (virtualParentId && parentId === virtualParentId) {
        const filtered = children.filter((c) => c.id !== virtualId);
        filtered.push(virtualItem as unknown as DictData);
        return filtered;
      }

      return children;
    };

    const dfs = async (
      currentParentId: number,
      level: number,
    ): Promise<void> => {
      if (level > maxDepth) return;

      const children = await getChildrenWithVirtual(currentParentId);
      for (const child of children) {
        const derivedNextParentId = this.normalizeId(child.dictId ?? child.id);

        if (!derivedNextParentId) continue;

        if (visitedParentIds.has(derivedNextParentId)) {
          throw new BusinessRejectedException(
            '嵌套dictId重复引用，可能导致死循环（最多5层）',
          );
        }

        visitedParentIds.add(derivedNextParentId);
        await dfs(derivedNextParentId, level + 1);
        visitedParentIds.delete(derivedNextParentId);
      }
    };

    await dfs(nestedDictId, 1);
  }

  /**
   * 新增 sys_dict_data（主键从 value/code 迁移到 id）：
   * - 同一 parentCode 下 value 唯一（不同 parentCode 可相同）
   * - 若传入嵌套 code，则先做最多 5 层的环形校验，避免死循环
   */
  async saveDictItem(createDictItemDto: DictItemInputDto) {
    const virtualValue = this.normalizeKey(createDictItemDto.value);
    if (!virtualValue)
      throw new BusinessRejectedException('字典项value不能为空');

    const virtualParentId = this.normalizeId(
      (createDictItemDto as any).parentId,
    );
    if (!virtualParentId)
      throw new BusinessRejectedException('字典项parentId不能为空');

    await this.assertDictItemValueUniqueUnderParent(
      virtualParentId,
      virtualValue,
    );

    const payload = {
      ...(createDictItemDto as Partial<DictData>),
      parentId: virtualParentId,
      value: virtualValue,
    };

    await this.assertDictItemNestedDictNoLoop(payload as DictItemInputDto, {
      maxDepth: 5,
    });
    const saved = await this.dictDataRepository.save(payload);
    const affectedRootCodes = await this.collectAffectedRootCodesFromDictData(
      saved.parentId,
    );
    await this.delDictTreeRedisKeys(affectedRootCodes);
    return saved;
  }

  /**
   * 更新 sys_dict_data（主键 id）：
   * - id 必填
   * - 未传字段不会覆盖为 undefined（避免破坏原数据）
   * - 更新后同样执行嵌套 code 的最多 5 层环校验
   */
  async updateDictItem(updateDictItemDto: UpdateDictItemDto) {
    const id = updateDictItemDto.id;
    if (!id) throw new BusinessRejectedException('字典项id不能为空');

    const existing = await this.dictDataRepository.findOne({ where: { id } });
    if (!existing) throw new BusinessRejectedException('字典项不存在');

    const { id: _id, ...rest } = updateDictItemDto;
    const updateData: Partial<DictData> = { ...(rest as Partial<DictData>) };
    for (const key of Object.keys(updateData)) {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    }

    const merged = this.dictDataRepository.merge(existing, updateData);
    const p = this.normalizeId(merged.parentId);
    const v = this.normalizeKey(merged.value);
    if (!p || !v) {
      throw new BusinessRejectedException('字典项parentId与value不能为空');
    }
    merged.parentId = p;
    merged.value = v;
    await this.assertDictItemValueUniqueUnderParent(p, v, merged.id);
    await this.assertDictItemNestedDictNoLoop(
      merged as unknown as DictItemInputDto,
      { maxDepth: 5 },
    );
    const saved = await this.dictDataRepository.save(merged);
    const affectedRootCodesUnion = new Set<string>();
    const roots1 = await this.collectAffectedRootCodesFromDictData(
      existing.parentId,
    );
    for (const r of roots1) affectedRootCodesUnion.add(r);
    const roots2 = await this.collectAffectedRootCodesFromDictData(
      merged.parentId,
    );
    for (const r of roots2) affectedRootCodesUnion.add(r);
    await this.delDictTreeRedisKeys(affectedRootCodesUnion);
    return saved;
  }

  /**
   * 删除 sys_dict_data（主键 id）
   * - 这里 id 是新主键，不再用 value 删除
   */
  async delDictItem(id: string) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new BusinessRejectedException('字典项id不能为空');
    }
    const existing = await this.dictDataRepository.findOne({
      where: { id: numId },
      select: ['parentId'],
    });
    if (existing?.parentId) {
      const affectedRootCodes = await this.collectAffectedRootCodesFromDictData(
        existing.parentId,
      );
      await this.delDictTreeRedisKeys(affectedRootCodes);
    }
    await this.dictDataRepository.delete(numId);
    return { message: 'ok' };
  }

  /**
   * dict-item 分页查询：
   * - 根节点 parentId 由 `parentId/dictCode/code` 共同决定（取第一个非空）
   * - 先分页取根节点，再调用 `attachDictItemChildren` 组装 children（最大 5 层）
   */
  async pageDictItem(queryDto: QueryDictItemDto) {
    const {
      page = 1,
      pageSize = 10,
      parentId,
      dictCode,
      code,
      name = '',
      value = '',
      status,
    } = queryDto as any;

    let rootParentId = this.normalizeId(parentId);
    if (!rootParentId) {
      const rootCode = this.normalizeKey(dictCode) || this.normalizeKey(code);
      if (rootCode) {
        const dict = await this.dictRepository.findOne({
          where: { code: rootCode },
          select: ['id'],
          loadEagerRelations: false,
        });
        rootParentId = dict?.id;
      }
    }

    if (!rootParentId) {
      return {
        list: [],
        total: 0,
        pageSize: Number(pageSize),
        currentPage: Number(page),
        totalPages: 0,
      };
    }

    const where: any = { parentId: rootParentId };
    if (name) where.name = Like(`%${name}%`);
    if (value) where.value = Like(`%${value}%`);
    if (status !== undefined && status !== null && status !== '')
      where.status = status;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [roots, total] = await this.dictDataRepository.findAndCount({
      where,
      skip,
      take,
      order: {
        sort: 'ASC' as any,
        value: 'ASC' as any,
      },
      loadEagerRelations: false,
    });

    const cache = new Map<string, DictData[]>();
    const list = await this.attachDictItemChildren(roots, {
      maxDepth: 5,
      cache,
      status:
        status !== undefined && status !== null && status !== ''
          ? status
          : undefined,
    });

    return {
      list,
      total,
      pageSize: Number(pageSize),
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(pageSize)),
    };
  }

  /**
   * dict-item 列表查询（带嵌套 children，最大 5 层）：
   * - 直接查询所有根节点，然后组装树
   */
  async listDictItem(queryDto: QueryDictItemDto) {
    const {
      parentId,
      dictCode,
      code,
      name = '',
      value = '',
      status,
    } = queryDto as any;

    let rootParentId = this.normalizeId(parentId);
    if (!rootParentId) {
      const rootCode = this.normalizeKey(dictCode) || this.normalizeKey(code);
      if (rootCode) {
        const dict = await this.dictRepository.findOne({
          where: { code: rootCode },
          select: ['id'],
          loadEagerRelations: false,
        });
        rootParentId = dict?.id;
      }
    }

    if (!rootParentId) return [];

    const where: any = { parentId: rootParentId };
    if (name) where.name = Like(`%${name}%`);
    if (value) where.value = Like(`%${value}%`);
    if (status !== undefined && status !== null && status !== '')
      where.status = status;

    const roots = await this.dictDataRepository.find({
      where,
      order: {
        sort: 'ASC' as any,
        value: 'ASC' as any,
      },
      loadEagerRelations: false,
    });

    const cache = new Map<string, DictData[]>();
    return await this.attachDictItemChildren(roots, {
      maxDepth: 5,
      cache,
      status:
        status !== undefined && status !== null && status !== ''
          ? status
          : undefined,
    });
  }

  private async buildDictTreesForCodesFromDB(
    rootCodes: string[],
    status: boolean,
  ): Promise<Record<string, any[]>> {
    const maxLevel = 5;

    interface DictTreeNode {
      value: string;
      label: string;
      tagType: string;
      children?: DictTreeNode[];
    }
    interface InternalDictTreeNode extends DictTreeNode {
      nextParentId?: number;
    }

    const toInternalNode = (r: DictData): InternalDictTreeNode => {
      const nextParentId = this.normalizeId(r.dictId);
      return {
        value: r.value,
        label: r.name,
        tagType: r.tagType ?? 'default',
        nextParentId,
      };
    };

    const cleanup = (nodes: InternalDictTreeNode[]) => {
      for (const n of nodes) {
        delete n.nextParentId;
        if (n.children) {
          if (n.children.length > 0) cleanup(n.children);
          if (n.children.length === 0) delete n.children;
        }
      }
    };

    const dicts = await this.dictRepository.find({
      where: { code: In(rootCodes) },
      select: ['id', 'code'],
      loadEagerRelations: false,
    });
    const rootCodeToId = new Map<string, number>();
    for (const d of dicts) rootCodeToId.set(d.code, d.id);

    const rootsByCode = new Map<string, InternalDictTreeNode[]>();
    for (const rootCode of rootCodes) rootsByCode.set(rootCode, []);

    let currentParentIds = Array.from(rootCodeToId.values());
    let prevNodes: InternalDictTreeNode[] = [];

    for (let level = 1; level <= maxLevel; level++) {
      if (currentParentIds.length === 0) break;

      const records = await this.dictDataRepository.find({
        where: {
          parentId: In(currentParentIds),
          status,
        },
        order: {
          sort: 'ASC' as any,
          value: 'ASC' as any,
        },
        loadEagerRelations: false,
      });

      const byParent = new Map<number, DictData[]>();
      for (const r of records) {
        const key = this.normalizeId(r.parentId);
        if (!key) continue;
        const arr = byParent.get(key);
        if (arr) arr.push(r);
        else byParent.set(key, [r]);
      }

      const nodesByParent = new Map<number, InternalDictTreeNode[]>();
      for (const p of currentParentIds) {
        const childrenRecords = byParent.get(p) ?? [];
        nodesByParent.set(p, childrenRecords.map(toInternalNode));
      }

      if (level === 1) {
        for (const rootCode of rootCodes) {
          const rootId = rootCodeToId.get(rootCode);
          rootsByCode.set(
            rootCode,
            rootId ? (nodesByParent.get(rootId) ?? []) : [],
          );
        }
        prevNodes = Array.from(nodesByParent.values()).flat();
      } else {
        // 把上一层节点的嵌套 children 挂到当前层节点上
        for (const node of prevNodes) {
          const nextParentId = node.nextParentId;
          if (!nextParentId) continue;
          const childrenNodes = nodesByParent.get(nextParentId) ?? [];
          if (childrenNodes.length === 0) continue;
          node.children = childrenNodes;
        }
        prevNodes = Array.from(nodesByParent.values()).flat();
      }

      if (level < maxLevel) {
        // 下一层 parentIds 只由“有嵌套 dictId”的节点产生
        const nextParentSet = new Set<number>();
        for (const node of prevNodes) {
          if (node.nextParentId) nextParentSet.add(node.nextParentId);
        }
        currentParentIds = Array.from(nextParentSet);
      }
    }

    // 清理内部字段并输出
    const out: Record<string, any[]> = {};
    for (const code of rootCodes) {
      const nodes = rootsByCode.get(code) ?? [];
      cleanup(nodes);
      out[code] = nodes;
    }
    return out;
  }

  /**
   * dict-tree 批量查询（高频）：
   * - 入参：sys_dict.code 数组
   * - 出参：{ [code]: TreeNode[] }
   * - 读写缓存：优先走本地 KV（缺失才查库并写回），缓存 10 分钟
   * - 最大返回 5 层，且如果节点没有嵌套 code（sys_dict_data.code），则不返回 children 字段
   */
  async getDictTrees(queryDto: QueryDictTreesDto) {
    const status = queryDto.status ?? true;

    // 去重 + 规整
    const uniqueCodes = Array.from(
      new Set(
        queryDto.codes
          .map((c) => this.normalizeKey(c))
          .filter((c): c is string => Boolean(c)),
      ),
    );

    const result: Record<string, any[]> = {};
    if (uniqueCodes.length === 0) return result;
    // 默认返回空数组，确保返回结构稳定（{ [code]: [] }）
    for (const code of uniqueCodes) result[code] = [];

    // 1) 批量 mget
    const redisKeys = uniqueCodes.map((c) =>
      this.getDictTreeRedisKey(c, status),
    );
    const redisValues = await this.kv.mget<string>(redisKeys);

    const stillMissingCodes: string[] = [];
    for (let i = 0; i < uniqueCodes.length; i++) {
      const code = uniqueCodes[i];
      const raw = redisValues[i];
      if (!raw) {
        stillMissingCodes.push(code);
        continue;
      }

      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        result[code] = Array.isArray(parsed) ? parsed : [];
      } catch {
        stillMissingCodes.push(code);
      }
    }

    if (stillMissingCodes.length === 0) return result;

    // 2) 防缓存击穿：只有拿到锁的请求才会访问数据库重建
    const lockTtlMs = 60_000;
    const waitRetryMs = 150;
    const waitTotalMs = 1_500;

    const toBuildCodes: string[] = [];
    const lockTokens = new Map<string, string>(); // code -> token
    const notLockedCodes: string[] = [];

    for (const code of stillMissingCodes) {
      const lockKey = this.getDictTreeLockRedisKey(code, status);
      const token = await this.tryAcquireLock(lockKey, lockTtlMs);
      if (token) {
        lockTokens.set(code, token);
        toBuildCodes.push(code);
      } else {
        notLockedCodes.push(code);
      }
    }

    // 等待其他请求把缓存写回来（短暂轮询）
    const remaining = new Set<string>(notLockedCodes);
    if (remaining.size > 0) {
      const start = Date.now();
      while (remaining.size > 0 && Date.now() - start < waitTotalMs) {
        const pollCodes = Array.from(remaining);
        const pollKeys = pollCodes.map((c) =>
          this.getDictTreeRedisKey(c, status),
        );
        const pollValues = await this.kv.mget<string>(pollKeys);

        for (let i = 0; i < pollCodes.length; i++) {
          const code = pollCodes[i];
          const raw = pollValues[i];
          if (!raw) continue;
          try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            result[code] = Array.isArray(parsed) ? parsed : [];
            remaining.delete(code);
          } catch {
            // keep waiting
          }
        }

        if (remaining.size > 0) await this.sleep(waitRetryMs);
      }

      // 仍缺失的，再尝试抢一次锁后自己构建
      if (remaining.size > 0) {
        for (const code of Array.from(remaining)) {
          if (lockTokens.has(code)) continue;
          const lockKey = this.getDictTreeLockRedisKey(code, status);
          const token = await this.tryAcquireLock(lockKey, lockTtlMs);
          if (token) {
            lockTokens.set(code, token);
            toBuildCodes.push(code);
          }
        }
      }
    }

    if (toBuildCodes.length === 0) {
      // 说明其他请求已经把缓存写好了
      for (const [code, token] of lockTokens.entries()) {
        const lockKey = this.getDictTreeLockRedisKey(code, status);
        await this.releaseLock(lockKey, token);
      }
      return result;
    }

    // 3) miss -> 批量查询数据库并构建树（仅构建锁持有方）
    let built: Record<string, any[]> = {};
    try {
      built = await this.buildDictTreesForCodesFromDB(toBuildCodes, status);

      // 4) 批量写回缓存（10分钟）
      await Promise.all(
        toBuildCodes.map(async (code) => {
          const data = built[code] ?? [];
          result[code] = data;
          const redisKey = this.getDictTreeRedisKey(code, status);
          await this.kv.set(redisKey, JSON.stringify(data), 600);
        }),
      );
    } finally {
      // 5) 释放锁
      for (const [code, token] of lockTokens.entries()) {
        const lockKey = this.getDictTreeLockRedisKey(code, status);
        await this.releaseLock(lockKey, token);
      }
    }

    return result;
  }

  /**
   * dict-tree 单码查询（兼容原 GET 接口）。
   */
  async getDictTree(queryDto: QueryDictTreeDto) {
    const dictCode = this.normalizeKey(queryDto.code);
    if (!dictCode) return [];

    const map = await this.getDictTrees({
      codes: [dictCode],
      status: queryDto.status ?? true,
    } as QueryDictTreesDto);

    return map[dictCode] ?? [];
  }
}
