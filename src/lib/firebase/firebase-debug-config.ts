// firebase/debug-config.ts - Firebase 디버깅하며 설정
import { initializeApp, FirebaseApp } from "firebase/app";
import {
  Firestore,
  //   connectFirestoreEmulator,
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// 환경변수 디버깅 함수
export function debugEnvironmentVariables() {
  console.log("🔍 환경변수 디버깅:");
  console.log("NODE_ENV:", process.env.NODE_ENV);

  const envVars = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    NEXT_PUBLIC_FIRESTORE_DATABASE_ID:
      process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID,
  };

  Object.entries(envVars).forEach(([key, value]) => {
    if (!value) {
      console.error(`❌ ${key} 누락!`);
    } else if (value.includes(",")) {
      console.error(`❌ ${key}에 쉼표 포함됨:`, value);
    } else {
      console.log(`✅ ${key}:`, value.substring(0, 2) + "...");
    }
  });

  return envVars;
}

// Firebase 설정 검증
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  fireStoreDB: string;
  measurementId?: string;
}

function createFirebaseConfig(): FirebaseConfig | null {
  const envVars = debugEnvironmentVariables();

  // 필수 환경변수 체크
  const required = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIRESTORE_DATABASE_ID",
  ];

  const missing = required.filter(
    (key) => !envVars[key as keyof typeof envVars]
  );

  if (missing.length > 0) {
    console.error("❌ 누락된 환경변수:", missing);
    return null;
  }

  // 쉼표 체크
  const hasCommas = Object.entries(envVars).find(
    ([, value]) => value && value.includes(",")
  );

  if (hasCommas) {
    console.error("❌ 환경변수에 쉼표 발견:", hasCommas);
    return null;
  }

  return {
    apiKey: envVars.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: envVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: envVars.NEXT_PUBLIC_FIREBASE_APP_ID!,
    fireStoreDB: envVars.NEXT_PUBLIC_FIRESTORE_DATABASE_ID!,
    measurementId: envVars.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

// Firebase 앱 초기화 (개선된 버전)
function initializeFirebaseApp(): FirebaseApp | null {
  try {
    const firebaseConfig = createFirebaseConfig();

    if (!firebaseConfig) {
      console.error("❌ Firebase 설정 생성 실패");
      return null;
    }

    console.log("🔧 Firebase 앱 초기화 중...");
    console.log("📋 Project ID:", firebaseConfig.projectId);

    const app = initializeApp(firebaseConfig);
    console.log("✅ Firebase 앱 초기화 성공");

    return app;
  } catch (error) {
    console.error("❌ Firebase 앱 초기화 실패:", error);
    return null;
  }
}

// Firestore 초기화 (WebChannel 비활성화)
function initializeFirestoreWithDebugging(app: FirebaseApp): Firestore | null {
  try {
    console.log("🔧 Firestore 초기화 중... (Long Polling 모드)");
    // 환경변수에서 databaseId 가져오기
    const config = createFirebaseConfig();
    const databaseId = config?.fireStoreDB;
    // 바로 Long Polling 모드로 초기화 (Listen 에러 방지)
    const db = initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true, // WebChannel 완전 비활성화
      },
      databaseId
    );
    console.log("✅ Firestore 초기화 성공 (Long Polling 모드)");

    return db;
  } catch (error) {
    console.error("❌ Firestore 초기화 실패:", error);
    return null;
  }
}

// Storage 초기화
function initializeStorageWithDebugging(
  app: FirebaseApp
): FirebaseStorage | null {
  try {
    console.log("🔧 Storage 초기화 중...");
    const storage = getStorage(app);
    console.log("✅ Storage 초기화 성공");
    return storage;
  } catch (error) {
    console.error("❌ Storage 초기화 실패:", error);
    return null;
  }
}

// 통합 초기화 함수
export function initializeFirebaseWithDebugging() {
  console.log("🚀 Firebase 디버깅 초기화 시작");

  const app = initializeFirebaseApp();
  if (!app) {
    throw new Error("Firebase 앱 초기화 실패");
  }

  const db = initializeFirestoreWithDebugging(app);
  if (!db) {
    throw new Error("Firestore 초기화 실패");
  }

  const storage = initializeStorageWithDebugging(app);
  if (!storage) {
    throw new Error("Storage 초기화 실패");
  }

  console.log("🎉 Firebase 모든 서비스 초기화 완료");

  return { app, db, storage };
}

// 연결 테스트 함수
export async function testFirebaseConnection() {
  try {
    console.log("🧪 Firebase 연결 테스트 시작 (Listen 없음)");

    const { db } = initializeFirebaseWithDebugging();

    // ✅ Listen 연결 없이 단순 doc 참조만 생성
    console.log("📝 Firestore 참조 테스트...");
    const testDocRef = doc(db, "test", "connection");

    // 실제 읽기/쓰기 없이 참조만 확인
    if (testDocRef.path) {
      console.log("✅ Firestore 참조 생성 성공:", testDocRef.path);
      console.log("📋 Database ID:", db.app.options.projectId);
      return true;
    } else {
      console.warn("⚠️ Firestore 참조 생성 실패");
      return false;
    }
  } catch (error) {
    console.error("❌ Firebase 연결 테스트 실패:", error);

    // 에러 타입별 상세 정보
    if (error instanceof Error) {
      console.error("에러 메시지:", error.message);
      console.error("에러 이름:", error.name);
    }

    return false;
  }
}

// 🔧 실제 CRUD 테스트 (선택적 - 필요시에만 사용)
export async function testFirebaseCRUD() {
  try {
    console.log("🧪 Firebase CRUD 테스트 시작");

    const { db } = initializeFirebaseWithDebugging();

    // 테스트 문서 생성
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: "Firebase 연결 테스트",
    };

    const testDocRef = doc(db, "connection_test", "test_doc");

    console.log("📝 테스트 문서 저장 중...");
    await setDoc(testDocRef, testData);
    console.log("✅ 문서 저장 성공");

    console.log("📖 테스트 문서 읽기 중...");
    const docSnap = await getDoc(testDocRef);

    if (docSnap.exists()) {
      console.log("✅ 문서 읽기 성공:", docSnap.data());
      return true;
    } else {
      console.warn("⚠️ 문서를 찾을 수 없음");
      return false;
    }
  } catch (error) {
    console.error("❌ Firebase CRUD 테스트 실패:", error);
    return false;
  }
}
