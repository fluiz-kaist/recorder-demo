// pages/admin/login.tsx (refactored)
import { useState } from "react";
import { useRouter } from "next/router";
import { useMutation } from "@tanstack/react-query";
import styles from "@/styles/AdminPages.module.css";

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
    lastLogin: string;
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

        <div className={styles.footer}>
          관리자 권한이 있는 계정만 접근 가능합니다.
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
