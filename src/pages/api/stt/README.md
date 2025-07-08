# STT API Documentation

Speech-to-Text API 엔드포인트들에 대한 상세 문서입니다.

## API 구조

```
pages/api/
├── README.md                 # 이 파일
├── google-transcribe.ts        # Google Cloud STT API
└── whisper-transcribe.ts    # OpenAI Whisper STT API
```

## API 엔드포인트

### 1. Google Cloud Speech-to-Text API

#### 기본 정보

- **URL**: `/api/google-transcribe`
- **메서드**: `POST`
- **Content-Type**: `multipart/form-data`
- **타임아웃**: 30초

#### 요청 형식

```javascript
const formData = new FormData();
formData.append("audio", audioBlob, "recording.webm");
formData.append("languageCode", "ko-KR");

const response = await fetch("/api/google-transcribe", {
  method: "POST",
  body: formData,
});
```

#### 요청 파라미터

| 파라미터       | 타입        | 필수 | 기본값  | 설명                    |
| -------------- | ----------- | ---- | ------- | ----------------------- |
| `audio`        | `File/Blob` | ✅   | -       | 오디오 파일 (최대 10MB) |
| `languageCode` | `string`    | ❌   | `ko-KR` | 언어 코드 (BCP-47)      |

#### 응답 형식

```typescript
interface STTResponse {
  success: boolean;
  transcription?: {
    transcript: string;
    confidence: number; // 0.0 ~ 1.0
  };
  error?: string;
}
```

#### 성공 응답 예시

```json
{
  "success": true,
  "transcription": {
    "transcript": "안녕하세요, 테스트 음성입니다.",
    "confidence": 0.9876543
  }
}
```

#### 오류 응답 예시

```json
{
  "success": false,
  "error": "음성을 인식할 수 없습니다. 더 명확하게 말씀해 주세요."
}
```

#### 지원 오디오 형식

- **WebM (Opus)**: 48kHz 샘플레이트
- **WAV (Linear16)**: 16kHz 샘플레이트
- **MP3**: 가변 비트레이트
- **FLAC**: 무손실 압축

#### 환경 변수 설정

```env
# Google Cloud 서비스 계정 키 (JSON 형식)
GCP_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
```

#### 주요 특징

- 자동 구두점 추가 (`enableAutomaticPunctuation: true`)
- 향상된 모델 사용 (`useEnhanced: true`)
- 긴 형식 모델 (`model: "latest_long"`)
- 자동 오디오 형식 감지
- 임시 파일 자동 정리

---

### 2. OpenAI Whisper API

#### 기본 정보

- **URL**: `/api/whisper-transcribe`
- **메서드**: `POST`
- **Content-Type**: `multipart/form-data`
- **타임아웃**: 45초

#### 요청 형식

```javascript
const formData = new FormData();
formData.append("file", audioBlob, "recording.webm");
formData.append("model", "whisper-1");
formData.append("language", "ko");
formData.append("response_format", "json");

const response = await fetch("/api/whisper-transcribe", {
  method: "POST",
  body: formData,
});
```

#### 요청 파라미터

| 파라미터          | 타입        | 필수 | 기본값      | 설명                    |
| ----------------- | ----------- | ---- | ----------- | ----------------------- |
| `file`            | `File/Blob` | ✅   | -           | 오디오 파일 (최대 25MB) |
| `model`           | `string`    | ❌   | `whisper-1` | Whisper 모델명          |
| `language`        | `string`    | ❌   | -           | 언어 코드 (ISO-639-1)   |
| `response_format` | `string`    | ❌   | `json`      | 응답 형식               |

#### 응답 형식

```typescript
interface WhisperSTTResponse {
  success: boolean;
  transcription?: {
    transcript: string;
    confidence?: number; // 기본적으로 제공되지 않음
  };
  error?: string;
}
```

#### 성공 응답 예시

```json
{
  "success": true,
  "transcription": {
    "transcript": "안녕하세요, 테스트 음성입니다."
  }
}
```

#### 오류 응답 예시

```json
{
  "success": false,
  "error": "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
}
```

#### 지원 오디오 형식

- **모든 주요 형식**: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
- **높은 호환성**: 다양한 코덱 및 비트레이트 지원

#### 환경 변수 설정

```env
# OpenAI API 키
OPENAI_API_KEY=sk-...
```

#### 주요 특징

- 25MB 대용량 파일 지원
- 다양한 오디오 형식 지원
- 자동 언어 감지 (언어 미지정시)
- 높은 정확도
- 빠른 처리 속도

---

## 공통 구현 사항

### 에러 처리

#### HTTP 상태 코드별 처리

```typescript
// 400: 잘못된 요청
if (response.status === 400) {
  throw new Error("잘못된 요청입니다. 오디오 파일을 확인해주세요.");
}

// 401: 인증 실패
if (response.status === 401) {
  throw new Error("API 키가 유효하지 않습니다.");
}

// 429: 요청 한도 초과 (Whisper)
if (response.status === 429) {
  throw new Error("API 요청 한도를 초과했습니다.");
}

// 500: 서버 오류
if (response.status === 500) {
  throw new Error("서버 오류가 발생했습니다.");
}
```

#### 네트워크 오류 처리

```typescript
try {
  const response = await fetch(url, options);
} catch (error) {
  if (error.name === "AbortError") {
    throw new Error("요청 시간이 초과되었습니다.");
  }
  if (error.message.includes("fetch")) {
    throw new Error("네트워크 연결을 확인해주세요.");
  }
}
```

### 파일 처리

#### formidable 설정

```typescript
const form = new IncomingForm({
  uploadDir: process.env.VERCEL ? "/tmp" : os.tmpdir(),
  keepExtensions: true,
  maxFileSize: 25 * 1024 * 1024, // 25MB
});
```

#### 임시 파일 정리

```typescript
try {
  fs.unlinkSync(audioFile.filepath);
  console.log("임시 파일 정리 완료");
} catch (cleanupError) {
  console.warn("임시 파일 정리 실패:", cleanupError);
}
```

### 보안 고려사항

#### API 키 보호

```typescript
// 환경 변수 확인
if (!process.env.OPENAI_API_KEY) {
  throw new Error("API 키가 설정되지 않았습니다.");
}

// API 키 노출 방지
const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
});
```

#### 파일 크기 검증

```typescript
if (audioFile.size > 25 * 1024 * 1024) {
  return res.status(400).json({
    success: false,
    error: "파일 크기가 너무 큽니다.",
  });
}
```

## 배포 고려사항

### Vercel 배포

- `/tmp` 디렉토리 사용 (임시 파일 저장)
- 환경 변수를 Vercel 대시보드에서 설정
- 함수 실행 시간 제한 고려 (Hobby: 10초, Pro: 60초)

### 성능 최적화

- 임시 파일 즉시 정리
- 적절한 타임아웃 설정
- 메모리 사용량 모니터링

### 모니터링

```typescript
console.log("API 요청 시작", {
  fileSize: audioFile.size,
  mimetype: audioFile.mimetype,
  timestamp: new Date().toISOString(),
});
```

## 테스트

### cURL 테스트 예시

#### Google STT 테스트

```bash
curl -X POST http://localhost:3000/api/stt/google-transcribe \
  -F "audio=@test.wav" \
  -F "languageCode=ko-KR"
```

#### Whisper STT 테스트

```bash
curl -X POST http://localhost:3000/api/stt/whisper-transcribe \
  -F "file=@test.wav" \
  -F "model=whisper-1" \
  -F "language=ko"
```

### JavaScript 테스트

```javascript
// 테스트 함수
async function testSTT(endpoint, audioBlob) {
  const formData = new FormData();

  if (endpoint.includes("whisper")) {
    formData.append("file", audioBlob, "test.wav");
    formData.append("model", "whisper-1");
  } else {
    formData.append("audio", audioBlob, "test.wav");
    formData.append("languageCode", "ko-KR");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  return response.json();
}
```

## 성능 비교

| 항목           | Google STT  | OpenAI Whisper |
| -------------- | ----------- | -------------- |
| 파일 크기 제한 | 10MB        | 25MB           |
| 처리 속도      | 빠름        | 보통           |
| 정확도         | 높음        | 매우 높음      |
| 언어 지원      | 광범위      | 광범위         |
| 가격           | 사용량 기반 | 분당 과금      |
| 신뢰도 점수    | 제공        | 미제공         |

## 🔍 트러블슈팅

### 자주 발생하는 문제

#### 1. 인증 오류

```
해결: 환경 변수 확인, API 키 유효성 검사
```

#### 2. 파일 형식 오류

```
해결: 지원 형식 확인, 파일 변환
```

#### 3. 타임아웃 오류

```
해결: 파일 크기 줄이기, 타임아웃 설정 조정
```

#### 4. 메모리 부족

```
해결: 파일 크기 제한, 스트리밍 처리 고려
```
