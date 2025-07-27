// src/utils/time.ts
import { Timestamp } from "firebase/firestore";

/**
 * 한국시간(KST) 기준으로 현재 시간을 다양한 형태로 반환하는 유틸리티 함수들
 */

/**
 * 한국시간 기준 현재 시간을 밀리초 타임스탬프로 반환
 * @returns {number} KST 기준 현재 시간 밀리초
 */
function getKoreanTimeMs(): number {
  const now = new Date();
  // UTC 시간에 9시간(한국시간) 추가
  const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreanTime.getTime();
}

/**
 * 한국시간 기준 현재 시간을 Date 객체로 반환
 * @returns {Date} KST 기준 현재 시간
 */
export function getKoreanTime(): Date {
  return new Date(getKoreanTimeMs());
}

/**
 * 한국시간 기준 현재 시간을 ISO 문자열로 반환
 * @returns {string} KST 기준 ISO 문자열 (예: "2025-07-03T14:30:15.123Z")
 */
function getKoreanTimeISO(): string {
  return getKoreanTime().toISOString();
}

/**
 * 한국시간 기준 현재 시간을 읽기 쉬운 형태로 반환
 * @returns {string} 형식: "2025-07-03 14:30:15"
 */
function getKoreanTimeReadable(): string {
  const kst = getKoreanTime();
  return kst.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * 한국시간 기준 현재 시간을 파일명에 적합한 형태로 반환
 * // useAudioUplaod에서 사용
 * @returns {string} 형식: "20250703_143015" (YYYYMMDD_HHMMSS)
 */
export function getKoreanTimeForFileName(): string {
  const kst = getKoreanTime();
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, "0");
  const day = String(kst.getDate()).padStart(2, "0");
  const hours = String(kst.getHours()).padStart(2, "0");
  const minutes = String(kst.getMinutes()).padStart(2, "0");
  const seconds = String(kst.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// =============================================================================
// DB 전용 함수
// =============================================================================

/**
 * 한국시간 기준 현재 시간을 Firestore Timestamp로 반환
 * @returns {Timestamp} KST 기준 Firestore Timestamp
 */
export function getKoreanTimestamp(): Timestamp {
  return Timestamp.fromDate(getKoreanTime());
}

/**
 * DB에 저장할 때 사용하는 타임스탬프
 * 현재: Firestore Timestamp / 나중: ISO string 등으로 변경 가능
 * @returns {Timestamp} 현재 DB에 맞는 타임스탬프 형식
 */
export function getTimestampForDB(): Timestamp {
  return getKoreanTimestamp();
}

/**
 * 사용자가 읽을 수 있는 타임스탬프 (UI 표시용)
 * @returns {string} 사용자 친화적 시간 형식
 */
export function getTimestampForUI(): string {
  return getKoreanTimeReadable();
}

/**
 * 범용 ID 생성 함수 (prefix + timestamp)
 * @param {string} prefix - ID 접두사
 * @returns {string} 형식: "prefix_20250703_143015"
 */
export function generateUniqueId(prefix: string): string {
  const timestamp = getKoreanTimeForFileName();
  return `${prefix}_${timestamp}`;
}

// 개발/디버깅용 함수들

/**
 * 디버깅용: 여러 형태의 한국시간을 한번에 출력
 */
export function logKoreanTimeFormats(): void {
  console.log("=== 한국시간 형태들 ===");
  console.log("밀리초:", getKoreanTimeMs());
  console.log("Date 객체:", getKoreanTime());
  console.log("ISO 문자열:", getKoreanTimeISO());
  console.log("읽기 쉬운 형태:", getKoreanTimeReadable());
  console.log("파일명 형태:", getKoreanTimeForFileName());
  console.log("DB용 타임스탬프:", getTimestampForDB());
  console.log("UI용 타임스탬프:", getTimestampForUI());
  //   console.log("오디오 ID 예시:", generateAudioFileId("user123", "script001"));
}

/**
 * Firebase Timestamp 객체를 한국시간 기준으로 읽기 쉬운 문자열로 변환
 * @param timestamp - Firestore Timestamp 또는 { seconds, nanoseconds } 객체 또는 Date
 * @returns {string} 예: "2025-07-27\n14:29:51"
 */
export function formatFirestoreTimestampKST(timestamp: any): string {
  if (!timestamp) return "-";

  let date: Date;

  // Firebase Timestamp 객체인 경우
  if (timestamp?.toDate && typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  }
  // { seconds, nanoseconds } 형태인 경우
  else if (timestamp?.seconds) {
    date = new Date(
      timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1e6)
    );
  }
  // 이미 Date 객체인 경우
  else if (timestamp instanceof Date) {
    date = timestamp;
  }
  // 문자열인 경우
  else {
    date = new Date(timestamp);
  }

  const kst = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );

  const yyyy = kst.getFullYear();
  const mm = String(kst.getMonth() + 1).padStart(2, "0");
  const dd = String(kst.getDate()).padStart(2, "0");
  const hh = String(kst.getHours()).padStart(2, "0");
  const min = String(kst.getMinutes()).padStart(2, "0");
  const ss = String(kst.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}\n${hh}:${min}:${ss}`;
}
