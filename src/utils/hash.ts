// utils/hash.ts - 새로 생성 (기존 코드에 영향 없음)
import crypto from "crypto";

/**
 * 사용자 식별을 위한 해시 생성
 * 이름과 주민번호를 조합하여 SHA-256 해시 생성
 */
export function generateUserHash(name: string, socialNumber: string): string {
  // 입력값 정규화 (공백 제거, 소문자 변환)
  const normalizedName = name.trim().toLowerCase();
  const normalizedSocialNumber = socialNumber.trim();

  // 솔트 추가 (환경변수에서 관리)
  const salt =
    process.env.USER_HASH_SALT || "default-salt-change-in-production";

  console.log("salt 확인용(지워야함)", salt);

  // 조합된 문자열로 해시 생성
  const combined = `${normalizedName}:${normalizedSocialNumber}:${salt}`;

  return crypto.createHash("sha256").update(combined, "utf8").digest("hex");
}

/**
 * 안전한 userId 생성
 */
export function generateSecureUserId(): string {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(16).toString("hex");
  return `user_${timestamp}_${randomBytes}`;
}

/**
 * 개인정보 마스킹 (로그용)
 */
export function maskPersonalInfo(name: string, socialNumber: string) {
  const maskedName =
    name.length > 2
      ? name.substring(0, 1) +
        "*".repeat(name.length - 2) +
        name.substring(name.length - 1)
      : name;

  const maskedSocialNumber = socialNumber.substring(0, 2) + "****";

  return {
    maskedName,
    maskedSocialNumber,
  };
}
