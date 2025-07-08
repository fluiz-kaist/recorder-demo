// // pages/admin/dashboard.tsx
// import React from "react";
// import { useRouter } from "next/router";
// import Head from "next/head";
// import Layout from "@/components/Layout";
// import styles from "@/styles/AdminDashboard.module.css";
// import {
//   useIsAdmin,
//   useAdminStatsQuery,
// } from "@/hooks/queries/useAdminQueries";

// const AdminDashboard = () => {
//   const router = useRouter();
//   const { isAdmin, adminData, isLoading: adminLoading } = useIsAdmin();
//   const {
//     data: stats,
//     isLoading: statsLoading,
//     error: statsError,
//   } = useAdminStatsQuery();

//   // 관리자가 아니면 로그인 페이지로 리다이렉트
//   React.useEffect(() => {
//     if (!adminLoading && !isAdmin) {
//       router.push("/admin/login");
//     }
//   }, [isAdmin, adminLoading, router]);

//   if (adminLoading || !isAdmin) {
//     return (
//       <div className={styles.loadingContainer}>
//         <div className={styles.spinner}></div>
//         <p>관리자 권한을 확인하고 있습니다...</p>
//       </div>
//     );
//   }

//   const formatNumber = (num: number) => {
//     return new Intl.NumberFormat("ko-KR").format(num);
//   };

//   return (
//     <>
//       <Head>
//         <title>관리자 대시보드 - 음성수집 서비스</title>
//         <meta name="description" content="관리자 대시보드" />
//       </Head>

//       <Layout>
//         <div className={styles.container}>
//           {/* 헤더 */}
//           <div className={styles.header}>
//             <div className={styles.titleSection}>
//               <h1 className={styles.title}>관리자 대시보드</h1>
//               <p className={styles.subtitle}>환영합니다, {adminData?.name}님</p>
//             </div>

//             <div className={styles.actionButtons}>
//               <button
//                 className={styles.actionButton}
//                 onClick={() => router.push("/admin/users")}
//               >
//                 <svg viewBox="0 0 24 24" fill="currentColor">
//                   <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A2.996 2.996 0 0 0 17.06 7h-1.62c-.8 0-1.54.37-2.01 1l-2.43 3L8 7H5.5C4.12 7 3 8.12 3 9.5S4.12 12 5.5 12H7l5.5 11h3.5z" />
//                 </svg>
//                 사용자 관리
//               </button>

//               <button
//                 className={styles.actionButton}
//                 onClick={() => window.location.reload()}
//               >
//                 <svg viewBox="0 0 24 24" fill="currentColor">
//                   <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
//                 </svg>
//                 새로고침
//               </button>
//             </div>
//           </div>

//           {/* 통계 카드 섹션 */}
//           {statsLoading ? (
//             <div className={styles.statsLoading}>
//               <div className={styles.spinner}></div>
//               <p>통계 데이터를 불러오는 중...</p>
//             </div>
//           ) : statsError ? (
//             <div className={styles.errorCard}>
//               <svg viewBox="0 0 24 24" fill="currentColor">
//                 <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
//               </svg>
//               <p>통계 데이터를 불러올 수 없습니다.</p>
//               <button onClick={() => window.location.reload()}>
//                 다시 시도
//               </button>
//             </div>
//           ) : (
//             stats && (
//               <>
//                 {/* 주요 통계 카드 */}
//                 <div className={styles.statsGrid}>
//                   <div className={styles.statCard}>
//                     <div className={styles.statIcon}>
//                       <svg viewBox="0 0 24 24" fill="currentColor">
//                         <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
//                       </svg>
//                     </div>
//                     <div className={styles.statContent}>
//                       <h3 className={styles.statTitle}>총 사용자</h3>
//                       <p className={styles.statValue}>
//                         {formatNumber(stats.totalUsers)}명
//                       </p>
//                     </div>
//                   </div>

//                   <div className={styles.statCard}>
//                     <div className={styles.statIcon}>
//                       <svg viewBox="0 0 24 24" fill="currentColor">
//                         <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
//                       </svg>
//                     </div>
//                     <div className={styles.statContent}>
//                       <h3 className={styles.statTitle}>총 녹음</h3>
//                       <p className={styles.statValue}>
//                         {formatNumber(stats.totalRecordings)}개
//                       </p>
//                     </div>
//                   </div>

//                   <div className={styles.statCard}>
//                     <div className={styles.statIcon}>
//                       <svg viewBox="0 0 24 24" fill="currentColor">
//                         <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h8c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
//                       </svg>
//                     </div>
//                     <div className={styles.statContent}>
//                       <h3 className={styles.statTitle}>완료된 스크립트</h3>
//                       <p className={styles.statValue}>
//                         {formatNumber(stats.totalCompletedScripts)}개
//                       </p>
//                     </div>
//                   </div>

//                   <div className={styles.statCard}>
//                     <div className={styles.statIcon}>
//                       <svg viewBox="0 0 24 24" fill="currentColor">
//                         <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
//                       </svg>
//                     </div>
//                     <div className={styles.statContent}>
//                       <h3 className={styles.statTitle}>평균 진행률</h3>
//                       <p className={styles.statValue}>
//                         {stats.averageProgress}%
//                       </p>
//                     </div>
//                   </div>
//                 </div>

//                 {/* 차트 섹션 */}
//                 <div className={styles.chartsSection}>
//                   <div className={styles.chartCard}>
//                     <h3 className={styles.chartTitle}>연령대별 사용자 분포</h3>
//                     <div className={styles.chartContent}>
//                       {Object.entries(stats.usersByAgeGroup).map(
//                         ([ageGroup, count]) => (
//                           <div key={ageGroup} className={styles.chartItem}>
//                             <span className={styles.chartLabel}>
//                               {ageGroup}
//                             </span>
//                             <div className={styles.chartBar}>
//                               <div
//                                 className={styles.chartFill}
//                                 style={{
//                                   width: `${(count / stats.totalUsers) * 100}%`,
//                                 }}
//                               ></div>
//                             </div>
//                             <span className={styles.chartValue}>{count}명</span>
//                           </div>
//                         )
//                       )}
//                     </div>
//                   </div>

//                   <div className={styles.chartCard}>
//                     <h3 className={styles.chartTitle}>성별 사용자 분포</h3>
//                     <div className={styles.chartContent}>
//                       {Object.entries(stats.usersByGender).map(
//                         ([gender, count]) => (
//                           <div key={gender} className={styles.chartItem}>
//                             <span className={styles.chartLabel}>
//                               {gender === "male"
//                                 ? "남성"
//                                 : gender === "female"
//                                 ? "여성"
//                                 : "기타"}
//                             </span>
//                             <div className={styles.chartBar}>
//                               <div
//                                 className={styles.chartFill}
//                                 style={{
//                                   width: `${(count / stats.totalUsers) * 100}%`,
//                                 }}
//                               ></div>
//                             </div>
//                             <span className={styles.chartValue}>{count}명</span>
//                           </div>
//                         )
//                       )}
//                     </div>
//                   </div>

//                   <div className={styles.chartCard}>
//                     <h3 className={styles.chartTitle}>최근 7일 녹음 현황</h3>
//                     <div className={styles.recordingChart}>
//                       {stats.recordingsByDate.map((item, index) => (
//                         <div key={index} className={styles.recordingItem}>
//                           <div className={styles.recordingDate}>
//                             {new Date(item.date).toLocaleDateString("ko-KR", {
//                               month: "short",
//                               day: "numeric",
//                             })}
//                           </div>
//                           <div className={styles.recordingBar}>
//                             <div
//                               className={styles.recordingFill}
//                               style={{
//                                 height: `${Math.max(
//                                   (item.count /
//                                     Math.max(
//                                       ...stats.recordingsByDate.map(
//                                         (d) => d.count
//                                       )
//                                     )) *
//                                     100,
//                                   5
//                                 )}%`,
//                               }}
//                             ></div>
//                           </div>
//                           <div className={styles.recordingCount}>
//                             {item.count}
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 </div>

//                 {/* 빠른 액션 섹션 */}
//                 <div className={styles.quickActions}>
//                   <h3 className={styles.sectionTitle}>빠른 액션</h3>
//                   <div className={styles.actionGrid}>
//                     <button
//                       className={styles.quickActionCard}
//                       onClick={() => router.push("/admin/users")}
//                     >
//                       <svg viewBox="0 0 24 24" fill="currentColor">
//                         <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
//                       </svg>
//                       <h4>사용자 관리</h4>
//                       <p>사용자 목록 조회 및 관리</p>
//                     </button>

//                     <button
//                       className={styles.quickActionCard}
//                       onClick={() => alert("스크립트 관리 페이지 개발 예정")}
//                     >
//                       <svg viewBox="0 0 24 24" fill="currentColor">
//                         <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h8c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
//                       </svg>
//                       <h4>스크립트 관리</h4>
//                       <p>스크립트 추가 및 할당 관리</p>
//                     </button>

//                     <button
//                       className={styles.quickActionCard}
//                       onClick={() => alert("녹음 관리 페이지 개발 예정")}
//                     >
//                       <svg viewBox="0 0 24 24" fill="currentColor">
//                         <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
//                       </svg>
//                       <h4>녹음 관리</h4>
//                       <p>녹음 파일 조회 및 품질 검수</p>
//                     </button>

//                     <button
//                       className={styles.quickActionCard}
//                       onClick={() => alert("시스템 설정 페이지 개발 예정")}
//                     >
//                       <svg viewBox="0 0 24 24" fill="currentColor">
//                         <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
//                       </svg>
//                       <h4>시스템 설정</h4>
//                       <p>관리자 설정 및 권한 관리</p>
//                     </button>
//                   </div>
//                 </div>
//               </>
//             )
//           )}
//         </div>
//       </Layout>
//     </>
//   );
// };

// export default AdminDashboard;
