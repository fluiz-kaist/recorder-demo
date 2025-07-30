// pages/admin/index.tsx (refactored)
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAdminAuth } from "@/hooks/queries/useAdminQueries";
import styles from "@/styles/AdminPages.module.css";

const AdminIndex = () => {
  const router = useRouter();
  const { data: authData, isLoading } = useAdminAuth();

  useEffect(() => {
    if (!isLoading) {
      if (authData?.isAdmin) {
        router.push("/admin/dashboard");
      } else {
        router.push("/admin/login");
      }
    }
  }, [authData, isLoading, router]);

  return <div className={styles.loadingBox}>관리자 페이지로 이동 중...</div>;
};

export default AdminIndex;
