import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/auth.dto";
import { AuthenticatedRequest } from "./auth.types";
import { Public } from "./public.decorator";

@Public()
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(body);
    if ("cookie" in result) {
      response.setHeader("Set-Cookie", result.cookie);
      return result.user;
    }
    return result;
  }

  @Post("request-access")
  requestAccess(@Body() body: LoginDto) {
    return this.authService.requestAccess(body);
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    const result = this.authService.logout();
    response.setHeader("Set-Cookie", result.cookie);
    return { ok: true };
  }

  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.currentUser(request);
  }
}
