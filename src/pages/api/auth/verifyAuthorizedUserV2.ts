// pages/api/auth/verifyAuthorizedUserV2.ts - Admin SDK로 변경
import { NextApiRequest, NextApiResponse } from "next";
import {
  getDocByIdAdmin,
  updateDocByIdAdmin,
} from "@/lib/firebase/firestoreAdmin"; // Admin SDK 추가
import { FieldValue } from "firebase-admin/firestore"; // Admin SDK 추가
import { serialize } from "cookie";
import { generateUserHash, maskPersonalInfo } from "@/utils/hash";

interface UserData {
  gender?: string;
  ageGroup?: string;
  completedAt?: string;
  scriptAssignments?: any[];
  lastAccessAt?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 메서드 확인 - POST와 PATCH 모두 지원
  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({
      success: false,
      message: "POST 또는 PATCH 방식만 지원합니다.",
    });
  }

  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
  const registeredUserCollectionName =
    process.env.NEXT_PUBLIC_DB_WHITELIST_USERS_COLLECTION || "registered-temp";

  // PATCH 요청일 때: userId만 업데이트
  if (req.method === "PATCH") {
    const { userId } = req.body;

    // userId 검증
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        success: false,
        message: "유효한 userId를 입력해주세요.",
      });
    }

    try {
      console.log(`userId 업데이트 요청: ${userId}`);

      // 쿠키에서 userHash 가져오기 (또는 다른 방법으로 사용자 식별)
      const cookies = req.headers.cookie;
      let userHash = null;

      if (cookies) {
        const cookieArray = cookies.split(";");
        const userHashCookie = cookieArray.find((cookie) =>
          cookie.trim().startsWith("userHash=")
        );
        if (userHashCookie) {
          userHash = userHashCookie.split("=")[1];
        }
      }

      if (!userHash) {
        return res.status(401).json({
          success: false,
          message: "사용자 인증 정보가 없습니다.",
        });
      }

      // 화이트리스트 사용자 데이터 조회
      const authorizedData = await getDocByIdAdmin(
        registeredUserCollectionName,
        userHash
      );

      if (!authorizedData) {
        return res.status(404).json({
          success: false,
          message: "등록된 사용자를 찾을 수 없습니다.",
        });
      }

      // userId 업데이트
      await updateDocByIdAdmin(registeredUserCollectionName, userHash, {
        userId: userId,
        lastLogin: FieldValue.serverTimestamp(),
        loginAttempts: 0,
      });

      console.log(`userId 업데이트 성공: ${userHash} -> ${userId}`);

      return res.status(200).json({
        success: true,
        message: "userId 업데이트 성공",
        user: {
          userHash: userHash,
          userId: userId,
          name: authorizedData.name,
          isExistingUser: false, // 새로 userId가 할당된 경우
        },
      });
    } catch (error) {
      console.error("userId 업데이트 중 오류:", error);
      return res.status(500).json({
        success: false,
        message: "userId 업데이트 중 오류가 발생했습니다.",
      });
    }
  }

  // POST 요청일 때: 기존 로직 수행
  const { name, socialNumber } = req.body;

  // 입력 검증
  if (!name || !socialNumber) {
    return res.status(400).json({
      success: false,
      message: "이름과 주민번호를 모두 입력해주세요.",
    });
  }

  // 입력 형식 검증
  if (typeof name !== "string" || typeof socialNumber !== "string") {
    return res.status(400).json({
      success: false,
      message: "입력 형식이 올바르지 않습니다.",
    });
  }

  // 주민번호 앞자리 길이 검증 (6자리)
  const cleanSocialNumber = socialNumber.trim().replace(/[^0-9]/g, "");
  if (cleanSocialNumber.length !== 6) {
    return res.status(400).json({
      success: false,
      message: "주민번호 앞 6자리를 정확히 입력해주세요.",
    });
  }

  // 이름 길이 검증
  const cleanName = name.trim();
  if (cleanName.length < 1) {
    return res.status(400).json({
      success: false,
      message: "이름을 입력해주세요.",
    });
  }

  try {
    console.log(
      `인증 시도: ${maskPersonalInfo(cleanName, cleanSocialNumber).maskedName}`
    );

    // 1. 해시 생성
    const userHash = generateUserHash(cleanName, cleanSocialNumber);

    console.log("verifyV2에서 생성하는 userHash", userHash);
    console.log(`생성된 해시: ${userHash.substring(0, 8)}...`);

    // 2. 해시 기반 직접 조회 (O(1) 시간복잡도)
    const authorizedData = await getDocByIdAdmin(
      registeredUserCollectionName,
      userHash
    );

    if (!authorizedData) {
      // 개인정보 마스킹하여 로그 기록
      const { maskedName, maskedSocialNumber } = maskPersonalInfo(
        cleanName,
        cleanSocialNumber
      );
      console.warn(
        `승인되지 않은 사용자: ${maskedName}, ${maskedSocialNumber}`
      );

      return res.status(401).json({
        success: false,
        message: "승인되지 않은 사용자입니다.",
      });
    }

    // 입력된 이름과 저장된 이름 비교 (선택사항)
    if (authorizedData.name && authorizedData.name !== cleanName) {
      console.warn("이름 불일치 감지");
      return res.status(403).json({
        success: false,
        message: "등록된 이름과 다릅니다.",
      });
    }
    console.log(`승인된 사용자 찾음: 활성상태=${authorizedData.isActive}`);

    // 3. 계정 활성화 상태 확인
    if (!authorizedData.isActive) {
      console.warn(`비활성화된 계정: ${userHash.substring(0, 8)}...`);
      return res.status(403).json({
        success: false,
        // TODO: 비활성화가 아니라 1회차 끝난? 승인 전인? 용도로 사용할 것
        message: "비활성화된 계정입니다. 관리자에게 문의하세요.",
      });
    }

    // 4. 기존 userId 확인 (생성하지 않음)
    const userId = authorizedData.userId;

    console.log("승인된 사용자 데이터:", authorizedData);

    if (!userId) {
      console.log(`신규 사용자 - userId 없음 (동의 미완료)`);
      // lastLogin만 업데이트 (userId 생성하지 않음)
      await updateDocByIdAdmin(registeredUserCollectionName, userHash, {
        lastLogin: FieldValue.serverTimestamp(),
        loginAttempts: 0,
      });
    } else {
      console.log(`기존 사용자 - userId 있음: ${userId}`);
      // 기존 userId 있으면 lastLogin만 업데이트
      await updateDocByIdAdmin(registeredUserCollectionName, userHash, {
        lastLogin: FieldValue.serverTimestamp(),
        loginAttempts: 0,
      });
    }

    // 5. 기존 사용자 판단: authV2의 userId 필드로 판단
    const isExistingUser = !!userId;

    let existingData: UserData | undefined;
    if (isExistingUser && userId) {
      // 기존 사용자인 경우에만 usersV2 데이터 조회
      const userData = await getDocByIdAdmin(userCollectionName, userId);
      if (userData) {
        existingData = userData as UserData;
        console.log(
          `기존 사용자 데이터 있음: completedAt=${!!existingData.completedAt}`
        );
      }
    } else {
      console.log(`신규 사용자 - 동의 필요`);
    }

    // 6. userHash를 쿠키로 설정 (PATCH 요청시 필요)
    const cookie = serialize("userHash", userHash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 24시간
      path: "/",
    });

    res.setHeader("Set-Cookie", cookie);

    // 7. 성공 응답
    const { maskedName } = maskPersonalInfo(cleanName, cleanSocialNumber);
    console.log(
      `등록된 사용자 인증 성공: ${maskedName}, userId: ${userId}, 방식: hash-based`
    );

    return res.status(200).json({
      success: true,
      message: "등록된 사용자 인증 성공 (해시 기반)",
      method: "hash-based", // 구분을 위한 필드
      user: {
        name: cleanName, // 클라이언트에서 필요한 실제 이름
        userId: userId,
        isExistingUser: isExistingUser,
        userHash: userHash, // userHash도 함께 반환
        ...(isExistingUser && { existingData }),
      },
    });
  } catch (error) {
    console.error("해시 기반 인증 중 오류:", error);

    // 에러 타입별 분기 처리
    if (error instanceof Error) {
      if (error.message.includes("permission-denied")) {
        return res.status(403).json({
          success: false,
          message: "데이터베이스 접근 권한이 없습니다.",
        });
      }

      if (error.message.includes("unavailable")) {
        return res.status(503).json({
          success: false,
          message:
            "서비스가 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해주세요.",
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
