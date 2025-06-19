// hooks/useScripts.ts - 클라이언트에서 사용할 훅
import { useState, useEffect } from "react";
import {
  SituationalScript,
  FormalScript,
  QAScenarioScript,
  UserProgress,
} from "../types/firebase";

interface AssignedScripts {
  situational: SituationalScript[];
  formal: FormalScript[];
  qaScenario: QAScenarioScript[];
}

export const useScripts = () => {
  const [userId, setUserId] = useState<string>("");
  const [scripts, setScripts] = useState<AssignedScripts>({
    situational: [],
    formal: [],
    qaScenario: [],
  });
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // 사용자 ID 가져오기 (index.tsx에서 설정한 것과 동일한 ID 사용)
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  // 스크립트 할당받기
  const assignScripts = async (targetUserId?: string) => {
    console.log("assignScripts 받은 매개변수:", targetUserId);
    console.log("assignScripts 내부 userId 상태:", userId);
    const effectiveUserId = targetUserId || userId;
    console.log("최종 사용할 userId:", effectiveUserId);

    if (!effectiveUserId) {
      setError("사용자 ID가 없습니다.");
      return;
    }
    console.log("assignScripts 시작: userId =", userId);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/scripts/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: effectiveUserId }),
      });

      console.log("응답 상태코드:", response.status);

      const data = await response.json();
      console.log("응답 데이터:", data);

      if (data.success) {
        setScripts(data.scripts);
        localStorage.setItem("assignedScripts", JSON.stringify(data.scripts));
        console.log("스크립트 저장 완료:", data.scripts);
      } else {
        setError(data.message || "스크립트 할당에 실패했습니다.");
        console.warn("스크립트 할당 실패:", data.message);
      }
    } catch (err) {
      setError("네트워크 오류가 발생했습니다.");
      console.error("Script assignment error:", err);
    } finally {
      setLoading(false);
      console.log("assignScripts 종료");
    }
  };

  // 사용자 진도 가져오기
  const getUserProgress = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/users/${userId}/progress`);
      const data = await response.json();

      if (data.success) {
        setProgress(data.progress || []);
      }
    } catch (err) {
      console.error("Progress fetch error:", err);
    }
  };

  // 스크립트 완료 처리
  const completeScript = async (
    scriptId: string,
    scriptType: "situational" | "formal" | "qaScenario",
    audioUrl: string,
    sttText: string
  ) => {
    if (!userId) return false;

    try {
      const response = await fetch("/api/scripts/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          scriptId,
          scriptType,
          audioUrl,
          sttText,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 로컬 상태 업데이트
        setProgress((prev) =>
          prev.map((p) =>
            p.scriptId === scriptId
              ? {
                  ...p,
                  status: "completed",
                  audioUrl,
                  sttText,
                  recordedAt: new Date(),
                }
              : p
          )
        );
        return true;
      } else {
        setError(data.message || "완료 처리에 실패했습니다.");
        return false;
      }
    } catch (err) {
      setError("네트워크 오류가 발생했습니다.");
      return false;
    }
  };

  // userId가 설정되면 캐시된 스크립트 복구 및 진도 가져오기
  useEffect(() => {
    if (userId) {
      // 캐시된 스크립트 복구
      const cachedScripts = localStorage.getItem("assignedScripts");
      if (cachedScripts) {
        try {
          setScripts(JSON.parse(cachedScripts));
        } catch (err) {
          console.error("Failed to parse cached scripts:", err);
        }
      }

      // 진도 가져오기
      getUserProgress();
    }
  }, [userId]);

  // 스크립트가 할당되었는지 확인
  const hasAssignedScripts = () => {
    return (
      scripts.situational.length > 0 ||
      scripts.formal.length > 0 ||
      scripts.qaScenario.length > 0
    );
  };

  return {
    userId,
    scripts,
    progress,
    loading,
    error,
    assignScripts,
    getUserProgress,
    completeScript,
    hasAssignedScripts,
  };
};
