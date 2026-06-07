import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const PROJECT_STATUS = ['ACTIVE', 'ARCHIVED'] as const;
const PROJECT_ROLE = ['PM', 'CONTRIBUTOR', 'REVIEWER', 'VIEWER'] as const;

export class QueryProjectsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 9;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(PROJECT_STATUS)
  status?: (typeof PROJECT_STATUS)[number];
}

export class InitialMemberDto {
  @IsUUID()
  userId!: string;

  @IsIn(PROJECT_ROLE)
  projectRole!: (typeof PROJECT_ROLE)[number];
}

export class CreateProjectDto {
  @IsString()
  @MinLength(3, { message: 'Tên dự án quá ngắn.' })
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  templateType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialMemberDto)
  initialMembers?: InitialMemberDto[];
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(PROJECT_STATUS)
  status?: (typeof PROJECT_STATUS)[number];
}

export class ToggleStarDto {
  @Type(() => Boolean)
  isStarred!: boolean;
}

export class AddMemberDto {
  @IsUUID()
  userId!: string;

  @IsIn(PROJECT_ROLE)
  projectRole!: (typeof PROJECT_ROLE)[number];
}

export class UpdateMemberDto {
  @IsIn(PROJECT_ROLE)
  projectRole!: (typeof PROJECT_ROLE)[number];
}
