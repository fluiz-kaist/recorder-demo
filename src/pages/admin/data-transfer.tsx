// pages/admin/data-transfer.tsx
import React, { useState, useEffect } from "react";
import { useDataTransfer } from "@/hooks/useDataTransfer";
import { getEnv } from "@/utils/envConfig";

const DataTransferPage: React.FC = () => {
  const [exportCollectionName, setExportCollectionName] = useState<string>("");
  const [importCollectionName, setImportCollectionName] = useState<string>("");
  const [exportLimit, setExportLimit] = useState<number>(100);
  const [overwriteMode, setOverwriteMode] = useState<boolean>(true);
  const { isDev, isProduction, isPreview } = getEnv();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const envText = isDev
    ? "development"
    : isProduction
    ? "production"
    : "preview";

  const {
    exportData,
    isExporting,
    exportResult,
    exportedData,
    importData,
    isImporting,
    importResult,
    error,
    reset,
    loadFromFile,
    uploadedData,
  } = useDataTransfer();

  const handleExport = async (): Promise<void> => {
    await exportData({
      collectionName: exportCollectionName,
      limit: exportLimit,
    });
  };

  const handleImport = async (): Promise<void> => {
    const dataToImport = exportedData || uploadedData;

    if (!dataToImport) {
      alert("먼저 Export를 실행해주세요.");
      return;
    }

    await importData({
      collectionName: importCollectionName,
      data: dataToImport,
      overwrite: overwriteMode,
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (selectedFile) {
      try {
        await loadFromFile(selectedFile);
      } catch (error) {
        alert("파일 로드 실패");
      }
    }
  };

  const handleDownloadJson = () => {
    if (!exportedData) return;

    const dataStr = JSON.stringify(exportedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportCollectionName}_${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* 헤더 */}
      <div style={{ marginBottom: "30px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "bold",
            color: "#333",
            marginBottom: "10px",
          }}
        >
          🔄 Firebase 데이터 전송
        </h1>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "10px" }}>
          프로덕션 → 개발 환경으로 데이터를 안전하게 복사합니다.
        </p>
        <div
          style={{
            backgroundColor: isDev ? "#d4edda" : "#f8d7da",
            color: isDev ? "#155724" : "#721c24",
          }}
        >
          현재 환경: {envText}
        </div>
      </div>

      {/* Export 섹션 */}
      <div
        style={{
          marginBottom: "30px",
          padding: "20px",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          backgroundColor: "#f9f9f9",
        }}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#333",
            marginBottom: "15px",
          }}
        >
          📥 1단계: 데이터 Export (프로덕션 환경)
        </h2>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "500",
              color: "#333",
              marginBottom: "8px",
            }}
          >
            Export할 컬렉션 이름
          </label>
          <input
            type="text"
            value={exportCollectionName}
            onChange={(e) => setExportCollectionName(e.target.value)}
            placeholder="예: recordings"
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "500",
              color: "#333",
              marginBottom: "8px",
            }}
          >
            최대 문서 수
          </label>
          <input
            type="number"
            value={exportLimit}
            onChange={(e) => setExportLimit(Number(e.target.value))}
            min={1}
            max={1000}
            style={{
              width: "200px",
              padding: "10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting || !exportCollectionName.trim()}
          style={{
            padding: "12px 20px",
            backgroundColor: isExporting ? "#ccc" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: isExporting ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {isExporting ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  width: "16px",
                  height: "16px",
                  border: "2px solid #ffffff",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                }}
              ></span>
              Export 중...
            </>
          ) : (
            <>📥 데이터 Export</>
          )}
        </button>

        {exportResult && (
          <div
            style={{
              marginTop: "15px",
              padding: "12px",
              border: `1px solid ${
                exportResult.success ? "#c3e6cb" : "#f5c6cb"
              }`,
              borderRadius: "4px",
              backgroundColor: exportResult.success ? "#d4edda" : "#f8d7da",
              color: exportResult.success ? "#155724" : "#721c24",
              fontSize: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{exportResult.success ? "✅" : "❌"}</span>
              <span>{exportResult.message}</span>
            </div>
            {exportResult.success && exportResult.documentCount && (
              <div style={{ marginTop: "8px", fontSize: "12px" }}>
                Export된 문서 수: {exportResult.documentCount}개
                {exportedData && (
                  <button
                    onClick={handleDownloadJson}
                    style={{
                      marginLeft: "10px",
                      padding: "4px 8px",
                      backgroundColor: "#007bff",
                      color: "white",
                      border: "none",
                      borderRadius: "3px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    📄 JSON 다운로드
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import 섹션 */}
      <div
        style={{
          marginBottom: "30px",
          padding: "20px",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          backgroundColor: "#f9f9f9",
        }}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#333",
            marginBottom: "15px",
          }}
        >
          📤 2단계: 데이터 Import (개발 환경)
        </h2>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "500",
              color: "#333",
              marginBottom: "8px",
            }}
          >
            Import할 컬렉션 이름
          </label>
          <input
            type="text"
            value={importCollectionName}
            onChange={(e) => setImportCollectionName(e.target.value)}
            placeholder="예: recordings_test"
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={overwriteMode}
              onChange={(e) => setOverwriteMode(e.target.checked)}
            />
            <span style={{ fontSize: "14px", color: "#333" }}>
              기존 문서 덮어쓰기
            </span>
          </label>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "500",
              color: "#333",
              marginBottom: "8px",
            }}
          >
            또는 JSON 파일 업로드
          </label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ marginBottom: "8px" }}
          />
          {selectedFile && (
            <button
              onClick={handleFileUpload}
              style={{
                padding: "8px 12px",
                backgroundColor: "#17a2b8",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              📁 파일 로드
            </button>
          )}
        </div>

        <button
          onClick={handleImport}
          disabled={
            isImporting ||
            !importCollectionName.trim() ||
            (!exportedData && !uploadedData)
          }
          style={{
            padding: "12px 20px",
            backgroundColor:
              isImporting || (!exportedData && !uploadedData)
                ? "#ccc"
                : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "500",
            cursor:
              isImporting || (!exportedData && !uploadedData)
                ? "not-allowed"
                : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {isImporting ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  width: "16px",
                  height: "16px",
                  border: "2px solid #ffffff",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                }}
              ></span>
              Import 중...
            </>
          ) : (
            <>📤 데이터 Import</>
          )}
        </button>

        {!exportedData && !uploadedData && (
          <div
            style={{ marginTop: "10px", fontSize: "12px", color: "#6c757d" }}
          >
            ⚠️ Import하려면 먼저 Export를 실행하거나 JSON 파일을 업로드해주세요.
          </div>
        )}
        {importResult && (
          <div
            style={{
              marginTop: "15px",
              padding: "12px",
              border: `1px solid ${
                importResult.success ? "#c3e6cb" : "#f5c6cb"
              }`,
              borderRadius: "4px",
              backgroundColor: importResult.success ? "#d4edda" : "#f8d7da",
              color: importResult.success ? "#155724" : "#721c24",
              fontSize: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{importResult.success ? "✅" : "❌"}</span>
              <span>{importResult.message}</span>
            </div>
            {importResult.success && (
              <div style={{ marginTop: "8px", fontSize: "12px" }}>
                Import된 문서: {importResult.importedCount}개
                {importResult.skippedCount && importResult.skippedCount > 0 && (
                  <span> | 스킵된 문서: {importResult.skippedCount}개</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 에러 표시 */}
      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "15px",
            border: "1px solid #f5c6cb",
            borderRadius: "4px",
            backgroundColor: "#f8d7da",
            color: "#721c24",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>❌</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 리셋 버튼 */}
      <div style={{ textAlign: "center" }}>
        <button
          onClick={reset}
          style={{
            padding: "8px 16px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          🔄 리셋
        </button>
      </div>

      {/* 주의사항 */}
      <div
        style={{
          marginTop: "30px",
          padding: "15px",
          backgroundColor: "#fff3cd",
          border: "1px solid #ffeaa7",
          borderRadius: "4px",
        }}
      >
        <h3
          style={{
            fontSize: "14px",
            fontWeight: "500",
            color: "#856404",
            margin: "0 0 10px 0",
          }}
        >
          ⚠️ 사용 방법
        </h3>
        <div style={{ fontSize: "14px", color: "#856404" }}>
          <p style={{ margin: "0 0 5px 0" }}>
            1. <strong>프로덕션 환경 설정</strong>으로 실행하여 Export 실행
          </p>
          <p style={{ margin: "0 0 5px 0" }}>
            2. <strong>개발 환경 설정</strong>으로 전환 후 Import 실행
          </p>
          <p style={{ margin: "0" }}>
            3. 개발 환경에서만 이 기능을 사용할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataTransferPage;
