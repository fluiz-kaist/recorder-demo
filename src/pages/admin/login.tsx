// // pages/admin/login.tsx
// import React, { useState } from "react";
// import { useRouter } from "next/router";
// import Head from "next/head";
// import styles from "@/styles/AdminLogin.module.css";
// import { useAdminLoginMutation } from "@/hooks/mutations/useAdminMutations";
// import { useIsAdmin } from "@/hooks/queries/useAdminQueries";

// const AdminLogin = () => {
//   const [adminName, setAdminName] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [errors, setErrors] = useState<{ [key: string]: string }>({});

//   const router = useRouter();
//   const adminLoginMutation = useAdminLoginMutation();
//   const { isAdmin, isLoading } = useIsAdmin();

//   // 이미 관리자로 로그인되어 있으면 대시보드로 리다이렉트
//   React.useEffect(() => {
//     if (!isLoading && isAdmin) {
//       router.push("/admin/dashboard");
//     }
//   }, [isAdmin, isLoading, router]);

//   const validateForm = () => {
//     const newErrors: { [key: string]: string } = {};

//     if (!adminName.trim()) {
//       newErrors.adminName = "관리자 이름을 입력해주세요.";
//     } else if (adminName.length < 2) {
//       newErrors.adminName = "관리자 이름은 2자 이상이어야 합니다.";
//     }

//     if (!password.trim()) {
//       newErrors.password = "비밀번호를 입력해주세요.";
//     }
//     // else if (password.length < 6) {
//     //   newErrors.password = "비밀번호는 6자 이상이어야 합니다.";
//     // }

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();

//     if (!validateForm()) {
//       return;
//     }

//     try {
//       await adminLoginMutation.mutateAsync({
//         adminId: adminName.trim(),
//         password: password.trim(),
//       });
//     } catch (error) {
//       console.error("관리자 로그인 오류:", error);
//     }
//   };

//   if (isLoading) {
//     return (
//       <div className={styles.loadingContainer}>
//         <div className={styles.spinner}></div>
//         <p>관리자 권한을 확인하고 있습니다...</p>
//       </div>
//     );
//   }

//   return (
//     <>
//       <Head>
//         <title>관리자 로그인 - 음성수집 서비스</title>
//         <meta name="description" content="관리자 로그인" />
//       </Head>

//       <div className={styles.container}>
//         <div className={styles.loginCard}>
//           {/* 헤더 */}
//           <div className={styles.header}>
//             <div className={styles.logoSection}>
//               <div className={styles.logoIcon}>
//                 <svg viewBox="0 0 24 24" fill="currentColor">
//                   <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11V12z" />
//                 </svg>
//               </div>
//               <h1 className={styles.title}>관리자 로그인</h1>
//             </div>
//             <p className={styles.subtitle}>
//               음성수집 서비스 관리자 페이지입니다
//             </p>
//           </div>

//           {/* 폼 */}
//           <form onSubmit={handleSubmit} className={styles.form}>
//             {/* 관리자 이름 입력 */}
//             <div className={styles.inputGroup}>
//               <label htmlFor="adminName" className={styles.label}>
//                 관리자 이름
//               </label>
//               <div className={styles.inputWrapper}>
//                 <input
//                   type="text"
//                   id="adminName"
//                   value={adminName}
//                   onChange={(e) => setAdminName(e.target.value)}
//                   className={`${styles.input} ${
//                     errors.adminName ? styles.inputError : ""
//                   }`}
//                   placeholder="관리자 이름을 입력하세요"
//                   autoComplete="username"
//                 />
//                 <div className={styles.inputIcon}>
//                   <svg viewBox="0 0 24 24" fill="currentColor">
//                     <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
//                   </svg>
//                 </div>
//               </div>
//               {errors.adminName && (
//                 <span className={styles.errorMessage}>{errors.adminName}</span>
//               )}
//             </div>

//             {/* 비밀번호 입력 */}
//             <div className={styles.inputGroup}>
//               <label htmlFor="password" className={styles.label}>
//                 비밀번호
//               </label>
//               <div className={styles.inputWrapper}>
//                 <input
//                   type={showPassword ? "text" : "password"}
//                   id="password"
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   className={`${styles.input} ${
//                     errors.password ? styles.inputError : ""
//                   }`}
//                   placeholder="비밀번호를 입력하세요"
//                   autoComplete="current-password"
//                 />
//                 <button
//                   type="button"
//                   className={styles.passwordToggle}
//                   onClick={() => setShowPassword(!showPassword)}
//                   aria-label={
//                     showPassword ? "비밀번호 숨기기" : "비밀번호 보기"
//                   }
//                 >
//                   <svg viewBox="0 0 24 24" fill="currentColor">
//                     {showPassword ? (
//                       <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
//                     ) : (
//                       <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
//                     )}
//                   </svg>
//                 </button>
//               </div>
//               {errors.password && (
//                 <span className={styles.errorMessage}>{errors.password}</span>
//               )}
//             </div>

//             {/* 로그인 버튼 */}
//             <button
//               type="submit"
//               className={styles.submitButton}
//               disabled={adminLoginMutation.isPending}
//             >
//               {adminLoginMutation.isPending ? (
//                 <>
//                   <div className={styles.spinner}></div>
//                   로그인 중...
//                 </>
//               ) : (
//                 <>
//                   <svg viewBox="0 0 24 24" fill="currentColor">
//                     <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
//                   </svg>
//                   관리자 로그인
//                 </>
//               )}
//             </button>

//             {/* 에러 메시지 */}
//             {adminLoginMutation.error && (
//               <div className={styles.globalError}>
//                 <svg viewBox="0 0 24 24" fill="currentColor">
//                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
//                 </svg>
//                 {adminLoginMutation.error.message}
//               </div>
//             )}
//           </form>

//           {/* 푸터 */}
//           <div className={styles.footer}>
//             <button
//               type="button"
//               className={styles.backButton}
//               onClick={() => router.push("/")}
//             >
//               ← 메인 페이지로 돌아가기
//             </button>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// };

// export default AdminLogin;
