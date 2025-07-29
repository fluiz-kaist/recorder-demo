// lib/firebase/config.ts - 로그 최적화 버전
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

// 🚀 Firebase 앱 초기화
const app = !getApps().length
  ? (() => {
      debugLog("Firebase 앱 초기화");
      return initializeApp(firebaseConfig);
    })()
  : getApps()[0];

// 📚 Firestore 초기화
let db: Firestore;
// 명명된 데이터베이스를 사용한다면, databaseId를 여기에 전달하거나 환경 변수에서 가져옵니다.
// NEXT_PUBLIC_FIRESTORE_DATABASE_ID가 설정되어 있다면, 명명된 DB를 사용한다고 가정합니다.
const firestoreDatabaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;

if (process.env.NODE_ENV === "development") {
  debugLog("Firestore 개발 모드 초기화 (long polling 강제)");
  db = initializeFirestore(
    app,
    { experimentalForceLongPolling: true },
    firestoreDatabaseId // 명명된 DB 사용 시 개발 환경에서 전달
  );
} else {
  debugLog("Firestore 프로덕션 모드 초기화");
  // 명명된 데이터베이스를 프로덕션에서도 사용한다면, databaseId를 전달해야 합니다.
  // getFirestore는 initializeFirestore와 달리 옵션 객체를 받지 않습니다.
  // 따라서 options는 initializeFirestore에서만 사용 가능합니다.
  if (firestoreDatabaseId) {
    debugLog(`명명된 Firestore 데이터베이스 '${firestoreDatabaseId}' 사용 중.`);
    db = getFirestore(app, firestoreDatabaseId);
  } else {
    debugLog("기본 Firestore 데이터베이스 사용 중.");
    db = getFirestore(app);
  }
}

// Storage 초기화
const storage = getStorage(app);

// Auth 초기화
const auth = getAuth(app);

// Export
export { app, db, storage, auth };

// 유틸리티 함수들 (필요시)
export function printFirebaseEnvInfo() {
  const isDevMode = process.env.NODE_ENV === "development";

  console.group("🔥 [Firebase] 환경 정보");
  console.log(`환경: ${isDevMode ? "Development" : "Production"}`);
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("프로젝트 ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  console.groupEnd();
}
