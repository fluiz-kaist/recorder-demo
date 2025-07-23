// lib/firebase/config.ts - Prod/Dev 분리 + 환경변수 제어
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  initializeFirestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { doc } from "firebase/firestore";
// 🎛️ 환경변수로 디버깅 제어
const DEBUG_ENABLED = process.env.NEXT_PUBLIC_FIREBASE_DEBUG === "true";
const CONNECTION_TEST_ENABLED =
  process.env.NEXT_PUBLIC_FIREBASE_TEST === "true";

// 🔍 디버깅 함수 (조건부 실행)
function debugLog(message: string, ...args: any[]) {
  if (DEBUG_ENABLED) {
    console.log(`🔥 [Firebase] ${message}`, ...args);
  }
}

// 🏗️ Firebase 설정 생성
function createFirebaseConfig() {
  const isDev = process.env.NODE_ENV === "development";

  debugLog(`환경: ${isDev ? "Development" : "Production"}`);
  debugLog("프로젝트 ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

  debugLog("NODE_ENV:", process.env.NODE_ENV);
  debugLog(
    "NEXT_PUBLIC_FIREBASE_API_KEY:",
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 2) + "..."
  );
  debugLog(
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:",
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.substring(0, 2) + "..."
  );
  debugLog(
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID:",
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.substring(0, 2) + "..."
  );
  debugLog(
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:",
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.substring(0, 2) + "..."
  );
  debugLog(
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:",
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.substring(0, 2) +
      "..."
  );
  debugLog(
    "NEXT_PUBLIC_FIREBASE_APP_ID:",
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.substring(0, 2) + "..."
  );
  debugLog(
    "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:",
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.substring(0, 2) + "..."
  );
  debugLog(
    "NEXT_PUBLIC_FIRESTORE_DATABASE_ID:",
    process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.substring(0, 1) + "..."
  );

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

// 🚀 Firebase 앱 초기화 (싱글톤)
function initializeFirebaseApp(): FirebaseApp {
  // 이미 초기화된 앱이 있으면 재사용
  if (getApps().length > 0) {
    debugLog("기존 Firebase 앱 재사용");
    return getApps()[0];
  }

  const config = createFirebaseConfig();
  debugLog("Firebase 앱 초기화 시작");

  const app = initializeApp(config);
  debugLog("Firebase 앱 초기화 완료");

  return app;
}

// 📚 Firestore 초기화
function initializeFirestoreService(app: FirebaseApp) {
  try {
    debugLog("Firestore 초기화 시작");

    // 개발환경에서는 Long Polling 사용 (WebChannel 문제 방지)
    if (process.env.NODE_ENV === "development") {
      const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;
      const db = initializeFirestore(
        app,
        {
          experimentalForceLongPolling: true,
        },
        databaseId
      );

      debugLog("Firestore 초기화 완료 (Long Polling)");
      return db;
    } else {
      // 프로덕션에서는 기본 설정
      const db = getFirestore(app);
      debugLog("Firestore 초기화 완료 (기본)");
      return db;
    }
  } catch (error) {
    console.error("❌ Firestore 초기화 실패:", error);
    throw error;
  }
}

// 🗄️ Storage 초기화
function initializeStorageService(app: FirebaseApp) {
  try {
    debugLog("Storage 초기화");
    return getStorage(app);
  } catch (error) {
    console.error("❌ Storage 초기화 실패:", error);
    throw error;
  }
}

// 🔐 Auth 초기화
function initializeAuthService(app: FirebaseApp) {
  try {
    debugLog("Auth 초기화");
    return getAuth(app);
  } catch (error) {
    console.error("❌ Auth 초기화 실패:", error);
    throw error;
  }
}

// 🧪 연결 테스트 (선택적)
async function testFirebaseConnection() {
  if (!CONNECTION_TEST_ENABLED) {
    debugLog("연결 테스트 건너뛰기 (환경변수로 비활성화)");
    return;
  }

  try {
    debugLog("Firebase 연결 테스트 시작");

    // 간단한 참조 생성 테스트
    const testRef = doc(db, "connection_test", "test");
    if (testRef.path) {
      debugLog("연결 테스트 성공:", testRef.path);
    }
  } catch (error) {
    console.error("❌ 연결 테스트 실패:", error);
  }
}

// 🔥 Firebase 서비스들 초기화
const app = initializeFirebaseApp();
const db = initializeFirestoreService(app);
const storage = initializeStorageService(app);
const auth = initializeAuthService(app);

// 🧪 연결 테스트 실행 (비동기, 블로킹 없음)
if (typeof window !== "undefined") {
  testFirebaseConnection();
}

// 📤 Export
export { app, db, storage, auth };
