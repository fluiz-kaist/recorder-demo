// components/tutorial/MicPermission.tsx - 마이크 권한 요청 전용 컴포넌트
import React from "react";
import styles from "@/styles/MicPermission.module.css";

interface MicPermissionProps {
  isGranted: boolean;
  onRequestPermission: () => void;
}

const MicPermission: React.FC<MicPermissionProps> = ({
  isGranted,
  onRequestPermission,
}) => {
  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.headerSection}>
        <div className={styles.micIcon}>🎤</div>
        <h1 className={styles.pageTitle}>실전 연습을 시작하겠습니다</h1>
      </div>

      {/* 설명 */}
      <div className={styles.explanationSection}>
        <p className={styles.explanationText}>
          이제 실제로 음성을 녹음해보겠습니다.
          <br />
          <br />
          먼저 마이크 사용 권한을 허용해주세요.
        </p>
      </div>

      {/* 단계 안내 */}
      <div className={styles.stepsSection}>
        <div className={styles.permissionStep}>
          <span className={styles.stepIcon}>1️⃣</span>
          <span className={styles.stepText}>아래 버튼을 눌러주세요</span>
        </div>
        <div className={styles.permissionStep}>
          <span className={styles.stepIcon}>2️⃣</span>
          <span className={styles.stepText}>
            허용 또는 Allow 버튼을 눌러주세요
          </span>
        </div>
        <div className={styles.permissionStep}>
          <span className={styles.stepIcon}>3️⃣</span>
          <span className={styles.stepText}>
            준비가 완료되면 다음으로 진행하세요
          </span>
        </div>
      </div>
      {/* 추가 안내 */}
      <div className={styles.additionalInfo}>
        <h3 className={styles.infoTitle}>🔐 마이크 허가 안내</h3>
        <div className={styles.infoContent}>
          <p className={styles.infoText}>
            브라우저에서 마이크 사용을 허락해주세요 라는 메시지가 나타나면
          </p>
          <div className={styles.infoHighlight}>
            <strong>
              [허용] 또는 [Allow] 버튼을
              <br /> 눌러주세요.
            </strong>
          </div>
          <p className={styles.infoNote}>
            이렇게 한 번만 허용하시면
            <br /> 앞으로 계속 사용하실 수 있습니다.
          </p>
        </div>
      </div>
      {/* 권한 요청 버튼 또는 성공 메시지 */}
      <div className={styles.actionSection}>
        {!isGranted ? (
          <button
            className={styles.permissionButton}
            onClick={onRequestPermission}
          >
            🎤 마이크 사용 권한 요청하기
          </button>
        ) : (
          <div className={styles.successSection}>
            <div className={styles.successIcon}>✅</div>
            <div className={styles.successMessage}>
              이제 음성 녹음 연습을
              <br />
              시작할 수 있습니다.
            </div>
            {/* <div className={styles.successSubtext}></div> */}
          </div>
        )}
      </div>
    </div>
  );
};

export default MicPermission;
