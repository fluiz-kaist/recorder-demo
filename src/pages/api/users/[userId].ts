//api/users/[userId].ts
import { NextApiRequest, NextApiResponse } from "next";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { User } from "@/types/firebase";

// 한국 시간 생성 유틸리티
const getKoreanTime = (): string => {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreanTime.toISOString();
};

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

  const userDocRef = doc(db, userCollectionName, userId);

  try {
    if (req.method === "GET") {
      // 🔍 사용자 조회 + lastAccessAt 업데이트 (1회 호출)
      console.log("🔍 사용자 조회:", userId);

      try {
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          return res.status(404).json({
            success: false,
            message: "사용자를 찾을 수 없습니다.",
          });
        }

        const userData = userSnap.data() as User;
        const now = getKoreanTime();

        // lastAccessAt 업데이트 (에러 무시 - 조회가 목적이므로)
        updateDoc(userDocRef, {
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
        console.error("❌에러 발생:", error);
        return res.status(404).json({
          success: false,
          message: "사용자를 찾을 수 없습니다.",
        });
      }
    } else if (req.method === "POST") {
      // 🏪 사용자 등록
      console.log("🏪 사용자 등록:", userId);

      const {
        gender,
        ageGroup,
        hasConsented = true, // 기본값 true (동의 후 등록이므로)
        completedAt,
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
      const existingUser = await getDoc(userDocRef);
      if (existingUser.exists()) {
        // 기존 사용자 데이터 반환 + lastAccessAt 업데이트
        const userData = existingUser.data() as User;
        const now = getKoreanTime();

        // lastAccessAt 업데이트
        await updateDoc(userDocRef, {
          lastAccessAt: now,
        });

        return res.status(200).json({
          success: true,
          message: "기존 사용자로 로그인되었습니다.",
          user: {
            ...userData,
            lastAccessAt: now,
          },
        });
      }
      // 현재 한국 시간
      const now = getKoreanTime();

      // 🆕 새로운 데이터 구조로 초기 participation 설정
      const initialParticipation = {
        currentSetNumber: 1, // 첫 번째 세트부터 시작
        totalCompletedSets: 0, // 아직 완료된 세트 없음
        maxAllowedSets: 3, // 최대 3세트 참가 가능 (설정값)

        // 기본 진행 방식 (사용자가 나중에 변경 가능)
        preferredMode: "mixed" as const, // 혼합 모드가 기본값

        // 아직 세트가 할당되지 않은 상태
        sets: [], // 빈 배열로 시작

        // 초기 통계
        stats: {
          totalRecordings: 0,
          totalApprovedRecordings: 0,
          averageQualityScore: 0,
          firstParticipationAt: "", // 첫 세트 시작 시 설정될 예정
          lastParticipationAt: "",
        },
      };

      // 🆕 현재 상태 초기화
      const initialCurrentStatus = {
        isTutorialCompleted: false, // 튜토리얼 미완료
        canStartRecording: false, // 아직 세트 할당 안됨

        // 다음 작업은 아직 없음 (세트 할당 후 결정)
        nextTask: null,

        // 초기 진행률
        progress: {
          completedPercentage: 0,
          submittedPercentage: 0,
          approvedPercentage: 0,
        },

        // 대기 상태
        pendingApproval: false,
        canStartNextSet: false, // 첫 세트도 아직 할당 안됨
      };

      // 🆕 초기 설정값
      const initialSettings = {
        autoSubmitAfterRecording: false, // 수동 제출이 기본값
        requireManualReview: true, // 수동 검토가 기본값 (나중에 자동화 가능)
        allowAutoApproval: false, // 자동 승인 비활성화 (안전을 위해)
      };

      // 새 사용자 데이터 (모든 타임스탬프를 string으로 통일)
      const newUserData: User = {
        // 기본 정보
        id: userId,
        gender,
        ageGroup,
        userName,
        authorizedUserId,
        hasConsented,

        // 시간 정보
        createdAt: now,
        lastAccessAt: now,
        completedAt: completedAt ? now : undefined, // 온보딩 완료 시점

        // 🎯 새로운 참가 관리 구조
        participation: initialParticipation,

        // 🎯 현재 상태
        currentStatus: initialCurrentStatus,

        // 🎯 설정
        settings: initialSettings,

        // 🔄 레거시 호환용 (기존 코드들이 아직 이 필드를 참조할 수 있음)
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
        scriptAssignments: [], // 빈 배열로 초기화
      };

      // Firestore에 사용자 생성 (string 타임스탬프로 저장)
      await setDoc(userDocRef, newUserData);

      return res.status(201).json({
        success: true,
        message: "사용자가 성공적으로 등록되었습니다.",
        user: newUserData,
      });
    } else if (req.method === "PATCH") {
      // 🔄 사용자 정보 수정
      console.log("🔄 사용자 정보 수정:", userId);
      console.log("🔄 수정 데이터:", req.body);

      // 사용자 존재 여부 확인
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        return res.status(404).json({
          success: false,
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      const currentUserData = userSnap.data() as User;

      // 현재 한국 시간
      const now = getKoreanTime();

      const updateData: Partial<User> = {
        lastAccessAt: now,
      };

      // 업데이트할 필드들 추가
      const {
        gender,
        ageGroup,
        hasConsented,
        completedAt,
        scriptAssignments,
        currentStatus, // 🆕 추가
        participation, // 🆕 추가
        settings, // 🆕 추가
        recordingStatus, // 레거시 호환용
      } = req.body;

      // 기본 필드 업데이트
      if (gender) updateData.gender = gender;
      if (ageGroup) updateData.ageGroup = ageGroup;
      if (hasConsented !== undefined) updateData.hasConsented = hasConsented;
      if (completedAt !== undefined) {
        updateData.completedAt = completedAt ? now : undefined;
      }
      if (scriptAssignments !== undefined) {
        updateData.scriptAssignments = scriptAssignments;
      }

      // 🆕 새로운 구조 필드들 업데이트
      if (currentStatus !== undefined) {
        updateData.currentStatus = {
          ...currentUserData.currentStatus,
          ...currentStatus,
        };
        console.log("🔄 currentStatus 업데이트:", updateData.currentStatus);
      }

      if (participation !== undefined) {
        updateData.participation = {
          ...currentUserData.participation,
          ...participation,
        };
        console.log("🔄 participation 업데이트:", updateData.participation);
      }

      if (settings !== undefined) {
        updateData.settings = {
          ...currentUserData.settings,
          ...settings,
        };
        console.log("🔄 settings 업데이트:", updateData.settings);
      }

      // 🔄 레거시 호환용
      if (recordingStatus !== undefined) {
        updateData.recordingStatus = {
          ...currentUserData.recordingStatus,
          ...recordingStatus,
        };
        console.log("🔄 recordingStatus 업데이트:", updateData.recordingStatus);
      }

      console.log("🔄 최종 업데이트 데이터:", updateData);

      // Firestore 문서 업데이트
      await updateDoc(userDocRef, updateData);

      // 업데이트된 사용자 데이터 반환 (추가 조회 없이)
      const updatedUserData: User = {
        ...currentUserData,
        ...updateData,
      };

      console.log("🔄 업데이트 완료:", updatedUserData);

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
    console.error("🚨 Firestore 오류:", error);

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
