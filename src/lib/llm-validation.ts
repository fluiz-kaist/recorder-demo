import OpenAI from "openai";

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// 단일 recording 검증 결과 타입
export interface ValidationResult {
  recordingId: string;
  isApproved: boolean;
  reasoning: string;
  confidence: number;
  textData?: TextData;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

// 텍스트 데이터 타입
export interface TextData {
  originalScript: string;
  sttTranscription: string;
  domain: string;
  intent: string;
  category: string;
}

// 배치 검증용 입력 타입
export interface BatchValidationInput {
  recordingId: string;
  textData: TextData;
}

interface GPTValidationResult {
  text: string;
  usage?:
    | {
        prompt: number;
        completion: number;
        total: number;
      }
    | undefined;
}

/**
 * 단일 recording 검증 (실시간 검증용)
 */
export async function validateSingleRecording(
  textData: TextData,
  recordingId: string = "single"
): Promise<ValidationResult> {
  try {
    const prompt = createSingleValidationPrompt(textData);
    const { text: response, usage } = await callGPTForValidation(prompt);

    const result = parseSingleValidationResponse(
      response,
      recordingId,
      textData
    );
    return {
      ...result,
      tokenUsage: usage, // 🔹 토큰 사용량 포함
    };
  } catch (error) {
    console.error("❌ 단일 검증 오류:", error);
    return {
      recordingId,
      isApproved: false,
      reasoning: `검증 중 오류 발생: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      confidence: 0,
      textData,
    };
  }
}

/**
 * 배치 recordings 검증 (배치 검증용)
 */
export async function validateBatchRecordings(
  recordings: BatchValidationInput[]
): Promise<ValidationResult[]> {
  try {
    const BATCH_SIZE = 20;
    const results: ValidationResult[] = [];

    for (let i = 0; i < recordings.length; i += BATCH_SIZE) {
      const batch = recordings.slice(i, i + BATCH_SIZE);
      console.log(
        `📋 배치 ${Math.floor(i / BATCH_SIZE) + 1} 처리 중... (${
          batch.length
        }개)`
      );

      const prompt = createBatchValidationPrompt(batch);
      const { text: response, usage } = await callGPTForValidation(prompt);

      const batchResults = parseBatchValidationResponse(response, batch).map(
        (r) => ({
          ...r,
          tokenUsage: usage
            ? {
                prompt: Math.round(usage.prompt / batch.length),
                completion: Math.round(usage.completion / batch.length),
                total: Math.round(usage.total / batch.length),
              }
            : undefined,
        })
      );
      results.push(...batchResults);

      if (i + BATCH_SIZE < recordings.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  } catch (error) {
    console.error("❌ 배치 검증 오류:", error);
    return recordings.map((r) => ({
      recordingId: r.recordingId,
      isApproved: false,
      reasoning: `배치 검증 중 오류 발생: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      confidence: 0,
      textData: r.textData,
    }));
  }
}

/**
 * GPT API 호출 (공통 로직)
 */
async function callGPTForValidation(
  prompt: string
): Promise<GPTValidationResult> {
  const systemMsg =
    "당신은 음성 인식(STT) 결과의 품질을 평가하는 전문가입니다. " +
    "원본 스크립트와 STT 결과를 비교하여 정확하고 객관적으로 평가해주세요. " +
    "요청된 JSON 형식을 절대 벗어나지 마세요.";

  const maxRetries = 2;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    try {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: prompt },
        ],
      });

      const text = resp.choices[0]?.message?.content?.trim();

      console.group("📦 GPT-4o 응답");
      console.log("원본 prompt:", prompt);
      console.log("모델 응답(JSON 텍스트):");
      console.log(text);
      if (resp.usage) {
        console.log(
          `🔹 Token usage: prompt=${resp.usage.prompt_tokens}, completion=${resp.usage.completion_tokens}, total=${resp.usage.total_tokens}`
        );
      }
      console.groupEnd();

      if (!text) throw new Error("GPT 응답이 비어있습니다");

      const usage = resp.usage
        ? {
            prompt: resp.usage.prompt_tokens,
            completion: resp.usage.completion_tokens,
            total: resp.usage.total_tokens,
          }
        : undefined;

      return { text, usage };
    } catch (err) {
      lastError = err;
      attempt += 1;

      const msg = String((err as any)?.message || err);
      const isRetryable =
        msg.includes("429") ||
        msg.includes("rate limit") ||
        msg.includes("temporarily") ||
        msg.includes("timeout") ||
        msg.includes("ECONNRESET") ||
        msg.includes("5");

      if (attempt > maxRetries || !isRetryable) {
        console.error("❌ GPT API 호출 오류:", err);
        throw err;
      }

      const delayMs = 200 * Math.pow(3, attempt - 1); // 200ms, 600ms
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError ?? new Error("GPT 호출 실패(알 수 없는 오류)");
}

/**
 * 단일 검증용 프롬프트 생성
 */
function createSingleValidationPrompt(textData: TextData): string {
  return `
다음 음성 인식(STT) 결과를 검증해주세요.

**평가 기준:**
1. 의미 일치도: 핵심 내용이 보존되었는가?
2. 단어 정확도: 주요 키워드가 올바르게 인식되었는가?
3. 이해 가능성: 인식 결과가 이해 가능한 수준인가?

**데이터:**
- 원본 스크립트: "${textData.originalScript}"
- STT 결과: "${textData.sttTranscription}"
- 도메인: ${textData.domain}
- 의도: ${textData.intent}
- 카테고리: ${textData.category}

다음 JSON 형식으로만 응답해주세요:
{
  "approved": true/false,
  "confidence": 0.85,
  "reasoning": "평가 이유를 한국어로 설명"
}
`;
}

/**
 * 배치 검증용 프롬프트 생성
 */
function createBatchValidationPrompt(
  recordings: BatchValidationInput[]
): string {
  const recordingList = recordings
    .map(
      (r, i) => `
[${i + 1}] ID: ${r.recordingId}
원본: "${r.textData.originalScript}"
STT: "${r.textData.sttTranscription}"
도메인: ${r.textData.domain} | 의도: ${r.textData.intent}
`
    )
    .join("\n");

  return `
다음 STT 결과가 원본 발화와 의미상 적절한지 평가하라.

규칙:
1) 원본이 상황을 제시한다면 → 상황응답 평가:
   - STT가 그 상황에 맞는 실제 발화나 대답을 제공하면 approved
   - 구체적인 대상, 조건, 금액, 시간 등이 추가되어도 주제와 행동 목적이 동일하면 approved
   - 상황 설명을 실제 수행 명령으로 변환하는 것은 허용
2) 상황을 제시하지 않을 그 외의 경우 → 따라읽기 평가: 거의 동일한 문장/단어여야 함
3) 오류 메시지나 무관한 내용은 무조건 rejected
4) 일부 표현 차이·동의어 허용, 의미가 유지되면 approved

JSON으로:
{"index":<번호>,"approved":<true/false>,"confidence":<0~1>,"reasoning":"<판단이유>"}

**데이터:**
${recordingList}

다음 JSON 형식으로만 응답해주세요:
{
  "results": [
    {
      "index": 1,
      "approved": true/false,
      "confidence": 0.85,
      "reasoning": "평가 이유"
    },
    {
      "index": 2,
      "approved": true/false,
      "confidence": 0.92,
      "reasoning": "평가 이유"
    }
  ]
}
`;
}

/**
 * 단일 검증 응답 파싱
 */
function parseSingleValidationResponse(
  response: string,
  recordingId: string,
  textData: TextData
): ValidationResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("응답에서 JSON을 찾을 수 없습니다");
    }
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      recordingId,
      isApproved: Boolean(parsed.approved),
      reasoning: String(parsed.reasoning || "응답 파싱 오류"),
      confidence: Number(parsed.confidence || 0),
      textData,
    };
  } catch (error) {
    console.error("❌ 단일 응답 파싱 오류:", error);
    return {
      recordingId,
      isApproved: false,
      reasoning: `응답 파싱 실패: ${response.slice(0, 100)}...`,
      confidence: 0,
      textData,
    };
  }
}

/**
 * 배치 검증 응답 파싱
 */
function parseBatchValidationResponse(
  response: string,
  recordings: BatchValidationInput[]
): ValidationResult[] {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("응답에서 JSON을 찾을 수 없습니다");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const results = parsed.results || [];

    return recordings.map((recording, index) => {
      const gptResult = results.find((r: any) => r.index === index + 1);

      if (gptResult) {
        return {
          recordingId: recording.recordingId,
          isApproved: Boolean(gptResult.approved),
          reasoning: String(gptResult.reasoning || "응답 파싱 오류"),
          confidence: Number(gptResult.confidence || 0),
          textData: recording.textData,
        };
      } else {
        return {
          recordingId: recording.recordingId,
          isApproved: false,
          reasoning: "GPT 응답에서 해당 인덱스를 찾을 수 없음",
          confidence: 0,
          textData: recording.textData,
        };
      }
    });
  } catch (error) {
    console.error("❌ 배치 응답 파싱 오류:", error);
    return recordings.map((r) => ({
      recordingId: r.recordingId,
      isApproved: false,
      reasoning: `응답 파싱 실패: ${response.slice(0, 100)}...`,
      confidence: 0,
      textData: r.textData,
    }));
  }
}
