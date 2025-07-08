// // pages/admin/users.tsx
// import React, { useState } from "react";
// import { useRouter } from "next/router";
// import Head from "next/head";
// import Layout from "@/components/Layout";
// import styles from "@/styles/AdminUsers.module.css";
// import { useIsAdmin, useAllUsersQuery } from "@/hooks/queries/useAdminQueries";
// import { useDeleteUserMutation } from "@/hooks/mutations/useAdminMutations";
// import { User } from "@/types/firebase";

// const AdminUsers = () => {
//   const router = useRouter();
//   const { isAdmin, isLoading: adminLoading } = useIsAdmin();

//   // 필터 및 페이지네이션 상태
//   const [currentPage, setCurrentPage] = useState(1);
//   const [limit, setLimit] = useState(20);
//   const [sortBy, setSortBy] = useState("createdAt");
//   const [sortOrder, setSortOrder] = useState("desc");
//   const [ageGroupFilter, setAgeGroupFilter] = useState("");
//   const [genderFilter, setGenderFilter] = useState("");
//   const [assignmentFilter, setAssignmentFilter] = useState("");
//   const [searchTerm, setSearchTerm] = useState("");

//   // 사용자 목록 조회
//   const {
//     data,
//     isLoading: usersLoading,
//     error: usersError,
//     refetch,
//   } = useAllUsersQuery({
//     page: currentPage,
//     limit,
//     sortBy,
//     sortOrder,
//     ageGroup: ageGroupFilter || undefined,
//     gender: genderFilter || undefined,
//     hasAssignments: assignmentFilter || undefined,
//   });

//   // 사용자 삭제 뮤테이션
//   const deleteUserMutation = useDeleteUserMutation();

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

//   const handleDeleteUser = async (userId: string, userName: string) => {
//     if (
//       confirm(
//         `정말로 "${userName}" 사용자를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 사용자의 모든 데이터(녹음, 스크립트 등)가 함께 삭제됩니다.`
//       )
//     ) {
//       try {
//         await deleteUserMutation.mutateAsync(userId);
//         alert("사용자가 성공적으로 삭제되었습니다.");
//         refetch(); // 목록 새로고침
//       } catch (error) {
//         console.error(error);
//         alert("사용자 삭제에 실패했습니다.");
//       }
//     }
//   };

//   const handleSortChange = (field: string) => {
//     if (sortBy === field) {
//       setSortOrder(sortOrder === "asc" ? "desc" : "asc");
//     } else {
//       setSortBy(field);
//       setSortOrder("desc");
//     }
//     setCurrentPage(1);
//   };

//   const resetFilters = () => {
//     setAgeGroupFilter("");
//     setGenderFilter("");
//     setAssignmentFilter("");
//     setSearchTerm("");
//     setCurrentPage(1);
//   };

//   const filteredUsers =
//     data?.users?.filter((user) => {
//       if (!searchTerm) return true;
//       return (
//         user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         user.userId?.toLowerCase().includes(searchTerm.toLowerCase())
//       );
//     }) || [];

//   const totalPages = Math.ceil((data?.totalCount || 0) / limit);

//   const formatDate = (dateString: string) => {
//     return new Date(dateString).toLocaleDateString("ko-KR", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//       hour: "2-digit",
//       minute: "2-digit",
//     });
//   };

//   const getProgressInfo = (user: User) => {
//     if (!user.scriptAssignments || user.scriptAssignments.length === 0) {
//       return { completed: 0, total: 0, percentage: 0 };
//     }

//     const totalAssigned = user.scriptAssignments.reduce(
//       (sum, assignment) => sum + assignment.assignedScriptIds.length,
//       0
//     );
//     const totalCompleted = user.scriptAssignments.reduce(
//       (sum, assignment) => sum + assignment.completedScriptIds.length,
//       0
//     );

//     return {
//       completed: totalCompleted,
//       total: totalAssigned,
//       percentage:
//         totalAssigned > 0
//           ? Math.round((totalCompleted / totalAssigned) * 100)
//           : 0,
//     };
//   };

//   return (
//     <>
//       <Head>
//         <title>사용자 관리 - 관리자</title>
//         <meta name="description" content="사용자 관리 페이지" />
//       </Head>

//       <Layout>
//         <div className={styles.container}>
//           {/* 헤더 */}
//           <div className={styles.header}>
//             <div className={styles.titleSection}>
//               <h1 className={styles.title}>사용자 관리</h1>
//               <p className={styles.subtitle}>
//                 총 {data?.totalCount || 0}명의 사용자
//               </p>
//             </div>

//             <div className={styles.headerActions}>
//               <button
//                 className={styles.refreshButton}
//                 onClick={() => refetch()}
//                 disabled={usersLoading}
//               >
//                 <svg viewBox="0 0 24 24" fill="currentColor">
//                   <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
//                 </svg>
//                 새로고침
//               </button>

//               <button
//                 className={styles.backButton}
//                 onClick={() => router.push("/admin/dashboard")}
//               >
//                 ← 대시보드로 돌아가기
//               </button>
//             </div>
//           </div>

//           {/* 필터 섹션 */}
//           <div className={styles.filtersSection}>
//             <div className={styles.filtersGrid}>
//               <div className={styles.filterGroup}>
//                 <label className={styles.filterLabel}>검색</label>
//                 <input
//                   type="text"
//                   className={styles.searchInput}
//                   placeholder="이름 또는 사용자 ID 검색"
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                 />
//               </div>

//               <div className={styles.filterGroup}>
//                 <label className={styles.filterLabel}>연령대</label>
//                 <select
//                   className={styles.filterSelect}
//                   value={ageGroupFilter}
//                   onChange={(e) => setAgeGroupFilter(e.target.value)}
//                 >
//                   <option value="">전체</option>
//                   <option value="10-19">10-19세</option>
//                   <option value="20-29">20-29세</option>
//                   <option value="30-39">30-39세</option>
//                   <option value="40-49">40-49세</option>
//                   <option value="50-59">50-59세</option>
//                   <option value="60+">60세 이상</option>
//                 </select>
//               </div>

//               <div className={styles.filterGroup}>
//                 <label className={styles.filterLabel}>성별</label>
//                 <select
//                   className={styles.filterSelect}
//                   value={genderFilter}
//                   onChange={(e) => setGenderFilter(e.target.value)}
//                 >
//                   <option value="">전체</option>
//                   <option value="male">남성</option>
//                   <option value="female">여성</option>
//                 </select>
//               </div>

//               <div className={styles.filterGroup}>
//                 <label className={styles.filterLabel}>할당 상태</label>
//                 <select
//                   className={styles.filterSelect}
//                   value={assignmentFilter}
//                   onChange={(e) => setAssignmentFilter(e.target.value)}
//                 >
//                   <option value="">전체</option>
//                   <option value="true">할당됨</option>
//                   <option value="false">할당 안됨</option>
//                 </select>
//               </div>

//               <div className={styles.filterGroup}>
//                 <label className={styles.filterLabel}>페이지당 항목</label>
//                 <select
//                   className={styles.filterSelect}
//                   value={limit}
//                   onChange={(e) => {
//                     setLimit(Number(e.target.value));
//                     setCurrentPage(1);
//                   }}
//                 >
//                   <option value={10}>10개</option>
//                   <option value={20}>20개</option>
//                   <option value={50}>50개</option>
//                   <option value={100}>100개</option>
//                 </select>
//               </div>

//               <div className={styles.filterGroup}>
//                 <button className={styles.resetButton} onClick={resetFilters}>
//                   필터 초기화
//                 </button>
//               </div>
//             </div>
//           </div>

//           {/* 사용자 목록 */}
//           {usersLoading ? (
//             <div className={styles.loadingSection}>
//               <div className={styles.spinner}></div>
//               <p>사용자 목록을 불러오는 중...</p>
//             </div>
//           ) : usersError ? (
//             <div className={styles.errorSection}>
//               <svg viewBox="0 0 24 24" fill="currentColor">
//                 <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
//               </svg>
//               <p>사용자 목록을 불러올 수 없습니다.</p>
//               <button onClick={() => refetch()}>다시 시도</button>
//             </div>
//           ) : filteredUsers.length === 0 ? (
//             <div className={styles.emptySection}>
//               <svg viewBox="0 0 24 24" fill="currentColor">
//                 <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
//               </svg>
//               <p>조건에 맞는 사용자가 없습니다.</p>
//             </div>
//           ) : (
//             <>
//               {/* 사용자 테이블 */}
//               <div className={styles.tableSection}>
//                 <div className={styles.tableContainer}>
//                   <table className={styles.table}>
//                     <thead>
//                       <tr>
//                         <th
//                           className={styles.sortableHeader}
//                           onClick={() => handleSortChange("name")}
//                         >
//                           이름
//                           {sortBy === "name" && (
//                             <span className={styles.sortIcon}>
//                               {sortOrder === "asc" ? "↑" : "↓"}
//                             </span>
//                           )}
//                         </th>
//                         <th>사용자 ID</th>
//                         <th>연령대</th>
//                         <th>성별</th>
//                         <th>진행률</th>
//                         <th
//                           className={styles.sortableHeader}
//                           onClick={() => handleSortChange("createdAt")}
//                         >
//                           가입일
//                           {sortBy === "createdAt" && (
//                             <span className={styles.sortIcon}>
//                               {sortOrder === "asc" ? "↑" : "↓"}
//                             </span>
//                           )}
//                         </th>
//                         <th
//                           className={styles.sortableHeader}
//                           onClick={() => handleSortChange("lastAccessAt")}
//                         >
//                           최근 접속
//                           {sortBy === "lastAccessAt" && (
//                             <span className={styles.sortIcon}>
//                               {sortOrder === "asc" ? "↑" : "↓"}
//                             </span>
//                           )}
//                         </th>
//                         <th>액션</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {filteredUsers.map((user) => {
//                         const progress = getProgressInfo(user);
//                         return (
//                           <tr key={user.userId} className={styles.tableRow}>
//                             <td className={styles.nameCell}>
//                               <div className={styles.userInfo}>
//                                 <div className={styles.userAvatar}>
//                                   {user.name?.charAt(0) || "?"}
//                                 </div>
//                                 <span className={styles.userName}>
//                                   {user.name || "이름 없음"}
//                                 </span>
//                               </div>
//                             </td>
//                             <td className={styles.userIdCell}>
//                               <code className={styles.userId}>
//                                 {user.userId}
//                               </code>
//                             </td>
//                             <td className={styles.ageGroupCell}>
//                               <span className={styles.badge}>
//                                 {user.ageGroup || "미설정"}
//                               </span>
//                             </td>
//                             <td className={styles.genderCell}>
//                               <span className={styles.badge}>
//                                 {user.gender === "male"
//                                   ? "남성"
//                                   : user.gender === "female"
//                                   ? "여성"
//                                   : "미설정"}
//                               </span>
//                             </td>
//                             <td className={styles.progressCell}>
//                               <div className={styles.progressContainer}>
//                                 <div className={styles.progressBar}>
//                                   <div
//                                     className={styles.progressFill}
//                                     style={{ width: `${progress.percentage}%` }}
//                                   ></div>
//                                 </div>
//                                 <span className={styles.progressText}>
//                                   {progress.percentage}% ({progress.completed}/
//                                   {progress.total})
//                                 </span>
//                               </div>
//                             </td>
//                             <td className={styles.dateCell}>
//                               {user.createdAt
//                                 ? formatDate(user.createdAt)
//                                 : "미설정"}
//                             </td>
//                             <td className={styles.dateCell}>
//                               {user.lastAccessAt
//                                 ? formatDate(user.lastAccessAt)
//                                 : "없음"}
//                             </td>
//                             <td className={styles.actionCell}>
//                               <div className={styles.actionButtons}>
//                                 <button
//                                   className={styles.viewButton}
//                                   onClick={() =>
//                                     alert(`${user.name} 상세 정보 (개발 예정)`)
//                                   }
//                                   title="상세 보기"
//                                 >
//                                   <svg viewBox="0 0 24 24" fill="currentColor">
//                                     <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
//                                   </svg>
//                                 </button>

//                                 <button
//                                   className={styles.editButton}
//                                   onClick={() =>
//                                     alert(`${user.name} 편집 (개발 예정)`)
//                                   }
//                                   title="편집"
//                                 >
//                                   <svg viewBox="0 0 24 24" fill="currentColor">
//                                     <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
//                                   </svg>
//                                 </button>

//                                 <button
//                                   className={styles.deleteButton}
//                                   onClick={() =>
//                                     handleDeleteUser(
//                                       user.userId,
//                                       user.name || "이름 없음"
//                                     )
//                                   }
//                                   disabled={deleteUserMutation.isPending}
//                                   title="삭제"
//                                 >
//                                   <svg viewBox="0 0 24 24" fill="currentColor">
//                                     <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
//                                   </svg>
//                                 </button>
//                               </div>
//                             </td>
//                           </tr>
//                         );
//                       })}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>

//               {/* 페이지네이션 */}
//               {totalPages > 1 && (
//                 <div className={styles.pagination}>
//                   <button
//                     className={styles.pageButton}
//                     onClick={() => setCurrentPage(1)}
//                     disabled={currentPage === 1}
//                   >
//                     ««
//                   </button>

//                   <button
//                     className={styles.pageButton}
//                     onClick={() => setCurrentPage(currentPage - 1)}
//                     disabled={currentPage === 1}
//                   >
//                     ‹
//                   </button>

//                   {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
//                     let pageNum;
//                     if (totalPages <= 5) {
//                       pageNum = i + 1;
//                     } else if (currentPage <= 3) {
//                       pageNum = i + 1;
//                     } else if (currentPage >= totalPages - 2) {
//                       pageNum = totalPages - 4 + i;
//                     } else {
//                       pageNum = currentPage - 2 + i;
//                     }

//                     return (
//                       <button
//                         key={pageNum}
//                         className={`${styles.pageButton} ${
//                           currentPage === pageNum ? styles.activePage : ""
//                         }`}
//                         onClick={() => setCurrentPage(pageNum)}
//                       >
//                         {pageNum}
//                       </button>
//                     );
//                   })}

//                   <button
//                     className={styles.pageButton}
//                     onClick={() => setCurrentPage(currentPage + 1)}
//                     disabled={currentPage === totalPages}
//                   >
//                     ›
//                   </button>

//                   <button
//                     className={styles.pageButton}
//                     onClick={() => setCurrentPage(totalPages)}
//                     disabled={currentPage === totalPages}
//                   >
//                     »»
//                   </button>

//                   <span className={styles.pageInfo}>
//                     {currentPage} / {totalPages} 페이지
//                   </span>
//                 </div>
//               )}
//             </>
//           )}
//         </div>
//       </Layout>
//     </>
//   );
// };

// export default AdminUsers;
