// pages/api/test/copy-document.ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
interface RequestBody {
  sourceDocumentId: string;
  collectionName: string;
  versionPrefix: string;
}

interface ResponseData {
  success?: boolean;
  message?: string;
  newDocumentId?: string;
  copiedSubcollections?: string[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sourceDocumentId, collectionName, versionPrefix }: RequestBody =
    req.body;

  if (!sourceDocumentId || !collectionName || !versionPrefix) {
    return res.status(400).json({
      error:
        "필수 필드가 누락되었습니다: sourceDocumentId, collectionName, versionPrefix",
    });
  }

  try {
    const newDocumentId = `${versionPrefix}-${sourceDocumentId}`;
    const copiedSubcollections: string[] = [];

    await copyDocumentWithSubcollections(
      adminDb.collection(collectionName).doc(sourceDocumentId),
      adminDb.collection(collectionName).doc(newDocumentId),
      copiedSubcollections
    );

    console.log(`✅ 문서 복사 완료: ${sourceDocumentId} → ${newDocumentId}`);

    return res.status(200).json({
      success: true,
      message: "문서 복사가 완료되었습니다.",
      newDocumentId,
      copiedSubcollections,
    });
  } catch (error) {
    console.error("❌ 문서 복사 실패:", error);
    return res.status(500).json({
      error: "문서 복사 중 오류가 발생했습니다.",
    });
  }
}

async function copyDocumentWithSubcollections(
  sourceDocRef: any,
  targetDocRef: any,
  copiedSubcollections: string[] = []
): Promise<void> {
  try {
    // 1. 원본 문서 가져오기
    const sourceDoc = await sourceDocRef.get();

    if (!sourceDoc.exists) {
      throw new Error(`원본 문서가 존재하지 않습니다: ${sourceDocRef.path}`);
    }

    // 2. 대상 위치에 문서 생성
    await targetDocRef.set(sourceDoc.data());
    console.log(`📄 문서 복사: ${sourceDocRef.path} → ${targetDocRef.path}`);

    // 3. 하위 컬렉션 목록 가져오기
    const subcollections = await sourceDocRef.listCollections();

    // 4. 각 하위 컬렉션 복사
    for (const subcollection of subcollections) {
      const subcollectionName = subcollection.id;
      console.log(`📁 하위 컬렉션 복사 시작: ${subcollectionName}`);

      if (!copiedSubcollections.includes(subcollectionName)) {
        copiedSubcollections.push(subcollectionName);
      }

      // 하위 컬렉션의 모든 문서 가져오기
      const snapshot = await subcollection.get();

      if (snapshot.empty) {
        console.log(`⚠️ 하위 컬렉션 ${subcollectionName}이 비어있습니다.`);
        continue;
      }

      for (const doc of snapshot.docs) {
        const sourceSubDocRef = subcollection.doc(doc.id);
        const targetSubDocRef = targetDocRef
          .collection(subcollectionName)
          .doc(doc.id);

        // 재귀적으로 하위 문서와 그 하위 컬렉션들도 복사
        await copyDocumentWithSubcollections(
          sourceSubDocRef,
          targetSubDocRef,
          copiedSubcollections
        );
      }

      console.log(`✅ 하위 컬렉션 복사 완료: ${subcollectionName}`);
    }
  } catch (error) {
    console.error(`❌ 복사 중 오류 발생: ${sourceDocRef.path}`, error);
    throw error;
  }
}
