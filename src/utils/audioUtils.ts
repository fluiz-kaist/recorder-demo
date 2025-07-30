// 파일 크기 기반 간단한 품질 검증 (1-5ms 완료)
export interface SimpleQualityResult {
  isGoodQuality: boolean;
  score: number; // 0-100 점수
  issues: string[];
  recommendations: string[];
  fileSize: number;
  fileSizeKB: number;
}
export const validateAudioQualitySimple = (
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
