import { NextPage } from "next";
import dynamic from "next/dynamic";
import styles from "@/styles/Home.module.css";
// VoiceRecorder 컴포넌트를 동적 임포트 (SSR 비활성화)
const VoiceRecorder = dynamic(() => import("@/components/voiceRecorder"), {
  ssr: false,
  loading: () => <p>음성 녹음기 로딩 중...</p>,
});
// MobileDebugConsole을 동적 임포트 (개발 환경에서만)
const MobileDebugConsole = dynamic(
  () => import("@/components/MobileDebugConsole"),
  {
    ssr: false,
    loading: () => null,
  }
);
const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>음성 녹음 데모</h1>
        <p className={styles.subtitle}></p>
        <div className={styles.voiceRecorderWrapper}>
          <VoiceRecorder />
        </div>
      </main>

      {/* 개발 환경에서만 디버그 콘솔 표시 */}
      {process.env.NODE_ENV === "development" && <MobileDebugConsole />}
    </div>
  );
};

export default Home;
