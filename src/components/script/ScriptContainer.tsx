// components/script/ScriptContainer.tsx - 리팩터링 버전 (상황→정형 순차 진행)
import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/ScriptRecording.module.css";
import VoiceRecorder from "@/components/voiceRecorder";
import { ScriptType, SituationalScript, FormalScript } from "@/types/firebase";
import {
  useMinimalUserQuery,
  useUserQuery,
  useAuthStatusQuery,
} from "@/hooks/queries/useUserQueries";
import { ScriptRenderer } from "@/components/script/ScriptRenderer";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { getNextServiceSlug, ServiceName } from "@/lib/serviceMapping";
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
  const router = useRouter();
  const [scriptIndex, setScriptIndex] = useState(0);
  const [showRecorder, setShowRecorder] = useState(false);
  const [reRecordingScripts, setReRecordingScripts] = useState<Set<string>>(
    new Set()
  );
  const { data: authStatus } = useAuthStatusQuery();
  const { data: minimalUser } = useMinimalUserQuery();
  // ✅ 수정: 명시적으로 userId 전달
  // ScriptContainer.tsx에서
  const { data: fullUser, isLoading: isUserLoading } = useUserQuery(
    authStatus?.userId
  );

  // 🔥 fullUser 상태 확인
  useEffect(() => {
    console.log("🔍 fullUser 전체 구조:", {
      fullUser: fullUser,
      participation: fullUser?.participation,
      sets: fullUser?.participation?.sets,
      "sets 타입": typeof fullUser?.participation?.sets,
      "sets 길이": fullUser?.participation?.sets?.length,
    });
  }, [fullUser]);
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

  const current = flatScriptList[scriptIndex];

  // 🎯 핵심 함수: 실제 tasks 배열에서 직접 상태 확인
  const isScriptCompleted = (script: AnyScript, type: ScriptType): boolean => {
    if (!fullUser?.participation?.sets?.[0]) {
      return false;
    }

    const set = fullUser.participation.sets[0];

    // task_key 우선, 없으면 id 사용
    const taskKey = String(
      "task_key" in script && script.task_key
        ? script.task_key
        : "id" in script && script.id
        ? script.id
        : ""
    );

    if (!taskKey) {
      console.warn("⚠️ taskKey를 찾을 수 없음:", script);
      return false;
    }

    // 해당 타입의 tasks 배열에서 직접 찾기
    const tasks =
      type === ScriptType.SITUATIONAL
        ? set.tasks?.situational || []
        : set.tasks?.formal || [];

    // 매칭되는 task 찾기
    const matchedTask = tasks.find((task) => String(task.taskKey) === taskKey);

    if (!matchedTask) {
      console.log(`❌ [${type}] Task not found: ${taskKey}`);
      console.log(
        "Available tasks:",
        tasks.map((t) => t.taskKey)
      );
      return false;
    }

    // 완료 상태 체크
    const completedStatuses = ["completed", "submitted", "approved"];
    const isCompleted = completedStatuses.includes(matchedTask.status || "");

    console.log(`🎯 [${type}] ${taskKey}:`, {
      status: matchedTask.status,
      isCompleted,
      hasAudioRecord: !!matchedTask.audioRecordId,
    });

    return isCompleted;
  };

  // 전체 진행률 계산 (실제 tasks 배열 기반)
  const getProgressPercentage = (): number => {
    if (!fullUser?.participation?.sets?.[0] || flatScriptList.length === 0) {
      return 0;
    }

    const completedCount = flatScriptList.filter(({ script, type }) =>
      isScriptCompleted(script, type)
    ).length;

    const percentage = Math.round(
      (completedCount / flatScriptList.length) * 100
    );

    console.log(
      `📊 Progress: ${completedCount}/${flatScriptList.length} = ${percentage}%`
    );

    return percentage;
  };

  // 로딩 상태 처리
  if (isUserLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>사용자 데이터 로딩 중...</div>
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

  const completed = isScriptCompleted(current.script, current.type);
  // 🔥 이 부분 추가 - 상태 변화 모니터링

  console.log("🔍 상세 디버깅:", {
    authStatus: authStatus,
    "authStatus?.isAuthenticated": authStatus?.isAuthenticated,
    "authStatus?.userId": authStatus?.userId,
    "!!authStatus?.userId": !!authStatus?.userId,
    "useUserQuery enabled 조건":
      !!authStatus?.isAuthenticated && !!authStatus?.userId,
  });
  // 2. ✅ 함수 추가 (isScriptCompleted 함수 아래에)
  const handleStartReRecording = () => {
    const taskKey = String(
      "task_key" in current.script && current.script.task_key
        ? current.script.task_key
        : "id" in current.script && current.script.id
        ? current.script.id
        : ""
    );

    const scriptKey = `${current.type}-${taskKey}`;
    setReRecordingScripts((prev) => new Set(prev.add(scriptKey)));
  };

  const handleRecordingComplete = () => {
    const taskKey = String(
      "task_key" in current.script && current.script.task_key
        ? current.script.task_key
        : "id" in current.script && current.script.id
        ? current.script.id
        : ""
    );

    const scriptKey = `${current.type}-${taskKey}`;
    setReRecordingScripts((prev) => {
      const newSet = new Set(prev);
      newSet.delete(scriptKey);
      return newSet;
    });
    setShowRecorder(false);
  };

  // 3. ✅ 재녹음 모드 확인 함수 추가
  const isInReRecordingMode = (): boolean => {
    const taskKey = String(
      "task_key" in current.script && current.script.task_key
        ? current.script.task_key
        : "id" in current.script && current.script.id
        ? current.script.id
        : ""
    );

    const scriptKey = `${current.type}-${taskKey}`;
    return reRecordingScripts.has(scriptKey);
  };

  // 🎯 다음 버튼 활성화 조건 함수
  const canGoToNext = (): boolean => {
    // 마지막 스크립트면 항상 비활성화
    if (scriptIndex === flatScriptList.length - 1) {
      return false;
    }

    // 현재 스크립트가 완료되지 않았으면 다음으로 못감
    const currentCompleted = isScriptCompleted(current.script, current.type);

    if (!currentCompleted) {
      return false;
    }

    return true;
  };

  // 디버깅용 로그
  console.log("🔍 현재 스크립트 정보:", {
    index: scriptIndex,
    taskKey: current.script.task_key || current.script.id,
    type: current.type,
    completed,
  });

  const handleNextScript = () => {
    if (scriptIndex < flatScriptList.length - 1) {
      setScriptIndex((prev) => prev + 1);
      setShowRecorder(false);
      scrollToTop();
    }
  };

  const handlePrevScript = () => {
    if (scriptIndex > 0) {
      setScriptIndex((prev) => prev - 1);
      setShowRecorder(false);
      scrollToTop();
    }
  };

  const goBack = () => router.push("/");

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

          {/* ✅ 마지막 스크립트이고 완료 상태일 때, 다음 주제로 바로가기 버튼 표시 */}
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
                    onClick={() => router.push(`/recording/${nextSlug}`)}
                  >
                    다음 주제 녹음하러 가기
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.congratulationsMessage}>
                    <h3>모든 녹음을 완료했습니다!</h3>
                    <p>수고하셨습니다.</p>
                  </div>
                </>
              ); // 마지막 서비스일 경우 버튼 없음
            })()}

          {/*  진행 안내 메시지 추가 */}
          {!completed && (
            <div className={styles.progressHint}>
              {/* <div className={styles.hintIcon}>📝</div> */}
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
