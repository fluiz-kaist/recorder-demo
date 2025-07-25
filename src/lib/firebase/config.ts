// lib/firebase/config.ts - 로그 최적화 버전
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  Firestore,
} from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

// 🎛️ 환경변수로 디버깅 제어
const DEBUG_ENABLED = process.env.NEXT_PUBLIC_FIREBASE_DEBUG === "true";

// 🔍 간단한 디버깅 (중복 로그 방지)
function debugLog(message: string) {
  if (DEBUG_ENABLED) {
    console.log(`🔥 [Firebase] ${message}`);
  }
}

// 🏗️ Firebase 설정
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
const db: Firestore = (() => {
  if (process.env.NODE_ENV === "development") {
    const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;
    return initializeFirestore(
      app,
      { experimentalForceLongPolling: true },
      databaseId
    );
  } else {
    return getFirestore(app);
  }
})();

// 🗄️ Storage 초기화
const storage = getStorage(app);

// 🔐 Auth 초기화
const auth = getAuth(app);

// 📤 Export
export { app, db, storage, auth };

// 🔍 유틸리티 함수들 (필요시)
export function printFirebaseEnvInfo() {
  const isDev = process.env.NODE_ENV === "development";

  console.group("🔥 [Firebase] 환경 정보");
  console.log(`환경: ${isDev ? "Development" : "Production"}`);
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("프로젝트 ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  console.groupEnd();
}
