// utils/lightweightVAD.ts
// 경량 클라이언트 VAD 구현

export interface VADConfig {
  energyThreshold: number; // 음성 감지 에너지 임계값 (0-1)
  minSpeechDuration: number; // 최소 음성 구간 길이 (ms)
  maxSilenceDuration: number; // 최대 허용 무음 구간 (ms)
  frameSize: number; // 분석 프레임 크기 (ms)
}

export interface VADResult {
  processedBlob: Blob;
  originalDuration: number;
  processedDuration: number;
  silenceRemoved: number;
  compressionRatio: number;

  //  추가 필드들
  speechSegments: number; // 음성 구간 수
  avgSegmentLength: number; // 평균 음성 구간 길이
  longestSilenceGap: number; // 가장 긴 무음 구간
}

const DEFAULT_CONFIG: VADConfig = {
  energyThreshold: 0.01,
  minSpeechDuration: 300,
  maxSilenceDuration: 500,
  frameSize: 50,
};

/**
 * 경량 VAD로 음성 구간만 추출
 * @param blob 원본 오디오 블롭
 * @param recordingDuration 녹음 시간 (초)
 * @param config VAD 설정
 * @returns 처리된 오디오와 메타데이터
 */
export const removeNonSpeechSegments = async (
  blob: Blob,
  recordingDuration: number,
  config: Partial<VADConfig> = {}
): Promise<VADResult> => {
  const vadConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = performance.now();

  console.log("🎯 경량 VAD 처리 시작:", {
    size: Math.round(blob.size / 1024) + "KB",
    duration: recordingDuration.toFixed(1) + "초",
  });

  try {
    // 1. 오디오 데이터 디코딩
    const audioBuffer = await decodeAudioBlob(blob);

    // 2. 에너지 기반 음성 구간 감지
    const speechSegments = detectSpeechSegments(audioBuffer, vadConfig);

    // 3. 음성 구간만 추출하여 새로운 오디오 생성
    const processedBuffer = extractSpeechSegments(audioBuffer, speechSegments);

    // 4. 새로운 블롭 생성
    const processedBlob = await audioBufferToBlob(processedBuffer, blob.type);

    // 5. 결과 계산
    const processedDuration = processedBuffer.duration;
    const silenceRemoved = recordingDuration - processedDuration;
    const compressionRatio = processedDuration / recordingDuration;

    const avgSegmentLength =
      speechSegments.length > 0
        ? speechSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0) /
          speechSegments.length
        : 0;

    const longestSilenceGap =
      speechSegments.length > 1
        ? Math.max(
            ...speechSegments
              .slice(1)
              .map((seg, i) => seg.start - speechSegments[i].end)
          )
        : 0;

    const endTime = performance.now();
    console.log("✅ VAD 처리 완료:", {
      처리시간: Math.round(endTime - startTime) + "ms",
      압축률: Math.round(compressionRatio * 100) + "%",
      제거된무음: silenceRemoved.toFixed(1) + "초",
    });

    return {
      processedBlob,
      originalDuration: recordingDuration,
      processedDuration,
      silenceRemoved,
      compressionRatio,
      speechSegments: speechSegments.length, // 🔥 추가
      avgSegmentLength, // 🔥 추가
      longestSilenceGap,
    };
  } catch (error) {
    console.warn("VAD 처리 실패, 원본 반환:", error);

    // 실패 시 원본 그대로 반환
    return {
      processedBlob: blob,
      originalDuration: recordingDuration,
      processedDuration: recordingDuration,
      silenceRemoved: 0,
      compressionRatio: 1,
      speechSegments: 1, // 🔥 추가
      avgSegmentLength: recordingDuration, // 🔥 추가
      longestSilenceGap: 0, // 🔥 추가
    };
  }
};

/**
 * 오디오 블롭을 AudioBuffer로 디코딩
 */
const decodeAudioBlob = async (blob: Blob): Promise<AudioBuffer> => {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)();

  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    // 메모리 절약을 위해 컨텍스트 종료
    if (audioContext.state !== "closed") {
      await audioContext.close();
    }
  }
};

/**
 * 에너지 기반 음성 구간 감지
 */
const detectSpeechSegments = (
  audioBuffer: AudioBuffer,
  config: VADConfig
): Array<{ start: number; end: number }> => {
  const channelData = audioBuffer.getChannelData(0); // 모노 채널 사용
  const sampleRate = audioBuffer.sampleRate;
  const frameSize = Math.floor((config.frameSize / 1000) * sampleRate);

  console.log("🔍 음성 구간 분석:", {
    샘플수: channelData.length,
    샘플레이트: sampleRate,
    프레임크기: frameSize,
  });

  // 프레임별 에너지 계산
  const energies: number[] = [];
  for (let i = 0; i < channelData.length; i += frameSize) {
    const frameEnd = Math.min(i + frameSize, channelData.length);
    let energy = 0;

    // RMS (Root Mean Square) 에너지 계산
    for (let j = i; j < frameEnd; j++) {
      energy += channelData[j] * channelData[j];
    }
    energy = Math.sqrt(energy / (frameEnd - i));
    energies.push(energy);
  }

  // 동적 임계값 계산 (전체 에너지의 평균 기반)
  const avgEnergy = energies.reduce((sum, e) => sum + e, 0) / energies.length;
  const dynamicThreshold = Math.max(config.energyThreshold, avgEnergy * 0.1);

  console.log("📊 에너지 분석:", {
    평균에너지: avgEnergy.toFixed(4),
    동적임계값: dynamicThreshold.toFixed(4),
    설정임계값: config.energyThreshold,
  });

  // 음성 구간 검출
  const segments: Array<{ start: number; end: number }> = [];
  let speechStart = -1;

  for (let i = 0; i < energies.length; i++) {
    const currentTime = (i * frameSize) / sampleRate;

    if (energies[i] > dynamicThreshold) {
      // 음성 시작
      if (speechStart === -1) {
        speechStart = currentTime;
      }
    } else {
      // 무음 감지
      if (speechStart !== -1) {
        const speechDuration = (currentTime - speechStart) * 1000;

        // 최소 음성 길이 확인
        if (speechDuration >= config.minSpeechDuration) {
          segments.push({
            start: speechStart,
            end: currentTime,
          });
        }
        speechStart = -1;
      }
    }
  }

  // 마지막 구간 처리
  if (speechStart !== -1) {
    const endTime = channelData.length / sampleRate;
    const speechDuration = (endTime - speechStart) * 1000;

    if (speechDuration >= config.minSpeechDuration) {
      segments.push({
        start: speechStart,
        end: endTime,
      });
    }
  }

  // 인접한 구간 병합 (짧은 무음 구간 제거)
  const mergedSegments = mergeNearbySegments(
    segments,
    config.maxSilenceDuration / 1000
  );

  console.log("🎤 음성 구간 감지 완료:", {
    원본구간수: segments.length,
    병합후구간수: mergedSegments.length,
    총음성시간:
      mergedSegments
        .reduce((sum, seg) => sum + (seg.end - seg.start), 0)
        .toFixed(1) + "초",
  });

  return mergedSegments;
};

/**
 * 인접한 음성 구간 병합
 */
const mergeNearbySegments = (
  segments: Array<{ start: number; end: number }>,
  maxGap: number
): Array<{ start: number; end: number }> => {
  if (segments.length <= 1) return segments;

  const merged: Array<{ start: number; end: number }> = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - current.end;

    if (gap <= maxGap) {
      // 구간 병합
      current.end = segments[i].end;
    } else {
      // 새로운 구간 시작
      merged.push(current);
      current = { ...segments[i] };
    }
  }

  merged.push(current);
  return merged;
};

/**
 * 음성 구간만 추출하여 새로운 AudioBuffer 생성
 */
const extractSpeechSegments = (
  audioBuffer: AudioBuffer,
  segments: Array<{ start: number; end: number }>
): AudioBuffer => {
  if (segments.length === 0) {
    // 음성 구간이 없으면 빈 버퍼 반환
    const emptyBuffer = new AudioContext().createBuffer(
      audioBuffer.numberOfChannels,
      1,
      audioBuffer.sampleRate
    );
    return emptyBuffer;
  }

  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  // 총 출력 샘플 수 계산
  const totalSamples = segments.reduce((sum, segment) => {
    return sum + Math.floor((segment.end - segment.start) * sampleRate);
  }, 0);

  // 새로운 AudioBuffer 생성
  const audioContext = new AudioContext();
  const outputBuffer = audioContext.createBuffer(
    numberOfChannels,
    totalSamples,
    sampleRate
  );

  // 각 채널별로 음성 구간 복사
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    let outputIndex = 0;

    for (const segment of segments) {
      const startSample = Math.floor(segment.start * sampleRate);
      const endSample = Math.floor(segment.end * sampleRate);

      // 세그먼트 데이터 복사
      for (let i = startSample; i < endSample && i < inputData.length; i++) {
        if (outputIndex < outputData.length) {
          outputData[outputIndex++] = inputData[i];
        }
      }
    }
  }

  return outputBuffer;
};

/**
 * AudioBuffer를 Blob으로 변환
 */
const audioBufferToBlob = async (
  audioBuffer: AudioBuffer,
  originalType: string
): Promise<Blob> => {
  // WAV 형식으로 변환 (가장 호환성 좋음)
  const length = audioBuffer.length;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;

  // WAV 헤더 + 데이터
  const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(buffer);

  // WAV 헤더 작성
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length * numberOfChannels * 2, true);

  // 오디오 데이터 작성
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];
      const intSample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, intSample * 0x7fff, true);
      offset += 2;
    }
  }

  // 원본 타입이 webm이면 webm으로, 아니면 wav로
  const mimeType = originalType.includes("webm") ? "audio/webm" : "audio/wav";
  return new Blob([buffer], { type: mimeType });
};

/**
 * 빠른 품질 체크 (VAD 적용 전 사전 검증)
 */
export const shouldApplyVAD = (
  blob: Blob,
  recordingDuration: number
): boolean => {
  // 너무 짧거나 파일이 너무 작으면 VAD 스킵
  if (recordingDuration < 2 || blob.size < 1024) {
    return false;
  }

  // 너무 길면 성능상 VAD 스킵
  if (recordingDuration > 60) {
    return false;
  }

  // 저사양 기기 감지 (간단한 방법)
  const isLowEnd =
    navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
  if (isLowEnd && recordingDuration > 30) {
    return false;
  }

  return true;
};
