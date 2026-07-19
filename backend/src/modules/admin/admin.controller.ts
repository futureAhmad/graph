import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { AuthenticatedRequest } from "../auth/auth.types";
import { AdminService } from "./admin.service";
import { CreateServicePathDto } from "./dto/admin-service.dto";

@Controller("admin")
export class AdminController {
  constructor(
    private readonly authService: AuthService,
    private readonly adminService: AdminService
  ) {}

  @Get("options")
  async options(@Req() request: AuthenticatedRequest) {
    await this.authService.requireAdmin(request);
    return this.adminService.getOptions();
  }

  @Post("service-paths")
  async createServicePath(@Req() request: AuthenticatedRequest, @Body() body: CreateServicePathDto) {
    await this.authService.requireAdmin(request);
    return this.adminService.createServicePath(body);
  }
}
