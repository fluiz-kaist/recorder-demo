import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styles from "@/styles/VoiceRecorder.module.css";
import { useAudioUpload } from "@/hooks/useAudioUpload";
import STTComponent, { TranscriptionResult } from "@/components/STTComponent";

import { useMobileOptimizedRecorder } from "@/hooks/useMobileOptimizedRecorder";

// 🎯 간단한 품질 검증 결과 인터페이스
interface SimpleQualityResult {
  isGoodQuality: boolean;
  score: number; // 0-100 점수
  issues: string[];
  recommendations: string[];
  fileSize: number;
  fileSizeKB: number;
}

const RecorderComponent: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    downloadURL: string;
    fileId: string;
  } | null>(null);
  const [isSTTProcessing, setIsSTTProcessing] = useState(false); // 새로 추가
  // 1. STT 성공 여부를 추적하는 상태 추가
  const [isSTTSuccess, setIsSTTSuccess] = useState(false);

  // STT 관련 상태
  const [transcription, setTranscription] =
    useState<TranscriptionResult | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(
    null
  );
  const [showSTT, setShowSTT] = useState(false);

  // 🎯 간단한 품질 검증 관련 상태
  const [qualityResult, setQualityResult] =
    useState<SimpleQualityResult | null>(null);
  const [showQualityWarning, setShowQualityWarning] = useState(false);

  // STT 분석 상태 변경 핸들러
  const handleSTTStateChange = (isTranscribing: boolean) => {
    setIsSTTProcessing(isTranscribing);
  };

  // 🔥 MobileOptimizedRecorder hook 사용
  const {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording: startMobileRecording,
    stopRecording: stopMobileRecording,
  } = useMobileOptimizedRecorder();

  // 업로드 훅 사용
  const { uploadState, uploadAudio, resetUploadState } = useAudioUpload();

  // 시간을 mm:ss 형식으로 변환
  const formatTime = (seconds: number): string => {
    if (!seconds || !isFinite(seconds) || isNaN(seconds)) {
      return "00:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // 🎯 파일 크기 기반 간단한 품질 검증 (1-5ms 완료)
  const validateAudioQualitySimple = (
    blob: Blob,
    recordingDuration: number
  ): SimpleQualityResult => {
    const startTime = performance.now();

    const fileSize = blob.size;
    const fileSizeKB = Math.round(fileSize / 1024);

    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    console.log(
      `🔍 간단 품질 검증 시작: 파일크기=${fileSizeKB}KB, 시간=${recordingDuration}초`
    );

    // 1. 녹음 시간 체크
    if (recordingDuration < 2) {
      score -= 40;
      issues.push("녹음 시간이 너무 짧습니다");
      recommendations.push("최소 2초 이상 말씀해 주세요");
    } else if (recordingDuration < 3) {
      score -= 20;
      issues.push("녹음 시간이 조금 짧습니다");
      recommendations.push("더 자세히 말씀해 주세요");
    }

    if (recordingDuration > 60) {
      score -= 10;
      issues.push("녹음 시간이 너무 깁니다");
      recommendations.push("1분 이내로 간결하게 말씀해 주세요");
    }

    // 2. 파일 크기 절대값 체크
    if (fileSizeKB < 5) {
      score -= 50;
      issues.push("파일이 너무 작습니다 (거의 무음상태)");
      recommendations.push("마이크를 확인하고 더 크게 말씀해 주세요");
    } else if (fileSizeKB < 15) {
      score -= 30;
      issues.push("음성이 너무 작게 녹음되었습니다");
      recommendations.push("조금 더 크게 말씀해 주세요");
    }

    if (fileSizeKB > 10000) {
      // 10MB 초과
      score -= 5;
      issues.push("파일이 예상보다 큽니다");
    }

    // 3. 파일 크기 대비 시간 비율 체크 (핵심 지표)
    const expectedSizePerSecond = 8; // KB/초 (WebM Opus 64kbps 기준)
    const expectedSize = recordingDuration * expectedSizePerSecond;
    const sizeRatio = fileSizeKB / expectedSize;

    console.log(
      `📊 크기 비율 분석: 예상=${expectedSize}KB, 실제=${fileSizeKB}KB, 비율=${sizeRatio.toFixed(
        2
      )}`
    );

    if (sizeRatio < 0.1) {
      score -= 40;
      issues.push("거의 무음상태로 녹음되었습니다");
      recommendations.push(
        "마이크 권한을 확인하고 조용한 곳에서 다시 녹음해 주세요"
      );
    } else if (sizeRatio < 0.3) {
      score -= 25;
      issues.push("음성이 너무 작게 녹음되었습니다");
      recommendations.push(
        "스마트폰을 입에서 15-20cm 거리에 두고 더 크게 말씀해 주세요"
      );
    } else if (sizeRatio < 0.5) {
      score -= 10;
      issues.push("음성이 조금 작게 녹음되었습니다");
      recommendations.push("조금 더 크게 말씀해 주세요");
    }

    // 4. 포맷 체크
    if (!blob.type.includes("webm")) {
      score -= 5;
      issues.push("최적 포맷이 아닙니다");
    }

    // 5. 시간당 파일 크기가 너무 작은 경우 (발음 불분명 가능성)
    if (recordingDuration > 0 && fileSizeKB / recordingDuration < 3) {
      score -= 15;
      issues.push("발음이 불분명하거나 음성이 약할 수 있습니다");
      recommendations.push("천천히, 또렷하게 말씀해 주세요");
    }

    const result: SimpleQualityResult = {
      isGoodQuality: score >= 70 && issues.length <= 1,
      score: Math.max(0, score),
      issues,
      recommendations,
      fileSize,
      fileSizeKB,
    };

    const endTime = performance.now();
    console.log(
      `✅ 간단 품질 검증 완료: ${(endTime - startTime).toFixed(2)}ms, 점수=${
        result.score
      }/100`
    );

    return result;
  };

  // 클라이언트 사이드에서만 실행되도록 보장
  useEffect(() => {
    console.log("🚀 VoiceRecorder 컴포넌트 마운트됨");
    setIsClient(true);
  }, []);

  // 🔥 녹음 시작
  const startRecording = async () => {
    try {
      console.log("🎤 녹음 시작 요청");

      // 이전 녹음 결과 초기화
      setAudioUrl(null);
      setAudioDuration(null);
      setUploadResult(null);
      setTranscription(null);
      setTranscriptionError(null);
      setShowSTT(false);
      setQualityResult(null);
      setShowQualityWarning(false);
      setIsSTTSuccess(false); // STT 상태 초기화 추가
      resetUploadState();

      // MobileOptimizedRecorder의 startRecording 호출
      await startMobileRecording();

      console.log("✅ 녹음 시작 완료");
    } catch (err) {
      console.error("❌ 녹음 시작 실패:", err);
      alert(`녹음 시작 실패: ${(err as Error).message}`);
    }
  };

  // 🔥 녹음 중지
  const stopRecording = async () => {
    try {
      console.log("🛑 녹음 종료 요청");
      await stopMobileRecording();
      console.log("✅ 녹음 종료 완료");
    } catch (err) {
      console.error("❌ 녹음 종료 실패:", err);
    }
  };

  // 🎯 audioBlob이 생성되면 즉시 간단한 품질 검증 후 STT 준비
  useEffect(() => {
    if (audioBlob) {
      console.log("📄 새로운 오디오 blob 생성됨:", {
        size: audioBlob.size,
        type: audioBlob.type,
      });

      // Blob URL 생성
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      setAudioDuration(recordingTime);

      // 🎯 즉시 간단한 품질 검증 (1-5ms 완료)
      const quality = validateAudioQualitySimple(audioBlob, recordingTime);
      setQualityResult(quality);

      if (quality.isGoodQuality) {
        console.log("✅ 품질 검증 통과 - STT 진행");
        setShowSTT(true);
      } else {
        console.log("⚠️ 품질 검증 실패 - 사용자에게 경고 표시");
        setShowQualityWarning(true);
      }

      // 오디오 메타데이터 로드 (더 정확한 duration, 선택사항)
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        if (audio.duration && isFinite(audio.duration)) {
          setAudioDuration(Math.floor(audio.duration));
        }
      });
      audio.load();

      // Cleanup 함수 (메모리 누수 방지)
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [audioBlob, recordingTime]);

  // 🎯 품질 경고 무시하고 계속 진행
  const proceedDespiteQuality = () => {
    setShowQualityWarning(false);
    setShowSTT(true);
    console.log("⚠️ 사용자가 품질 경고를 무시하고 STT 진행");
  };

  // 서버로 업로드
  const handleUpload = async () => {
    if (!audioBlob || !audioDuration) {
      console.error("❌ 업로드할 오디오 파일이 없습니다.");
      return;
    }

    try {
      const fileName = `recording_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.webm`;
      // localStorage에서 userId 가져오기
      const userId = localStorage.getItem("userInfo") || "anonymous";
      console.log("📋 사용자 ID:", userId);

      const result = await uploadAudio(
        audioBlob,
        fileName,
        audioDuration,
        userId
      );

      if (result) {
        setUploadResult(result);
        console.log("🎉 업로드 성공:", result);
      }
    } catch (error) {
      console.error("❌ 업로드 실패:", error);
    }
  };

  // STT 결과 처리
  const handleTranscriptionComplete = (result: TranscriptionResult | null) => {
    setTranscription(result);
    if (result) {
      setTranscriptionError(null);
      setIsSTTSuccess(true); // STT 성공 표시
      setIsSTTProcessing(false);
      console.log("✅ STT 변환 완료:", result);
    }
  };

  const handleTranscriptionError = (error: string) => {
    setTranscriptionError(error);
    setIsSTTProcessing(false);
    setTranscription(null);
    setIsSTTSuccess(false); // STT 실패 표시
    console.error("❌ STT 변환 실패:", error);
  };

  // 새로 녹음하기
  const handleNewRecording = () => {
    console.log("🔄 새 녹음 준비 중...");
    setAudioUrl(null);
    setAudioDuration(null);
    setUploadResult(null);
    setTranscription(null);
    setTranscriptionError(null);
    setShowSTT(false);
    setQualityResult(null);
    setShowQualityWarning(false);
    setIsSTTSuccess(false); // STT 상태 초기화 추가
    setIsSTTProcessing(false); // ✅ 이 줄 추가!
    resetUploadState();
    console.log("✅ 새 녹음 준비 완료");
  };

  if (!isClient) {
    return (
      <div className={styles.loading}>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      {/* 🎯 녹음 안내 (품질 향상을 위한 팁) */}
      {!audioUrl && !uploadResult && !isRecording && (
        <div className={styles.recordingGuide}>
          <h4>🎤 음성 녹음 안내</h4>
          <ul>
            <li>조용한 곳에서 녹음해 주세요</li>
            <li>스마트폰을 입에서 15-20cm 거리에 두세요</li>
            <li>최소 3초 이상 또렷하게 말씀해 주세요</li>
          </ul>
        </div>
      )}

      {/* 녹음 시간 표시 */}
      {isRecording && (
        <div className={styles.recordingStatus}>
          <div className={styles.recordingIndicator}></div>
          <span className={styles.recordingTime}>
            녹음 중: {formatTime(recordingTime)}
          </span>
        </div>
      )}

      {/* 녹음 결과가 없을 때만 메인 녹음 버튼 표시 */}
      {!audioUrl && !uploadResult && (
        <button
          className={`${styles.recordButton} ${
            isRecording ? styles.recordingButton : ""
          }`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={uploadState.isUploading}
        >
          {isRecording ? "🛑 녹음 종료" : "🎤 녹음 시작"}
        </button>
      )}

      {/* 🎯 품질 경고 표시 */}
      {showQualityWarning && qualityResult && (
        <div className={styles.qualityWarning}>
          <h4>⚠️ 음성 품질 개선 필요</h4>
          {/* 오디오 URL 상태에 따른 처리 */}
          {audioUrl ? (
            <div className={styles.audioPreview}>
              <p>🔉 녹음된 음성 확인하기:</p>
              <audio className={styles.audioPlayer} src={audioUrl} controls />
            </div>
          ) : (
            <div className={styles.audioError}>
              ❌ 음성 파일을 불러올 수 없습니다. 다시 녹음해 주세요.
            </div>
          )}
          <div className={styles.qualityScore}>
            품질 점수: {qualityResult.score}/100 점
          </div>
          <div className={styles.fileSizeInfo}>
            파일 크기: {qualityResult.fileSizeKB}KB
          </div>

          {qualityResult.issues.length > 0 && (
            <div className={styles.qualityIssues}>
              <strong>문제점:</strong>
              <ul>
                {qualityResult.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {qualityResult.recommendations.length > 0 && (
            <div className={styles.qualityRecommendations}>
              <strong>개선 방법:</strong>
              <ul>
                {qualityResult.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.qualityActions}>
            <button
              className={styles.retryRecordingButton}
              onClick={handleNewRecording}
            >
              🔄 다시 녹음하기(권장)
            </button>
            <button
              className={styles.proceedButton}
              onClick={proceedDespiteQuality}
            >
              그대로 진행하기
            </button>
          </div>
        </div>
      )}

      {/* 오디오 섹션 (품질 통과 시) */}
      {audioUrl && !uploadResult && !transcription && !showQualityWarning && (
        <div className={styles.audioSection}>
          <div className={styles.audioHeader}>
            <p className={styles.audioLabel}>🔉 녹음된 파일</p>
            {audioDuration && (
              <span className={styles.audioDuration}>
                길이: {formatTime(audioDuration)}
              </span>
            )}
            {qualityResult && (
              <span className={styles.qualityBadge}>
                품질: {qualityResult.score}/100 ✅
              </span>
            )}
          </div>
          <audio className={styles.audioPlayer} src={audioUrl} controls />

          {/* STT 컴포넌트 */}
          {showSTT && (
            <STTComponent
              audioBlob={audioBlob}
              audioDuration={audioDuration}
              onTranscriptionComplete={handleTranscriptionComplete}
              onError={handleTranscriptionError}
              onTranscribingStateChange={handleSTTStateChange} // 새로 추가
              autoTranscribe={true}
            />
          )}

          {/* STT 에러 표시 */}
          {transcriptionError && (
            <div className={styles.errorMessage}>
              ❌ 변환 실패: {transcriptionError}
              <p className={styles.errorGuidance}>
                음성 변환에 실패했습니다. 새로 녹음해주세요.
              </p>
            </div>
          )}

          <div className={styles.actionButtons}>
            {/* STT가 성공했을 때만 제출하기 버튼 표시 */}
            {isSTTSuccess && (
              <button
                className={styles.uploadButton}
                onClick={handleUpload}
                disabled={uploadState.isUploading || isSTTProcessing}
              >
                {isSTTProcessing
                  ? "음성 분석 중..."
                  : uploadState.isUploading
                  ? "제출 중..."
                  : "제출하기"}
              </button>
            )}

            <button
              className={styles.newRecordingButton}
              onClick={handleNewRecording}
              disabled={uploadState.isUploading || isSTTProcessing} // 조건 추가
            >
              {isSTTProcessing ? "분석 중..." : "🔄 새로 녹음하기"}
            </button>
          </div>

          {/* 업로드 진행률 */}
          {uploadState.isUploading && (
            <div className={styles.uploadProgress}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${uploadState.progress}%` }}
                ></div>
              </div>
              <span className={styles.progressText}>
                제출 중... {uploadState.progress}%
              </span>
            </div>
          )}

          {/* 업로드 에러 */}
          {uploadState.error && (
            <div className={styles.errorMessage}>
              ❌ 제출 실패: {uploadState.error}
            </div>
          )}
        </div>
      )}

      {/* STT 변환 결과 */}
      {transcription && (
        <div className={styles.successSection}>
          <div className={styles.successHeader}>
            <h3 className={styles.successTitle}>음성 변환 결과</h3>
          </div>

          <div className={styles.transcriptionResult}>
            <div className={styles.transcriptionText}>
              <p className={styles.transcriptContent}>
                {transcription.transcript}
              </p>
            </div>

            <div className={styles.resultDetails}>
              <p>🔉 녹음된 음성 확인하기:</p>
              <audio className={styles.audioPlayer} src={audioUrl} controls />
              {audioDuration && (
                <div className={styles.audioDurationInfo}>
                  <strong>녹음 길이:</strong> {formatTime(audioDuration)}
                </div>
              )}
            </div>
          </div>

          <div className={styles.successActions}>
            {/* 여기서도 조건부 렌더링 적용 */}
            {isSTTSuccess && (
              <button
                className={styles.uploadButton}
                onClick={handleUpload}
                disabled={uploadState.isUploading}
              >
                {uploadState.isUploading ? "제출 중..." : "제출하기"}
              </button>
            )}

            <button
              className={styles.newRecordingButton}
              onClick={handleNewRecording}
              disabled={isSTTProcessing}
            >
              새로 녹음하기
            </button>
          </div>
          {/* 업로드 진행률 */}
          {uploadState.isUploading && (
            <div className={styles.uploadProgress}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${uploadState.progress}%` }}
                ></div>
              </div>
              <span className={styles.progressText}>
                업로드 중... {uploadState.progress}%
              </span>
            </div>
          )}

          {/* 업로드 에러 */}
          {uploadState.error && (
            <div className={styles.errorMessage}>
              ❌ 업로드 실패: {uploadState.error}
            </div>
          )}
        </div>
      )}

      {/* 업로드 성공 */}
      {uploadResult && (
        <div className={styles.successSection}>
          <div className={styles.successHeader}>
            <h3 className={styles.successTitle}>🎉 제출 완료!</h3>
          </div>

          <div className={styles.successInfo}>
            <p className={styles.successText}>
              파일이 성공적으로 제출되었습니다.
            </p>
            {/* <div className={styles.fileDetails}>
              <p>
                <strong>파일 ID:</strong> {uploadResult.fileId}
              </p>
              <p>
                <strong>파일 길이:</strong>{" "}
                {audioDuration ? formatTime(audioDuration) : "알 수 없음"}
              </p>
              {qualityResult && (
                <p>
                  <strong>음성 품질:</strong> {qualityResult.score}/100
                </p>
              )}
              {transcription && (
                <p>
                  <strong>변환된 텍스트:</strong> {transcription.transcript}
                </p>
              )}
            </div> */}
          </div>

          <div className={styles.successActions}>
            {/* <a
              className={styles.viewFileLink}
              href={uploadResult.downloadURL}
              target="_blank"
              rel="noopener noreferrer"
            >
              🔗 업로드된 파일 보기
            </a>

            {transcription && (
              <button
                className={styles.copyButton}
                onClick={() => {
                  navigator.clipboard.writeText(transcription.transcript);
                  alert("텍스트가 클립보드에 복사되었습니다!");
                }}
              >
                📋 텍스트 복사
              </button>
            )} */}

            <button
              className={styles.newRecordingButton}
              onClick={handleNewRecording}
            >
              🔄 새로 녹음하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const VoiceRecorder = dynamic(() => Promise.resolve(RecorderComponent), {
  ssr: false,
  loading: () => <p className={styles.loading}>음성 녹음기 로딩 중...</p>,
});

export default VoiceRecorder;
