import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { AdminService, extractClientDeviceFromHeaders } from './admin.service';
import { SignInAuthDto } from './dto/signIn-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import type { AuthenticatedRequest } from './types/request.types';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './decorators';
import { BusinessPass, BusinessRejectedException } from 'src/common/exceptions';
import { QueryAdminDto } from './dto/query-admin.dto';
import { CreateAdminDto, VerifyPassWord } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { QueryAccessTokenSessionsDto } from './dto/query-access-token-sessions.dto';
import { RevokeAccessTokenSessionDto } from './dto/revoke-access-token-session.dto';
import { Permissions } from './decorators';

@Controller('admin')
@ApiTags('管理用户')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Public()
  @Post('login')
  async signIn(@Body() signInDto: SignInAuthDto, @Req() req: Request) {
    const device = extractClientDeviceFromHeaders(req.headers);
    return BusinessPass(
      await this.adminService.signIn(signInDto.username, signInDto.password, {
        device,
      }),
    );
  }

  @Public()
  @Post('refreshToken')
  refreshToken(@Body() body: RefreshTokenDto, @Req() req: Request) {
    const device = extractClientDeviceFromHeaders(req.headers);
    return this.adminService.refreshToken(body.refreshToken, device);
  }

  // 获取当前用户信息
  @Get('profile')
  getProfile(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  /** 退出登录：删除当前 accessToken 在 Redis 中的会话（下次请求同一 token 将被 Guard 拒绝） */
  @Post('logout')
  async logOut(@Req() req: AuthenticatedRequest) {
    const jti = req.user.jti;
    if (typeof jti !== 'string' || jti.length === 0) {
      return BusinessPass({ revoked: false });
    }
    const revoked = await this.adminService.revokeUserAccessTokenSession(
      req.user.id,
      jti,
    );
    return BusinessPass({ revoked });
  }

  // 获取用户列表
  @Permissions('user:list')
  @Get('user')
  async getAdminList(@Query() queryAdminDto: QueryAdminDto) {
    try {
      return BusinessPass(await this.adminService.getAdminList(queryAdminDto));
    } catch (error) {
      throw new BusinessRejectedException(error.message as string);
    }
  }

  // 根据用户id查询角色id列表
  @Permissions('user:list')
  @Get('listRoleIds/:userId')
  async getRoleIds(@Param('userId') userId: string) {
    // 判断id是不是number
    if (isNaN(+userId)) {
      throw new BusinessRejectedException('id必须是数字');
    }
    try {
      return BusinessPass(await this.adminService.getRoleIds(+userId));
    } catch (error) {
      throw new BusinessRejectedException(error.message as string);
    }
  }

  // 返回所有角色列表id和name
  @Permissions('user:list')
  @Get('listAllRole')
  async getListAllRole() {
    return BusinessPass(await this.adminService.getListAllRole());
  }

  // 添加管理用户
  @Permissions('user:btn:add')
  @Post('addUser')
  async addUser(@Body() createAdminDto: CreateAdminDto) {
    return BusinessPass(await this.adminService.addUser(createAdminDto));
  }

  // 修改管理用户
  @Permissions('user:btn:update')
  @Put('updateUser')
  async updateUser(
    @Body() updateAdminDto: UpdateAdminDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (
      updateAdminDto.status === false &&
      updateAdminDto.id === req.user.id
    ) {
      throw new BusinessRejectedException('不能禁用自己');
    }
    try {
      await this.adminService.updateUser(updateAdminDto);
      return BusinessPass('ok');
    } catch (error) {
      throw new BusinessRejectedException(error.message as string);
    }
  }

  // 批量删除管理用户
  @Permissions('user:btn:delete')
  @Post('deleteUsers')
  async deleteUsers(@Body() ids: number[], @Req() req: AuthenticatedRequest) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BusinessRejectedException('请选择要删除的用户');
    }
    // 不能删除自己
    if (ids.includes(req.user.id)) {
      throw new BusinessRejectedException('不能删除自己');
    }
    try {
      await this.adminService.deleteUsers(ids);
      return BusinessPass('ok');
    } catch (error) {
      throw new BusinessRejectedException(error.message as string);
    }
  }

  @Permissions('user:btn:assignRole')
  @Put('assignRole/:userId')
  async assignRole(@Param('userId') userId: string, @Body() roleIds: number[]) {
    if (isNaN(+userId)) {
      throw new BusinessRejectedException('id必须是数字');
    }
    try {
      await this.adminService.assignRole(+userId, roleIds);
      return BusinessPass('ok');
    } catch (error) {
      throw new BusinessRejectedException(error.message as string);
    }
  }

  @Permissions('user:btn:resetPassword')
  @Put('resetPassword/:userId')
  async resetPassword(
    @Param('userId') userId: string,
    @Body() body: VerifyPassWord,
  ) {
    if (isNaN(+userId)) {
      throw new BusinessRejectedException('id必须是数字');
    }
    try {
      await this.adminService.resetPassword(+userId, body.password);
      return BusinessPass('ok');
    } catch (error) {
      throw new BusinessRejectedException(error.message as string);
    }
  }

  /**
   * Redis 中仍有效的 accessToken 会话分页列表（按用户聚合，children 为各 token）
   */
  @Permissions('user:online:list')
  @Get('accessTokenSessions')
  async pageAccessTokenSessions(@Query() query: QueryAccessTokenSessionsDto) {
    try {
      return BusinessPass(
        await this.adminService.pageAccessTokenSessions(query),
      );
    } catch (error) {
      throw new BusinessRejectedException(
        String((error as Error)?.message ?? error),
      );
    }
  }

  /** 使用户指定 jti 的 accessToken 会话失效 */
  @Permissions('user:online:delete')
  @Delete('accessTokenSession')
  async revokeAccessTokenSession(@Body() body: RevokeAccessTokenSessionDto) {
    try {
      const revoked = await this.adminService.revokeUserAccessTokenSession(
        body.userId,
        body.jti,
      );
      return BusinessPass({ revoked });
    } catch (error) {
      throw new BusinessRejectedException(
        String((error as Error)?.message ?? error),
      );
    }
  }

  /** 使用户全部 accessToken 会话失效 */
  @Permissions('user:online:delete')
  @Delete('user/:userId/accessTokenSessions')
  async revokeAllUserAccessTokenSessions(@Param('userId') userId: string) {
    if (isNaN(+userId)) {
      throw new BusinessRejectedException('id必须是数字');
    }
    try {
      const revokedCount =
        await this.adminService.revokeAllUserAccessTokenSessions(+userId);
      return BusinessPass({ revokedCount });
    } catch (error) {
      throw new BusinessRejectedException(
        String((error as Error)?.message ?? error),
      );
    }
  }
}
