// pages/admin.tsx - 빌드용 간단한 관리자 페이지
import React from "react";

const AdminPage: React.FC = () => {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>관리자 페이지</h1>
      <p>관리자 기능을 준비 중입니다.</p>

      <div style={{ marginTop: "20px" }}>
        <h2>주요 기능</h2>
        <ul>
          <li>사용자 관리</li>
          <li>스크립트 관리</li>
          <li>오디오 관리</li>
          <li>통계 및 분석</li>
        </ul>
      </div>

      <div style={{ marginTop: "20px" }}>
        <button
          onClick={() => window.history.back()}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          뒤로가기
        </button>
      </div>
    </div>
  );
};

export default AdminPage;
