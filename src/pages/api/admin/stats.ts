// pages/api/admin/stats.ts - 관리자 전체 통계 API
import { NextApiRequest, NextApiResponse } from "next";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { User, AudioRecording } from "@/types/firebase";

interface AdminStatsResponse {
  success: boolean;
  message?: string;
  stats: {
    totalUsers: number;
    totalRecordings: number;
    totalCompletedScripts: number;
    averageProgress: number;
    usersByAgeGroup: { [ageGroup: string]: number };
    usersByGender: { [gender: string]: number };
    recordingsByDate: { date: string; count: number }[];
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminStatsResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
      stats: {
        totalUsers: 0,
        totalRecordings: 0,
        totalCompletedScripts: 0,
        averageProgress: 0,
        usersByAgeGroup: {},
        usersByGender: {},
        recordingsByDate: [],
      },
    });
  }

  try {
    console.log("📊 관리자 통계 조회 시작");

    // 1. 모든 사용자 데이터 조회
    const usersCollection = collection(db, "users");
    const usersSnapshot = await getDocs(usersCollection);
    const users = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as User[];

    console.log(`👥 총 사용자 수: ${users.length}`);

    // 2. 모든 오디오 녹음 데이터 조회
    const audioCollection = collection(db, "audioRecordings");
    const audioSnapshot = await getDocs(audioCollection);
    const recordings = audioSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AudioRecording[];

    console.log(`🎙️ 총 녹음 수: ${recordings.length}`);

    // 3. 통계 계산
    const stats = calculateAdminStats(users, recordings);

    console.log("✅ 관리자 통계 계산 완료");

    return res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("❌ 관리자 통계 조회 실패:", error);
    return res.status(500).json({
      success: false,
      message: "통계 데이터 조회에 실패했습니다.",
      stats: {
        totalUsers: 0,
        totalRecordings: 0,
        totalCompletedScripts: 0,
        averageProgress: 0,
        usersByAgeGroup: {},
        usersByGender: {},
        recordingsByDate: [],
      },
    });
  }
}

function calculateAdminStats(users: User[], recordings: AudioRecording[]) {
  // 기본 통계
  const totalUsers = users.length;
  const totalRecordings = recordings.length;

  // 완료된 스크립트 수 계산
  const totalCompletedScripts = users.reduce((total, user) => {
    if (!user.scriptAssignments) return total;
    return (
      total +
      user.scriptAssignments.reduce((userTotal, assignment) => {
        return userTotal + assignment.completedScriptIds.length;
      }, 0)
    );
  }, 0);

  // 평균 진행률 계산
  const userProgresses = users.map((user) => {
    if (!user.scriptAssignments || user.scriptAssignments.length === 0)
      return 0;

    const totalAssigned = user.scriptAssignments.reduce(
      (sum, assignment) => sum + assignment.assignedScriptIds.length,
      0
    );
    const totalCompleted = user.scriptAssignments.reduce(
      (sum, assignment) => sum + assignment.completedScriptIds.length,
      0
    );

    return totalAssigned > 0 ? (totalCompleted / totalAssigned) * 100 : 0;
  });

  const averageProgress =
    userProgresses.length > 0
      ? Math.round(
          userProgresses.reduce((sum, progress) => sum + progress, 0) /
            userProgresses.length
        )
      : 0;

  // 연령대별 사용자 분포
  const usersByAgeGroup = users.reduce((acc, user) => {
    acc[user.ageGroup] = (acc[user.ageGroup] || 0) + 1;
    return acc;
  }, {} as { [ageGroup: string]: number });

  // 성별 사용자 분포
  const usersByGender = users.reduce((acc, user) => {
    acc[user.gender] = (acc[user.gender] || 0) + 1;
    return acc;
  }, {} as { [gender: string]: number });

  // 날짜별 녹음 수 (최근 7일)
  const recordingsByDate = calculateRecordingsByDate(recordings);

  return {
    totalUsers,
    totalRecordings,
    totalCompletedScripts,
    averageProgress,
    usersByAgeGroup,
    usersByGender,
    recordingsByDate,
  };
}

function calculateRecordingsByDate(recordings: AudioRecording[]) {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split("T")[0]; // YYYY-MM-DD 형식
  }).reverse();

  const recordingCounts = recordings.reduce((acc, recording) => {
    const recordingDate = new Date(recording.recordedAt)
      .toISOString()
      .split("T")[0];
    acc[recordingDate] = (acc[recordingDate] || 0) + 1;
    return acc;
  }, {} as { [date: string]: number });

  return last7Days.map((date) => ({
    date,
    count: recordingCounts[date] || 0,
  }));
}
