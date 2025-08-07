// src/lib/firebase/firestoreAdmin.ts - Admin SDK용 CRUD 유틸
import { adminDb } from "./admin";
import { DocumentData, WriteBatch } from "firebase-admin/firestore";

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

  return data as T;
}

export async function docExistsAdmin(
  colName: string,
  id: string
): Promise<boolean> {
  try {
    const docSnap = await adminDb.collection(colName).doc(id).get();
    return docSnap.exists;
  } catch (err) {
    console.error("❌ 문서 존재 확인 실패:", err);
    return false; // 에러 발생 시 false 반환
  }
}

export async function getAllDocsTypedAdmin<T>(
  colName: string
): Promise<Array<T & { id: string }>> {
  const data = await getAllDocsAdmin(colName);
  return data as Array<T & { id: string }>;
}

// ===== 배치 업데이트 함수들 =====

/**
 * 배치 업데이트용 인터페이스
 */
export interface BatchUpdateItem {
  recordingId: string;
  updates: Partial<DocumentData>;
}

/**
 * 단일 문서 업데이트 (기존 updateDocByIdAdmin와 동일하지만 배치용 래퍼)
 */
export async function updateSingleRecording(
  colName: string,
  recordingId: string,
  updates: Partial<DocumentData>
): Promise<void> {
  return updateDocByIdAdmin(colName, recordingId, updates);
}

/**
 * 배치 업데이트 - Firebase Batch 사용 (최대 500개)
 */
export async function updateRecordingsBatch(
  colName: string,
  updates: BatchUpdateItem[]
): Promise<void> {
  if (updates.length === 0) {
    console.log("⚠️ 업데이트할 항목이 없습니다.");
    return;
  }

  if (updates.length > 500) {
    throw new Error("Firebase Batch는 최대 500개 문서까지만 처리 가능합니다. updateRecordingsBatchChunked를 사용하세요.");
  }

  try {
    const batch: WriteBatch = adminDb.batch();

    updates.forEach(({ recordingId, updates: updateData }) => {
      const docRef = adminDb.collection(colName).doc(recordingId);
      batch.update(docRef, updateData);
    });

    await batch.commit();
    console.log(`✅ 배치 업데이트 완료: ${updates.length}개 문서`);
  } catch (err) {
    console.error("❌ 배치 업데이트 실패:", err);
    throw err;
  }
}

/**
 * 대용량 배치 업데이트 - 500개씩 청크로 나누어 처리
 */
export async function updateRecordingsBatchChunked(
  colName: string,
  updates: BatchUpdateItem[]
): Promise<void> {
  if (updates.length === 0) {
    console.log("⚠️ 업데이트할 항목이 없습니다.");
    return;
  }

  const BATCH_SIZE = 500;
  const chunks = [];
  
  // 500개씩 청크로 나누기
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    chunks.push(updates.slice(i, i + BATCH_SIZE));
  }

  console.log(`🔄 ${updates.length}개 문서를 ${chunks.length}개 배치로 나누어 업데이트 시작`);

  try {
    // 각 청크를 순차적으로 처리
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`📦 배치 ${i + 1}/${chunks.length} 처리 중... (${chunk.length}개 문서)`);
      
      await updateRecordingsBatch(colName, chunk);
      
      // 배치 간 잠시 대기 (rate limiting 방지)
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ 전체 배치 업데이트 완료: ${updates.length}개 문서`);
  } catch (err) {
    console.error("❌ 청크 배치 업데이트 실패:", err);
    throw err;
  }
}

/**
 * 범용 레코딩 업데이트 함수 - 단일/배치 자동 판단
 */
export async function updateRecordings(
  colName: string,
  updates: BatchUpdateItem | BatchUpdateItem[]
): Promise<void> {
  // 단일 업데이트인 경우
  if (!Array.isArray(updates)) {
    return updateSingleRecording(colName, updates.recordingId, updates.updates);
  }

  // 배치 업데이트인 경우
  if (updates.length <= 500) {
    return updateRecordingsBatch(colName, updates);
  } else {
    return updateRecordingsBatchChunked(colName, updates);
  }
}