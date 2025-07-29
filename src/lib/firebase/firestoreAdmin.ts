// src/lib/firebase/firestoreAdmin.ts - Admin SDK용 CRUD 유틸
import { adminDb } from "./admin";
import { DocumentData } from "firebase-admin/firestore";

// 🔹 Create or Update (with specific id)
export async function saveDocAdmin(
  colName: string,
  id: string,
  data: DocumentData
): Promise<void> {
  try {
    console.log("saveDocAdmin 호출:", { colName, id, data });

    await adminDb.collection(colName).doc(id).set(data);
    console.log(`✅ 문서 저장됨: ${colName}/${id}`);
  } catch (err) {
    console.error("❌ 저장 실패:", err);
    throw err;
  }
}

// 🔹 Create (auto-generated id)
export async function addDocAutoIdAdmin(
  colName: string,
  data: DocumentData
): Promise<string> {
  try {
    const docRef = await adminDb.collection(colName).add(data);
    console.log("✅ 새 문서 ID:", docRef.id);
    return docRef.id;
  } catch (err) {
    console.error("❌ 문서 추가 실패:", err);
    throw err;
  }
}

// 🔹 Read
export async function getDocByIdAdmin(
  colName: string,
  id: string
): Promise<DocumentData | null> {
  try {
    const docSnap = await adminDb.collection(colName).doc(id).get();
    try {
      //   console.log("1️⃣ Firestore 연결 객체 확인:", adminDb !== undefined);
      //   const col = adminDb.collection(colName);
      //   console.log("2️⃣ 컬렉션 접근 성공:", col.id); // col.id는 컬렉션 이름

      //   const docRef = col.doc(id);
      //   console.log("3️⃣ 문서 레퍼런스 생성됨:", docRef.id); // 예상대로면 id 출력

      //   const docSnap = await docRef.get();
      //   console.log("4️⃣ 문서 읽기 성공 여부:", docSnap.exists);

      if (docSnap.exists) {
        // console.log("5️⃣ 문서 내용:", docSnap.data());
        return docSnap.data() || null;
      } else {
        console.warn("⚠️ 문서가 존재하지 않음:", colName, id);
        return null;
      }
    } catch (err) {
      console.error("❌ Firestore 읽기 실패:", err);
      throw err;
    }

    // console.log("📌 docSnap.exists:", docSnap.exists);
    // if (docSnap.exists) {
    //   return docSnap.data() || null;
    // } else {
    //   console.warn("⚠️ 문서가 존재하지 않음");
    //   return null;
    // }
  } catch (err) {
    console.error("❌ 읽기 실패:", err);
    throw err;
  }
}

// 🔹 Read All
export async function getAllDocsAdmin(
  colName: string
): Promise<Array<DocumentData & { id: string }>> {
  try {
    const querySnapshot = await adminDb.collection(colName).get();
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
export async function updateDocByIdAdmin(
  colName: string,
  id: string,
  data: Partial<DocumentData>
): Promise<void> {
  try {
    await adminDb.collection(colName).doc(id).update(data);
    // console.log(`✅ 업데이트 완료: ${colName}/${id}`);
  } catch (err) {
    console.error("❌ 업데이트 실패:", err);
    throw err;
  }
}

// 🔹 Delete
export async function deleteDocByIdAdmin(
  colName: string,
  id: string
): Promise<void> {
  try {
    await adminDb.collection(colName).doc(id).delete();
    console.log(`🗑️ 삭제됨: ${colName}/${id}`);
  } catch (err) {
    console.error("❌ 삭제 실패:", err);
    throw err;
  }
}

// 🔹 제네릭 타입을 사용한 타입 안전한 버전들
export async function getDocByIdTypedAdmin<T>(
  colName: string,
  id: string
): Promise<T | null> {
  const data = await getDocByIdAdmin(colName, id);
  return data as T | null;
}

export async function getAllDocsTypedAdmin<T>(
  colName: string
): Promise<Array<T & { id: string }>> {
  const data = await getAllDocsAdmin(colName);
  return data as Array<T & { id: string }>;
}
