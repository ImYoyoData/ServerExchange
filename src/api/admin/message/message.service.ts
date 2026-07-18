import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DeepPartial, FindOptionsWhere, In, Repository } from 'typeorm';
import { BusinessRejectedException } from 'src/common/exceptions';
import { Admin } from '../entities/admin.entity';
import { Role } from '../entities/role.entity';
import { SysMessage } from './entities/message.entity';
import { QueryMessagePageDto } from './dto/query-message-page.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { QueryMyMessageDto } from './dto/query-my-message.dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(SysMessage)
    private readonly messageRepo: Repository<SysMessage>,
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  /**
   * 管理端：消息分页（标题/内容关键词、已读状态、类型、接收用户）
   */
  async pageMessages(queryDto: QueryMessagePageDto) {
    const {
      page = 1,
      pageSize = 10,
      keyword = '',
      status,
      type,
      userId,
    } = queryDto;

    const qb = this.messageRepo
      .createQueryBuilder('m')
      .orderBy('m.createdAt', 'DESC');

    const kw = String(keyword ?? '').trim();
    if (kw) {
      qb.andWhere('(m.title LIKE :kw OR m.content LIKE :kw)', {
        kw: `%${kw}%`,
      });
    }

    if (status !== undefined && status !== null) {
      qb.andWhere('m.status = :status', { status: Boolean(status) });
    }

    if (type !== undefined && type !== null && !Number.isNaN(Number(type))) {
      qb.andWhere('m.type = :type', { type: Number(type) });
    }

    if (
      userId !== undefined &&
      userId !== null &&
      !Number.isNaN(Number(userId))
    ) {
      qb.andWhere('m.userId = :userId', { userId: Number(userId) });
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [list, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      list,
      total,
      pageSize: Number(pageSize),
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(pageSize)) || 0,
    };
  }

  /**
   * 新增：`0` = 全员各一行；正整数 = 一行；数组 = 每个 id 一行。同一次请求共用一个 sendBatchId。
   */
  async createMessage(dto: CreateMessageDto) {
    const { userId, roleIds, title, content, type, redirectUrl } = dto;

    const sendBatchId = randomUUID();
    const trimmedRedirect = redirectUrl?.trim()
      ? redirectUrl.trim()
      : undefined;

    const buildPartial = (uid: number) => {
      const partial: DeepPartial<SysMessage> = {
        userId: uid,
        sendBatchId,
        type,
        title: title.trim(),
        content: content.trim(),
        status: false,
      };
      if (trimmedRedirect) partial.redirectUrl = trimmedRedirect;
      return this.messageRepo.create(partial);
    };

    const resolveTargetAdminIdsFromUserId = async (): Promise<number[]> => {
      if (userId === undefined) return [];
      if (userId === 0) {
        const admins = await this.adminRepo.find({
          select: ['id'],
          loadEagerRelations: false,
        });
        if (!admins.length) {
          throw new BusinessRejectedException('系统中没有管理员用户，无法群发');
        }
        return admins.map((a) => a.id);
      }
      if (Array.isArray(userId)) {
        const unique = [...new Set(userId.map((n) => Number(n)))].filter(
          (id) => Number.isInteger(id) && id > 0,
        );
        if (!unique.length) {
          throw new BusinessRejectedException('用户 ID 列表无效');
        }
        const found = await this.adminRepo.find({
          where: { id: In(unique) },
          select: ['id'],
          loadEagerRelations: false,
        });
        if (found.length !== unique.length) {
          throw new BusinessRejectedException('部分用户 ID 不存在');
        }
        return unique;
      }
      const uid = Number(userId);
      const admin = await this.adminRepo.findOne({
        where: { id: uid },
        select: ['id'],
        loadEagerRelations: false,
      });
      if (!admin) {
        throw new BusinessRejectedException('指定的用户不存在');
      }
      return [uid];
    };

    const resolveTargetAdminIdsFromRoles = async (): Promise<number[]> => {
      if (!roleIds?.length) return [];
      const uniqueRoleIds = [...new Set(roleIds.map((n) => Number(n)))].filter(
        (id) => Number.isInteger(id) && id > 0,
      );
      if (!uniqueRoleIds.length) {
        throw new BusinessRejectedException('角色 ID 列表无效');
      }
      const roleCount = await this.roleRepo.count({
        where: { id: In(uniqueRoleIds) },
      });
      if (roleCount !== uniqueRoleIds.length) {
        throw new BusinessRejectedException('部分角色 ID 不存在');
      }
      const admins = await this.adminRepo
        .createQueryBuilder('a')
        .innerJoin('a.roles', 'role')
        .where('role.id IN (:...roleIds)', { roleIds: uniqueRoleIds })
        .select(['a.id'])
        .distinct(true)
        .getMany();
      if (!admins.length) {
        throw new BusinessRejectedException('所选角色下暂无关联的管理员用户');
      }
      return admins.map((a) => a.id);
    };

    const fromUsers = await resolveTargetAdminIdsFromUserId();
    const fromRoles = await resolveTargetAdminIdsFromRoles();
    const targetIds = [...new Set([...fromUsers, ...fromRoles])];
    if (!targetIds.length) {
      throw new BusinessRejectedException('没有可接收消息的用户');
    }
    const rows = targetIds.map((uid) => buildPartial(uid));
    const saved = await this.messageRepo.save(rows);
    return {
      count: saved.length,
      ids: saved.map((m) => m.id),
      sendBatchId,
    };
  }

  /**
   * 按同一次发送批次软删（多人/全员时一次删掉所有相关行）
   */
  async softDeleteMessageBatch(sendBatchId: string) {
    const id = String(sendBatchId ?? '').trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      throw new BusinessRejectedException('sendBatchId 格式无效');
    }
    const res = await this.messageRepo.softDelete({ sendBatchId: id });
    if (!res.affected) {
      throw new BusinessRejectedException('未找到该批次下的消息或已删除');
    }
    return { affected: res.affected, sendBatchId: id };
  }

  /**
   * 管理端编辑：可改 `title`、`content`、`redirectUrl`（至少一项）；`userId`、已读等不可改。
   */
  async updateMessage(dto: UpdateMessageDto) {
    const { id, title, content, redirectUrl } = dto;

    const msg = await this.messageRepo.findOne({ where: { id } });
    if (!msg) {
      throw new BusinessRejectedException('消息不存在或已删除');
    }

    if (title !== undefined) msg.title = title.trim();
    if (content !== undefined) msg.content = content.trim();
    if (redirectUrl !== undefined) {
      const t =
        typeof redirectUrl === 'string' ? redirectUrl.trim() : '';
      msg.redirectUrl = t ? t : null;
    }
    await this.messageRepo.save(msg);
    return msg;
  }

  /**
   * 软删除
   */
  async softDeleteMessage(id: number) {
    const res = await this.messageRepo.softDelete(id);
    if (!res.affected) {
      throw new BusinessRejectedException('消息不存在或已删除');
    }
    return { affected: res.affected };
  }

  /**
   * 当前登录用户：消息列表 + 未读数
   */
  async pageMyMessages(adminId: number, queryDto: QueryMyMessageDto) {
    const { page = 1, pageSize = 50, type } = queryDto;

    const where: FindOptionsWhere<SysMessage> = { userId: adminId };
    if (type !== undefined && type !== null && !Number.isNaN(Number(type))) {
      where.type = Number(type);
    }

    const unreadWhere: FindOptionsWhere<SysMessage> = {
      userId: adminId,
      status: false,
    };
    if (type !== undefined && type !== null && !Number.isNaN(Number(type))) {
      unreadWhere.type = Number(type);
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [list, total, unreadCount] = await Promise.all([
      this.messageRepo.find({
        where,
        order: { createdAt: 'DESC' },
        skip,
        take,
        loadEagerRelations: false,
      }),
      this.messageRepo.count({ where }),
      this.messageRepo.count({ where: unreadWhere }),
    ]);

    return {
      list,
      total,
      unreadCount,
      pageSize: Number(pageSize),
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(pageSize)) || 0,
    };
  }

  /**
   * 用户将单条消息标为已读（可选接口，前端读完调用）
   */
  async markAsReadForUser(messageId: number, adminId: number) {
    const msg = await this.messageRepo.findOne({
      where: { id: messageId, userId: adminId },
    });
    if (!msg) {
      throw new BusinessRejectedException('消息不存在');
    }
    if (!msg.status) {
      msg.status = true;
      msg.readAt = new Date();
      await this.messageRepo.save(msg);
    }
    return msg;
  }
}
