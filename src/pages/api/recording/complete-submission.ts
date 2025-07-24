/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 녹음 완전 제출 API
 *
 * 이 API는 사용자의 음성 녹음 파일 제출을 완전히 처리합니다.
 * Firebase Firestore의 batch 기능을 사용하여 다음 작업들을 원자적으로 수행합니다:
 *
 * 1. 오디오 파일 메타데이터 저장 (audio_files 컬렉션)
 * 2. 사용자 완료 스크립트 목록 업데이트 (users 컬렉션)
 * 3. 사용자 진도 정보 업데이트 (users/{userId}/progress 서브컬렉션)
 *
 * 모든 작업이 성공하거나 모든 작업이 실패하여 데이터 일관성을 보장합니다.
 */

import { NextApiRequest, NextApiResponse } from "next";
import {
  writeBatch,
  doc,
  arrayUnion,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";

// 요청 데이터 타입 정의
interface CompleteSubmissionRequest {
  userId: string;
  scriptId: string;
  scriptType: string;
  audioUrl: string;
  filePath: string;
  sttText: string;
  audioMetadata: {
    documentId: string;
    fileName: string;
    duration: number;
    uploadedAt: string;
    fileSize: number;
    scriptInfo?: any;
    fileCategory?: string;
    category: string;
    searchKey: string;
  };
}

// 응답 데이터 타입 정의
interface CompleteSubmissionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CompleteSubmissionResponse>
) {
  // POST 요청만 허용
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed. Only POST requests are supported.",
    });
  }

  try {
    // 요청 데이터 추출 및 유효성 검사
    const {
      userId,
      scriptId,
      scriptType,
      audioUrl,
      filePath,
      sttText,
      audioMetadata,
    }: CompleteSubmissionRequest = req.body;

    // 필수 필드 검증
    if (
      !userId ||
      !scriptId ||
      !scriptType ||
      !audioUrl ||
      !sttText ||
      !audioMetadata
    ) {
      return res.status(400).json({
        success: false,
        message:
          "필수 필드가 누락되었습니다. userId, scriptId, scriptType, audioUrl, sttText, audioMetadata가 모두 필요합니다.",
      });
    }

    // audioMetadata의 필수 필드 검증
    if (!audioMetadata.documentId || !audioMetadata.fileName) {
      return res.status(400).json({
        success: false,
        message: "audioMetadata에 documentId와 fileName이 필요합니다.",
      });
    }

    console.log("녹음 완전 제출 처리 시작:", {
      userId,
      scriptId,
      scriptType,
      documentId: audioMetadata.documentId,
    });

    // Firestore batch 트랜잭션 생성
    const batch = writeBatch(db);

    // 1. 오디오 파일 메타데이터 저장
    // audio_files 컬렉션에 오디오 파일 정보와 메타데이터 저장
    const audioDocRef = doc(db, "audio_files", audioMetadata.documentId);
    const audioDocData = {
      ...audioMetadata,
      downloadURL: audioUrl,
      filePath,
      userId,
      createdAt: serverTimestamp(),
    };

    batch.set(audioDocRef, audioDocData);
    console.log("Batch에 오디오 메타데이터 추가:", audioMetadata.documentId);

    // 2. 사용자 완료 스크립트 목록 업데이트
    // users 컬렉션에서 해당 사용자의 완료된 스크립트 목록과 통계 업데이트
    const userRef = doc(db, "usersV2", userId);
    const completedField = `completedScripts.${scriptType}`;

    batch.update(userRef, {
      [completedField]: arrayUnion(scriptId),
      totalCompleted: increment(1),
      lastAccess: serverTimestamp(),
    });
    console.log("Batch에 사용자 완료 스크립트 업데이트 추가:", completedField);

    // 3. 사용자 진도 정보 업데이트
    // users/{userId}/progress 서브컬렉션에 해당 스크립트의 진도 정보 업데이트
    const progressRef = doc(db, "usersV2", userId, "progress", scriptId);
    const progressData = {
      status: "completed",
      recordedAt: serverTimestamp(),
      audioUrl,
      sttText,
      completedAt: serverTimestamp(),
    };

    batch.update(progressRef, progressData);
    console.log("Batch에 진도 정보 업데이트 추가:", scriptId);

    // 4. 모든 작업을 원자적으로 실행
    // 모든 작업이 성공하거나 모든 작업이 실패함을 보장
    await batch.commit();
    console.log("Batch 커밋 완료 - 모든 작업 성공");

    // 성공 응답 반환
    return res.status(200).json({
      success: true,
      message: "녹음 파일 제출이 성공적으로 완료되었습니다.",
    });
  } catch (error) {
    // 에러 로깅 및 응답
    console.error("녹음 완전 제출 처리 중 오류 발생:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      error: errorMessage,
    });
  }
}
