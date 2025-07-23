// pages/admin/upload.tsx - 새로 생성 (간단한 업로드 페이지)
import { useState } from "react";

interface UploadResult {
  success: boolean;
  message: string;
  summary?: {
    totalRows: number;
    processed: number;
    saved: number;
    errors: number;
  };
  errors?: string[];
}

export default function AdminUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null); // 이전 결과 초기화
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert("파일을 선택해주세요.");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/uploadAuthorizedUsers", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        setFile(null);
        // 파일 입력 초기화
        const fileInput = document.getElementById(
          "file-input"
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      }
    } catch (error) {
      console.error("업로드 오류:", error);
      setResult({
        success: false,
        message: "업로드 중 오류가 발생했습니다.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">승인된 사용자 목록 업로드</h1>

      {/* 엑셀 파일 형식 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">📋 엑셀 파일 형식</h3>
        <p className="text-blue-700 text-sm mb-2">
          첫 번째 행은 헤더여야 합니다:
        </p>
        <div className="bg-white border rounded p-2 font-mono text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>이름</strong>
            </div>
            <div>
              <strong>주민번호앞자리</strong>
            </div>
            <div>홍길동</div>
            <div>901234</div>
            <div>김철수</div>
            <div>851215</div>
            <div className="text-gray-500 text-xs col-span-2 mt-2">
              * 업로더: admin (자동 설정)
            </div>
          </div>
        </div>
        <p className="text-blue-600 text-xs mt-2">
          ⚠️ 주민번호앞자리는 6자리 숫자만 입력하세요.
        </p>
      </div>

      {/* 파일 업로드 */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            엑셀 파일 선택
          </label>
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {file && (
          <div className="text-sm text-gray-600">
            선택된 파일: <strong>{file.name}</strong> (
            {(file.size / 1024).toFixed(1)}KB)
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className={`w-full py-3 px-4 rounded-lg font-semibold ${
            !file || uploading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {uploading ? "업로드 중..." : "업로드 시작"}
        </button>
      </div>

      {/* 결과 표시 */}
      {result && (
        <div
          className={`mt-6 p-4 rounded-lg border ${
            result.success
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div
            className={`font-semibold ${
              result.success ? "text-green-800" : "text-red-800"
            }`}
          >
            {result.success ? "✅ 업로드 성공" : "❌ 업로드 실패"}
          </div>

          <p
            className={`mt-2 ${
              result.success ? "text-green-700" : "text-red-700"
            }`}
          >
            {result.message}
          </p>

          {result.summary && (
            <div className="mt-3 text-sm space-y-1">
              <div>
                📊 전체 행: <strong>{result.summary.totalRows}</strong>
              </div>
              <div>
                ✅ 처리됨: <strong>{result.summary.processed}</strong>
              </div>
              <div>
                💾 저장됨: <strong>{result.summary.saved}</strong>
              </div>
              <div>
                ⚠️ 오류: <strong>{result.summary.errors}</strong>
              </div>
            </div>
          )}

          {result.errors && result.errors.length > 0 && (
            <div className="mt-3">
              <div className="text-sm font-medium text-red-800">오류 목록:</div>
              <ul className="mt-1 text-sm text-red-700 space-y-1">
                {result.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 테스트용 샘플 다운로드 */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">🧪 테스트용 샘플</h3>
        <p className="text-sm text-gray-600 mb-3">
          테스트용 엑셀 파일을 만들어서 업로드해보세요.
        </p>
        <button
          onClick={() => {
            const csvContent =
              "이름,주민번호앞자리\n홍길동,901234\n김철수,851215\n이영희,920306";
            const blob = new Blob([csvContent], {
              type: "text/csv;charset=utf-8;",
            });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "sample_users.csv";
            link.click();
          }}
          className="text-blue-600 hover:text-blue-800 text-sm underline"
        >
          📥 샘플 CSV 다운로드
        </button>
      </div>
    </div>
  );
}
