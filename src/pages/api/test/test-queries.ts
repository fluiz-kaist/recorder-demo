// pages/api/admin/test-queries.ts - 개발용 임시 API
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 개발 환경에서만 실행
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({
      error: "이 API는 개발 환경에서만 사용 가능합니다.",
    });
  }

  const audioCollectionName =
    process.env.NEXT_PUBLIC_DB_AUDIO_RECORDINGS_COLLECTION || "recording-temp";

  const testCases = [
    {
      name: "단일 필터 + 정렬",
      query: () =>
        adminDb
          .collection(audioCollectionName)
          .where("verificationStatus", "==", "pending")
          .orderBy("uploadedAt", "desc")
          .limit(5),
    },
    {
      name: "복합 필터 1: status + domain + 정렬",
      query: () =>
        adminDb
          .collection(audioCollectionName)
          .where("verificationStatus", "==", "pending")
          .where("textData.domain", "==", "건강")
          .orderBy("uploadedAt", "desc")
          .limit(5),
    },
    {
      name: "복합 필터 2: status + taskType + 정렬",
      query: () =>
        adminDb
          .collection(audioCollectionName)
          .where("verificationStatus", "==", "pending")
          .where("taskType", "==", "situational")
          .orderBy("uploadedAt", "desc")
          .limit(5),
    },
    {
      name: "복합 필터 3: 모든 필터 + 정렬",
      query: () =>
        adminDb
          .collection(audioCollectionName)
          .where("verificationStatus", "==", "pending")
          .where("textData.domain", "==", "건강")
          .where("taskType", "==", "situational")
          .orderBy("uploadedAt", "desc")
          .limit(5),
    },
    {
      name: "날짜 범위 + status + 정렬",
      query: () =>
        adminDb
          .collection(audioCollectionName)
          .where("uploadedAt", ">=", new Date("2025-08-01"))
          .where("verificationStatus", "==", "pending")
          .orderBy("uploadedAt", "desc")
          .limit(5),
    },
  ];

  const results = [];

  for (const testCase of testCases) {
    try {
      console.log(`🧪 테스트 중: ${testCase.name}`);
      const startTime = Date.now();

      const snapshot = await testCase.query().get();
      const executionTime = Date.now() - startTime;

      results.push({
        name: testCase.name,
        status: "✅ 성공",
        count: snapshot.docs.length,
        executionTime: `${executionTime}ms`,
        hasIndex: "인덱스 존재",
        sampleData: snapshot.docs.slice(0, 2).map((doc) => ({
          id: doc.id,
          verificationStatus: doc.data().verificationStatus,
          domain: doc.data().textData?.domain,
          taskType: doc.data().taskType,
          uploadedAt: doc.data().uploadedAt?.toDate?.()?.toISOString(),
        })),
      });
    } catch (error: any) {
      console.error(`❌ ${testCase.name} 실패:`, error.message);

      results.push({
        name: testCase.name,
        status: "❌ 실패",
        error: error.message,
        indexNeeded: error.message.includes("index")
          ? "🔗 인덱스 필요"
          : "기타 오류",
        indexUrl: error.message.includes("https://")
          ? error.message.match(/https:\/\/[^\s]+/)?.[0]
          : null,
      });
    }
  }

  return res.status(200).json({
    message: "Firestore 쿼리 테스트 완료",
    environment: process.env.NODE_ENV,
    collection: audioCollectionName,
    timestamp: new Date().toISOString(),
    results,
    instructions: {
      success: "✅ 성공한 쿼리들은 이미 인덱스가 있습니다",
      failed: "❌ 실패한 쿼리들의 indexUrl을 클릭해서 인덱스를 생성하세요",
      note: "인덱스 생성 후 몇 분 기다린 다음 다시 테스트하세요",
    },
  });
}

// 사용법:
// GET http://localhost:3000/api/test/test-queries
// 브라우저나 Postman에서 호출
//curl http://localhost:3000/api/test/test-queries | jq
