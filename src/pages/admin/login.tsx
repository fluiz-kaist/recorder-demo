// pages/admin/login.tsx (refactored)
import { useState } from "react";
import { useRouter } from "next/router";
import { useMutation } from "@tanstack/react-query";
import styles from "@/styles/AdminPages.module.css";
import { FieldValue, Timestamp } from 'firebase/firestore';
interface AdminLoginData {
  adminId: string;
  password: string;
}

interface AdminLoginResponse {
  success: boolean;
  message?: string;
  admin?: {
    name: string;
    sessionToken: string;
    lastLogin: string| FieldValue | Timestamp;
  };
}

const AdminLogin = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({ adminId: "", password: "" });
  const [error, setError] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (
      loginData: AdminLoginData
    ): Promise<AdminLoginResponse> => {
      const response = await fetch("/api/auth/verifyAdmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "관리자 로그인 실패");
      return data;
    },
    onSuccess: (data) => {
      router.push("/admin/dashboard");
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!formData.adminId || !formData.password) {
      setError("관리자 ID와 비밀번호를 모두 입력해주세요.");
      return;
    }
    loginMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  // 환경변수 테스트 함수
  const testFirebaseEnv = () => {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

    console.group("🔥 [Firebase] 환경 정보");
    console.log(
      `환경: ${
        process.env.NODE_ENV === "development" ? "Development" : "Production"
      }`
    );
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("프로젝트 ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    console.log("Firebase Config:", firebaseConfig);

    // 환경변수가 제대로 로드되었는지 확인
    Object.entries(firebaseConfig).forEach(([key, value]) => {
      console.log(`${key}:`, value ? "✅ 설정됨" : "❌ 누락");
    });

    console.groupEnd();
  };
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>관리자 로그인</h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <label className={styles.label}>관리자 ID</label>
            <input
              type="text"
              name="adminId"
              value={formData.adminId}
              onChange={handleChange}
              placeholder="관리자 ID를 입력하세요"
              className={styles.input}
              disabled={loginMutation.isPending}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label className={styles.label}>비밀번호</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호를 입력하세요"
              className={styles.input}
              disabled={loginMutation.isPending}
            />
          </div>

          {error && <div className={styles.errorBox}>{error}</div>}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className={styles.submitButton}
          >
            {loginMutation.isPending ? "로그인 중..." : "로그인"}
          </button>
        </form>
        {/* 테스트용 버튼 추가 */}
        {/* <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button
            type="button"
            onClick={testFirebaseEnv}
            style={{
              padding: "8px 16px",
              backgroundColor: "#ff6b6b",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            🔥 Firebase 환경변수 테스트
          </button>
        </div> */}
        <div className={styles.footer}>
          관리자 권한이 있는 계정만 접근 가능합니다.
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
