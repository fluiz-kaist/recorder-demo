// lib/firebase/config.ts - 수정된 버전
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  Firestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// 환경변수로 디버깅 제어
const DEBUG_ENABLED = process.env.NEXT_PUBLIC_FIREBASE_DEBUG === "true";

// 간단한 디버깅 (중복 로그 방지)
function debugLog(message: string) {
  if (DEBUG_ENABLED) {
    console.log(`🔥 [Firebase] ${message}`);
  }
}

// Firebase 설정
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

//  Firebase 앱 초기화
const app = !getApps().length
  ? (() => {
      debugLog("Firebase 앱 초기화");
      return initializeApp(firebaseConfig);
    })()
  : getApps()[0];

//  Firestore 초기화 (Custom Token 호환성 개선)
let db: Firestore;

if (process.env.NODE_ENV === "development") {
  debugLog(
    "Firestore 개발 모드 초기화 (long polling 강제 + Custom Token 최적화)"
  );

  //   try {
  //     db = initializeFirestore(app, {
  //       experimentalForceLongPolling: true,
  //       // databaseId 매개변수 없음 = 자동으로 기본 DB 사용
  //     });
  //     debugLog("Firestore 초기화 성공");
  //   } catch (error) {
  //     debugLog("Firestore initializeFirestore 실패, getFirestore로 폴백");
  //     console.error("firestore init failed :", error);
  //     // 이미 초기화된 경우 getFirestore 사용
  //     db = getFirestore(app);
  //   }
  // } else {
  //   debugLog("Firestore 프로덕션 모드 초기화");

  //   //  명명된 데이터베이스 로직 단순화
  //   const firestoreDatabaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;
  //   if (firestoreDatabaseId) {
  //     debugLog(`명명된 Firestore 데이터베이스 '${firestoreDatabaseId}' 사용 중.`);
  //     db = getFirestore(app, firestoreDatabaseId);
  //   } else {
  //     debugLog("기본 Firestore 데이터베이스 사용 중.");
  //     db = getFirestore(app);
  //   }
  // }
  try {
    // 🔧 개발 모드: 기본 DB + long polling
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
    debugLog("Firestore 초기화 성공");
  } catch (error) {
    debugLog("Firestore initializeFirestore 실패, getFirestore로 폴백");
    console.error("firestore init failed :", error);
    // 이미 초기화된 경우 getFirestore 사용
    db = getFirestore(app);
  }
} else {
  debugLog("Firestore 프로덕션 모드 초기화 (기본 DB)");

  // 🔧 프로덕션 모드: 기본 DB만 사용
  db = getFirestore(app);
}
// Storage 초기화
const storage = getStorage(app);

// Auth 초기화
const auth = getAuth(app);

// 🔧 추가 디버깅 정보
if (DEBUG_ENABLED) {
  debugLog(`프로젝트 ID: ${firebaseConfig.projectId}`);
  debugLog(`인증 도메인: ${firebaseConfig.authDomain}`);
}

// Export
export { app, db, storage, auth };

// 유틸리티 함수들 (필요시)
export function printFirebaseEnvInfo() {
  const isDevMode = process.env.NODE_ENV === "development";

  console.group("🔥 [Firebase] 환경 정보");
  console.log(`환경: ${isDevMode ? "Development" : "Production"}`);
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("프로젝트 ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  console.log("DEBUG 모드:", DEBUG_ENABLED);
  console.groupEnd();
}
