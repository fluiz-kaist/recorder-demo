import styles from "@/styles/AdminTaskManage.module.css";
import { useRouter } from "next/router";
import React, { useState, useEffect } from "react";

interface Task {
  id: string;
  setIndex: number;
  taskType: "situational" | "formal";
  taskIndex: number;
  taskKey: string;
  status: string;
  completedAt?: string;
  recordingId?: string;
}

interface TaskData {
  userId: string;
  totalTasks: number;
  completedTasks: number;
  tasks: Task[];
}
// 개별 태스크 카드 컴포넌트
const TaskCard = ({
  task,
  isSelected,
  onSelect,
  onStatusChange,
  loading,
}: {
  task: Task;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onStatusChange: (status: string) => void;
  loading: boolean;
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "border-green-300 bg-green-50";
      case "in_progress":
        return "border-blue-300 bg-blue-50";
      case "recording":
        return "border-yellow-300 bg-yellow-50";
      default:
        return "border-gray-300 bg-white";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="text-green-600 text-sm font-bold">✓</span>;
      case "in_progress":
        return <span className="text-blue-600 text-sm">▶</span>;
      case "recording":
        return <span className="text-yellow-600 text-sm">●</span>;
      default:
        return <span className="text-gray-600 text-sm">□</span>;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "완료됨";
      case "in_progress":
        return "진행중";
      case "recording":
        return "녹음중";
      default:
        return "시작전";
    }
  };
  const getStatusClass = () => {
    if (task.status === "completed") return styles.completed;
    if (task.status === "recording") return styles.recording;
    if (task.status === "in_progress") return styles.in_progress;
    return "";
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div
          className={`${styles.taskCard} ${getStatusClass()} ${
            isSelected ? styles.selected : ""
          }`}
        >
          <div className={styles.taskCardHeader}>
            <div className={styles.taskCardCheckboxRow}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelect(e.target.checked)}
              />
              <span>{task.status === "completed" ? "✓" : "○"}</span>
              <span>{getStatusText(task.status)}</span>
            </div>
            <div className={styles.taskCardActions}>
              <button
                onClick={() => onStatusChange("completed")}
                disabled={loading || task.status === "completed"}
              >
                ✓
              </button>
              <button
                onClick={() => onStatusChange("not_started")}
                disabled={loading || task.status === "not_started"}
              >
                ↻
              </button>
            </div>
          </div>

          <p className={styles.taskCardTitle}>{task.taskKey}</p>

          <div className={styles.taskCardMeta}>
            <span
              className={
                task.taskType === "situational"
                  ? styles.tagSituational
                  : styles.tagFormal
              }
            >
              {task.taskType === "situational" ? "상황발화" : "정형발화"}
            </span>
            <span>#{task.taskIndex + 1}</span>
          </div>

          {task.completedAt && (
            <p className={styles.taskCardFooter}>
              완료: {new Date(task.completedAt).toLocaleDateString()}
            </p>
          )}
          {task.recordingId && (
            <p className={styles.taskCardFooter}>ID: {task.recordingId}</p>
          )}
        </div>
      </div>
    </div>
  );
};
const AdminTaskManager = () => {
  const [userId, setUserId] = useState("");
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [expandedSets, setExpandedSets] = useState<Set<number>>(new Set([0]));
  const router = useRouter();

  const goBack = () => {
    router.push("/admin/dashboard");
  };

  // 태스크 목록 조회
  const fetchTasks = async () => {
    if (!userId.trim()) {
      setError("User ID를 입력하세요");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/test/manage-tasks?userId=${encodeURIComponent(userId)}`
      );
      const data = await response.json();

      console.log("그 데이터", data);

      if (data.success) {
        setTaskData(data.data);
        setExpandedSets(new Set([0])); // 첫 번째 세트만 펼쳐두기
        setSelectedTasks(new Set()); // 선택 초기화
      } else {
        setError(data.message || "태스크를 불러올 수 없습니다");
        setTaskData(null);
      }
    } catch (err) {
      setError("API 호출 중 오류가 발생했습니다");
      setTaskData(null);
    } finally {
      setLoading(false);
    }
  };

  // 개별 태스크 상태 업데이트
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    if (!taskData) return;

    const task = taskData.tasks.find((t) => t.id === taskId);
    if (!task) return;

    setLoading(true);

    try {
      const response = await fetch("/api/test/manage-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: taskData.userId,
          updates: [
            {
              setIndex: task.setIndex,
              taskType: task.taskType,
              taskIndex: task.taskIndex,
              status: newStatus,
            },
          ],
        }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchTasks(); // 태스크 목록 새로고침
      } else {
        setError(data.message || "태스크 업데이트에 실패했습니다");
      }
    } catch (err) {
      setError("태스크 업데이트 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 선택된 태스크들 일괄 업데이트
  const updateSelectedTasks = async (newStatus: string) => {
    if (!taskData || selectedTasks.size === 0) return;

    setLoading(true);

    try {
      const updates = Array.from(selectedTasks).map((taskId) => {
        const task = taskData.tasks.find((t) => t.id === taskId);
        return {
          setIndex: task!.setIndex,
          taskType: task!.taskType,
          taskIndex: task!.taskIndex,
          status: newStatus,
        };
      });

      const response = await fetch("/api/test/manage-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: taskData.userId,
          updates,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSelectedTasks(new Set());
        await fetchTasks();
      } else {
        setError(data.message || "일괄 업데이트에 실패했습니다");
      }
    } catch (err) {
      setError("일괄 업데이트 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 모든 태스크 완료
  const completeAllTasks = async () => {
    if (!taskData) return;

    if (!confirm("정말 모든 태스크를 완료 상태로 변경하시겠습니까?")) return;

    setLoading(true);

    try {
      const response = await fetch("/api/test/manage-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: taskData.userId }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchTasks();
      } else {
        setError(data.message || "모든 태스크 완료 처리에 실패했습니다");
      }
    } catch (err) {
      setError("모든 태스크 완료 처리 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 선택한 태스크만 완료 처리하는 함수 (completeAllTasks 함수 아래에 추가)
  const completeSelectedTasks = async (completeAllInSet = false) => {
    if (!taskData || selectedTasks.size === 0) return;

    if (
      !confirm(
        completeAllInSet
          ? `선택한 태스크가 포함된 세트 전체를 완료하시겠습니까? (선택: ${selectedTasks.size}개)`
          : `선택한 ${selectedTasks.size}개의 태스크만 완료하시겠습니까?`
      )
    )
      return;

    setLoading(true);

    try {
      // 선택된 태스크들을 API 형식으로 변환
      const selectedTasksArray = Array.from(selectedTasks).map((taskId) => {
        const task = taskData.tasks.find((t) => t.id === taskId);
        if (!task) throw new Error(`태스크를 찾을 수 없습니다: ${taskId}`);

        return {
          setIndex: task.setIndex,
          taskType: task.taskType,
          taskIndex: task.taskIndex,
          taskKey: task.taskKey,
        };
      });

      const response = await fetch("/api/test/complete-selected-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: taskData.userId,
          selectedTasks: selectedTasksArray,
          completeAllInSet,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSelectedTasks(new Set());
        await fetchTasks();
        alert(
          `완료 처리 성공!\n완료된 태스크: ${data.data.completedTasks.length}개\n전체 진행률: ${data.data.overallProgress}%`
        );
      } else {
        setError(data.message || "선택 태스크 완료 처리에 실패했습니다");
      }
    } catch (err) {
      console.error("완료 처리 오류:", err);
      setError("선택 태스크 완료 처리 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };
  // 특정 세트의 특정 개수만큼 랜덤하게 완료하는 함수
  const completeRandomTasks = async (
    setIndex: number,
    count: number,
    taskType?: "situational" | "formal"
  ) => {
    if (!taskData) return;

    const setTasks = taskData.tasks.filter((task) => {
      const matchesSet = task.setIndex === setIndex;
      const matchesType = !taskType || task.taskType === taskType;
      const notCompleted = task.status !== "completed";
      return matchesSet && matchesType && notCompleted;
    });

    if (setTasks.length === 0) {
      alert("완료할 수 있는 태스크가 없습니다.");
      return;
    }

    const actualCount = Math.min(count, setTasks.length);

    if (
      !confirm(
        `세트 ${setIndex + 1}에서 ${
          taskType ? taskType + " " : ""
        }태스크 ${actualCount}개를 랜덤하게 완료하시겠습니까?`
      )
    )
      return;

    const shuffled = [...setTasks].sort(() => Math.random() - 0.5);
    const randomTasks = shuffled.slice(0, actualCount);

    setLoading(true);

    try {
      const selectedTasksArray = randomTasks.map((task) => ({
        setIndex: task.setIndex,
        taskType: task.taskType,
        taskIndex: task.taskIndex,
        taskKey: task.taskKey,
      }));

      const response = await fetch("/api/test/complete-selected-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: taskData.userId,
          selectedTasks: selectedTasksArray,
          completeAllInSet: false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchTasks();
        alert(
          `랜덤 완료 성공!\n완료된 태스크: ${data.data.completedTasks.length}개`
        );
      } else {
        setError(data.message || "랜덤 완료 처리에 실패했습니다");
      }
    } catch (err) {
      setError("랜덤 완료 처리 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 프리셋 완료 패턴들
  const presetPatterns = {
    // 첫 번째 세트 절반만
    halfFirstSet: () => {
      if (!taskData) return;
      const firstSetTasks = taskData.tasks.filter(
        (t) => t.setIndex === 0 && t.status !== "completed"
      );
      const halfCount = Math.ceil(firstSetTasks.length / 2);
      completeRandomTasks(0, halfCount);
    },

    // 각 세트에서 상황발화만 완료
    situationalOnly: async () => {
      if (!taskData) return;

      if (!confirm("모든 세트의 상황발화 태스크만 완료하시겠습니까?")) return;

      const situationalTasks = taskData.tasks.filter(
        (task) => task.taskType === "situational" && task.status !== "completed"
      );

      if (situationalTasks.length === 0) {
        alert("완료할 상황발화 태스크가 없습니다.");
        return;
      }

      setLoading(true);

      try {
        const selectedTasksArray = situationalTasks.map((task) => ({
          setIndex: task.setIndex,
          taskType: task.taskType,
          taskIndex: task.taskIndex,
          taskKey: task.taskKey,
        }));

        const response = await fetch("/api/test/complete-selected-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: taskData.userId,
            selectedTasks: selectedTasksArray,
            completeAllInSet: false,
          }),
        });

        const data = await response.json();

        if (data.success) {
          await fetchTasks();
          alert(
            `상황발화 완료 성공!\n완료된 태스크: ${data.data.completedTasks.length}개`
          );
        } else {
          setError(data.message || "상황발화 완료 처리에 실패했습니다");
        }
      } catch (err) {
        setError("상황발화 완료 처리 중 오류가 발생했습니다");
      } finally {
        setLoading(false);
      }
    },

    // 각 세트별로 진행률 80% 달성
    eightyPercent: async () => {
      if (!taskData) return;

      if (!confirm("각 세트를 80% 진행률로 만드시겠습니까?")) return;

      const allSelectedTasks: any[] = [];

      Object.entries(groupedTasks).forEach(([setIndex, setTasks]) => {
        const setNum = parseInt(setIndex);
        const allSetTasks = [...setTasks.situational, ...setTasks.formal];
        const incompleteTasks = allSetTasks.filter(
          (task) => task.status !== "completed"
        );
        const targetCount =
          Math.floor(allSetTasks.length * 0.8) -
          (allSetTasks.length - incompleteTasks.length);

        if (targetCount > 0 && incompleteTasks.length > 0) {
          const selectedCount = Math.min(targetCount, incompleteTasks.length);
          const shuffled = [...incompleteTasks].sort(() => Math.random() - 0.5);
          const selected = shuffled.slice(0, selectedCount);

          selected.forEach((task) => {
            allSelectedTasks.push({
              setIndex: task.setIndex,
              taskType: task.taskType,
              taskIndex: task.taskIndex,
              taskKey: task.taskKey,
            });
          });
        }
      });

      if (allSelectedTasks.length === 0) {
        alert("더 이상 완료할 태스크가 없습니다.");
        return;
      }

      setLoading(true);

      try {
        const response = await fetch("/api/test/complete-selected-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: taskData.userId,
            selectedTasks: allSelectedTasks,
            completeAllInSet: false,
          }),
        });

        const data = await response.json();

        if (data.success) {
          await fetchTasks();
          alert(
            `80% 진행률 달성!\n완료된 태스크: ${data.data.completedTasks.length}개`
          );
        } else {
          setError(data.message || "80% 진행률 처리에 실패했습니다");
        }
      } catch (err) {
        setError("80% 진행률 처리 중 오류가 발생했습니다");
      } finally {
        setLoading(false);
      }
    },
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (!taskData) return;

    if (selectedTasks.size === taskData.tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(taskData.tasks.map((t) => t.id)));
    }
  };

  // 태스크를 세트별로 그룹화
  const groupedTasks = taskData
    ? taskData.tasks.reduce((acc, task) => {
        if (!acc[task.setIndex]) {
          acc[task.setIndex] = { situational: [], formal: [] };
        }
        acc[task.setIndex][task.taskType].push(task);
        return acc;
      }, {} as Record<number, { situational: Task[]; formal: Task[] }>)
    : {};

  // Enter 키로 조회
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      fetchTasks();
    }
  };

  console.log("여기서 테스트 데이터가?", taskData);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>👥</span>
          <h1 className={styles.headerTitle}>Task Manager</h1>
          <span className={styles.badge}>테스트용</span>
          <button onClick={goBack}>뒤로가기</button>
        </div>

        <div className={styles.inputSection}>
          <h2 className={styles.inputLabel}>사용자 조회</h2>
          <div className={styles.inputRow}>
            <div className={styles.inputWrapper}>
              <label className={styles.inputLabel}>User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyPress={handleKeyPress}
                className={styles.inputField}
                placeholder="예: user123"
                disabled={loading}
              />
            </div>
            <button
              onClick={fetchTasks}
              disabled={loading || !userId.trim()}
              className={styles.button}
            >
              {loading ? "로딩..." : "조회"}
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <div className={styles.taskCardHeader}>
              <div className={styles.taskCardCheckboxRow}>
                <div className="w-4 h-4 bg-red-500 rounded-full" />
                <p>{error}</p>
              </div>
            </div>
          </div>
        )}

        {taskData && (
          <>
            <div className={styles.statGrid}>
              <div className={styles.statCard}>
                <div className={styles.taskCardHeader}>
                  <span>🎯</span>
                  <div>
                    <p className={styles.statTitle}>완료율</p>
                    <p className={styles.statValue}>
                      {taskData.completedTasks !== 0
                        ? `${Math.round(
                            (taskData.completedTasks / taskData.totalTasks) *
                              100
                          )}%`
                        : "시작 안함"}
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.taskCardHeader}>
                  <span>✅</span>
                  <div>
                    <p className={styles.statTitle}>완료된 태스크</p>
                    <p className={styles.statValue}>
                      {taskData.completedTasks} / {taskData.totalTasks}
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.taskCardHeader}>
                  <span>⏰</span>
                  <div>
                    <p className={styles.statTitle}>선택된 태스크</p>
                    <p className={styles.statValue}>{selectedTasks.size}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.actionSection}>
              <div className={styles.taskCardHeader}>
                <h3>{taskData.userId} 태스크 관리</h3>
                <div className={styles.progressBarContainer}>
                  <div
                    className={styles.progressBar}
                    style={{
                      width: `${
                        (taskData.completedTasks / taskData.totalTasks) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className={styles.presetSection}>
                <div className={styles.taskCardHeader}>
                  <h3>빠른 완료 패턴</h3>
                </div>

                <div className={styles.taskCardActions}>
                  <button
                    onClick={presetPatterns.halfFirstSet}
                    disabled={loading}
                    className={styles.button}
                  >
                    첫 세트 절반만
                  </button>
                  <button
                    onClick={presetPatterns.situationalOnly}
                    disabled={loading}
                    className={styles.button}
                  >
                    상황발화만 전부
                  </button>
                  {/* <button
                    onClick={presetPatterns.eightyPercent}
                    disabled={loading}
                    className={styles.button}
                  >
                    각 세트 80%까지
                  </button> */}
                </div>

                {/* 세트별 랜덤 완료 버튼들 */}
                {/* <div style={{ marginTop: "10px" }}>
                  <h4 style={{ fontSize: "14px", marginBottom: "8px" }}>
                    세트별 랜덤 완료:
                  </h4>
                  {Object.keys(groupedTasks).map((setIndex) => {
                    const setNum = parseInt(setIndex);
                    return (
                      <div
                        key={setIndex}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <span style={{ minWidth: "60px", fontSize: "13px" }}>
                          세트 {setNum + 1}:
                        </span>
                        <button
                          onClick={() =>
                            completeRandomTasks(setNum, 3, "situational")
                          }
                          disabled={loading}
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          상황 3개
                        </button>
                        <button
                          onClick={() =>
                            completeRandomTasks(setNum, 5, "formal")
                          }
                          disabled={loading}
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          정형 5개
                        </button>
                        <button
                          onClick={() => completeRandomTasks(setNum, 10)}
                          disabled={loading}
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          전체 10개
                        </button>
                      </div>
                    );
                  })}
                </div> */}
              </div>

              <div className={styles.taskCardActions}>
                <button onClick={toggleSelectAll} className={styles.button}>
                  {selectedTasks.size === taskData.tasks.length
                    ? "전체 해제"
                    : "전체 선택"}
                </button>

                {/* 기존 선택 완료 버튼을 새로운 버튼들로 교체 */}
                <button
                  onClick={() => completeSelectedTasks(false)}
                  disabled={loading || selectedTasks.size === 0}
                  className={styles.button}
                >
                  선택만 완료 ({selectedTasks.size})
                </button>
                <button
                  onClick={() => completeSelectedTasks(true)}
                  disabled={loading || selectedTasks.size === 0}
                  className={styles.button}
                >
                  선택+세트 완료
                </button>

                <button
                  onClick={() => updateSelectedTasks("not_started")}
                  disabled={loading || selectedTasks.size === 0}
                  className={styles.button}
                >
                  선택 초기화
                </button>
                <button
                  onClick={completeAllTasks}
                  disabled={loading}
                  className={styles.button}
                >
                  모든 태스크 완료
                </button>
              </div>
            </div>

            {Object.entries(groupedTasks).map(([setIndex, setTasks]) => {
              const setNum = parseInt(setIndex);
              const isExpanded = expandedSets.has(setNum);
              const setTotal =
                setTasks.situational.length + setTasks.formal.length;
              const setCompleted = [
                ...setTasks.situational,
                ...setTasks.formal,
              ].filter((task) => task.status === "completed").length;

              return (
                <div key={setIndex} className={styles.setContainer}>
                  <button
                    onClick={() => {
                      const next = new Set(expandedSets);
                      // ✅ 여기 부분을 if/else로 명확히
                      if (isExpanded) {
                        next.delete(setNum);
                      } else {
                        next.add(setNum);
                      }
                      setExpandedSets(next);
                    }}
                    className={styles.setHeader}
                  >
                    세트 {setNum + 1} - {setCompleted}/{setTotal} 완료
                  </button>

                  {isExpanded && (
                    <div className={styles.taskList}>
                      {setTasks.situational.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          isSelected={selectedTasks.has(task.id)}
                          onSelect={(selected) => {
                            const updated = new Set(selectedTasks);
                            if (selected) {
                              updated.add(task.id);
                            } else {
                              updated.delete(task.id);
                            }
                            setSelectedTasks(updated);
                          }}
                          onStatusChange={(status) =>
                            updateTaskStatus(task.id, status)
                          }
                          loading={loading}
                        />
                      ))}
                      {setTasks.formal.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          isSelected={selectedTasks.has(task.id)}
                          onSelect={(selected) => {
                            const updated = new Set(selectedTasks);
                            if (selected) {
                              updated.add(task.id);
                            } else {
                              updated.delete(task.id);
                            }
                            setSelectedTasks(updated);
                          }}
                          onStatusChange={(status) =>
                            updateTaskStatus(task.id, status)
                          }
                          loading={loading}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminTaskManager;
