import React from "react";
import styles from "@/styles/ErrorPopup.module.css";

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
}

export interface STTResponse {
  success: boolean;
  transcription?: TranscriptionResult;
  error?: string;
}

// 에러 팝업 컴포넌트
const ErrorPopup: React.FC<{
  message: string;
  onClose: () => void;
}> = ({ message, onClose }) => {
  return (
    <div className={styles.errorOverlay}>
      <div className={styles.errorPopup}>
        <div className={styles.errorHeader}>
          <h3>⚠️ 오류 발생</h3>
          <button
            className={styles.errorCloseButton}
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className={styles.errorBody}>
          <p>{message}</p>
        </div>
        <div className={styles.errorFooter}>
          <button className={styles.errorOkButton} onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorPopup;
