import React from "react";
import styles from "@/styles/SuccessPopup.module.css";

// 성공 팝업 컴포넌트
const SuccessPopup: React.FC<{
  message: string;
  onClose: () => void;
  details?: string; // 추가 세부사항 (선택사항)
}> = ({ message, onClose, details }) => {
  return (
    <div className={styles.successOverlay}>
      <div className={styles.successPopup}>
        <div className={styles.successHeader}>
          <h3>🎉 성공!</h3>
          <button
            className={styles.successCloseButton}
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className={styles.successBody}>
          <p className={styles.successMessage}>{message}</p>
          {details && <p className={styles.successDetails}>{details}</p>}
        </div>
        <div className={styles.successFooter}>
          <button className={styles.successOkButton} onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessPopup;
