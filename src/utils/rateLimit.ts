// utils/rateLimit.ts
import { NextApiResponse } from "next";

interface RateLimitOptions {
  interval: number; // 시간 간격 (밀리초)
  uniqueTokenPerInterval: number; // 간격당 고유 토큰 수
}

interface RateLimitResult {
  check: (
    response: NextApiResponse,
    limit: number,
    token: string
  ) => Promise<void>;
}

// 메모리 기반 캐시 (간단한 개발용)
const cache = new Map<string, { count: number; resetTime: number }>();

/**
 * API 속도 제한 미들웨어
 */
export default function rateLimit(options: RateLimitOptions): RateLimitResult {
  const { interval, uniqueTokenPerInterval } = options;

  return {
    check: async (
      response: NextApiResponse,
      limit: number,
      token: string
    ): Promise<void> => {
      const now = Date.now();
      const key = `${token}`;

      // 기존 데이터 가져오기
      const current = cache.get(key);

      // 시간 간격이 지났으면 리셋
      if (!current || now > current.resetTime) {
        cache.set(key, {
          count: 1,
          resetTime: now + interval,
        });

        // 헤더 설정
        response.setHeader("X-RateLimit-Limit", limit);
        response.setHeader("X-RateLimit-Remaining", limit - 1);
        response.setHeader(
          "X-RateLimit-Reset",
          new Date(now + interval).toISOString()
        );

        return;
      }

      // 제한 확인
      if (current.count >= limit) {
        response.setHeader("X-RateLimit-Limit", limit);
        response.setHeader("X-RateLimit-Remaining", 0);
        response.setHeader(
          "X-RateLimit-Reset",
          new Date(current.resetTime).toISOString()
        );
        response.setHeader(
          "Retry-After",
          Math.ceil((current.resetTime - now) / 1000)
        );

        throw new Error("Rate limit exceeded");
      }

      // 카운트 증가
      cache.set(key, {
        count: current.count + 1,
        resetTime: current.resetTime,
      });

      // 헤더 설정
      response.setHeader("X-RateLimit-Limit", limit);
      response.setHeader("X-RateLimit-Remaining", limit - current.count);
      response.setHeader(
        "X-RateLimit-Reset",
        new Date(current.resetTime).toISOString()
      );
    },
  };
}
