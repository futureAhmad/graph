import { IsBoolean, IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  @Matches(/^[A-Za-z]+$/, { message: "Username can contain letters only." })
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class CreateUserDto {
  @IsString()
  @Matches(/^[A-Za-z]+$/, { message: "Username can contain letters only." })
  username!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(["admin", "user"])
  role!: "admin" | "user";

  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn(["admin", "user"])
  role?: "admin" | "user";

  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;
}
