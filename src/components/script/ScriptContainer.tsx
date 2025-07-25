// components/script/ScriptContainer.tsx - 리팩터링 버전 (상황→정형 순차 진행)
import React, { useState, useMemo } from "react";
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

  const { data: authStatus } = useAuthStatusQuery();
  const { data: minimalUser } = useMinimalUserQuery();
  const { data: fullUser } = useUserQuery();
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
  const userId = authStatus?.userId;

  const getCurrentScriptId = (script: AnyScript): string | number => {
    return "id" in script ? script.id : script.task_key;
  };

  const isScriptCompleted = (script: AnyScript, type: ScriptType): boolean => {
    if (!fullUser?.participation?.sets?.[0]) return false;
    const set = fullUser.participation.sets[0];
    const taskKey = getCurrentScriptId(script);
    const tasks =
      type === ScriptType.SITUATIONAL
        ? set.tasks.situational
        : set.tasks.formal;
    const match = tasks.find((t) => t.taskKey === taskKey);
    return ["completed", "submitted", "approved"].includes(match?.status || "");
  };

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

  const getProgressPercentage = (): number => {
    const total = flatScriptList.length;
    const completed = flatScriptList.filter(({ script, type }) =>
      isScriptCompleted(script, type)
    ).length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

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
          <div className={styles.headerTitle}>스크립트 녹음</div>
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
            <VoiceRecorder
              key={`voice-recorder-${scriptIndex}`}
              scriptType={current.type}
              scriptData={current.script}
              isCompltedScript={completed}
              onRecordingComplete={() => setShowRecorder(false)}
            />
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
              disabled={scriptIndex === flatScriptList.length - 1}
              className={`${styles.navButton} ${
                scriptIndex === flatScriptList.length - 1
                  ? styles.navButtonDisabled
                  : styles.navButtonEnabled
              }`}
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
