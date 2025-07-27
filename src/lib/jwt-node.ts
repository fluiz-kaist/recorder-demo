// src/lib/jwt-node.ts (API Routes용)
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "my-super-secret-key";

export interface AdminTokenPayload {
  adminId: string;
  name: string;
  iat?: number;
  exp?: number;
}

// Node.js Runtime용 JWT 생성
export function generateAdminToken(
  payload: Omit<AdminTokenPayload, "iat" | "exp">
): string {
  console.log("🚀 Node.js JWT 생성:", payload);
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "4h" });
}

// Node.js Runtime용 JWT 검증 (필요할 때를 위해)
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    console.log("🚀 Node.js JWT 검증 시작");
    const decoded = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
    console.log("✅ Node.js JWT 검증 성공:", decoded);
    return decoded;
  } catch (error) {
    console.error("❌ Node.js JWT 검증 실패:", error);
    return null;
  }
}
