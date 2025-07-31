//api/users/[userId].ts
import { NextApiRequest, NextApiResponse } from "next";
import {
  getDocByIdAdmin,
  saveDocAdmin,
  updateDocByIdAdmin,
} from "@/lib/firebase/firestoreAdmin"; // Admin SDK 추가
import { User } from "@/types/firebase";
import { getKoreanTimeISO } from "@/utils/time";
import { FieldValue } from "firebase-admin/firestore"; // Admin SDK 추가

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userId } = req.query;
  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

  // userId 유효성 검사
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({
      success: false,
      message: "유효한 사용자 ID가 필요합니다.",
    });
  }

  const now = getKoreanTimeISO();

  try {
    if (req.method === "GET") {
      // 사용자 조회 + lastAccessAt 업데이트 (1회 호출)
      console.log("사용자 조회:", userId);

      try {
        const userData = await getDocByIdAdmin(userCollectionName, userId); // Admin SDK로 변경

        if (!userData) {
          return res.status(404).json({
            success: false,
            message: "사용자를 찾을 수 없습니다.",
          });
        }

        // lastAccessAt 업데이트 (에러 무시 - 조회가 목적이므로)
        updateDocByIdAdmin(userCollectionName, userId, {
          // Admin SDK로 변경
          lastAccessAt: now,
        }).catch((err) => console.warn("lastAccessAt 업데이트 실패:", err));

        return res.status(200).json({
          success: true,
          user: {
            ...userData,
            lastAccessAt: now, // 업데이트된 시간 반영
          },
        });
      } catch (error) {
        console.error("에러 발생:", error);
        return res.status(404).json({
          success: false,
          message: "사용자를 찾을 수 없습니다.",
        });
      }
    } else if (req.method === "POST") {
      // 사용자 등록
      console.log("사용자 등록:", userId);

      const {
        gender,
        ageGroup,
        hasConsented = true, // 기본값 true (동의 후 등록이므로)
        userName,
        authorizedUserId,
      } = req.body;

      // 필수 필드 검증
      if (!gender || !ageGroup) {
        return res.status(400).json({
          success: false,
          message: "성별과 연령대는 필수입니다.",
        });
      }

      // 동의 여부 확인
      if (!hasConsented) {
        return res.status(400).json({
          success: false,
          message: "서비스 이용 동의가 필요합니다.",
        });
      }

      // 사용자 존재 여부 확인
      const existingUser = await getDocByIdAdmin(userCollectionName, userId); // Admin SDK로 변경
      if (existingUser) {
        const now = getKoreanTimeISO();

        // lastAccessAt 업데이트
        await updateDocByIdAdmin(userCollectionName, userId, {
          // Admin SDK로 변경
          lastAccessAt: now,
        });

        return res.status(200).json({
          success: true,
          message: "기존 사용자로 로그인되었습니다.",
          user: {
            ...existingUser,
            lastAccessAt: now,
          },
        });
      }

      // 신규 사용자 등록 절차 시작
      console.log(">>>>authorizedUserId?", authorizedUserId);

      // authorized collection에 생성한 user id를 갱신
      const registeredUserCollectionName =
        process.env.NEXT_PUBLIC_DB_WHITELIST_USERS_COLLECTION ||
        "registered-temp";

      await updateDocByIdAdmin(registeredUserCollectionName, authorizedUserId, {
        // Admin SDK로 변경
        accountCreatedAt: now,
        userId: userId,
      });

      console.log("auth user 정보 갱신 완료");

      // 새로운 데이터 구조로 초기 participation 설정
      const initialParticipation = {
        currentSetNumber: 1,
        totalCompletedSets: 0,
        maxAllowedSets: 3,
        preferredMode: "mixed" as const,
        sets: [],
        stats: {
          totalRecordings: 0,
          totalApprovedRecordings: 0,
          averageQualityScore: 0,
          firstParticipationAt: "",
          lastParticipationAt: "",
        },
      };

      // 현재 상태 초기화
      const initialCurrentStatus = {
        isTutorialCompleted: false,
        canStartRecording: false,
        nextTask: null,
        progress: {
          completedPercentage: 0,
          submittedPercentage: 0,
          approvedPercentage: 0,
        },
        pendingApproval: false,
        canStartNextSet: false,
      };

      // 초기 설정값
      const initialSettings = {
        autoSubmitAfterRecording: false,
        requireManualReview: true,
        allowAutoApproval: false,
      };

      // 새 사용자 데이터
      const newUserData: User = {
        id: userId,
        gender,
        ageGroup,
        userName,
        authorizedUserId,
        hasConsented,
        createdAt: now,
        lastAccessAt: now,
        completedAt: FieldValue.serverTimestamp(), // Admin SDK로 변경
        participation: initialParticipation,
        currentStatus: initialCurrentStatus,
        settings: initialSettings,
        recordingStatus: {
          isTutorialCompleted: false,
          isAllRecordingCompleted: false,
          allRecordingCompletedAt: "",
          progress: {
            totalAssigned: 0,
            tutorialCompleted: 0,
            mainSituationalCompleted: 0,
            mainFormalCompleted: 0,
            lastRecordedAt: "",
          },
        },
      };

      // Firestore에 사용자 생성
      await saveDocAdmin(userCollectionName, userId, newUserData); // Admin SDK로 변경

      return res.status(201).json({
        success: true,
        message: "사용자가 성공적으로 등록되었습니다.",
        user: newUserData,
      });
    } else if (req.method === "PATCH") {
      // 사용자 정보 수정
      console.log("사용자 정보 수정:", userId);
      console.log("수정 데이터:", req.body);

      // 사용자 존재 여부 확인
      const currentUserData = await getDocByIdAdmin(userCollectionName, userId); // Admin SDK로 변경

      if (!currentUserData) {
        return res.status(404).json({
          success: false,
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      const now = getKoreanTimeISO();

      const updateData: Partial<User> = {
        lastAccessAt: now,
      };

      // 업데이트할 필드들 추가
      const {
        gender,
        ageGroup,
        hasConsented,
        completedAt,
        currentStatus,
        participation,
        settings,
        recordingStatus,
      } = req.body;

      // 기본 필드 업데이트
      if (gender) updateData.gender = gender;
      if (ageGroup) updateData.ageGroup = ageGroup;
      if (hasConsented !== undefined) updateData.hasConsented = hasConsented;
      if (completedAt !== undefined) {
        updateData.completedAt = FieldValue.serverTimestamp(); // Admin SDK로 변경
      }

      // 새로운 구조 필드들 업데이트
      if (currentStatus !== undefined) {
        updateData.currentStatus = {
          ...currentUserData.currentStatus,
          ...currentStatus,
        };
        console.log("currentStatus 업데이트:", updateData.currentStatus);
      }

      if (participation !== undefined) {
        updateData.participation = {
          ...currentUserData.participation,
          ...participation,
        };
        console.log("participation 업데이트:", updateData.participation);
      }

      if (settings !== undefined) {
        updateData.settings = {
          ...currentUserData.settings,
          ...settings,
        };
        console.log("settings 업데이트:", updateData.settings);
      }

      // 레거시 호환용
      if (recordingStatus !== undefined) {
        updateData.recordingStatus = {
          ...currentUserData.recordingStatus,
          ...recordingStatus,
        };
        console.log("recordingStatus 업데이트:", updateData.recordingStatus);
      }

      console.log("최종 업데이트 데이터:", updateData);

      // Firestore 문서 업데이트
      await updateDocByIdAdmin(userCollectionName, userId, updateData); // Admin SDK로 변경

      // 업데이트된 사용자 데이터 반환
      const updatedUserData = {
        ...currentUserData,
        ...updateData,
      } as User;
      console.log("업데이트 완료:", updatedUserData);

      return res.status(200).json({
        success: true,
        message: "사용자 정보가 수정되었습니다.",
        user: updatedUserData,
      });
    } else {
      // 지원하지 않는 메소드
      res.setHeader("Allow", ["GET", "POST", "PATCH"]);
      return res.status(405).json({
        success: false,
        message: `Method ${req.method} Not Allowed`,
      });
    }
  } catch (error) {
    console.error("Firestore 오류:", error);

    // Firestore 특정 오류 처리
    if (error instanceof Error) {
      if (error.message.includes("permission-denied")) {
        return res.status(403).json({
          success: false,
          message: "접근 권한이 없습니다.",
        });
      }

      if (error.message.includes("not-found")) {
        return res.status(404).json({
          success: false,
          message: "요청한 데이터를 찾을 수 없습니다.",
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      ...(process.env.NODE_ENV === "development" && {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    });
  }
}
