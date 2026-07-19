import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionAuthGuard } from "./session-auth.guard";
import { UsersController } from "./users.controller";

@Module({
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard
    }
  ],
  exports: [AuthService]
})
export class AuthModule {}
