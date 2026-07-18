import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { In, Like, Repository } from 'typeorm';
import { Admin } from './entities/admin.entity';
import { BusinessPass, BusinessRejectedException } from 'src/common/exceptions';
import dayjs from 'dayjs';
import { ConfigService } from '@nestjs/config';
import ms from 'src/common/utils/ms-utils';
import { Menu } from './menu/entities/menu.entity';
import { RoleMenu } from './menu/entities/role-menu.entity';
import { Role } from './entities/role.entity';
import { UserAuth } from './types/request.types';
import { QueryAdminDto } from './dto/query-admin.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { QueryAccessTokenSessionsDto } from './dto/query-access-token-sessions.dto';
import { FileService } from './file/file.service';
import {
  ADMIN_ACCESS_TOKEN_SESSION_KEY_PREFIX,
  buildAdminAccessTokenSessionRedisKey,
} from './admin.constants';

/** 从请求头解析设备标识：优先自定义头，否则 User-Agent；截断避免 JWT 过大 */
export function extractClientDeviceFromHeaders(
  headers: Record<string, unknown> | { get(name: string): string | null },
): string | undefined {
  const get = (name: string): string => {
    const key = name.toLowerCase();
    if (
      headers &&
      typeof (headers as { get?: (n: string) => string | null }).get ===
        'function'
    ) {
      const v = (headers as { get: (n: string) => string | null }).get(key);
      return (v ?? '').trim();
    }
    const h = headers as Record<string, unknown>;
    const v = h[key];
    if (typeof v === 'string') return v.trim();
    if (Array.isArray(v) && v[0] != null) return String(v[0]).trim();
    return '';
  };
  const raw =
    get('x-client-device') ||
    get('x-device') ||
    get('device') ||
    get('user-agent');
  if (!raw) return undefined;
  return raw.length > 500 ? raw.slice(0, 500) : raw;
}

@Injectable()
export class AdminService {
  private logger = new Logger(AdminService.name);
  constructor(
    private configService: ConfigService,
    @InjectRepository(Admin) private adminRepository: Repository<Admin>,
    private jwtService: JwtService,
    private readonly fileService: FileService,
    @InjectRepository(Menu) private menuRepository: Repository<Menu>,
    @InjectRepository(Role) private roleRepository: Repository<Role>,
    @InjectRepository(RoleMenu)
    private readonly roleMenuRepository: Repository<RoleMenu>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** 与 Redis 中 accessToken 会话 key 一致：`admin:accessToken:{userId}:{jti}` */
  buildAccessTokenSessionRedisKey(userId: number, jti: string): string {
    return buildAdminAccessTokenSessionRedisKey(userId, jti);
  }

  private parseAccessTokenSessionRedisKey(
    key: string,
  ): { userId: number; jti: string } | null {
    const base = `${ADMIN_ACCESS_TOKEN_SESSION_KEY_PREFIX}:`;
    if (!key.startsWith(base)) return null;
    const rest = key.slice(base.length);
    const col = rest.indexOf(':');
    if (col <= 0) return null;
    const uid = Number(rest.slice(0, col));
    const jti = rest.slice(col + 1);
    if (!Number.isFinite(uid) || uid <= 0 || !jti) return null;
    return { userId: uid, jti };
  }

  private async scanRedisKeys(match: string): Promise<string[]> {
    const out: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        match,
        'COUNT',
        500,
      );
      cursor = next;
      out.push(...keys);
    } while (cursor !== '0');
    return out;
  }

  /**
   * 将本次 accessToken 会话写入 Redis（每用户可多条，键独立 TTL 与 accessToken 一致）
   */
  private async cacheAccessTokenSession(
    userId: number,
    jti: string,
    ttlSeconds: number,
    meta: { username: string; device?: string },
  ): Promise<void> {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return;
    const key = this.buildAccessTokenSessionRedisKey(userId, jti);
    const value = JSON.stringify({
      typ: 'admin_access',
      username: meta.username,
      device: meta.device ?? '',
      ts: Date.now(),
    });
    try {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } catch (e) {
      this.logger.warn(
        `Redis 写入 accessToken 会话失败: ${String((e as Error)?.message ?? e)}`,
      );
    }
  }

  /**
   * 分页查询 Redis 中仍存在的 accessToken 会话（键未过期即视为有效），按用户聚合，子级为各 jti 会话
   */
  async pageAccessTokenSessions(queryDto: QueryAccessTokenSessionsDto) {
    const page = Number(queryDto.page) || 1;
    const pageSize = Number(queryDto.pageSize) || 10;
    const keyword = (queryDto.keyword ?? '').trim().toLowerCase();

    const pattern = `${ADMIN_ACCESS_TOKEN_SESSION_KEY_PREFIX}:*`;
    const keys = await this.scanRedisKeys(pattern);
    if (keys.length === 0) {
      return {
        list: [] as Array<{
          userId: number;
          username: string;
          nickname: string;
          avatar: string;
          avatarFileId: number | null;
          tokenCount: number;
          children: Array<{
            userId: number;
            jti: string;
            username: string;
            device: string;
            ts: number;
            ttlSeconds: number;
            expiresAt: string;
          }>;
        }>,
        total: 0,
        pageSize,
        currentPage: page,
        totalPages: 0,
      };
    }

    type SessionRow = {
      userId: number;
      jti: string;
      username: string;
      device: string;
      ts: number;
      ttlSeconds: number;
    };

    const sessions: SessionRow[] = [];
    const chunkSize = 80;

    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize);
      const pipe = this.redis.pipeline();
      for (const k of chunk) {
        pipe.get(k);
        pipe.ttl(k);
      }
      const execed = await pipe.exec();
      if (!execed) continue;

      for (let j = 0; j < chunk.length; j++) {
        const key = chunk[j];
        const parsed = this.parseAccessTokenSessionRedisKey(key);
        if (!parsed) continue;

        const ttlRaw = execed[j * 2 + 1]?.[1];
        const ttlSeconds = typeof ttlRaw === 'number' ? ttlRaw : Number(ttlRaw);
        if (ttlSeconds === -2) continue;

        const rawGet = execed[j * 2]?.[1];
        const getRes = typeof rawGet === 'string' ? rawGet : null;

        let username = '';
        let device = '';
        let ts = 0;
        if (getRes) {
          try {
            const obj = JSON.parse(getRes) as {
              username?: string;
              device?: string;
              ts?: number;
            };
            if (typeof obj.username === 'string') username = obj.username;
            if (typeof obj.device === 'string') device = obj.device;
            if (typeof obj.ts === 'number') ts = obj.ts;
          } catch {
            // ignore
          }
        }

        const ttlNorm = ttlSeconds >= 0 ? ttlSeconds : 0;
        sessions.push({
          userId: parsed.userId,
          jti: parsed.jti,
          username,
          device,
          ts,
          ttlSeconds: ttlNorm,
        });
      }
    }

    const filtered = keyword
      ? sessions.filter((s) => {
          const hay = `${s.username} ${s.device} ${s.jti}`.toLowerCase();
          return hay.includes(keyword);
        })
      : sessions;

    const byUser = new Map<number, SessionRow[]>();
    for (const s of filtered) {
      const arr = byUser.get(s.userId);
      if (arr) arr.push(s);
      else byUser.set(s.userId, [s]);
    }

    const userRows = Array.from(byUser.entries()).map(([, tokens]) => {
      const userId = tokens[0].userId;
      const username =
        tokens.find((t) => t.username)?.username ?? `user#${userId}`;
      tokens.sort((a, b) => b.ts - a.ts);
      return {
        userId,
        username,
        nickname: '',
        avatar: '',
        avatarFileId: null as number | null,
        tokenCount: tokens.length,
        children: tokens.map((t) => ({
          userId: t.userId,
          jti: t.jti,
          username: t.username,
          device: t.device,
          ts: t.ts,
          ttlSeconds: t.ttlSeconds,
          expiresAt:
            t.ttlSeconds > 0
              ? dayjs().add(t.ttlSeconds, 's').format('YYYY-MM-DD HH:mm:ss')
              : '',
        })),
      };
    });

    userRows.sort((a, b) => b.userId - a.userId);

    const total = userRows.length;
    const totalPages = Math.ceil(total / pageSize) || 0;
    const start = (page - 1) * pageSize;
    const list = userRows.slice(start, start + pageSize);

    await this.attachAvatarsToAccessTokenSessionRows(list);

    return {
      list,
      total,
      pageSize,
      currentPage: page,
      totalPages,
    };
  }

  private async attachAvatarsToAccessTokenSessionRows(
    list: Array<{
      userId: number;
      username: string;
      nickname: string;
      avatar: string;
      avatarFileId: number | null;
      tokenCount: number;
      children: Array<{
        userId: number;
        jti: string;
        username: string;
        device: string;
        ts: number;
        ttlSeconds: number;
        expiresAt: string;
      }>;
    }>,
  ): Promise<void> {
    const ids = [...new Set(list.map((r) => r.userId))];
    if (ids.length === 0) return;

    const admins = await this.adminRepository.find({
      where: { id: In(ids) },
      select: ['id', 'avatar', 'nickname', 'username'],
      loadEagerRelations: false,
    });
    const byId = new Map(admins.map((a) => [a.id, a]));

    await Promise.all(
      list.map(async (row) => {
        const admin = byId.get(row.userId);
        if (!admin) return;
        row.nickname = admin.nickname ?? '';
        row.avatarFileId = admin.avatar ?? null;
        if (admin.avatar) {
          try {
            const fileInfo = await this.fileService.getFileInfoById(
              admin.avatar,
            );
            row.avatar = fileInfo.fileUrl ?? '';
          } catch {
            row.avatar = '';
          }
        }
      }),
    );
  }

  /** 使指定用户指定 jti 的 accessToken 会话失效（删除 Redis 记录） */
  async revokeUserAccessTokenSession(
    userId: number,
    jti: string,
  ): Promise<boolean> {
    const j = jti.trim();
    if (!j) return false;
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) return false;
    const key = this.buildAccessTokenSessionRedisKey(uid, j);
    const n = await this.redis.del(key);
    return n > 0;
  }

  /**
   * 使用户在 Redis 中的全部 accessToken 会话失效（删除该用户下所有会话键）。
   * 其他 Service 可注入 AdminService 后调用；禁用用户时也会调用。
   */
  async revokeAllUserAccessTokenSessions(userId: number): Promise<number> {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) return 0;
    const pattern = `${ADMIN_ACCESS_TOKEN_SESSION_KEY_PREFIX}:${uid}:*`;
    const keys = await this.scanRedisKeys(pattern);
    if (keys.length === 0) return 0;
    const n = await this.redis.del(...keys);
    return n;
  }

  /**
   * 管理员登录
   * @param opts.device 从请求头解析的设备信息，写入 accessToken / refreshToken payload
   */
  async signIn(
    username: string,
    password?: string,
    opts?: { device?: string },
  ) {
    // 1. 查询用户
    const admin = await this.adminRepository.findOne({
      where: { username },
      relations: ['roles'],
    });

    if (!admin) {
      this.logger.warn(`登录失败: 用户 ${username} 不存在`);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 2. 检查账户状态
    if (!admin.status) {
      this.logger.warn(`登录失败: 用户 ${username} 已被禁用`);
      throw new UnauthorizedException('账户已被禁用，请联系管理员');
    }

    // 3. 验证密码
    if (password && admin.password !== password) {
      this.logger.warn(`登录失败: 用户 ${username} 密码错误`);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 4. 获取角色和权限代码
    const { roleCodes, roleIds, permissionCodes } =
      await this.getAdminRolesAndPermissions(admin);

    const device = opts?.device?.trim();
    const payload: UserAuth = {
      id: admin.id,
      username: admin.username,
      roles: roleCodes,
      roleIds, // 角色id只存token中 主要用于获取本身角色的菜单列表使用
      permissions: permissionCodes,
      ...(device ? { device } : {}),
    };
    // 默认token两个小时
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '2h');
    const accessTtlSeconds = ms.toSeconds(expiresIn);
    const accessJti = randomUUID();
    const avatarFileId = admin.avatar;
    let avatarUrl = '';
    if (avatarFileId) {
      try {
        const fileInfo = await this.fileService.getFileInfoById(avatarFileId);
        avatarUrl = fileInfo.fileUrl ?? '';
      } catch {
        avatarUrl = '';
      }
    }

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: accessTtlSeconds,
      jwtid: accessJti,
    });
    await this.cacheAccessTokenSession(admin.id, accessJti, accessTtlSeconds, {
      username: admin.username,
      device,
    });

    return {
      username: admin.username,
      nickname: admin.nickname,
      avatar: avatarUrl,
      avatarFileId,
      accessToken,
      accessJti,
      roles: roleCodes, // 分离的角色
      roleIds,
      permissions: permissionCodes, // 分离的权限
      expires: dayjs().add(accessTtlSeconds, 's').format('YYYY-MM-DD HH:mm:ss'), // 这里用ms转换了的 支持 2h 2d 15m 这些时间格式
      // 用来刷新的token长达一周
      refreshToken: await this.jwtService.signAsync(payload), // 默认token一个星期 设置了全局的 JWT_REFRESH_EXPIRES_IN
    };
  }

  /**
   * 获取管理员角色和权限
   */
  private async getAdminRolesAndPermissions(admin: Admin): Promise<{
    roleIds: number[];
    roleCodes: string[];
    permissionCodes: string[];
  }> {
    // 初始化返回数组
    const roleCodes: string[] = [];
    const permissionCodes: string[] = [];
    const roleIds = admin.roles.map((role) => role.id);
    const adminCode = 'admin'; // 默认管理员 添加 *:*:* 权限

    // 普通管理员：处理角色
    admin.roles.forEach((role) => {
      if (role.code) {
        roleCodes.push(role.code);
      }
    });

    // 管理员默认权限
    if (roleCodes.includes(adminCode)) {
      permissionCodes.unshift('*:*:*');
    }

    // 如果没有角色，直接返回
    if (roleCodes.length === 0) return { roleCodes, roleIds, permissionCodes };

    // 通过角色ID获取关联的菜单权限

    const roleMenus = await this.roleMenuRepository
      .createQueryBuilder('roleMenu')
      .innerJoinAndSelect('roleMenu.menu', 'menu')
      .where('roleMenu.roleId IN (:...roleIds)', { roleIds })
      .andWhere('menu.menuType = :menuType', { menuType: 3 })
      .andWhere('menu.auths IS NOT NULL')
      .getMany();

    // 提取权限代码
    roleMenus.forEach((roleMenu) => {
      if (roleMenu.menu.auths) {
        permissionCodes.push(roleMenu.menu.auths);
      }
    });

    // 去重
    return {
      roleIds,
      roleCodes: [...new Set(roleCodes)],
      permissionCodes: [...new Set(permissionCodes)],
    };
  }

  /**
   *  刷新token
   * @param refreshToken
   * @returns
   */
  async refreshToken(refreshToken: string, deviceFromRequest?: string) {
    try {
      const payload = this.jwtService.verify<UserAuth>(refreshToken);
      const deviceFromPayload =
        'device' in payload &&
        typeof payload.device === 'string' &&
        payload.device.trim()
          ? payload.device.trim()
          : '';
      const device =
        (deviceFromRequest && deviceFromRequest.trim()) || deviceFromPayload;
      const newAdmin = await this.signIn(payload.username, undefined, {
        device: device || undefined,
      });
      return BusinessPass({
        id: payload.id,
        ...newAdmin,
        refreshToken, // 保持旧的刷新token 如果每次都是新的 那么将永远不会重新登录了
      });
    } catch (_error) {
      throw new UnauthorizedException({
        success: false,
        message: _error.message || 'token已过期',
      });
    }
  }

  async getAdminList(queryAdminDto: QueryAdminDto) {
    const {
      page = 1,
      pageSize = 10,
      username = '',
      phone = '',
      status = '',
    } = queryAdminDto;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // 构建查询条件
    const where: any = {};

    if (username) {
      where.username = Like(`%${username}%`);
    }

    if (phone) {
      where.phone = Like(`%${phone}%`);
    }

    if (status !== '') {
      // 处理不同格式的 status
      if (typeof status === 'string') {
        if (status === 'true' || status === '1') {
          where.status = true;
        } else if (status === 'false' || status === '0') {
          where.status = false;
        } else {
          where.status = status === '1';
        }
      } else {
        where.status = Boolean(status);
      }
    }

    const [list, total] = await this.adminRepository.findAndCount({
      select: [
        'id',
        'avatar',
        'username',
        'nickname',
        'phone',
        'email',
        'sex',
        'status',
        'remark',
        'createdAt',
      ],
      where,
      skip,
      take,
      loadEagerRelations: false,
      order: { id: 'DESC' },
    });

    const listWithAvatarUrl = await Promise.all(
      list.map(async (item) => {
        let avatar_url = '';
        if (item.avatar) {
          try {
            const fileInfo = await this.fileService.getFileInfoById(
              item.avatar,
            );
            avatar_url = fileInfo.fileUrl ?? '';
          } catch {
            avatar_url = '';
          }
        }
        return {
          ...item,
          avatar_url,
        };
      }),
    );

    return {
      list: listWithAvatarUrl,
      total,
      pageSize: Number(pageSize),
      currentPage: Number(page),
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getRoleIds(userId: number) {
    return (
      await this.adminRepository.findOne({
        where: { id: userId },
        select: ['id', 'roles'],
        relations: ['roles'],
      })
    )?.roles.map((role) => role.id);
  }

  async getListAllRole() {
    return await this.roleRepository.find({
      select: ['id', 'name'],
    });
  }

  async addUser(createAdminDto: CreateAdminDto) {
    return this.adminRepository.save(createAdminDto);
  }

  async updateUser(updateAdminDto: UpdateAdminDto) {
    const oldAdmin = await this.adminRepository.findOne({
      where: { id: updateAdminDto.id },
      select: ['id', 'avatar'],
      loadEagerRelations: false,
    });
    if (!oldAdmin) {
      throw new BusinessRejectedException('用户不存在');
    }

    const saved = await this.adminRepository.save(updateAdminDto);

    if (updateAdminDto.status === false) {
      try {
        const n = await this.revokeAllUserAccessTokenSessions(
          updateAdminDto.id,
        );
        if (n > 0) {
          this.logger.log(
            `用户 ${updateAdminDto.id} 已禁用，已清除 Redis accessToken 会话 ${n} 条`,
          );
        }
      } catch (e) {
        this.logger.warn(
          `用户 ${updateAdminDto.id} 禁用后清除 accessToken 会话失败: ${String((e as Error)?.message ?? e)}`,
        );
      }
    }

    // 头像变更时，软删除旧文件
    const hasNewAvatar =
      updateAdminDto.avatar !== undefined && updateAdminDto.avatar !== null;
    if (
      hasNewAvatar &&
      oldAdmin.avatar &&
      oldAdmin.avatar !== updateAdminDto.avatar
    ) {
      try {
        await this.fileService.deleteFileById(oldAdmin.avatar);
      } catch (error: any) {
        this.logger.warn(
          `用户 ${updateAdminDto.id} 更新头像后删除旧文件失败: ${
            error?.message ?? error
          }`,
        );
      }
    }

    return saved;
  }

  async deleteUsers(ids: number[]) {
    // 判断不能删除role 里面 code 是 admin 的成员
    const adminList = await this.adminRepository.find({
      where: { id: In(ids) },
      select: ['id', 'roles'],
      relations: ['roles'],
    });
    const isAdminUser = adminList.find((admin) =>
      admin.roles.find((role) => role.code === 'admin'),
    );
    if (isAdminUser) {
      throw new BusinessRejectedException('不能删除管理员角色成员！');
    }
    return this.adminRepository.delete(ids);
  }

  async assignRole(userId: number, roleIds: number[]) {
    return this.adminRepository.save({
      id: +userId,
      roles: roleIds.map((id) => ({ id })),
    });
  }

  // 修改用户密码-后面需要用加密防止明文出现
  async resetPassword(userId: number, password: string) {
    return this.adminRepository.update(userId, { password });
  }
}
