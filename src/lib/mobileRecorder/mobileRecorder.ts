import { useRef, useState } from "react";
// 모바일 최적화된 순수 Web Audio API 녹음기
export const MobileOptimizedRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedBuffersRef = useRef<Float32Array[]>([]);

  // 모바일 최적화 마이크 접근
  const getMicrophoneStream = async () => {
    // const isMobile =
    //   /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    //     navigator.userAgent
    //   );

    // 모바일에서 가장 호환성 좋은 설정들을 순서대로 시도
    const constraintsList = [
      // 1순위: 모바일 최적화 (exact는 일부 기기에서 실패할 수 있음)
      {
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      },
      // 2순위: 기본 설정 + 모노 채널
      {
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      },
      // 3순위: 최소 설정 (모바일 호환성 우선)
      {
        audio: true,
      },
    ];

    for (const constraints of constraintsList) {
      try {
        console.log("🎤 마이크 접근 시도:", constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        const track = stream.getAudioTracks()[0];
        const settings = track.getSettings();

        console.log("✅ 마이크 접근 성공:", settings);
        return stream;
      } catch (error) {
        if (error instanceof Error) {
          console.warn("⚠️ 설정 실패, 다음 설정 시도:", error.message);
        } else {
          console.warn("⚠️ 설정 실패, 다음 설정 시도:", error);
        }
        continue;
      }
    }

    throw new Error("모든 마이크 설정이 실패했습니다.");
  };

  // 강제 모노 변환을 위한 AudioContext 설정
  const createMonoAudioContext = async (stream: MediaStream) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass({
      sampleRate: 16000, // STT 최적화
      latencyHint: "interactive",
    });

    console.log("🔊 AudioContext 생성:", {
      sampleRate: audioContext.sampleRate,
      state: audioContext.state,
    });

    const source = audioContext.createMediaStreamSource(stream);

    // 입력이 스테레오든 모노든 상관없이 강제로 모노 출력
    const merger = audioContext.createChannelMerger(1);
    const splitter = audioContext.createChannelSplitter(2); // 최대 2채널로 가정

    // 스테레오 → 모노 변환
    source.connect(splitter);
    splitter.connect(merger, 0, 0); // 왼쪽 채널만 사용 (또는 믹싱 가능)

    // ScriptProcessorNode 생성 (구형 브라우저 호환성)
    const bufferSize = 4096;
    const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

    recordedBuffersRef.current = [];

    processor.onaudioprocess = (event) => {
      if (!isRecording) return;

      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0); // 모노 채널

      // Float32Array를 복사해서 저장
      const buffer = new Float32Array(inputData.length);
      buffer.set(inputData);
      recordedBuffersRef.current.push(buffer);
    };

    // 연결: source → splitter → merger → processor → destination
    merger.connect(processor);
    processor.connect(audioContext.destination);

    return { audioContext, source, processor };
  };

  // 녹음 시작
  const startRecording = async () => {
    try {
      console.log("🎤 녹음 시작");

      // 1. 마이크 스트림 획득
      const stream = await getMicrophoneStream();
      streamRef.current = stream;

      // 2. AudioContext 및 노드 설정
      const { audioContext, source, processor } = await createMonoAudioContext(
        stream
      );
      audioContextRef.current = audioContext;
      sourceNodeRef.current = source;
      processorNodeRef.current = processor;

      // 3. 녹음 상태 설정
      setIsRecording(true);
      setRecordingTime(0);
      recordedBuffersRef.current = [];

      // 4. 타이머 시작
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      console.log("✅ 녹음 시작 완료");
    } catch (error) {
      console.error("❌ 녹음 시작 실패:", error);
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`녹음 시작 실패: ${errorMessage}`);
    }
  };

  // 녹음 중지 및 WAV 생성
  const stopRecording = async () => {
    try {
      console.log("🛑 녹음 중지");

      setIsRecording(false);

      // 타이머 정리
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // AudioContext 정리
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // 녹음된 데이터를 WAV로 변환
      const audioBlob = createMonoWavBlob(recordedBuffersRef.current, 16000);

      console.log("📄 WAV 파일 생성:", {
        size: audioBlob.size,
        type: audioBlob.type,
        bufferCount: recordedBuffersRef.current.length,
      });

      setAudioBlob(audioBlob);

      // WAV 헤더 검증
      await validateWavFile(audioBlob);
    } catch (error) {
      console.error("❌ 녹음 중지 실패:", error);
    }
  };

  // 모노 WAV 파일 생성 (16000Hz, 16-bit, 모노)
  const createMonoWavBlob = (
    buffers: Float32Array[],
    sampleRate: number
  ): Blob => {
    // 전체 길이 계산
    const totalLength = buffers.reduce((acc, buffer) => acc + buffer.length, 0);

    // 16-bit PCM 데이터 생성
    const pcmData = new Int16Array(totalLength);
    let offset = 0;

    for (const buffer of buffers) {
      for (let i = 0; i < buffer.length; i++) {
        // Float32 → Int16 변환 (-1.0 ~ 1.0 → -32768 ~ 32767)
        const sample = Math.max(-1, Math.min(1, buffer[i]));
        pcmData[offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
    }

    // WAV 헤더 + PCM 데이터
    const wavBuffer = createWavBuffer(pcmData, sampleRate, 1); // 1 = 모노
    return new Blob([wavBuffer], { type: "audio/wav" });
  };

  // WAV 헤더 생성

  const createWavBuffer = (
    pcmData: Int16Array,
    sampleRate: number,
    numChannels: number
  ): ArrayBuffer => {
    const bytesPerSample = 2; // 16-bit
    const dataLength = pcmData.length * bytesPerSample;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;

    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);

    // WAV 헤더 작성
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, totalLength - 8, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true); // 채널 수
    view.setUint32(24, sampleRate, true); // 샘플레이트
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, "data");
    view.setUint32(40, dataLength, true);

    // PCM 데이터 복사
    const pcmView = new Int16Array(buffer, headerLength);
    pcmView.set(pcmData);

    return buffer;
  };

  // WAV 파일 검증
  const validateWavFile = async (blob: Blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    const numChannels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);

    console.log("🔍 생성된 WAV 파일 검증:", {
      channels: numChannels,
      sampleRate: sampleRate,
      bitsPerSample: bitsPerSample,
      size: blob.size,
      isSTTReady: numChannels === 1 && sampleRate === 16000,
    });

    if (numChannels !== 1) {
      console.warn("⚠️ 채널 수가 모노가 아닙니다!");
    }

    return numChannels === 1;
  };

  return {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
  };
};
