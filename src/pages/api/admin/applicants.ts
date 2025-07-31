// pages/api/admin/applicants.ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { AuthorizedUserData } from "@/types/user";

interface ApplicantsResponse {
  success: boolean;
  data?: {
    applicants: (AuthorizedUserData & { isRegistered: boolean })[];
    totalCount: number;
    statistics: {
      totalApplicants: number;
      registeredCount: number;
      unregisteredCount: number;
      registrationRate: number;
    };
  };
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApplicantsResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  // Firestore 컬렉션 이름 설정
  const applicantsCollection =
    process.env.NEXT_PUBLIC_DB_WHITELIST_USERS_COLLECTION || "whitelist-temp";

  try {
    // 관리자 토큰 확인
    const adminToken = req.cookies["admin-token"];
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        message: "관리자 권한이 필요합니다.",
      });
    }

    // 쿼리 파라미터 추출
    const {
      search,
      registered, // 'true', 'false', 또는 undefined
      isActive, // 'true', 'false', 또는 undefined
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // 1. 신청자 목록 조회 (whitelist 컬렉션)
    const validSortFields = ["createdAt", "lastLogin", "name"];
    const sortField = validSortFields.includes(sortBy as string)
      ? (sortBy as string)
      : "createdAt";

    // 쿼리 빌드
    // Firestore에서 orderBy()를 호출하면 Query 타입이 반환되는데, 이를 변수에 재할당하려고 할 때 타입 충돌이 발생함
    const applicantsQuery = adminDb
      .collection(applicantsCollection)
      .orderBy(sortField, sortOrder as "asc" | "desc");

    const applicantsSnapshot = await applicantsQuery.get();

    // 2. 신청자 데이터 처리 및 등록 여부 판단
    let applicants = applicantsSnapshot.docs.map((doc) => {
      const data = doc.data() as Partial<AuthorizedUserData>;
      const applicant = {
        id: doc.id,
        userHash: data.userHash ?? "",
        createdAt: data.createdAt ?? "",
        isActive: data.isActive ?? false,
        name: data.name ?? "",
        lastLogin: data.lastLogin,
        loginAttempts: data.loginAttempts,
        source: data.source,
        userId: data.userId,
        isRegistered: !!data.userId, // userId가 있으면 등록된 것으로 판단
      };
      return applicant;
    });

    // lastLogin으로 정렬했지만 null 값들도 포함해서 다시 정렬
    if (sortField === "lastLogin") {
      applicants.sort((a, b) => {
        const aLogin = a.lastLogin;
        const bLogin = b.lastLogin;

        // null 값은 마지막으로
        if (!aLogin && !bLogin) return 0;
        if (!aLogin) return 1;
        if (!bLogin) return -1;

        const comparison = aLogin.localeCompare(bLogin);
        return sortOrder === "desc" ? -comparison : comparison;
      });
    }

    // 3. 검색 필터링 (이름 기준)
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      applicants = applicants.filter((applicant) =>
        applicant.name.toLowerCase().includes(searchTerm)
      );
    }

    // 4. isActive 필터링
    if (isActive === "true") {
      applicants = applicants.filter((a) => a.isActive);
    } else if (isActive === "false") {
      applicants = applicants.filter((a) => !a.isActive);
    }

    // 5. 등록 여부 필터링
    if (registered === "true") {
      applicants = applicants.filter((a) => a.isRegistered);
    } else if (registered === "false") {
      applicants = applicants.filter((a) => !a.isRegistered);
    }

    // 6. 통계 계산 (필터링 전 전체 데이터 기준)
    const allApplicants = applicantsSnapshot.docs.map((doc) => {
      const data = doc.data() as Partial<AuthorizedUserData>;
      return {
        isRegistered: !!data.userId,
      };
    });

    const totalApplicants = allApplicants.length;
    const registeredCount = allApplicants.filter((a) => a.isRegistered).length;
    const unregisteredCount = totalApplicants - registeredCount;
    const registrationRate =
      totalApplicants > 0
        ? Math.round((registeredCount / totalApplicants) * 100)
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        applicants,
        totalCount: applicants.length,
        statistics: {
          totalApplicants,
          registeredCount,
          unregisteredCount,
          registrationRate,
        },
      },
    });
  } catch (error) {
    console.error("신청자 목록 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
