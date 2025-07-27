// src/lib/jwt-edge.ts (Middleware용)
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "my-super-secret-key";
const secret = new TextEncoder().encode(JWT_SECRET);

export interface AdminTokenPayload {
  adminId: string;
  name: string;
  iat?: number;
  exp?: number;
}

// Edge Runtime용 JWT 검증 (Middleware에서 사용)
export async function verifyAdminToken(
  token: string
): Promise<AdminTokenPayload | null> {
  console.log("🚀 Edge JWT 검증 시작");
  try {
    const { payload } = await jwtVerify(token, secret);
    console.log("✅ Edge JWT 페이로드:", payload);

    // 더 유연한 검증 - adminId 또는 id 모두 허용
    const adminId = payload.adminId || payload.id;
    const name = payload.name;

    console.log("🔍 adminId:", adminId, "타입:", typeof adminId);
    console.log("🔍 name:", name, "타입:", typeof name);

    if (typeof adminId === "string" && typeof name === "string") {
      console.log("✅ Edge JWT 검증 성공!");
      return {
        adminId,
        name,
        iat: payload.iat,
        exp: payload.exp,
      };
    }

    throw new Error("Invalid token payload structure");
  } catch (error) {
    console.error("❌ Edge JWT 검증 실패:", error);
    return null;
  }
}
