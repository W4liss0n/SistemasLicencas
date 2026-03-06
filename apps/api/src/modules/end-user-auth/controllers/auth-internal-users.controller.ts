import { Body, Controller, HttpCode, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiHeader } from '@nestjs/swagger';
import {
  AdminCreateUserRequestDto,
  AdminUpdateUserRequestDto,
  AdminUserResponseDto
} from '../dto/auth.dto';
import { EndUserAdminService } from '../services/end-user-admin.service';
import { InternalApiKeyGuard } from '../../admin-backoffice/guards/internal-api-key.guard';

@ApiExcludeController()
@UseGuards(InternalApiKeyGuard)
@ApiHeader({ name: 'X-Internal-Api-Key', required: true })
@Controller('internal/admin/users')
export class AuthInternalUsersController {
  constructor(@Inject(EndUserAdminService) private readonly endUserAdminService: EndUserAdminService) {}

  @Post()
  @HttpCode(200)
  async createUser(@Body() payload: AdminCreateUserRequestDto): Promise<AdminUserResponseDto> {
    return this.endUserAdminService.createUser(payload);
  }

  @Patch(':id')
  @HttpCode(200)
  async updateUser(
    @Param('id') id: string,
    @Body() payload: AdminUpdateUserRequestDto
  ): Promise<AdminUserResponseDto> {
    return this.endUserAdminService.updateUser(id, payload);
  }

  @Post(':id/block')
  @HttpCode(200)
  async blockUser(@Param('id') id: string): Promise<AdminUserResponseDto> {
    return this.endUserAdminService.blockUser(id);
  }

  @Post(':id/unblock')
  @HttpCode(200)
  async unblockUser(@Param('id') id: string): Promise<AdminUserResponseDto> {
    return this.endUserAdminService.unblockUser(id);
  }
}
