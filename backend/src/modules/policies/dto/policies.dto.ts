import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Tạo policy mới. Hỗ trợ 2 form (chọn 1):
 *  - Generic theo cột casbin_rule: { ptype, v0, v1, v2, v3?, v4?, v5? }
 *  - Form Visual Rule Builder của Luồng 22 (chỉ áp dụng cho ptype='p'):
 *      { ptype:'p', subjectCondition, objectCondition, action, contextCondition?, effect? }
 *    -> mapping v0=subjectCondition, v1=objectCondition, v2=action, v3=contextCondition,
 *       v4=effect (allow|deny, mặc định allow).
 */
export class CreatePolicyDto {
  @IsIn(['p', 'g'], { message: 'ptype phải là p (policy) hoặc g (grouping).' })
  ptype!: 'p' | 'g';

  // Generic form
  @IsOptional() @IsString() v0?: string;
  @IsOptional() @IsString() v1?: string;
  @IsOptional() @IsString() v2?: string;
  @IsOptional() @IsString() v3?: string;
  @IsOptional() @IsString() v4?: string;
  @IsOptional() @IsString() v5?: string;

  // Builder form
  @IsOptional() @IsString() subjectCondition?: string;
  @IsOptional() @IsString() objectCondition?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() contextCondition?: string;
  @IsOptional() @IsIn(['allow', 'deny']) effect?: 'allow' | 'deny';
}

export class SimulatePolicyDto {
  @IsString()
  @MinLength(1)
  sub!: string;

  @IsString()
  @MinLength(1)
  obj!: string;

  @IsString()
  @MinLength(1)
  act!: string;
}
