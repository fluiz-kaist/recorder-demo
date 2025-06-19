// components/MobileDebugConsole.tsx
import React, { useEffect, useState, useRef } from "react";
import styles from "@/styles/MobileDebugConsole.module.css";

interface LogEntry {
  id: number;
  type: "log" | "error" | "warn" | "info";
  message: string;
  timestamp: string;
}

const MobileDebugConsole: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState("");
  const logIdRef = useRef(0);
  const consoleRef = useRef<HTMLDivElement>(null);

  const handleAuth = () => {
    const adminPwd = process.env.NEXT_PUBLIC_DEBUG_PASSWORD;
    if (authInput === adminPwd) {
      setIsAuthenticated(true);
      setAuthError("");
      setAuthInput("");
    } else {
      setAuthError("비밀번호가 올바르지 않습니다.");
      setAuthInput("");
    }
  };

  const handleAuthKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAuth();
    }
  };

  useEffect(() => {
    // 원본 콘솔 메서드들 백업
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
    };

    // 로그 추가 함수

    const addLog = (
      type: LogEntry["type"],
      args: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
    ) => {
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");

      const newLog: LogEntry = {
        id: logIdRef.current++,
        type,
        message,
        timestamp: new Date().toISOString().split("T")[1].split(".")[0],
      };

      setLogs((prevLogs) => {
        const updatedLogs = [...prevLogs, newLog];
        // 최대 100개 로그만 유지
        return updatedLogs.slice(-100);
      });

      // 원본 콘솔 메서드 호출
      originalConsole[type](...args);
    };

    // 콘솔 메서드들 오버라이드
    console.log = (...args) => addLog("log", args);
    console.error = (...args) => addLog("error", args);
    console.warn = (...args) => addLog("warn", args);
    console.info = (...args) => addLog("info", args);

    // 에러 핸들러 추가
    const handleError = (event: ErrorEvent) => {
      addLog("error", [
        `Uncaught Error: ${event.message} at ${event.filename}:${event.lineno}`,
      ]);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addLog("error", [`Unhandled Promise Rejection: ${event.reason}`]);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // 클린업 함수
    return () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
      window.removeEventListener("error", handleError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
    };
  }, []);

  // 새 로그가 추가될 때마다 스크롤을 맨 아래로
  useEffect(() => {
    if (consoleRef.current && !isMinimized) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, isMinimized]);

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "error":
        return "❌";
      case "warn":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "📝";
    }
  };

  const getLogClassName = (type: LogEntry["type"]) => {
    switch (type) {
      case "error":
        return styles.logError;
      case "warn":
        return styles.logWarn;
      case "info":
        return styles.logInfo;
      default:
        return styles.logDefault;
    }
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        className={styles.floatingButton}
        onClick={() => setIsVisible(!isVisible)}
        title="디버그 콘솔 토글"
      >
        🐛
      </button>

      {/* 콘솔 창 */}
      {isVisible && (
        <div
          className={`${styles.console} ${isMinimized ? styles.minimized : ""}`}
        >
          <div className={styles.header}>
            <span className={styles.title}>🐛 Debug Console</span>
            <div className={styles.controls}>
              <button
                className={styles.controlButton}
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "펼치기" : "최소화"}
              >
                {isMinimized ? "⬆️" : "⬇️"}
              </button>
              <button
                className={styles.controlButton}
                onClick={clearLogs}
                title="로그 지우기"
              >
                🗑️
              </button>
              <button
                className={styles.controlButton}
                onClick={() => setIsVisible(false)}
                title="닫기"
              >
                ❌
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {!isAuthenticated ? (
                <div className={styles.authContainer}>
                  <div className={styles.authMessage}>
                    관리자 비밀번호를 입력하세요
                  </div>
                  <div className={styles.authInputContainer}>
                    <input
                      type="text"
                      value={authInput}
                      onChange={(e) => setAuthInput(e.target.value)}
                      onKeyDown={handleAuthKeyPress}
                      maxLength={20}
                      className={styles.authInput}
                    />
                    <button onClick={handleAuth} className={styles.authButton}>
                      확인
                    </button>
                  </div>
                  {authError && (
                    <div className={styles.authError}>{authError}</div>
                  )}
                </div>
              ) : (
                // 인증이 완료된 경우 로그 표시
                <div className={styles.logContainer} ref={consoleRef}>
                  {logs.length === 0 ? (
                    <div className={styles.noLogs}>로그가 없습니다</div>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className={`${styles.logEntry} ${getLogClassName(
                          log.type
                        )}`}
                      >
                        <span className={styles.logTime}>{log.timestamp}</span>
                        <span className={styles.logIcon}>
                          {getLogIcon(log.type)}
                        </span>
                        <pre className={styles.logMessage}>{log.message}</pre>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
};

export default MobileDebugConsole;
