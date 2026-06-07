import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { googleSsoConfigured } from './google.strategy';

/** Guard cho Google SSO — trả 503 rõ ràng nếu chưa cấu hình OAuth thay vì redirect lỗi. */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    if (!googleSsoConfigured()) {
      throw new ServiceUnavailableException('Đăng nhập Google chưa được cấu hình.');
    }
    return super.canActivate(context);
  }
}
