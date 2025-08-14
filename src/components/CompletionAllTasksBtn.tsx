import { useRouter } from "next/router";
import { useUserQuery } from "@/hooks/queries/useUserQueries";
import { useUpdateUserMutation } from "@/hooks/mutations/useUserMutations";
import { updateDocById, getDocById } from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";
import styles from "@/styles/CompletionBtn.module.css";
import { RoundStatus } from "@/types/user";
import { useTaskTracking } from "@/hooks/useTaskTracking";
// 생략된 import 부분 동일

const CompletionAllTasksBtn = () => {
  const router = useRouter();
  const { data: user } = useUserQuery();
  const updateUserMutation = useUpdateUserMutation();
  const { submitPendingData, manager } = useTaskTracking();

  const handleCompleteAndProceed = async () => {
    if (!user) return;

    try {
      const result = await submitPendingData();
      console.log(`📤 ${result.totalCount}개 제출 완료 (로컬에서 자동 삭제)`);
    } catch (error) {
      console.error(error);
      // 실패해도 조용히 넘어감
    }

    const roundProgress = user.currentStatus.currentRoundProgress;
    console.log(roundProgress.completedPercentage, user.currentStatus.nextTask);
    // const isRoundCompleted =
    //   roundProgress.completedPercentage === 100 &&
    //   user.currentStatus.nextTask === null;
    const isRoundCompleted = roundProgress.completedPercentage === 100;

    const userId = user.profile.userId;
    const currentRoundNumber = user.currentStatus.currentRoundNumber || 1;
    const collectionName =
      process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
    const now = Timestamp.now();

    if (!isRoundCompleted) {
      alert(
        `${currentRoundNumber}라운드의 모든 작업을 완료한 후에만 진행할 수 있습니다.`
      );
      return;
    }

    try {
      console.group("1. 현재 ParticipationRound 데이터 조회");
      const roundData = await getDocById(
        `${collectionName}/${userId}/rounds`,
        currentRoundNumber.toString()
      );
      console.log("roundData:", roundData);
      console.groupEnd();

      if (!roundData || !roundData.tasks) {
        alert("현재 진행 회차 정보를 불러오지 못했습니다.");
        return;
      }

      const situational = roundData.tasks.situational || [];
      const formal = roundData.tasks.formal || [];

      const totalTasks = situational.length + formal.length;
      const approvedTasks = [...situational, ...formal].filter(
        (t) => t.status === "approved"
      ).length;

      const situationalCompleted = situational.filter(
        (t: any) =>
          t.status === "completed" ||
          t.status === "submitted" ||
          t.status === "approved"
      ).length;

      const formalCompleted = formal.filter(
        (t: any) =>
          t.status === "completed" ||
          t.status === "submitted" ||
          t.status === "approved"
      ).length;

      const submittedExists = [...situational, ...formal].some(
        (t) => t.status === "submitted"
      );

      const recordingTimeSum = [...situational, ...formal].reduce(
        (acc, cur) => acc + (cur.duration || 0),
        0
      );

      console.group("2. 계산된 작업 통계");
      console.log("situationalCompleted:", situationalCompleted);
      console.log("formalCompleted:", formalCompleted);
      console.log("totalTasks:", totalTasks);
      console.log("approvedTasks:", approvedTasks);
      console.log("submittedExists:", submittedExists);
      console.log("recordingTimeSum:", recordingTimeSum);
      console.groupEnd();

      const prevSummaries: any[] = user.roundSummaries || [];

      const updatedSummary = {
        roundNumber: currentRoundNumber,
        status: RoundStatus.COMPLETED,
        completedAt: now,
        progressSummary: {
          totalTasks,
          approvedTasks,
          approvalRate:
            totalTasks > 0 ? Math.round((approvedTasks / totalTasks) * 100) : 0,
        },
      };

      const updatedSummaries = [...prevSummaries];
      const index = updatedSummaries.findIndex(
        (s) => s.roundNumber === currentRoundNumber
      );
      if (index !== -1) {
        updatedSummaries[index] = {
          ...updatedSummaries[index],
          ...updatedSummary,
        };
      } else {
        updatedSummaries.push(updatedSummary);
      }

      console.group("3. ParticipationRound 업데이트");
      await updateDocById(
        `${collectionName}/${userId}/rounds`,
        currentRoundNumber.toString(),
        {
          completedAt: now,
          status: RoundStatus.COMPLETED,
          "progress.completedTasks": formalCompleted + situationalCompleted,
          "progress.byTaskType.formal.completed": formalCompleted,
          "progress.byTaskType.situational.completed": situationalCompleted,
        }
      );
      console.log("ParticipationRound 업데이트 완료");
      console.groupEnd();

      console.group("4. 사용자 문서 업데이트");
      const userUpdates = {
        currentStatus: {
          ...user.currentStatus,
          currentRoundNumber: currentRoundNumber + 1, // 회차 번호 1 증가
          canStartRecording: false, // 녹음 시작 불가로 변경
          canStartNextRound: false, //  관리자 허가 대기
          nextTask: null,
          hasPendingApproval: submittedExists,
          currentRoundProgress: {
            completedPercentage: 0,
            submittedPercentage: 0,
            approvedPercentage: 0,
          },
        },
        statistics: {
          ...user.statistics,
          current: {
            ...user.statistics.current,

            completedTasks: formalCompleted + situationalCompleted,
            completedPercentage: 100,
            recordingTime: recordingTimeSum,
            lastUpdatedAt: now,
          },
        },
        roundSummaries: updatedSummaries,
        updatedAt: now,
      };
      console.log("업데이트할 데이터:", userUpdates);

      await updateUserMutation.mutateAsync({
        userId,
        updates: userUpdates,
      });
      console.log("사용자 문서 업데이트 완료");
      console.groupEnd();

      console.log("작업 완료, 페이지 이동 시작");
      console.log("작업 완료, 페이지 이동 시작");
      // 라운드별로 다른 페이지나 메시지 처리
      if (currentRoundNumber === 1) {
        router.push("/completion?round=1");
      } else if (currentRoundNumber === 2) {
        router.push("/completion?round=2");
      } else {
        router.push("/completion");
      }
    } catch (error) {
      console.error("완료 처리 실패:", error);
      alert("작업 완료 처리 중 오류가 발생했습니다.");
    }
  };

  return (
    <button
      onClick={handleCompleteAndProceed}
      className={styles.finishAllTasks}
    >
      <span>모든 작업 완료</span>
    </button>
  );
};

export default CompletionAllTasksBtn;
