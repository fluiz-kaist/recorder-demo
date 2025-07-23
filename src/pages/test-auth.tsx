// pages/test-auth.tsx - 새로 생성 (인증 테스트 페이지)
import { useState } from "react";
import {
  useHybridAuthMutation,
  useHashBasedAuthMutation,
} from "@/hooks/mutations/useHybridAuth";

export default function TestAuthPage() {
  const [name, setName] = useState("");
  const [socialNumber, setSocialNumber] = useState("");

  const hybridAuth = useHybridAuthMutation();
  const hashAuth = useHashBasedAuthMutation();

  const handleHybridTest = async () => {
    if (!name || !socialNumber) {
      alert("이름과 주민번호를 입력해주세요.");
      return;
    }

    try {
      await hybridAuth.mutateAsync({ name, socialNumber });
    } catch (error) {
      console.error("하이브리드 테스트 실패:", error);
    }
  };

  const handleHashOnlyTest = async () => {
    if (!name || !socialNumber) {
      alert("이름과 주민번호를 입력해주세요.");
      return;
    }

    try {
      await hashAuth.mutateAsync({ name, socialNumber });
    } catch (error) {
      console.error("해시 전용 테스트 실패:", error);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg mt-20">
      <h1 className="text-2xl font-bold mb-6 text-center">
        🧪 인증 시스템 테스트
      </h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 홍길동"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            주민번호 앞자리
          </label>
          <input
            type="text"
            value={socialNumber}
            onChange={(e) =>
              setSocialNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 901234"
            maxLength={6}
          />
        </div>

        <div className="space-y-3 pt-4">
          {/* 하이브리드 방식 테스트 */}
          <button
            onClick={handleHybridTest}
            disabled={hybridAuth.isPending}
            className={`w-full py-3 px-4 rounded-lg font-semibold ${
              hybridAuth.isPending
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {hybridAuth.isPending ? "인증 중..." : "🔄 하이브리드 인증 (권장)"}
          </button>

          {/* 해시 전용 방식 테스트 */}
          <button
            onClick={handleHashOnlyTest}
            disabled={hashAuth.isPending}
            className={`w-full py-3 px-4 rounded-lg font-semibold ${
              hashAuth.isPending
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {hashAuth.isPending ? "인증 중..." : "🔒 해시 전용 인증"}
          </button>
        </div>

        {/* 결과 표시 */}
        {(hybridAuth.data || hybridAuth.error) && (
          <div
            className={`mt-4 p-3 rounded-lg ${
              hybridAuth.data
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div
              className={`font-semibold ${
                hybridAuth.data ? "text-green-800" : "text-red-800"
              }`}
            >
              {hybridAuth.data
                ? "✅ 하이브리드 인증 성공"
                : "❌ 하이브리드 인증 실패"}
            </div>
            <div
              className={`text-sm mt-1 ${
                hybridAuth.data ? "text-green-700" : "text-red-700"
              }`}
            >
              {hybridAuth.data
                ? `방식: ${hybridAuth.data.method}, 사용자: ${hybridAuth.data.user?.name}`
                : hybridAuth.error?.message}
            </div>
          </div>
        )}

        {(hashAuth.data || hashAuth.error) && (
          <div
            className={`mt-4 p-3 rounded-lg ${
              hashAuth.data
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div
              className={`font-semibold ${
                hashAuth.data ? "text-green-800" : "text-red-800"
              }`}
            >
              {hashAuth.data ? "✅ 해시 인증 성공" : "❌ 해시 인증 실패"}
            </div>
            <div
              className={`text-sm mt-1 ${
                hashAuth.data ? "text-green-700" : "text-red-700"
              }`}
            >
              {hashAuth.data
                ? `방식: ${hashAuth.data.method}, 사용자: ${hashAuth.data.user?.name}`
                : hashAuth.error?.message}
            </div>
          </div>
        )}
      </div>

      {/* 개발자 정보 */}
      <div className="mt-8 p-3 bg-gray-50 rounded-lg text-sm">
        <div className="font-semibold text-gray-800 mb-2">📋 테스트 정보</div>
        <div className="text-gray-600 space-y-1">
          <div>• 하이브리드: 해시 기반 → 기존 방식 순서로 시도</div>
          <div>• 해시 전용: 새로운 해시 기반 방식만 사용</div>
          <div>• 브라우저 콘솔에서 상세 로그 확인 가능</div>
        </div>
      </div>
    </div>
  );
}
