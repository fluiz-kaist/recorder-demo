// pages/user-detail/[id].tsx
import { useState, useEffect, ReactElement } from "react";
import ParticipantsDetailPopup from "@/components/admin/ParticipantsDetailPopup";
import { ParticipantDetail } from "@/pages/api/admin/participants/[userId]";
import { ParticipantOverview } from "@/pages/api/admin/participants/overview";

function ParticipantsDetailPage() {
  const [participant, setParticipant] = useState<ParticipantOverview | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [dataReceived, setDataReceived] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || dataReceived) {
        return; //  이미 받았으면 무시
      }

      //   if (event.origin !== window.location.origin) {
      //     return;
      //   }

      if (event.data.type === "RECORDING_DATA" && event.data.participant) {
        //overview데이터를 전달 받음
        console.log("데이터 받음:", event.data.participant);
        setParticipant(event.data.participant);
        setIsLoading(false);
        setDataReceived(true);
      }
    };

    window.addEventListener("message", handleMessage);

    // 부모 창에게 데이터 요청
    const requestData = () => {
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "REQUEST_DATA",
            id: window.location.pathname.split("/").pop(),
          },
          window.location.origin
        );
      }
    };

    requestData();
    const retryTimeout = setTimeout(requestData, 1000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(retryTimeout);
    };
  }, []);

  console.log("여기서 얻은 데이터? ");

  if (isLoading) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div>이이디 받는 중...</div>
      </div>
    );
  }

  if (!participant) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ marginBottom: "20px" }}>데이터를 불러올 수 없습니다.</div>
        <button
          onClick={() => window.close()}
          style={{
            background: "#e74c3c",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          창 닫기
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        background: "#f8f9fa",
        padding: "0",
        margin: "0",
        overflow: "auto",
      }}
    >
      <ParticipantsDetailPopup participant={participant} />
    </div>
  );
}
// 레이아웃 제거
ParticipantsDetailPage.getLayout = function getLayout(page: ReactElement) {
  return page;
};

export default ParticipantsDetailPage;
