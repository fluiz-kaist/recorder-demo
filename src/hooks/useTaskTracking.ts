// hooks/useTaskTracking.ts
import { useEffect, useRef, useCallback } from "react";
import {
  TaskTrackingManager,
  LocalTaskTrackingData,
  TaskTrackingStorageKey,
  TASK_TRACKING_CONSTANTS,
} from "@/types/taskTrack";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { saveDoc } from "@/lib/firebase/firestore";
const trackingCollectionName =
  process.env.NEXT_PUBLIC_DB_TRACKING_COLLECTION || "tracking-temp";

/**
 * TaskTrackingManager 구현체 - 최적화된 버전
 */
class TaskTrackingManagerImpl implements TaskTrackingManager {
  private currentTrackingKey: TaskTrackingStorageKey | null = null;
  private lastTrackingKey: string | null = null; // 중복 방지용

  private createStorageKey(
    userId: string,
    roundNumber: number,
    taskKey: string,
    taskType: "formal" | "situational"
  ): TaskTrackingStorageKey {
    return `taskTracking_${userId}_${roundNumber}_${taskKey}_${taskType}` as TaskTrackingStorageKey;
  }

  private getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  startTracking(
    userId: string,
    roundNumber: number,
    taskKey: string,
    taskType: "formal" | "situational",
    userProfile: { ageGroup: string; gender: "남성" | "여성" }
  ): void {
    const storageKey = this.createStorageKey(
      userId,
      roundNumber,
      taskKey,
      taskType
    );
    const trackingId = `${taskKey}_${taskType}`;

    //  중복 추적 방지
    if (this.lastTrackingKey === trackingId) {
      console.log(" 중복 추적 방지:", trackingId);
      return;
    }

    // 이미 진행 중인 추적이 있다면 종료
    if (this.currentTrackingKey) {
      this.endTracking("navigation");
    }

    const trackingData: LocalTaskTrackingData = {
      userId,
      roundNumber,
      taskKey,
      taskType,
      pageEnteredAt: Date.now(),
      userProfile,
      deviceInfo: this.getDeviceInfo(),
      isSubmitted: false,
    };

    localStorage.setItem(storageKey, JSON.stringify(trackingData));
    this.currentTrackingKey = storageKey;
    this.lastTrackingKey = trackingId;

    console.log("추적 시작:", { storageKey, taskKey, taskType });
  }

  endTracking(exitMethod: string): void {
    if (!this.currentTrackingKey) return;

    const existingData = localStorage.getItem(this.currentTrackingKey);
    if (!existingData) return;

    try {
      const trackingData: LocalTaskTrackingData = JSON.parse(existingData);
      const now = Date.now();
      const duration = now - trackingData.pageEnteredAt;

      //  너무 짧은 세션은 무시 (1초 미만)
      if (duration < 1000) {
        console.log("세션이 너무 짧아서 무시:", duration, "ms");
        localStorage.removeItem(this.currentTrackingKey);
        this.currentTrackingKey = null;
        return;
      }

      trackingData.pageExitedAt = now;
      trackingData.exitMethod = exitMethod;

      localStorage.setItem(
        this.currentTrackingKey,
        JSON.stringify(trackingData)
      );

      console.log("추적 종료:", {
        key: this.currentTrackingKey,
        exitMethod,
        duration: duration,
      });

      this.currentTrackingKey = null;
    } catch (error) {
      console.error("추적 종료 중 오류:", error);
    }
  }

  // 현재 추적 중인지 확인
  isCurrentlyTracking(taskKey: string, taskType: string): boolean {
    const trackingId = `${taskKey}_${taskType}`;
    return this.lastTrackingKey === trackingId;
  }

  getCurrentTracking(): LocalTaskTrackingData | null {
    if (!this.currentTrackingKey) return null;

    const data = localStorage.getItem(this.currentTrackingKey);
    return data ? JSON.parse(data) : null;
  }

  getPendingSubmissions(): LocalTaskTrackingData[] {
    const pendingData: LocalTaskTrackingData[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(TASK_TRACKING_CONSTANTS.STORAGE_PREFIX)) {
        try {
          const data: LocalTaskTrackingData = JSON.parse(
            localStorage.getItem(key)!
          );
          if (!data.isSubmitted && data.pageExitedAt) {
            // 종료된 세션만
            pendingData.push(data);
          }
        } catch (error) {
          console.error("로컬 데이터 파싱 오류:", key, error);
        }
      }
    }

    return pendingData;
  }

  async submitToServer(trackingData: LocalTaskTrackingData): Promise<void> {
    const duration = trackingData.pageExitedAt
      ? trackingData.pageExitedAt - trackingData.pageEnteredAt
      : undefined;

    // 너무 짧거나 긴 세션은 필터링
    if (
      duration &&
      (duration < TASK_TRACKING_CONSTANTS.MIN_VALID_DURATION * 1000 ||
        duration > TASK_TRACKING_CONSTANTS.MAX_VALID_DURATION * 1000)
    ) {
      console.warn("비정상적인 세션 시간:", duration / 1000, "초");
      return; // 제출하지 않음
    }

    const taskId = `${trackingData.taskType}_${trackingData.taskKey}`;
    const customDocId = `${taskId}_${trackingData.userId}_${Date.now()}`;

    const firestoreData = {
      userId: trackingData.userId,
      roundNumber: trackingData.roundNumber,
      taskKey: trackingData.taskKey,
      taskType: trackingData.taskType,
      taskId: taskId,
      pageEnteredAt: new Date(trackingData.pageEnteredAt).toISOString(),
      pageExitedAt: trackingData.pageExitedAt
        ? new Date(trackingData.pageExitedAt).toISOString()
        : null,
      totalDuration: duration ? Math.round(duration / 1000) : null,
      exitMethod: trackingData.exitMethod || "unknown",
      userProfile: trackingData.userProfile,
      deviceInfo: trackingData.deviceInfo,
      submittedAt: serverTimestamp(),
      clientTimestamp: Date.now(),
    };

    try {
      await saveDoc(trackingCollectionName, customDocId, firestoreData);
      console.log("✅ 추적 데이터 제출 완료:");

      // 제출 성공 시 즉시 로컬에서 삭제
      const storageKey = this.createStorageKey(
        trackingData.userId,
        trackingData.roundNumber,
        trackingData.taskKey,
        trackingData.taskType
      );
      localStorage.removeItem(storageKey);
      console.log("로컬 데이터 삭제:", storageKey);
    } catch (error) {
      console.error("❌ 추적 데이터 제출 실패:", error);
      throw error;
    }
  }

  async submitAllPending(): Promise<any> {
    const pendingData = this.getPendingSubmissions();

    if (pendingData.length === 0) {
      return { userId: "", submissions: [], submittedAt: "", totalCount: 0 };
    }

    const submissions = [];
    for (const data of pendingData) {
      try {
        await this.submitToServer(data);
        this.markAsSubmitted(
          this.createStorageKey(
            data.userId,
            data.roundNumber,
            data.taskKey,
            data.taskType
          )
        );
        submissions.push(data);
      } catch (error) {
        console.error("개별 제출 실패:", data.taskKey, error);
      }
    }

    return {
      userId: pendingData[0]?.userId || "",
      submissions,
      submittedAt: new Date().toISOString(),
      totalCount: submissions.length,
    };
  }

  markAsSubmitted(trackingKey: TaskTrackingStorageKey): void {
    const data = localStorage.getItem(trackingKey);
    if (data) {
      try {
        const trackingData: LocalTaskTrackingData = JSON.parse(data);
        trackingData.isSubmitted = true;
        localStorage.setItem(trackingKey, JSON.stringify(trackingData));
      } catch (error) {
        console.error("제출 완료 표시 실패:", error);
      }
    }
  }

  cleanupSubmittedData(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(TASK_TRACKING_CONSTANTS.STORAGE_PREFIX)) {
        try {
          const data: LocalTaskTrackingData = JSON.parse(
            localStorage.getItem(key)!
          );
          if (data.isSubmitted) {
            const submittedAge = Date.now() - data.pageEnteredAt;
            const maxAge =
              TASK_TRACKING_CONSTANTS.CLEANUP_AFTER_DAYS * 24 * 60 * 60 * 1000;

            if (submittedAge > maxAge) {
              keysToRemove.push(key);
            }
          }
        } catch (error) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));

    if (keysToRemove.length > 0) {
      console.log("🧹 정리된 추적 데이터:", keysToRemove.length, "개");
    }
  }
}

/**
 * 작업 추적 커스텀 훅 - 최적화된 버전
 */
export const useTaskTracking = (
  userId?: string | null,
  roundNumber?: number,
  userProfile?: { ageGroup: string; gender: "남성" | "여성" }
) => {
  // 환경변수로 비활성화
  const isTrackingEnabled = process.env.NEXT_PUBLIC_TRACKING_ENABLED === "true";
  const managerRef = useRef<TaskTrackingManagerImpl>(
    new TaskTrackingManagerImpl()
  );
  const currentTrackingRef = useRef<string | null>(null);

  // 페이지 이탈 시 추적 종료
  useEffect(() => {
    const handleBeforeUnload = () => {
      managerRef.current.endTracking("browser_close");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        managerRef.current.endTracking("navigation");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // 주기적으로 미제출 데이터 정리 및 제출
  useEffect(() => {
    const cleanup = () => {
      managerRef.current.cleanupSubmittedData();
    };

    const interval = setInterval(cleanup, 5 * 60 * 1000); // 5분마다
    cleanup(); // 초기 실행

    return () => clearInterval(interval);
  }, []);

  // 작업 추적 시작 - 중복 방지 로직 추가
  const startTracking = useCallback(
    (taskKey: string, taskType: "formal" | "situational" | "tutorial") => {
      if (!isTrackingEnabled) {
        console.log("🚫 추적 비활성화됨 (환경변수)");
        return;
      }

      if (taskType === "tutorial") {
        console.warn("튜토리얼, 추적 하지 않음");
        return;
      }
      if (!userId || !roundNumber || !userProfile) {
        console.warn("추적 시작 실패: 필수 정보 누락");
        return;
      }

      const trackingId = `${taskKey}_${taskType}`;

      // 🚫 이미 같은 작업을 추적 중이면 무시
      if (managerRef.current.isCurrentlyTracking(taskKey, taskType)) {
        console.log("🚫 이미 추적 중인 작업:", trackingId);
        return;
      }

      // 이전 추적 종료
      if (
        currentTrackingRef.current &&
        currentTrackingRef.current !== trackingId
      ) {
        managerRef.current.endTracking("navigation");
      }

      managerRef.current.startTracking(
        userId,
        roundNumber,
        taskKey,
        taskType,
        userProfile
      );

      currentTrackingRef.current = trackingId;
    },
    [userId, roundNumber, userProfile]
  );

  // 작업 추적 종료
  const endTracking = useCallback((exitMethod = "next_button") => {
    managerRef.current.endTracking(exitMethod);
    currentTrackingRef.current = null;
  }, []);

  // 미제출 데이터 제출
  const submitPendingData = useCallback(async () => {
    if (!isTrackingEnabled) {
      return { userId: "", submissions: [], submittedAt: "", totalCount: 0 };
    }
    try {
      const result = await managerRef.current.submitAllPending();
      console.log("📤 일괄 제출 완료:", result.totalCount, "개");
      return result;
    } catch (error) {
      console.error("일괄 제출 실패:", error);
      throw error;
    }
  }, [isTrackingEnabled]);

  const clearAllTrackingData = useCallback(() => {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(TASK_TRACKING_CONSTANTS.STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    console.log("모든 추적 데이터 삭제:", keysToRemove.length, "개");
  }, []);

  return {
    startTracking,
    endTracking,
    submitPendingData,
    clearAllTrackingData,
    manager: managerRef.current,
  };
};
