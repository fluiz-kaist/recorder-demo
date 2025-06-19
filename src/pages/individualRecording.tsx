import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";

const IndividualRecordingPage = () => {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [currentScript, setCurrentScript] = useState("");
  const [scriptIndex, setScriptIndex] = useState(0);
  const [recordedCount, setRecordedCount] = useState(0);

  // 예시 개별 스크립트들
  const scripts = [
    "안녕하세요",
    "감사합니다",
    "죄송합니다",
    "괜찮습니다",
    "도와주세요",
    "잠시만요",
    "알겠습니다",
    "모르겠습니다",
  ];

  useEffect(() => {
    setCurrentScript(scripts[scriptIndex]);
  }, [scriptIndex]);

  const handleStartRecording = () => {
    setIsRecording(true);
    // 실제 녹음 로직 구현
    console.log(`녹음 시작: ${currentScript}`);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setRecordedCount((prev) => prev + 1);
    console.log(`녹음 완료: ${currentScript}`);
  };

  const handleNextScript = () => {
    if (scriptIndex < scripts.length - 1) {
      setScriptIndex((prev) => prev + 1);
    }
  };

  const handlePrevScript = () => {
    if (scriptIndex > 0) {
      setScriptIndex((prev) => prev - 1);
    }
  };

  const goBack = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={goBack}
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors duration-200"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            돌아가기
          </button>

          <div className="text-sm text-gray-600">
            {scriptIndex + 1} / {scripts.length}
          </div>
        </div>

        {/* 메인 카드 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              개별 스크립트 녹음
            </h1>
            <p className="text-gray-600">아래 문장을 또렷하게 읽어주세요</p>
          </div>

          {/* 현재 스크립트 */}
          <div className="bg-blue-50 rounded-xl p-6 mb-8">
            <div className="text-center">
              <p className="text-2xl font-medium text-blue-800 mb-4">
                {currentScript}
              </p>
              <div className="text-sm text-blue-600">현재 스크립트</div>
            </div>
          </div>

          {/* 녹음 버튼 */}
          <div className="text-center mb-8">
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-full transition-colors duration-200 shadow-lg transform hover:scale-105"
              >
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-white rounded-full mr-3"></div>
                  녹음 시작
                </div>
              </button>
            ) : (
              <button
                onClick={handleStopRecording}
                className="bg-red-600 text-white font-bold py-4 px-8 rounded-full shadow-lg animate-pulse"
              >
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-white mr-3"></div>
                  녹음 중... (탭하여 중지)
                </div>
              </button>
            )}
          </div>

          {/* 네비게이션 */}
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrevScript}
              disabled={scriptIndex === 0}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors duration-200 ${
                scriptIndex === 0
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-blue-600 hover:bg-blue-50"
              }`}
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              이전
            </button>

            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">완료한 녹음</div>
              <div className="text-2xl font-bold text-blue-600">
                {recordedCount}
              </div>
            </div>

            <button
              onClick={handleNextScript}
              disabled={scriptIndex === scripts.length - 1}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors duration-200 ${
                scriptIndex === scripts.length - 1
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-blue-600 hover:bg-blue-50"
              }`}
            >
              다음
              <svg
                className="w-5 h-5 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 진행률 바 */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>진행률</span>
            <span>
              {Math.round(((scriptIndex + 1) / scripts.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((scriptIndex + 1) / scripts.length) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndividualRecordingPage;
