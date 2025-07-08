// pages/api/admin/users.ts - 관리자 사용자 목록 API
import { NextApiRequest, NextApiResponse } from "next";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { User } from "@/types/firebase";

interface AdminUsersResponse {
  success: boolean;
  message?: string;
  users: User[];
  totalCount: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminUsersResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
      users: [],
      totalCount: 0,
    });
  }

  try {
    console.log("👥 관리자 사용자 목록 조회 시작");

    // 쿼리 파라미터
    const {
      page = "1",
      limit = "50",
      sortBy = "createdAt",
      sortOrder = "desc",
      ageGroup,
      gender,
      hasAssignments,
    } = req.query;

    // 기본 쿼리 생성
    const usersCollection = collection(db, "users");
    let usersQuery = query(usersCollection);

    // 정렬 적용
    if (sortBy === "createdAt" || sortBy === "lastAccessAt") {
      usersQuery = query(
        usersCollection,
        orderBy(sortBy as string, sortOrder as "asc" | "desc")
      );
    }

    // 모든 사용자 데이터 조회
    const usersSnapshot = await getDocs(usersQuery);
    let users = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as User[];

    console.log(`📊 조회된 총 사용자 수: ${users.length}`);

    // 클라이언트 사이드 필터링 (Firestore 쿼리 제한 때문)
    if (ageGroup && typeof ageGroup === "string") {
      users = users.filter((user) => user.ageGroup === ageGroup);
    }

    if (gender && typeof gender === "string") {
      users = users.filter((user) => user.gender === gender);
    }

    if (hasAssignments === "true") {
      users = users.filter(
        (user) => user.scriptAssignments && user.scriptAssignments.length > 0
      );
    } else if (hasAssignments === "false") {
      users = users.filter(
        (user) => !user.scriptAssignments || user.scriptAssignments.length === 0
      );
    }

    const totalCount = users.length;

    // 페이지네이션 적용
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedUsers = users.slice(startIndex, endIndex);

    console.log(
      `📄 페이지 ${pageNum}: ${paginatedUsers.length}명 반환 (전체 ${totalCount}명)`
    );

    return res.status(200).json({
      success: true,
      users: paginatedUsers,
      totalCount,
    });
  } catch (error) {
    console.error("❌ 관리자 사용자 목록 조회 실패:", error);
    return res.status(500).json({
      success: false,
      message: "사용자 목록 조회에 실패했습니다.",
      users: [],
      totalCount: 0,
    });
  }
}
