import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthenticatedRequest } from "./auth.types";
import { CreateUserDto, UpdateUserDto } from "./dto/auth.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    await this.authService.requireAdmin(request);
    return this.authService.listUsers();
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateUserDto) {
    await this.authService.requireAdmin(request);
    return this.authService.createUser(body);
  }

  @Patch(":userId")
  async update(@Req() request: AuthenticatedRequest, @Param("userId") userId: string, @Body() body: UpdateUserDto) {
    await this.authService.requireAdmin(request);
    return this.authService.updateUser(Number(userId), body);
  }

  @Delete(":userId")
  async delete(@Req() request: AuthenticatedRequest, @Param("userId") userId: string) {
    const currentUser = await this.authService.requireAdmin(request);
    return this.authService.deleteUser(Number(userId), currentUser.userId);
  }
}
