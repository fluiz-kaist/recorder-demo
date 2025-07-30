// src/lib/firebase/firestore.ts - Firestore 관련 CRUD 유틸
import { db } from "./config";
import {
  DocumentData,
  DocumentReference,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";

// 🔹 Create or Update (with specific id)
export async function saveDoc(
  colName: string,
  id: string,
  data: DocumentData
): Promise<void> {
  try {
    console.log("saveDoc 호출:", { colName, id, data });
    console.log("Types:", {
      colName: typeof colName,
      id: typeof id,
      data: typeof data,
    });

    await setDoc(doc(db, colName, id), data);
    console.log(`✅ 문서 저장됨: ${colName}/${id}`);
  } catch (err) {
    console.error("❌ 저장 실패:", err);
    throw err;
  }
}
// 🔹 Create (auto-generated id)
export async function addDocAutoId(
  colName: string,
  data: DocumentData
): Promise<string> {
  try {
    const docRef: DocumentReference = await addDoc(
      collection(db, colName),
      data
    );
    console.log("✅ 새 문서 ID:", docRef.id);
    return docRef.id;
  } catch (err) {
    console.error("❌ 문서 추가 실패:", err);
    throw err;
  }
}

// 🔹 Read
export async function getDocById(
  colName: string,
  id: string
): Promise<DocumentData | null> {
  try {
    console.log("colname?", colName);
    const docSnap = await getDoc(doc(db, colName, id));
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.warn("⚠️ 문서가 존재하지 않음");
      return null;
    }
  } catch (err) {
    console.error("❌ 읽기 실패:", err);
    throw err;
  }
}

// 🔹 Read All
export async function getAllDocs(
  colName: string
): Promise<Array<DocumentData & { id: string }>> {
  try {
    const querySnapshot = await getDocs(collection(db, colName));
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error("❌ 전체 조회 실패:", err);
    throw err;
  }
}

// 🔹 Update
export async function updateDocById(
  colName: string,
  id: string,
  data: Partial<DocumentData>
): Promise<void> {
  try {
    await updateDoc(doc(db, colName, id), data);
    // console.log(`✅ 업데이트 완료: ${colName}/${id}`);
  } catch (err) {
    console.error("❌ 업데이트 실패:", err);
    throw err;
  }
}

// 🔹 Delete
export async function deleteDocById(
  colName: string,
  id: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, colName, id));
    console.log(`🗑️ 삭제됨: ${colName}/${id}`);
  } catch (err) {
    console.error("❌ 삭제 실패:", err);
    throw err;
  }
}

// 🔹 제네릭 타입을 사용한 타입 안전한 버전들 (선택사항)
export async function getDocByIdTyped<T>(
  colName: string,
  id: string
): Promise<T | null> {
  const data = await getDocById(colName, id);
  return data as T | null;
}

export async function getAllDocsTyped<T>(
  colName: string
): Promise<Array<T & { id: string }>> {
  const data = await getAllDocs(colName);
  return data as Array<T & { id: string }>;
}
