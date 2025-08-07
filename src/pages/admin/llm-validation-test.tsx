// pages/admin/llm-validation-test.tsx

import { useState, useEffect } from "react";
import Head from "next/head";
import { GetServerSideProps } from "next";

// GET 응답 타입
interface LLMValidationGetResponse {
  success: boolean;
  data?: {
    recordings: Array<{
      id: string;
      taskKey: string;
      textData: {
        originalScript: string;
        sttTranscription: string;
        domain: string;
        intent: string;
        category: string;
      };
      verificationStatus: string;
      uploadedAt: string;
      verification?: {
        verifiedAt?: string;
        verifiedBy?: string;
        verificationMethod?: string;
        isApproved?: boolean;
        verifierNotes?: string;
      };
    }>;
    totalCount: number;
    summary: {
      pendingCount: number;
      approvedCount: number;
      rejectedCount: number;
      dateRange?: {
        from: string;
        to: string;
      };
    };
    qualityCheck?: any;
  };
  message?: string;
}

const LLMValidationTestPage = ({ adminToken }: { adminToken: string }) => {
  const [data, setData] = useState<LLMValidationGetResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiData = async () => {
      try {
        setLoading(true);
        setError(null);

        const queryParams = new URLSearchParams({
          verificationStatus: "pending", // "pending" 상태의 데이터만 조회하도록 필터링
          limit: "20", // 20개만 조회
        });

        const response = await fetch(
          `/api/admin/recordings/llm-validation?${queryParams.toString()}`,
          {
            method: "GET",
            headers: {
              // 'admin-token' 쿠키가 없으므로 헤더에 수동으로 추가 (필요시 수정)
              "admin-token": adminToken,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `API 호출 실패: ${response.status} ${response.statusText}`
          );
        }

        const result: LLMValidationGetResponse = await response.json();
        setData(result);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    if (adminToken) {
      fetchApiData();
    } else {
      setLoading(false);
      setError(
        "관리자 토큰이 없습니다. API 호출을 위해 'getServerSideProps'를 확인하세요."
      );
    }
  }, [adminToken]);

  return (
    <>
      <Head>
        <title>LLM Validation API Test</title>
      </Head>
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>LLM Validation API (GET) 테스트</h1>
        <p>
          <code>/api/admin/recordings/llm-validation</code> API의 GET 요청을
          테스트합니다.
        </p>
        <hr style={{ margin: "2rem 0" }} />

        {loading && <p>데이터 로딩 중...</p>}
        {error && <p style={{ color: "red" }}>오류: {error}</p>}

        {data && (
          <div>
            <h2>API 응답 결과</h2>
            <p>
              <strong>성공 여부:</strong> {data.success ? "✅ 성공" : "❌ 실패"}
            </p>
            {data.message && (
              <p>
                <strong>메시지:</strong> {data.message}
              </p>
            )}

            <h3>요약</h3>
            <pre
              style={{
                backgroundColor: "#f4f4f4",
                padding: "1rem",
                borderRadius: "8px",
                whiteSpace: "pre-wrap",
              }}
            >
              {JSON.stringify(data.data?.summary, null, 2)}
            </pre>

            <h3>전체 데이터 (첫 5개만 표시)</h3>
            <pre
              style={{
                backgroundColor: "#f4f4f4",
                padding: "1rem",
                borderRadius: "8px",
                whiteSpace: "pre-wrap",
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              {JSON.stringify(data.data?.recordings.slice(0, 5), null, 2)}
            </pre>

            {data.data && data.data.recordings.length > 5 && (
              <p>
                총 {data.data.recordings.length}개의 레코딩 중 첫 5개만
                표시했습니다.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default LLMValidationTestPage;

// 서버사이드에서 쿠키를 읽어 'adminToken'을 props로 전달
export const getServerSideProps: GetServerSideProps = async (context) => {
  const adminToken =
    context.req.cookies["admin-token"] || "your-test-token-here";
  return {
    props: {
      adminToken,
    },
  };
};
