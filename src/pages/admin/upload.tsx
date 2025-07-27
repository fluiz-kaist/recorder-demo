// pages/admin/upload.tsx - 새로 생성 (간단한 업로드 페이지)
import { useState } from "react";
import styles from "@/styles/AdminUploadPage.module.css";
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
    <div className={styles.container}>
      <h1 className={styles.title}>승인된 사용자 목록 업로드</h1>

      <div className={styles.excelGuideBox}>
        <h3 className={styles.excelGuideTitle}>📋 엑셀 파일 형식</h3>
        <p className={styles.excelGuideText}>첫 번째 행은 헤더여야 합니다:</p>
        <div className={styles.tablePreview}>
          <div className={styles.gridRow}>
            <strong>이름</strong>
          </div>
          <div className={styles.gridRow}>
            <strong>주민번호앞자리</strong>
          </div>
          <div className={styles.gridRow}>홍길동</div>
          <div className={styles.gridRow}>901234</div>
          <div className={styles.gridRow}>김철수</div>
          <div className={styles.gridRow}>851215</div>
          <div className={styles.uploadNote}>* 업로더: admin (자동 설정)</div>
        </div>
        <p className={styles.caution}>
          ⚠️ 주민번호앞자리는 6자리 숫자만 입력하세요.
        </p>
      </div>

      <div className={styles.uploadSection}>
        <div>
          <label className={styles.label}>엑셀 파일 선택</label>
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className={styles.fileInput}
          />
        </div>

        {file && (
          <div className={styles.selectedFile}>
            선택된 파일: <strong>{file.name}</strong> (
            {(file.size / 1024).toFixed(1)}KB)
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className={`${styles.uploadButton} ${
            !file || uploading ? styles.disabled : styles.enabled
          }`}
        >
          {uploading ? "업로드 중..." : "업로드 시작"}
        </button>
      </div>

      {result && (
        <div
          className={`${styles.resultBox} ${
            result.success ? styles.success : styles.failure
          }`}
        >
          <div className={styles.resultTitle}>
            {result.success ? "✅ 업로드 성공" : "❌ 업로드 실패"}
          </div>
          <p className={styles.resultMessage}>{result.message}</p>

          {result.summary && (
            <div className={styles.summaryBox}>
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
            <div className={styles.errorListBox}>
              <div className={styles.errorListTitle}>오류 목록:</div>
              <ul className={styles.errorList}>
                {result.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* <div className={styles.sampleBox}>
        <h3 className={styles.sampleTitle}>🧪 테스트용 샘플</h3>
        <p className={styles.sampleText}>
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
          className={styles.sampleDownloadLink}
        >
          📥 샘플 CSV 다운로드
        </button>
      </div> */}
    </div>
  );
}
