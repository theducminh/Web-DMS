/** Payload claims nhúng trong JWT Access Token + gắn vào request.user sau khi xác thực. */
export interface AuthenticatedUser {
  sub: string; // userId (profiles.id)
  email: string;
  fullName?: string;
  department?: string | null;
  title?: string | null;
  clearanceLevel?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
  authProvider?: 'LOCAL' | 'GOOGLE';
  jti?: string; // JWT ID — dùng cho Blacklist (Force Logout)
}
