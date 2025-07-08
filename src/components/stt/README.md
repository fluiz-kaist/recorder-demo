# STT (google-transcribe) Components

음성을 텍스트로 변환하는 React 컴포넌트 라이브러리입니다. Google Cloud google-transcribe와 OpenAI Whisper API를 지원합니다.

## 파일 구조

```
components/stt/
├── README.md                    # 이 파일
├── SttGoogle.tsx            # Google STT 컴포넌트
├── SttWhisper.tsx     # OpenAI Whisper STT 컴포넌트
└── types/
    ├── google-stt.types.ts     # Google STT 타입 정의
    └── whisper-stt.types.ts    # Whisper STT 타입 정의
```

## 사용법

### Google STT 컴포넌트

```tsx
import SttGoogle from "@/components/stt/SttGoogle";

const MyComponent = () => {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const handleTranscriptionComplete = (result) => {
    if (result) {
      console.log("변환된 텍스트:", result.transcript);
      console.log("신뢰도:", result.confidence);
    }
  };

  const handleError = (error) => {
    console.error("STT 오류:", error);
  };

  return (
    <SttGoogle
      audioBlob={audioBlob}
      onTranscriptionComplete={handleTranscriptionComplete}
      onError={handleError}
      autoTranscribe={true}
      onTranscribingStateChange={(isTranscribing) => {
        console.log("변환 중:", isTranscribing);
      }}
    />
  );
};
```

### OpenAI Whisper STT 컴포넌트

```tsx
import SttWhisper from "@/components/stt/SttWhisper";

const MyComponent = () => {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const handleTranscriptionComplete = (result) => {
    if (result) {
      console.log("변환된 텍스트:", result.transcript);
    }
  };

  return (
    <SttWhisper
      audioBlob={audioBlob}
      onTranscriptionComplete={handleTranscriptionComplete}
      onError={handleError}
      autoTranscribe={false}
    />
  );
};
```

## Props 인터페이스

### 공통 Props

| Prop                        | 타입                                                  | 필수 | 기본값  | 설명                |
| --------------------------- | ----------------------------------------------------- | ---- | ------- | ------------------- |
| `audioBlob`                 | `Blob \| null`                                        | ✅   | -       | 변환할 오디오 파일  |
| `onTranscriptionComplete`   | `(result: GoogleTranscriptionResult \| null) => void` | ✅   | -       | 변환 완료 콜백      |
| `onError`                   | `(error: string) => void`                             | ✅   | -       | 에러 발생 콜백      |
| `autoTranscribe`            | `boolean`                                             | ❌   | `false` | 자동 변환 여부      |
| `onTranscribingStateChange` | `(isTranscribing: boolean) => void`                   | ❌   | -       | 변환 상태 변경 콜백 |

### 응답 타입

#### Google STT

```typescript
interface GoogleTranscriptionResult {
  transcript: string;
  confidence: number; // 0.0 ~ 1.0
}
```

#### Whisper STT

```typescript
interface WhisperTranscriptionResult {
  transcript: string;
  confidence?: number; // 기본적으로 제공되지 않음
}
```

## 🔧 API 요구사항

### Google STT API 호출 요구사항

- **엔드포인트**: `/api/stt/google-transcribe`
- **메서드**: `POST`
- **Content-Type**: `multipart/form-data`
- **필드**:
  - `audio`: 오디오 파일 (Blob)
  - `languageCode`: 언어 코드 (기본값: "ko-KR")

### Whisper STT API 호출 요구사항

- **엔드포인트**: `/api/stt/whisper-transcribe`
- **메서드**: `POST`
- **Content-Type**: `multipart/form-data`
- **필드**:
  - `file`: 오디오 파일 (Blob)
  - `model`: Whisper 모델 (기본값: "whisper-1")
  - `language`: 언어 코드 (기본값: "ko")
  - `response_format`: 응답 형식 (기본값: "json")

## 🎵 지원 오디오 형식

### Google STT

- WebM (Opus 코덱)
- WAV (Linear16)
- MP3
- FLAC

### OpenAI Whisper

- flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm

## 파일 크기 제한

- **Google STT**: 10MB
- **OpenAI Whisper**: 25MB

## 컴포넌트 상태

1. **대기 상태**: 오디오 파일이 없거나 변환 버튼 대기
2. **변환 중**: `isTranscribing: true`, 로딩 스피너 표시
3. **변환 완료**: 성공/실패 상태에 따른 UI 업데이트
4. **에러 상태**: ErrorPopup을 통한 에러 메시지 표시

## 필요한 환경 변수

### Google STT

```env
GCP_CREDENTIALS_JSON={"type":"service_account",...}
```

### OpenAI Whisper

```env
OPENAI_API_KEY=sk-...
```

## 에러 처리

### 자동 에러 처리

- HTTP 상태 코드별 사용자 친화적 메시지
- 네트워크 오류 감지
- 타임아웃 처리 (Google: 30초, Whisper: 45초)
- 파일 형식 오류 처리

### 커스텀 에러 처리

```tsx
const handleError = (error: string) => {
  // 로깅
  console.error("STT Error:", error);

  // 사용자 알림
  alert(`음성 변환 오류: ${error}`);

  // 상태 초기화
  setAudioBlob(null);
};
```

## 🔄 라이프사이클

1. **컴포넌트 마운트**: 상태 초기화
2. **오디오 파일 설정**: `audioBlob` props 변경 시 `hasTranscribed` 초기화
3. **자동 변환**: `autoTranscribe=true`일 때 자동 실행
4. **수동 변환**: 버튼 클릭 시 실행
5. **결과 처리**: 성공/실패에 따른 콜백 호출
6. **정리**: 컴포넌트 언마운트 시 상태 정리

## 사용 시나리오

### 1. 실시간 음성 메모

```tsx
<STTComponent
  audioBlob={recordedAudio}
  autoTranscribe={true}
  onTranscriptionComplete={(result) => {
    if (result) saveToDatabase(result.transcript);
  }}
/>
```

### 2. 수동 변환

```tsx
<STTComponent
  audioBlob={uploadedAudio}
  autoTranscribe={false}
  onTranscriptionComplete={handleResult}
/>
```

### 3. 배치 처리

```tsx
const processMultipleFiles = async (files: Blob[]) => {
  for (const file of files) {
    await new Promise((resolve) => {
      <STTComponent
        audioBlob={file}
        autoTranscribe={true}
        onTranscriptionComplete={resolve}
      />;
    });
  }
};
```
