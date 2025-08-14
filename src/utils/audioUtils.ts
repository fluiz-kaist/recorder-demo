import {
  removeNonSpeechSegments,
  shouldApplyVAD,
  type VADResult,
} from "@/utils/lightweightVAD";

// 기존 인터페이스는 그대로 유지
export interface SimpleQualityResult {
  isGoodQuality: boolean;
  score: number; // 0-100 점수
  issues: string[];
  recommendations: string[];
  fileSize: number;
  fileSizeKB: number;

  //  VAD 관련 필드 추가
  vadApplied?: boolean;
  processedBlob?: Blob; // VAD 처리된 오디오
  compressionRatio?: number; // 압축 비율

  // 🔥 VAD 관련 필드 추가
  processedDuration?: number;
  silenceRemoved?: number;
  speechSegments?: number;
  avgSegmentLength?: number;
  longestSilenceGap?: number;
}

import { getEnv } from "@/utils/envConfig";

// 내부적으로만 사용할 확장 인터페이스
interface InternalEnhancedResult extends SimpleQualityResult {
  vadApplied: boolean;
  vadResult?: VADResult;
}

const { isPreview, isDev } = getEnv();

// 기존 함수를 내부 함수로 이름 변경
const validateAudioQualitySimpleOriginal = (
  blob: Blob,
  recordingDuration: number
): SimpleQualityResult => {
  // ... 기존 코드 전체 그대로 ...
  const startTime = performance.now();

  const fileSize = blob.size;
  const fileSizeKB = Math.round(fileSize / 1024);

  let score = 100;
  const issues: string[] = [];
  const recommendations: string[] = [];

  console.group(
    `🔍 음성 품질 검증 (${Math.round(
      blob.size / 1024
    )}KB, ${recordingDuration.toFixed(1)}초)`
  );

  // 조기 실패 판정 (성능 최적화)
  if (!blob || blob.size === 0) {
    return {
      isGoodQuality: false,
      score: 0,
      issues: ["녹음 파일이 없습니다"],
      recommendations: ["다시 녹음해 주세요"],
      fileSize: 0,
      fileSizeKB: 0,
    };
  }

  if (fileSizeKB < 1 && recordingDuration > 2) {
    return {
      isGoodQuality: false,
      score: 0,
      issues: ["마이크 접근 권한이 거부되었을 가능성이 있습니다"],
      recommendations: ["마이크 권한을 허용하고 다시 녹음해 주세요"],
      fileSize,
      fileSizeKB,
    };
  }

  // 모바일 환경별 최적화된 기준값
  const getMobileQualityThreshold = () => {
    const ua = navigator.userAgent;

    if (/iPhone|iPad/.test(ua)) {
      return { minRatio: 0.25, baseSize: 5.5 };
    } else if (/Android/.test(ua)) {
      const chromeVersion = ua.match(/Chrome\/(\d+)/)?.[1];
      const isNewChrome = parseInt(chromeVersion || "0") > 100;
      return {
        minRatio: isNewChrome ? 0.3 : 0.4,
        baseSize: isNewChrome ? 6.8 : 7.5,
      };
    }
    return { minRatio: 0.3, baseSize: 8 };
  };

  const { minRatio, baseSize } = getMobileQualityThreshold();

  // 실제 압축률 데이터 기반 예상 크기 계산
  const getExpectedSize = (duration: number, type: string) => {
    if (type.includes("webm")) {
      return duration * (6.5 + Math.random() * 1.5); // Opus 64kbps 실측
    } else if (type.includes("mp4")) {
      return duration * 7.2; // AAC 기준
    }
    return duration * baseSize;
  };

  const expectedSize = getExpectedSize(recordingDuration, blob.type);

  // 1. 녹음 시간 검증 (개선됨)
  if (recordingDuration < 2) {
    score -= 40;
    issues.push(
      `녹음 시간이 너무 짧습니다 (${recordingDuration.toFixed(1)}초)`
    );
    recommendations.push("최소 2초 이상 말씀해 주세요");
  } else if (recordingDuration < 3) {
    score -= 20;
    issues.push("녹음 시간이 조금 짧습니다");
    recommendations.push("더 자세히 말씀해 주세요");
  }

  if (recordingDuration > 60) {
    score -= 10;
    issues.push(`녹음 시간이 너무 깁니다 (${Math.round(recordingDuration)}초)`);
    recommendations.push("1분 이내로 간결하게 말씀해 주세요");
  }

  // 2. 시간대별 차등 기준 적용
  const analyzeQualityByDuration = (duration: number, sizeKB: number) => {
    if (duration < 3) {
      // 짧은 음성: 압축 효율 떨어짐 (헤더 오버헤드)
      const minSize = 2 + duration * 4;
      return sizeKB >= minSize;
    } else if (duration > 30) {
      // 긴 음성: 압축 효율 높아짐
      const expectedSizeForLong = duration * 5.5;
      return sizeKB >= expectedSizeForLong * 0.6;
    } else {
      // 중간 길이: 표준 기준
      return sizeKB >= expectedSize * minRatio;
    }
  };

  // 3. 파일 크기 절대값 검증 (정교화)
  const minExpectedSize = Math.max(2, recordingDuration * 3); // 최소 3KB/초
  const maxExpectedSize = recordingDuration * 15; // 최대 15KB/초

  if (fileSizeKB < minExpectedSize * 0.1) {
    // 거의 완전 무음일 때만 처리
    score -= 50;
    issues.push("거의 무음상태로 녹음되었습니다");
    recommendations.push(
      "조용한 곳에서 마이크에 가까이 대고 다시 녹음해 주세요"
    );
  }

  if (fileSizeKB > maxExpectedSize) {
    score -= 10;
    issues.push("배경 소음이 많거나 마이크 감도가 높습니다");
    recommendations.push("조용한 환경에서 녹음해 주세요");
  }

  // 4. 압축률 기반 품질 추정 (핵심 개선)
  const sizeRatio = fileSizeKB / expectedSize;

  console.log(
    `📊 압축률 분석: 예상=${expectedSize.toFixed(
      1
    )}KB, 실제=${fileSizeKB}KB, 비율=${sizeRatio.toFixed(2)}`
  );

  if (!analyzeQualityByDuration(recordingDuration, fileSizeKB)) {
    if (sizeRatio < 0.01) {
      // 기존: 0.05를 0.01로 변경 (거의 완전 무음)
      score -= 45;
      issues.push("녹음된 소리가 거의 들리지 않아요.");
      recommendations.push(
        "마이크 사용이 허용되어 있는지 확인해 주시고, 조용한 곳에서 다시 말씀해 주세요."
      );
    } else if (sizeRatio < 0.05) {
      // 기존: 0.2를 0.05로 변경
      score -= 35;
      issues.push("녹음된 소리가 너무 작아요.");
      recommendations.push(
        "말씀하실 때, 핸드폰을 입에서 15~20cm 정도 거리로 가까이 두고, 조금 더 크게 말씀해 주세요."
      );
    } else if (sizeRatio < minRatio) {
      score -= 20;
      issues.push("소리가 작게 녹음되었어요.");
      recommendations.push("조금 더 크게 말씀해 주시면 좋아요.");
    }
  }
  if (sizeRatio > 2.0) {
    score -= 15;
    issues.push("주변 소음이 너무 크거나 소리가 뭉개졌을 수 있어요.");
    recommendations.push(
      "조용한 곳에서 핸드폰과 약간 거리를 두고 다시 녹음해 보세요."
    );
  }

  // 5. 무음 구간 감지 (파일 크기만으로)
  const detectSilencePattern = (duration: number, sizeKB: number) => {
    const avgSizePerSec = sizeKB / duration;

    // 이 부분을 더 관대하게 수정 - 완전 무음일 때만 문제로 판단
    if (avgSizePerSec < 0.5 && duration > 5) {
      // 기존: 2
      return "녹음 중에 조용한 시간이 너무 길게 이어졌어요.";
    }

    // 이 부분도 더 엄격한 기준으로 변경
    const expectedVariation = Math.log(duration) * 0.5; // 기존: 1.2
    if (avgSizePerSec < expectedVariation && duration > 10) {
      // 기존: 3
      return "녹음 도중에 조용한 구간이 있었던 것 같아요.";
    }

    return null;
  };
  const silenceIssue = detectSilencePattern(recordingDuration, fileSizeKB);
  if (silenceIssue) {
    score -= 15;
    issues.push(silenceIssue);
    recommendations.push("연속으로 또렷하게 말씀해 주세요");
  }

  // 6. 포맷 및 브라우저 호환성 검사 (강화)
  if (blob.type === "" || blob.type === "audio/wav") {
    score -= 20;
    issues.push("브라우저 호환성 문제가 있을 수 있습니다");
    recommendations.push(
      "브라우저를 업데이트하거나 다른 브라우저를 사용해 주세요"
    );
  } else if (!blob.type.includes("webm") && !blob.type.includes("mp4")) {
    score -= 10;
    issues.push("최적 포맷이 아닙니다");
  }

  // 7. 실제 문제 패턴 인식
  const avgSizePerSecond = fileSizeKB / recordingDuration;

  // 이상치 감지
  if (avgSizePerSecond > 50) {
    score = 0;
    issues.unshift("녹음 오류가 발생했습니다");
    recommendations.unshift("페이지를 새로고침하고 다시 녹음해 주세요");
  } else if (avgSizePerSecond < 0.2 && recordingDuration > 5) {
    // 기존: 0.5, 3을 0.2, 5로 변경
    score -= 15; // 기존: 25를 15로 감점 완화
    issues.push("네트워크 연결이 불안정했을 수 있습니다");
    recommendations.push("안정한 네트워크 연결에서 다시 시도해 주세요");
  }

  // 8. 모바일 특화 검사 및 추천
  const isMobile =
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  if (isMobile && score < 70) {
    recommendations.push("핸드폰 마이크 구멍이 막히지 않았는지 확인해 주세요");

    // iOS Safari 특별 처리
    if (
      /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
      blob.type.includes("mp4")
    ) {
      score += 5; // iOS에서 mp4는 더 신뢰할 수 있음
    }
  }

  // 9. 가중치 기반 최종 점수 계산
  const coreQualityWeight = 0.7; // 음성 품질이 가장 중요
  const stabilityWeight = 0.2; // 기술적 안정성
  const usabilityWeight = 0.1; // 사용성

  // 핵심 품질 점수 (압축률 기반)
  const coreScore =
    sizeRatio >= minRatio ? 100 : Math.max(0, (sizeRatio / minRatio) * 100);

  // 기술적 안정성 점수 (포맷, 브라우저 호환성)
  const stabilityScore = blob.type.includes("webm")
    ? 100
    : blob.type.includes("mp4")
    ? 90
    : 60;

  // 사용성 점수 (시간, 크기 적절성)
  const usabilityScore =
    recordingDuration >= 2 && recordingDuration <= 60 ? 100 : 70;

  const weightedScore = Math.round(
    coreScore * coreQualityWeight +
      stabilityScore * stabilityWeight +
      usabilityScore * usabilityWeight
  );

  // 최종 점수는 기존 감점 방식과 가중치 방식 중 더 관대한 것 선택
  score = Math.max(Math.max(0, score), Math.min(100, weightedScore));

  // 10. 우선순위별 이슈 정렬 (심각도 순)
  const sortIssuesBySeverity = (issues: string[]) => {
    const severityOrder = [
      "녹음 오류가 발생했습니다",
      "마이크 접근 권한이 거부되었을",
      "거의 무음",
      "매우 작습니다",
      "너무 작게",
      "브라우저 호환성",
      "배경 소음",
      "너무 짧습니다",
      "너무 깁니다",
    ];

    return issues.sort((a, b) => {
      const aIndex = severityOrder.findIndex((keyword) => a.includes(keyword));
      const bIndex = severityOrder.findIndex((keyword) => b.includes(keyword));
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  };

  const result: SimpleQualityResult = {
    isGoodQuality: score >= 70 && issues.length <= 2,
    score,
    issues: sortIssuesBySeverity(issues),
    recommendations,
    fileSize,
    fileSizeKB,
  };

  const endTime = performance.now();
  console.log(
    `✅ 간단 품질 검증 완료: ${(endTime - startTime).toFixed(2)}ms, 점수=${
      result.score
    }/100, 품질=${result.isGoodQuality ? "좋음" : "개선필요"}`
  );
  console.groupEnd();
  return result;
};

// VAD 결과를 반영한 품질 평가 보정 (내부 함수)
const enhanceQualityWithVADResult = (
  basicResult: SimpleQualityResult,
  vadResult: VADResult
): SimpleQualityResult => {
  let enhancedScore = basicResult.score;
  const issues = [...basicResult.issues];
  const recommendations = [...basicResult.recommendations];

  // VAD 성과에 따른 보정
  if (vadResult.compressionRatio < 0.3) {
    enhancedScore += 15;
    issues.push(
      `원본에 무음 구간이 ${Math.round(
        (1 - vadResult.compressionRatio) * 100
      )}% 포함되어 있었음`
    );
    // 기술적 메시지 제거하고 친화적으로 변경
    if (isDev && isPreview) {
      recommendations.push("녹음이 자동으로 깔끔하게 정리되었습니다");
    }
  } else if (vadResult.compressionRatio < 0.7) {
    enhancedScore += 10;
    if (isDev && isPreview) {
      recommendations.push("녹음이 자동으로 깔끔하게 정리되었습니다");
    }
  } else if (vadResult.compressionRatio > 0.95) {
    enhancedScore += 5;
    if (isDev && isPreview) {
      recommendations.push("녹음이 자동으로 깔끔하게 정리되었습니다");
    }
  }

  enhancedScore = Math.min(100, enhancedScore);

  return {
    ...basicResult,
    score: enhancedScore,
    issues,
    recommendations, // 사용자 친화적 메시지만
    isGoodQuality: enhancedScore >= 70 && issues.length <= 2,
  };
};
// 기존 함수명을 그대로 사용하는 래퍼 함수
export const validateAudioQualitySimple = async (
  blob: Blob,
  recordingDuration: number
): Promise<SimpleQualityResult> => {
  const basicResult = validateAudioQualitySimpleOriginal(
    blob,
    recordingDuration
  );
  const shouldUseVAD =
    shouldApplyVAD(blob, recordingDuration) && basicResult.score >= 40;

  if (!shouldUseVAD) {
    return {
      ...basicResult,
      vadApplied: false,
      processedBlob: blob,
      processedDuration: recordingDuration,
      silenceRemoved: 0,
      compressionRatio: 1.0,
      speechSegments: 1,
      // 기술적 메시지 제거 - 이 부분은 그대로 두고 나중에 관리자 정보 추가
    };
  }

  try {
    const vadResult = await removeNonSpeechSegments(blob, recordingDuration);
    const enhancedResult = enhanceQualityWithVADResult(basicResult, vadResult);

    return {
      ...enhancedResult,
      vadApplied: true,
      processedBlob: vadResult.processedBlob,
      processedDuration: vadResult.processedDuration,
      silenceRemoved: vadResult.silenceRemoved,
      compressionRatio: vadResult.compressionRatio,
      speechSegments: vadResult.speechSegments || 1,
    };
  } catch (error) {
    return {
      ...basicResult,
      vadApplied: false,
      processedBlob: blob,
      compressionRatio: 1.0,
    };
  }
};
// 🔥 추가: VAD 처리된 오디오 블롭을 가져오는 헬퍼 함수 (필요시 사용)
export const getProcessedAudioBlob = async (
  blob: Blob,
  recordingDuration: number
): Promise<{ blob: Blob; wasProcessed: boolean }> => {
  if (!shouldApplyVAD(blob, recordingDuration)) {
    return { blob, wasProcessed: false };
  }

  try {
    const vadResult = await removeNonSpeechSegments(blob, recordingDuration);
    return {
      blob: vadResult.processedBlob,
      wasProcessed: vadResult.compressionRatio < 0.95,
    };
  } catch (error) {
    console.warn("VAD 처리 실패:", error);
    return { blob, wasProcessed: false };
  }
};
