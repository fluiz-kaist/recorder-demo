// pages/api/test/import-collection.ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { isDevelopment } from "@/utils/envConfig";
import { applyNewCompletionLogic } from "@/utils/transferOldData";
import { Timestamp } from "firebase-admin/firestore";

interface DocumentData {
  id: string;
  data: any;
  subcollections?: { [key: string]: DocumentData[] };
}

interface RequestBody {
  collectionName: string;
  data?: DocumentData[];
  overwrite?: boolean;
  applyCompletionLogic?: boolean;
  excludeUserName?: string;
  useStreaming?: boolean;
}

interface ResponseData {
  success?: boolean;
  message?: string;
  importedCount?: number;
  skippedCount?: number;
  importedDocuments?: string[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // 개발 환경에서만 실행 가능하도록 제한
  if (!isDevelopment()) {
    return res.status(403).json({
      error: "이 기능은 개발 환경에서만 사용할 수 있습니다.",
    });
  }

  // POST 요청만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    collectionName,
    data,
    overwrite = true,
    applyCompletionLogic = false,
    excludeUserName = "",
    useStreaming = false,
  }: RequestBody = req.body;

  // 기본 유효성 검사
  if (!collectionName) {
    return res.status(400).json({
      error: "컬렉션 이름이 필요합니다.",
    });
  }

  // 스트리밍 모드가 아닌 경우 데이터 배열 검증
  if (!useStreaming && (!data || !Array.isArray(data))) {
    return res.status(400).json({
      error: "데이터 배열이 필요합니다.",
    });
  }

  if (!useStreaming && data!.length === 0) {
    return res.status(400).json({
      error: "Import할 데이터가 없습니다.",
    });
  }

  try {
    // 스트리밍 모드와 일반 모드 분기 처리
    if (useStreaming) {
      return await handleStreamingImport(req, res, {
        collectionName,
        overwrite,
        applyCompletionLogic,
        excludeUserName,
      });
    } else {
      return await handleBatchImport(req, res, {
        collectionName,
        data: data!,
        overwrite,
        applyCompletionLogic,
        excludeUserName,
      });
    }
  } catch (error: any) {
    console.error("Import 실패:", error);
    return res.status(500).json({
      error: `Import 중 오류가 발생했습니다: ${error.message}`,
    });
  }
}

// 기존 배치 처리 방식
async function handleBatchImport(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
  options: {
    collectionName: string;
    data: DocumentData[];
    overwrite: boolean;
    applyCompletionLogic: boolean;
    excludeUserName: string;
  }
) {
  const {
    collectionName,
    data,
    overwrite,
    applyCompletionLogic,
    excludeUserName,
  } = options;

  console.log(`데이터 Import 시작: ${collectionName} (${data.length}개 문서)`);

  const importedDocuments: string[] = [];
  let importedCount = 0;
  let skippedCount = 0;

  // Firebase 배치 처리 준비
  const batch = adminDb.batch();
  const BATCH_SIZE = 500;
  let batchCount = 0;

  for (const item of data) {
    try {
      // 문서 처리 결과
      const result = await processDocument(item, {
        collectionName,
        overwrite,
        applyCompletionLogic,
        excludeUserName,
        batch,
        batchCount,
      });

      if (result.success) {
        importedDocuments.push(item.id);
        importedCount++;
        batchCount = result.batchCount;

        // 배치 크기 체크 및 커밋
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`배치 커밋: ${batchCount}개 문서`);

          // 새로운 배치 생성
          const newBatch = adminDb.batch();
          Object.assign(batch, newBatch);
          batchCount = 0;
        }
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.warn(`문서 처리 실패: ${item.id}`, error);
      skippedCount++;
    }
  }

  // 남은 문서들 커밋
  if (batchCount > 0) {
    await batch.commit();
    console.log(`최종 배치 커밋: ${batchCount}개 문서`);
  }

  console.log(`Import 완료: ${importedCount}개 문서 (스킵: ${skippedCount}개)`);

  return res.status(200).json({
    success: true,
    message: `성공적으로 ${importedCount}개 문서를 Import했습니다. (스킵: ${skippedCount}개)`,
    importedCount,
    skippedCount,
    importedDocuments,
  });
}

// 스트리밍 처리 방식
async function handleStreamingImport(
  req: NextApiRequest,
  res: NextApiResponse,
  options: {
    collectionName: string;
    overwrite: boolean;
    applyCompletionLogic: boolean;
    excludeUserName: string;
  }
) {
  const { collectionName, overwrite, applyCompletionLogic, excludeUserName } =
    options;

  // 스트리밍 응답 헤더 설정
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Transfer-Encoding", "chunked");

  let importedCount = 0;
  let skippedCount = 0;
  const batch = adminDb.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;

  console.log(`스트리밍 Import 시작: ${collectionName}`);

  // 요청 본문을 스트림으로 처리
  let buffer = "";

  req.on("data", async (chunk) => {
    buffer += chunk.toString();

    // 완성된 JSON 라인들 처리
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // 마지막 불완전한 라인은 버퍼에 유지

    for (const line of lines) {
      if (line.trim()) {
        try {
          const item = JSON.parse(line);

          // 문서 처리
          const result = await processDocument(item, {
            collectionName,
            overwrite,
            applyCompletionLogic,
            excludeUserName,
            batch,
            batchCount,
          });

          if (result.success) {
            importedCount++;
            batchCount = result.batchCount;

            // 배치 크기 체크 및 커밋
            if (batchCount >= BATCH_SIZE) {
              await batch.commit();
              console.log(`스트리밍 배치 커밋: ${batchCount}개 문서`);

              // 새로운 배치 생성
              const newBatch = adminDb.batch();
              Object.assign(batch, newBatch);
              batchCount = 0;
            }
          } else {
            skippedCount++;
          }
        } catch (error) {
          console.warn("JSON 파싱 또는 문서 처리 실패:", error);
          skippedCount++;
        }
      }
    }
  });

  req.on("end", async () => {
    try {
      // 남은 배치 커밋
      if (batchCount > 0) {
        await batch.commit();
        console.log(`스트리밍 최종 배치 커밋: ${batchCount}개 문서`);
      }

      console.log(
        `스트리밍 Import 완료: ${importedCount}개 문서 (스킵: ${skippedCount}개)`
      );

      // 최종 응답
      res.write(
        JSON.stringify({
          success: true,
          message: `스트리밍으로 ${importedCount}개 문서를 Import했습니다. (스킵: ${skippedCount}개)`,
          importedCount,
          skippedCount,
        })
      );
      res.end();
    } catch (error) {
      console.error("스트리밍 Import 최종 처리 실패:", error);
      res.write(
        JSON.stringify({
          success: false,
          error: "스트리밍 Import 중 오류가 발생했습니다.",
        })
      );
      res.end();
    }
  });

  req.on("error", (error) => {
    console.error("스트리밍 요청 오류:", error);
    res.write(
      JSON.stringify({
        success: false,
        error: "스트리밍 요청 처리 중 오류가 발생했습니다.",
      })
    );
    res.end();
  });
}

// 개별 문서 처리 함수
async function processDocument(
  item: DocumentData,
  options: {
    collectionName: string;
    overwrite: boolean;
    applyCompletionLogic: boolean;
    excludeUserName: string;
    batch: any;
    batchCount: number;
  }
): Promise<{ success: boolean; batchCount: number }> {
  const {
    collectionName,
    overwrite,
    applyCompletionLogic,
    excludeUserName,
    batch,
  } = options;
  let { batchCount } = options;

  // 데이터 유효성 검사
  if (!item.id || !item.data) {
    console.warn(`잘못된 데이터 형식: ${JSON.stringify(item)}`);
    return { success: false, batchCount };
  }

  // 메인 문서 레퍼런스 생성
  const docRef = adminDb.collection(collectionName).doc(item.id);

  // 덮어쓰기 모드가 아닌 경우 기존 문서 존재 여부 확인
  if (!overwrite) {
    const existingDoc = await docRef.get();
    if (existingDoc.exists) {
      console.log(`문서가 이미 존재함 (스킵): ${item.id}`);
      return { success: false, batchCount };
    }
  }

  let processedData = item.data;

  // Broken Timestamp만 수정 (원본 타입 최대한 보존)
  processedData = fixBrokenTimestampsInData(processedData);

  // 완료 로직 적용 조건 체크
  if (applyCompletionLogic) {
    const shouldExclude =
      excludeUserName && item.data?.profile?.userName === excludeUserName;

    if (!shouldExclude) {
      // 완료 로직 적용
      try {
        const roundData = extractRoundDataFromSubcollections(
          item.subcollections
        );
        const result = applyNewCompletionLogic(item.data, roundData);
        processedData = result.updatedUserData;

        console.log(`완료 로직 적용: ${item.id}`);
      } catch (error) {
        console.warn(`완료 로직 적용 실패: ${item.id}`, error);
        // 실패시 원본 데이터 사용
      }
    }
  }

  // 메인 문서를 배치에 추가
  batch.set(docRef, processedData);
  batchCount++;

  // 하위 컬렉션 처리
  if (item.subcollections) {
    for (const [subcolName, subDocs] of Object.entries(item.subcollections)) {
      // 각 하위 컬렉션의 문서들 처리
      for (const subDoc of subDocs as any[]) {
        // 하위 문서 레퍼런스 생성
        const subDocRef = docRef.collection(subcolName).doc(subDoc.id);

        // 하위 문서를 배치에 추가
        batch.set(subDocRef, subDoc.data);
        batchCount++;
      }
    }
  }

  return { success: true, batchCount };
}

// 라운드 데이터 추출 함수
function extractRoundDataFromSubcollections(subcollections: any) {
  // rounds 서브컬렉션에서 현재 라운드 데이터 추출
  const roundsData = subcollections?.rounds || [];
  if (roundsData.length > 0) {
    // 가장 최신 라운드 데이터 사용
    const latestRound = roundsData[roundsData.length - 1];
    return latestRound.data;
  }

  // 기본값 반환
  return {
    tasks: {
      situational: [],
      formal: [],
    },
  };
}
// 오직 잘못된 Timestamp 객체만 수정하는 함수
function fixBrokenTimestamp(value: any): any {
  // 이미 정상적인 Firestore Timestamp인 경우 - 그대로 유지
  if (value && typeof value.toMillis === "function") {
    return value;
  }

  // 🎯 핵심: {_seconds, _nanoseconds} 형태의 일반 객체만 수정
  if (
    value &&
    typeof value === "object" &&
    value.constructor === Object && // 일반 Object만
    typeof value._seconds === "number" &&
    (value._nanoseconds === undefined || typeof value._nanoseconds === "number")
  ) {
    console.log(`Broken Timestamp 수정: ${JSON.stringify(value)}`);
    return new Timestamp(value._seconds, value._nanoseconds || 0);
  }

  // 다른 모든 타입은 원본 그대로 유지
  // - 문자열로 저장된 시간
  // - Date 객체
  // - 숫자로 저장된 timestamp
  // - null, undefined
  // - 기타 모든 값
  return value;
}

// 객체를 순회하면서 broken timestamp만 찾아서 수정
function fixBrokenTimestampsInData(data: any): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  // 배열인 경우
  if (Array.isArray(data)) {
    return data.map((item) => fixBrokenTimestampsInData(item));
  }

  // 일반 객체인 경우
  const fixedData = { ...data };

  Object.keys(fixedData).forEach((key) => {
    const value = fixedData[key];

    if (value === null || value === undefined) {
      // null, undefined는 그대로 유지
      return;
    }

    if (Array.isArray(value)) {
      // 배열 안의 각 요소 재귀 처리
      fixedData[key] = value.map((item) => fixBrokenTimestampsInData(item));
    } else if (typeof value === "object") {
      // 먼저 broken timestamp인지 확인
      const fixed = fixBrokenTimestamp(value);

      if (fixed !== value) {
        // broken timestamp였다면 수정된 값 사용
        fixedData[key] = fixed;
      } else {
        // 아니라면 재귀적으로 내부 확인
        fixedData[key] = fixBrokenTimestampsInData(value);
      }
    } else {
      // primitive 값들은 그대로 유지 (string, number, boolean)
      // 원본이 문자열이나 숫자로 저장했다면 그대로 둠
    }
  });

  return fixedData;
}
