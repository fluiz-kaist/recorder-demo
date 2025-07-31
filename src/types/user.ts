//화이트리스트 타입
export interface AuthorizedUserData {
  userHash: string;
  createdAt: string;
  isActive: boolean;
  name: string;
  userId?: string;
  lastLogin?: string;
  loginAttempts?: number;
  source?: string;
}
