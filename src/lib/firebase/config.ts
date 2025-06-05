// firebase/config.ts - Firebase 앱 초기화 및 공통 객체(export)
import {
  initializeFirebaseWithDebugging,
  testFirebaseConnection,
} from "@/lib/firebase/firebase-debug-config";

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";

// 디버깅과 함께 Firebase 초기화
const { db, storage } = initializeFirebaseWithDebugging();

// 개발 환경에서 연결 테스트 실행
if (process.env.NODE_ENV === "development") {
  testFirebaseConnection().then((success) => {
    if (success) {
      console.log("🎉 Firebase 연결 테스트 통과!");
    } else {
      console.error(
        "⚠️ Firebase 연결 테스트 실패 - 환경변수와 Firebase 설정을 확인하세요"
      );
    }
  });
}

export {
  storage,
  ref,
  uploadBytes,
  getDownloadURL, // storage
  db,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs, // firestore
};
