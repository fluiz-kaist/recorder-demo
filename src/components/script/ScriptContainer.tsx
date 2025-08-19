// components/script/ScriptContainer.tsx - 작업 추적 통합 버전
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/ScriptRecording.module.css";
import VoiceRecorder from "@/components/voiceRecorder";
import { ScriptType, SituationalScript, FormalScript } from "@/types/firebase";
import {
  useMinimalUserQuery,
  useUserQuery,
  useAuthStatusQuery,
  useCurrentRoundQuery,
} from "@/hooks/queries/useUserQueries";
import { ScriptRenderer } from "@/components/script/ScriptRenderer";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { getNextServiceSlug, ServiceName } from "@/lib/serviceMapping";
import { User, ParticipationRound, Task, TaskStatus } from "@/types/user";
import { useTaskTracking } from "@/hooks/useTaskTracking";
import CompletionAllTasksBtn from "@/components/CompletionAllTasksBtn";
import { getUniqueKey } from "@/utils/createUniqKeyForTaskKey";
export interface MergedScript {
  scriptType: "situational" | "formal";
  situation?: SituationalScript;
  formal?: FormalScript[];
}

type AnyScript = SituationalScript | FormalScript;

interface FlatScript {
  script: AnyScript;
  type: ScriptType;
}

interface ScriptContainerProps {
  scripts: MergedScript[];
}

export const ScriptContainer: React.FC<ScriptContainerProps> = ({
  scripts,
}) => {
  console.log("컨테이너에서 받은 스크립트", scripts);
  const router = useRouter();
  const [scriptIndex, setScriptIndex] = useState<number | undefined>(undefined);
  const [showRecorder, setShowRecorder] = useState(false);
  const [reRecordingScripts, setReRecordingScripts] = useState<Set<string>>(
    new Set()
  );

  const { data: authStatus } = useAuthStatusQuery();
  const { data: fullUser, isLoading: isUserLoading } = useUserQuery(
    authStatus?.userId
  );
  const currentRoundNumber = fullUser?.currentStatus?.currentRoundNumber || 0;
  const { data: currentRound, isLoading: isRoundLoading } =
    useCurrentRoundQuery(authStatus?.userId, currentRoundNumber);

  // 작업 추적 훅 초기화
  const { startTracking, endTracking, submitPendingData } = useTaskTracking(
    authStatus?.userId || undefined,
    currentRoundNumber,
    fullUser?.profile
      ? {
          ageGroup: fullUser.profile.ageGroup,
          gender: fullUser.profile.gender,
        }
      : undefined
  );
  const scrollToTop = useScrollToTop();

  const flatScriptList: FlatScript[] = useMemo(() => {
    const list: FlatScript[] = [];
    scripts.forEach((merged) => {
      if (merged.situation) {
        list.push({ script: merged.situation, type: ScriptType.SITUATIONAL });
      }
      merged.formal?.forEach((f) => {
        list.push({ script: f, type: ScriptType.FORMAL });
      });
    });
    return list;
  }, [scripts]);

  // 통합 로딩 상태
  const isLoading =
    isUserLoading || isRoundLoading || scriptIndex === undefined;
  const isScriptCompleted = useCallback(
    (script: AnyScript, type: ScriptType): boolean => {
      const uniqueKey = getUniqueKey(script, type);
      const scriptKey = `${type}-${uniqueKey}`;

      console.group(`isScriptCompleted Debug: ${scriptKey}`);
      console.log("Unique Key:", uniqueKey);
      console.log("Type:", type);

      console.log("검사하는 script", script);

      // 재녹음 모드 체크
      if (reRecordingScripts.has(scriptKey)) {
        console.log("재녹음 모드 감지됨 → false 반환");
        console.groupEnd();
        return false;
      }

      if (!currentRound?.tasks) {
        console.log("currentRound.tasks 없음 → false 반환");
        console.groupEnd();
        return false;
      }

      const tasks =
        type === ScriptType.SITUATIONAL
          ? currentRound.tasks.situational || []
          : currentRound.tasks.formal || [];

      console.log("Tasks 개수:", tasks.length);

      // uniqueKey로 매칭
      const matchedTask = tasks.find(
        (task) => String(task.taskKey) === uniqueKey
      );

      if (!matchedTask) {
        console.log("매칭되는 task 없음 → false 반환");
        console.groupEnd();
        return false;
      }

      console.log("매칭된 Task:", matchedTask);

      const completedStatuses = [
        TaskStatus.COMPLETED,
        TaskStatus.SUBMITTED,
        TaskStatus.APPROVED,
      ];

      const result = completedStatuses.includes(matchedTask.status);
      console.log("완료 여부:", result);
      console.groupEnd();

      return result;
    },
    [currentRound?.tasks, reRecordingScripts]
  );

  // 🎯 초기 scriptIndex 설정 - 완료되지 않은 첫 번째 스크립트로 이동
  useEffect(() => {
    if (
      scriptIndex !== undefined ||
      !currentRound?.tasks ||
      flatScriptList.length === 0
    ) {
      return;
    }

    // 완료되지 않은 첫 번째 스크립트 찾기
    let targetIndex = 0;
    for (let i = 0; i < flatScriptList.length; i++) {
      const { script, type } = flatScriptList[i];
      if (!isScriptCompleted(script, type)) {
        targetIndex = i;
        break;
      }
      // 모든 스크립트가 완료된 경우 마지막 스크립트로
      if (i === flatScriptList.length - 1) {
        targetIndex = i;
      }
    }

    console.log("🎯 자동 스킵: 시작 인덱스 설정", targetIndex);
    setScriptIndex(targetIndex);
  }, [scriptIndex, currentRound?.tasks, flatScriptList, isScriptCompleted]);

  const current =
    scriptIndex !== undefined ? flatScriptList[scriptIndex] : undefined;

  //  스크립트 변경 시 추적 시작
  // 🎯 스크립트 변경 시 추적 시작 - 디바운스 적용
  useEffect(() => {
    if (
      !current ||
      !authStatus?.userId ||
      !currentRoundNumber ||
      !fullUser?.profile
    ) {
      return;
    }

    const uniqueKey = getUniqueKey(current.script, current.type);

    if (uniqueKey) {
      const timer = setTimeout(() => {
        console.log("🎯 새 스크립트 추적 시작:", {
          uniqueKey,
          type: current.type,
          index: scriptIndex,
        });

        startTracking(uniqueKey, current.type);
      }, 100);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [
    scriptIndex,
    current,
    authStatus?.userId,
    currentRoundNumber,
    fullUser?.profile,
    startTracking,
  ]);
  // 페이지 이탈 시 미제출 데이터 처리
  // useEffect(() => {
  //   const handleRouteChange = () => {
  //     endTracking("navigation");
  //     // 페이지 이동 시 미제출 데이터 백그라운드 제출
  //     submitPendingData().catch(console.error);
  //   };

  //   router.events.on("routeChangeStart", handleRouteChange);

  //   return () => {
  //     router.events.off("routeChangeStart", handleRouteChange);
  //   };
  // }, [router.events, endTracking, submitPendingData]);

  const getProgressPercentage = (): number => {
    if (flatScriptList.length === 0) {
      return 0;
    }

    const completedCount = flatScriptList.filter(({ script, type }) =>
      isScriptCompleted(script, type)
    ).length;

    return Math.round((completedCount / flatScriptList.length) * 100);
  };

  // 로딩 상태 처리
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>사용자 데이터 로딩 중...</div>
      </div>
    );
  }

  if (!currentRound) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>
          현재 작업 중인 회차가 없습니다. (작업 종료하기를 눌렀을 때 잠시 보일
          수 있습니다)
        </div>
      </div>
    );
  }

  if (flatScriptList.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>
          아직 녹음할 스크립트가 없습니다.
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>
          할당받은 과제를 초기화 하는 중...
        </div>
      </div>
    );
  }

  const completed = isScriptCompleted(current.script, current.type);

  const handleStartReRecording = () => {
    const uniqueKey = getUniqueKey(current.script, current.type);
    const scriptKey = `${current.type}-${uniqueKey}`;
    setReRecordingScripts((prev) => new Set(prev.add(scriptKey)));
  };

  const handleRecordingComplete = () => {
    const uniqueKey = getUniqueKey(current.script, current.type);
    const scriptKey = `${current.type}-${uniqueKey}`;
    setReRecordingScripts((prev) => {
      const newSet = new Set(prev);
      newSet.delete(scriptKey);
      return newSet;
    });
    setShowRecorder(false);
  };

  const isInReRecordingMode = (): boolean => {
    const uniqueKey = getUniqueKey(current.script, current.type);
    const scriptKey = `${current.type}-${uniqueKey}`;
    return reRecordingScripts.has(scriptKey);
  };

  const canGoToNext = (): boolean => {
    if (scriptIndex === flatScriptList.length - 1) {
      return false;
    }

    const currentCompleted = isScriptCompleted(current.script, current.type);

    if (!currentCompleted) {
      return false;
    }

    return true;
  };

  // 🎯 다음 스크립트로 이동 (추적 종료 및 새 추적 시작)
  const handleNextScript = () => {
    if (scriptIndex !== undefined && scriptIndex < flatScriptList.length - 1) {
      // 현재 추적 종료
      endTracking("next_button");

      // 다음 스크립트로 이동
      setScriptIndex((prev) => (prev !== undefined ? prev + 1 : 1));
      setShowRecorder(false);
      scrollToTop();

      console.log("🎯 다음 스크립트로 이동:", {
        from: scriptIndex,
        to: scriptIndex + 1,
      });
    }
  };

  // 🎯 이전 스크립트로 이동
  const handlePrevScript = () => {
    if (scriptIndex !== undefined && scriptIndex > 0) {
      // 현재 추적 종료
      endTracking("prev_button");

      // 이전 스크립트로 이동
      setScriptIndex((prev) => (prev !== undefined ? prev - 1 : 0));
      setShowRecorder(false);
      scrollToTop();

      console.log("🎯 이전 스크립트로 이동:", {
        from: scriptIndex,
        to: scriptIndex - 1,
      });
    }
  };

  //  뒤로가기 (추적 종료 및 미제출 데이터 처리)
  const goBack = async () => {
    endTracking("back_button");

    // 백그라운드에서 미제출 데이터 처리
    // try {
    //   await submitPendingData();
    // } catch (error) {
    //   console.error("뒤로가기 시 데이터 제출 실패:", error);
    // }

    router.push("/");
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <button onClick={goBack} className={styles.backButton}>
            <svg
              className={styles.backIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            뒤로가기
          </button>
          <div className={styles.headerTitle}>
            {current.script.service_name}
          </div>
          <div className={styles.progressIndicator}>
            {scriptIndex + 1} / {flatScriptList.length}
          </div>
        </div>

        <div className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>전체 진행률</span>
            <span className={styles.progressPercentage}>
              {getProgressPercentage()}%
            </span>
          </div>
          <div className={styles.progressBarTrack}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>
        </div>

        <div className={styles.mainCard}>
          <ScriptRenderer
            script={current.script}
            scriptType={current.type}
            isCompleted={completed}
          />
          <div className={styles.recordingSection}>
            {completed && !isInReRecordingMode() ? (
              <div className={styles.completedSection}>
                <div className={styles.completedIcon}>🎉</div>
                <div className={styles.completedMessage}>
                  제출을 완료했습니다!
                  <br />
                  다음으로 넘어가주세요
                </div>
                <button
                  className={styles.reRecordButton}
                  onClick={handleStartReRecording}
                >
                  다시 녹음하기
                </button>
              </div>
            ) : (
              <VoiceRecorder
                key={`voice-recorder-${scriptIndex}-${
                  isInReRecordingMode() ? "rerecord" : "normal"
                }`}
                scriptType={current.type}
                scriptData={current.script}
                isCompltedScript={completed}
                onRecordingComplete={handleRecordingComplete}
              />
            )}
          </div>

          <div className={styles.navigation}>
            <button
              onClick={handlePrevScript}
              disabled={scriptIndex === 0}
              className={`${styles.navButton} ${
                scriptIndex === 0
                  ? styles.navButtonDisabled
                  : styles.navButtonEnabled
              }`}
            >
              이전
            </button>

            <div className={styles.statsSection}>
              <div className={styles.statsLabel}>완료한 녹음</div>
              <div className={styles.statsValue}>
                {
                  flatScriptList.filter(({ script, type }) =>
                    isScriptCompleted(script, type)
                  ).length
                }{" "}
                / {flatScriptList.length}
              </div>
            </div>

            <button
              onClick={handleNextScript}
              disabled={!canGoToNext()}
              className={`${styles.navButton} ${
                !canGoToNext()
                  ? styles.navButtonDisabled
                  : styles.navButtonEnabled
              }`}
              title={
                !completed && scriptIndex < flatScriptList.length - 1
                  ? "현재 스크립트를 완료하고 제출해주세요"
                  : ""
              }
            >
              {scriptIndex === flatScriptList.length - 1 ? "완료" : "다음"}
            </button>
          </div>

          {/* 마지막 스크립트이고 완료 상태일 때, 다음 주제로 바로가기 버튼 표시 */}
          {scriptIndex === flatScriptList.length - 1 &&
            completed &&
            (() => {
              const currentService = current?.script
                ?.service_name as ServiceName;
              const nextSlug = getNextServiceSlug(currentService);
              return nextSlug ? (
                <div className={styles.nextTopicWrapper}>
                  <button
                    className={styles.nextTopicButton}
                    onClick={() => {
                      //  다음 주제로 이동 시 추적 종료
                      endTracking("next_topic");
                      // submitPendingData().catch(console.error);
                      router.push(`/recording/${nextSlug}`);
                    }}
                  >
                    다음 주제 녹음하러 가기
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.congratulationsMessage}>
                    <h3>모든 녹음을 완료했습니다!</h3>
                    <p>수고하셨습니다.</p>
                    <CompletionAllTasksBtn />
                  </div>
                </>
              );
            })()}

          {/* 진행 안내 메시지 */}
          {!completed && (
            <div className={styles.progressHint}>
              <div className={styles.hintText}>
                녹음을 완료하고 제출해야 다음으로 넘어갈 수 있습니다.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
