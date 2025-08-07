// pages/api/admin/recordings/update.ts
import { NextApiRequest, NextApiResponse } from "next";
import {
  updateRecordings,
  BatchUpdateItem,
} from "@/lib/firebase/firestoreAdmin";
import { AudioRecording } from "@/types/audio";

interface SingleUpdateRequest {
  recordingId: string;
  updates: Partial<AudioRecording>;
}

interface BatchUpdateRequest {
  batch: Array<{
    recordingId: string;
    updates: Partial<AudioRecording>;
  }>;
}

type UpdateRequest = SingleUpdateRequest | BatchUpdateRequest;

interface UpdateResponse {
  success: boolean;
  message?: string;
  data?: {
    updatedCount: number;
    recordingIds: string[];
  };
}

/**
 * 범용 AudioRecording 업데이트 함수 - 다른 API에서 import 가능
 */
export async function updateAudioRecordings(
  updates: BatchUpdateItem | BatchUpdateItem[]
): Promise<{ updatedCount: number; recordingIds: string[] }> {
  const audioCollectionName =
    process.env.NEXT_PUBLIC_DB_AUDIO_RECORDINGS_COLLECTION || "recording-temp";

  await updateRecordings(audioCollectionName, updates);

  // 결과 정보 반환
  if (Array.isArray(updates)) {
    return {
      updatedCount: updates.length,
      recordingIds: updates.map((u) => u.recordingId),
    };
  } else {
    return {
      updatedCount: 1,
      recordingIds: [updates.recordingId],
    };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateResponse>
) {
  if (req.method !== "PATCH" && req.method !== "PUT") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed. Use PATCH or PUT.",
    });
  }

  try {
    // 관리자 권한 확인
    const adminToken = req.cookies["admin-token"];
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        message: "관리자 권한이 필요합니다.",
      });
    }

    const requestData = req.body as UpdateRequest;

    // 요청 데이터 검증
    if (!requestData) {
      return res.status(400).json({
        success: false,
        message: "요청 데이터가 없습니다.",
      });
    }

    let batchUpdates: BatchUpdateItem[];

    // 단일 업데이트인지 배치 업데이트인지 판단
    if ("batch" in requestData) {
      // 배치 업데이트
      if (!Array.isArray(requestData.batch) || requestData.batch.length === 0) {
        return res.status(400).json({
          success: false,
          message: "배치 업데이트 데이터가 유효하지 않습니다.",
        });
      }

      batchUpdates = requestData.batch.map((item) => ({
        recordingId: item.recordingId,
        updates: item.updates,
      }));
    } else {
      // 단일 업데이트
      if (!requestData.recordingId || !requestData.updates) {
        return res.status(400).json({
          success: false,
          message: "recordingId와 updates가 필요합니다.",
        });
      }

      batchUpdates = [
        {
          recordingId: requestData.recordingId,
          updates: requestData.updates,
        },
      ];
    }

    // 업데이트 실행
    const result = await updateAudioRecordings(batchUpdates);

    console.log(`✅ AudioRecording 업데이트 완료: ${result.updatedCount}개`);

    return res.status(200).json({
      success: true,
      message: `${result.updatedCount}개 레코딩이 성공적으로 업데이트되었습니다.`,
      data: result,
    });
  } catch (err) {
    console.error("❌ AudioRecording 업데이트 오류:", err);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}

// 사용 예시 (주석)
/*
// 단일 업데이트 요청
{
  "recordingId": "abc123",
  "updates": {
    "verificationStatus": "approved",
    "verification": {
      "verifiedAt": "2025-08-07T10:30:00Z",
      "verifiedBy": "system",
      "verificationMethod": "auto",
      "isApproved": true,
      "verifierNotes": "LLM 분석: 적절한 응답입니다"
    }
  }
}

// 배치 업데이트 요청
{
  "batch": [
    {
      "recordingId": "abc123",
      "updates": {
        "verificationStatus": "approved",
        "verification": {
          "verifiedAt": "2025-08-07T10:30:00Z",
          "verifiedBy": "system",
          "verificationMethod": "auto", 
          "isApproved": true,
          "verifierNotes": "LLM 분석: 적절한 응답입니다"
        }
      }
    },
    {
      "recordingId": "def456", 
      "updates": {
        "verificationStatus": "rejected",
        "verification": {
          "verifiedAt": "2025-08-07T10:30:00Z",
          "verifiedBy": "system",
          "verificationMethod": "auto",
          "isApproved": false,
          "verifierNotes": "LLM 분석: 부적절한 응답 - 주제와 맞지 않음"
        }
      }
    }
  ]
}
*/
