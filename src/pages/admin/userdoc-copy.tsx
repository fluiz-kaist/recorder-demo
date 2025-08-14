import React, { useState } from "react";

interface CopyResult {
  success: boolean;
  message: string;
  newDocumentId?: string;
  copiedSubcollections?: string[];
}

const DocumentCopyPage: React.FC = () => {
  const [documentId, setDocumentId] = useState<string>("");
  const [collectionName, setCollectionName] = useState<string>("");
  const [versionPrefix, setVersionPrefix] = useState<string>("v2");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CopyResult | null>(null);

  const handleCopy = async (): Promise<void> => {
    if (!documentId.trim() || !collectionName.trim()) {
      setResult({
        success: false,
        message: "문서 ID와 컬렉션 이름을 모두 입력해주세요.",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/test/copy-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceDocumentId: documentId.trim(),
          collectionName: collectionName.trim(),
          versionPrefix: versionPrefix.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: "문서가 성공적으로 복사되었습니다!",
          newDocumentId: data.newDocumentId,
          copiedSubcollections: data.copiedSubcollections,
        });
      } else {
        setResult({
          success: false,
          message: data.error || "복사 중 오류가 발생했습니다.",
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: `네트워크 오류: ${error.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ marginBottom: "30px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "bold",
            color: "#333",
            marginBottom: "10px",
          }}
        >
          Firebase 문서 복사
        </h1>
        <p style={{ color: "#666", fontSize: "14px" }}>
          문서와 모든 하위 컬렉션을 버전 접두사와 함께 복사합니다.
        </p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label
          htmlFor="collectionName"
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: "500",
            color: "#333",
            marginBottom: "8px",
          }}
        >
          컬렉션 이름
        </label>
        <input
          id="collectionName"
          type="text"
          value={collectionName}
          onChange={(e) => setCollectionName(e.target.value)}
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

      <div style={{ marginBottom: "20px" }}>
        <label
          htmlFor="documentId"
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: "500",
            color: "#333",
            marginBottom: "8px",
          }}
        >
          문서 ID
        </label>
        <input
          id="documentId"
          type="text"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          placeholder="복사할 문서의 ID를 입력하세요"
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

      <div style={{ marginBottom: "20px" }}>
        <label
          htmlFor="versionPrefix"
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: "500",
            color: "#333",
            marginBottom: "8px",
          }}
        >
          버전 접두사
        </label>
        <input
          id="versionPrefix"
          type="text"
          value={versionPrefix}
          onChange={(e) => setVersionPrefix(e.target.value)}
          placeholder="예: v2, v3, test"
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "14px",
            boxSizing: "border-box",
          }}
        />
        <p
          style={{
            marginTop: "5px",
            fontSize: "12px",
            color: "#666",
          }}
        >
          새 문서 ID: {versionPrefix}
          {documentId ? `-${documentId}` : "-[문서ID]"}
        </p>
      </div>

      <button
        onClick={handleCopy}
        disabled={isLoading}
        style={{
          width: "100%",
          padding: "12px",
          backgroundColor: isLoading ? "#ccc" : "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "16px",
          fontWeight: "500",
          cursor: isLoading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        {isLoading ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                border: "2px solid #ffffff",
                borderTop: "2px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            ></span>
            복사 중...
          </>
        ) : (
          <>📋 문서 복사</>
        )}
      </button>

      {result && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            border: `1px solid ${result.success ? "#d4edda" : "#f8d7da"}`,
            borderRadius: "4px",
            backgroundColor: result.success ? "#d1ecf1" : "#f8d7da",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <span
              style={{
                fontSize: "18px",
                marginRight: "10px",
              }}
            >
              {result.success ? "✅" : "❌"}
            </span>
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: result.success ? "#155724" : "#721c24",
                  margin: "0 0 5px 0",
                }}
              >
                {result.success ? "복사 완료" : "복사 실패"}
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: result.success ? "#155724" : "#721c24",
                  margin: "0",
                }}
              >
                {result.message}
              </p>

              {result.success && result.newDocumentId && (
                <div style={{ marginTop: "10px" }}>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#155724",
                      margin: "0 0 5px 0",
                    }}
                  >
                    <strong>새 문서 ID:</strong> {result.newDocumentId}
                  </p>
                  {result.copiedSubcollections &&
                    result.copiedSubcollections.length > 0 && (
                      <div>
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#155724",
                            fontWeight: "500",
                            margin: "5px 0",
                          }}
                        >
                          복사된 하위 컬렉션:
                        </p>
                        <ul
                          style={{
                            fontSize: "14px",
                            color: "#155724",
                            margin: "0",
                            paddingLeft: "20px",
                          }}
                        >
                          {result.copiedSubcollections.map((subcol, index) => (
                            <li key={index}>{subcol}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: "#e7f3ff",
          border: "1px solid #b3d7ff",
          borderRadius: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <span
            style={{
              fontSize: "18px",
              marginRight: "10px",
            }}
          >
            ℹ️
          </span>
          <div>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "500",
                color: "#0056b3",
                margin: "0 0 5px 0",
              }}
            >
              주의사항
            </h3>
            <div
              style={{
                fontSize: "14px",
                color: "#0056b3",
              }}
            >
              <p style={{ margin: "0 0 5px 0" }}>
                • 문서와 모든 하위 컬렉션이 재귀적으로 복사됩니다.
              </p>
              <p style={{ margin: "0 0 5px 0" }}>
                • 같은 컬렉션 내에 새로운 ID로 복사됩니다.
              </p>
              <p style={{ margin: "0" }}>
                • 복사 과정에서 오류가 발생하면 일부만 복사될 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default DocumentCopyPage;
