// pages/index.tsx
// 첫 진입 화면
// 화이트리스트(verifyUsers)에 등록된 참가자인지 확인 후
// 참가자가 맞고 참가 이력이 없을 때 동의 화면으로 진입, 동의 후 User를 생성
// 참가자가 맞고 참가 이력이 있을 때 main으로 이동

import fs from "fs";
import path from "path";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useQueryClient } from "@tanstack/react-query";

import { GetStaticProps } from "next";
import Head from "next/head";

import styles from "@/styles/ConsentPage.module.css";

// Hooks
import {
  useMinimalUserQuery,
  useUserCompletionStatusQuery,
} from "@/hooks/queries/useUserQueries";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import {
  useRegisterUserMutation,
  useVerifyAuthorizedUserMutation,
  useUpdateWhitelistedUserMutation,
} from "@/hooks/mutations/useUserMutations";
import { useAssignScriptsMutation } from "@/hooks/mutations/useScriptMutations";

// Utils
import { generateUserHash, generateSecureUserId } from "@/utils/hash";

import { isRecordingAvailable } from "@/utils/timeCheck";
// =================================
// ========== 타입, 상수=============
// ===================================

// Constants
const ageGroups = [
  "55-59세",
  "60-64세",
  "65-69세",
  "70-74세",
  "75-79세",
  "80세 이상",
] as const;

const genders = ["남성", "여성"] as const;

// Types
interface ConsentPageProps {
  consentText: string;
  serviceDescription: string;
}

interface UserInput {
  name: string;
  socialNumber: string;
  gender: "남성" | "여성";
  ageGroup: string;
  hasConsented: boolean;
}

interface PendingAuthData {
  isExistingUser: boolean;
  userId?: string;
  userHash?: string;
  name: string;
}

/**
 * 복합 상태 관리 훅 (Composite State Hook)
 * - 여러 개의 개별 훅을 조합하여 하나의 인터페이스로 제공
 * - 인증 관련 상태들과 파생 상태를 통합 관리
 */
function useAuthState() {
  const {
    user: firebaseUser,
    isLoading: firebaseLoading,
    signInWithToken,
    isAuthenticated,
    saveIdTokenToCookie,
  } = useFirebaseAuth();
  const { data: minimalUserInfo } = useMinimalUserQuery();
  const { data: userCompletionStatus, isLoading: completionLoading } =
    useUserCompletionStatusQuery();

  return {
    firebaseUser,
    firebaseLoading,
    signInWithToken,
    saveIdTokenToCookie,
    isAuthenticated,
    minimalUserInfo,
    userCompletionStatus,
    completionLoading,
    isFullyAuthenticated: isAuthenticated && userCompletionStatus === true,
  };
}

export default function ConsentPage({ consentText }: ConsentPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // =================================================
  // ========== 상태 관리와 Hook & Mutations =============
  // ===================================================
  const authState = useAuthState();

  // Mutations
  const verifyUserMutation = useVerifyAuthorizedUserMutation();
  const updateVeryUserMutation = useUpdateWhitelistedUserMutation();
  const registerUserMutation = useRegisterUserMutation();
  const assignScriptsMutation = useAssignScriptsMutation();

  // Local state
  const [userInput, setUserInput] = useState<UserInput>({
    name: "",
    socialNumber: "",
    gender: "" as "남성" | "여성",
    ageGroup: "",
    hasConsented: false,
  });
  const [error, setError] = useState<string>("");
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [pendingAuthData, setPendingAuthData] =
    useState<PendingAuthData | null>(null);
  const [isConsentExpanded, setIsConsentExpanded] = useState<boolean>(false);
  // const isAvailable = isRecordingAvailable();
  // Temporarily hardcoded for the test period (4 PM to 10 PM)

  // 현재 시간을 한국 시간으로 가져오는 함수
  const getKoreanTime = () => {
    const now = new Date();
    // 'Asia/Seoul' 타임존을 명시하여 한국 시간으로 변환
    const nowKST = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
    );
    return nowKST.getHours();
  };

  const currentHour = getKoreanTime();
  const isAvailable = currentHour >= 16 && currentHour < 22; // 4시(16)부터 10시(22)까지

  // =================================
  // ========== 함수 =============
  // =================================

  /**
   *  유틸리티 함수: 사용자 입력 상태 업데이트
   * - 모든 핸들러 함수에서 공통으로 사용되는 기본 함수
   * - 에러 상태도 함께 초기화
   */
  const updateUserInput = useCallback((updates: Partial<UserInput>) => {
    setUserInput((prev) => ({ ...prev, ...updates }));
    setError("");
  }, []);

  /**
   *  핵심 함수: Firebase 인증 플로우 완료
   * - 인증 쿠키 생성 → Firebase 로그인 → 캐시 무효화 → 리다이렉트
   * - 기존 사용자와 신규 사용자 모두에서 사용
   * - 인증 상태를 완전히 설정하는 중앙 집중식 함수
   */
  const completeAuthFlow = useCallback(
    async (authData: PendingAuthData) => {
      if (isRedirecting) return;

      try {
        setIsRedirecting(true);
        console.log("🔄 인증 플로우 완료 시작:", authData);

        // [1] auth cookie와 firebase token 생성
        const response = await fetch("/api/auth/completeAuth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            userId: authData.userId,
            userHash: authData.userHash,
            userName: authData.name,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "인증 실패");
        }

        const data = await response.json();
        console.log("🍪 인증 쿠키 생성 완료");

        //[2] firebase 로그인
        if (data.customToken && !authState.firebaseUser) {
          // if (process.env.NODE_ENV === "development") {
          //   throw new Error("테스트용 Firebase Auth 실패");
          // }
          try {
            const user = await authState.signInWithToken(data.customToken);
            await authState.saveIdTokenToCookie(user);
            console.log("🔥 Firebase Auth 및 ID Token 저장 완료");
          } catch (firebaseError) {
            console.error("Firebase Auth 실패:", firebaseError);
            // Firebase 오류 시 전체 플로우 중단
            throw new Error("인증 서비스에 문제가 발생하였습니다.");
          }
        }

        // [3] 기존 사용자인 경우에만 캐시 무효화 및 리다이렉트

        // Step 3: Invalidate caches
        if (authData.isExistingUser) {
          // ✅ 잠시 대기 후 캐시 무효화 (Firebase Auth 상태 안정화)
          await new Promise((resolve) => setTimeout(resolve, 100));

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["user"] }),
            queryClient.invalidateQueries({
              queryKey: ["userCompletionStatus"],
            }),
          ]);

          localStorage.removeItem("pendingAuth");
          setPendingAuthData(null);
          console.log("✅ 기존 사용자 인증 플로우 완료");
          await router.push("/main");
        } else {
          console.log("🔧 신규 사용자 - Firebase Auth만 완료, 등록 대기 중");
        }
      } catch (error) {
        console.error("인증 플로우 실패:", error);
        const errorMessage = "등록된 참가자인지 확인하지 못했습니다.";
        setError(
          error instanceof Error
            ? `${errorMessage}\n${error.message}`
            : `${errorMessage}\n입력 정보를 확인해주세요. 본 작업은 안내 메일을 받으신 뒤 참가할 수 있습니다.`
        );
        setIsRedirecting(false);
      }
    },
    [authState, queryClient, setPendingAuthData, isRedirecting, router]
  );

  /**
   *  1단계: 화이트리스트 인증
   * - 이름 + 주민번호로 참가 자격 확인
   * - 기존 사용자 → completeAuthFlow 실행
   * - 신규 사용자 → pendingAuthData 설정하여 동의 화면으로 전환
   */
  const handleVerifyUser = useCallback(async () => {
    if (!userInput.name || !userInput.socialNumber) {
      setError("이름과 주민번호를 입력해주세요.");
      return;
    }

    try {
      const result = await verifyUserMutation.mutateAsync({
        name: userInput.name,
        socialNumber: userInput.socialNumber,
      });

      if (result.user?.isExistingUser) {
        await completeAuthFlow(result.user);
      } else {
        // 신규 사용자인 경우 상태로 설정하고 localStorage에도 저장
        console.log("신규 사용자 감지, 동의 화면으로 전환");
        const authData = result.user;
        setPendingAuthData(authData);
        localStorage.setItem("pendingAuth", JSON.stringify(authData));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "인증에 실패했습니다.");
    }
  }, [
    userInput.name,
    userInput.socialNumber,
    verifyUserMutation,
    completeAuthFlow,
  ]);

  // 동의 후 절차: 신규 유저 등록
  /**
   * 3단계: 신규 사용자 등록 완료
   * - 동의 + 개인정보 입력 후 최종 등록
   * - Firebase Auth → Firestore 등록 → 화이트리스트 업데이트 → 리다이렉트
   * - 가장 복잡한 플로우를 담당하는 함수
   */
  const handleCompleteRegistration = useCallback(async () => {
    if (!userInput.gender || !userInput.ageGroup || !userInput.hasConsented) {
      setError("모든 항목을 선택하고 동의해주세요.");
      return;
    }

    if (!pendingAuthData) {
      setError("인증 정보가 없습니다. 다시 인증해주세요.");
      return;
    }

    try {
      console.group("user 컬랙션에 등록하기 시작합니다");
      const userId = generateSecureUserId();
      const userHash = generateUserHash(
        pendingAuthData.name,
        userInput.socialNumber || pendingAuthData.name
      );

      // Step 1: Firebase Auth 완료 (필요한 경우)
      if (!authState.firebaseUser) {
        console.log("🔧 Firebase Auth 진행");
        try {
          // if (process.env.NODE_ENV === "development") {
          //   throw new Error("테스트용 Firebase 등록 실패");
          // }

          await completeAuthFlow({
            ...pendingAuthData,
            userId,
            userHash,
          });
          console.log("✅ Firebase Auth 완료");

          // // ✅ Firebase Auth 상태 안정화를 위한 대기
          // await new Promise((resolve) => setTimeout(resolve, 200));

          // // 🔥 추가: Firebase 인증 성공 여부 재확인
          // if (!authState.firebaseUser) {
          //   throw new Error("Firebase 인증이 완료되지 않았습니다.");
          // }
        } catch (authError) {
          console.error("Firebase Auth 단계 실패:", authError);
          throw authError; // 상위로 전파하여 전체 등록 중단
        }
      }

      // step 2 : verifyiedUser에 userId 입력

      // Step 2: Firestore에 사용자 등록
      console.log("🔥 Firestore - users컬렉션 사용자 등록 시작");
      await registerUserMutation.mutateAsync({
        userId,
        gender: userInput.gender,
        ageGroup: userInput.ageGroup,
        hasConsented: userInput.hasConsented,
        userName: pendingAuthData.name || "noName",
        authorizedUserId: userHash,
      });
      console.log("✅ Firestore - users컬렉션 등록 완료");

      console.log(" 🔥  very 컬렉션의 userId 업데이트 작업 시작");
      await updateVeryUserMutation.mutateAsync({
        userId,
      });
      console.log(" ✅ very 컬렉션의 userId 업데이트 작업 완료");

      // Step 3: 등록 완료 후 정리 작업
      console.log("🔧 등록 완료 후 정리 작업 시작");

      // ✅ 잠시 대기 후 캐시 무효화
      await new Promise((resolve) => setTimeout(resolve, 100));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user"] }),
        queryClient.invalidateQueries({ queryKey: ["userCompletionStatus"] }),
      ]);

      // pendingAuth 제거
      localStorage.removeItem("pendingAuth");
      setPendingAuthData(null);

      console.log("✅ 신규 사용자 등록 및 정리 완료");
      console.groupEnd();

      // 성공적으로 등록 완료 후 메인으로 이동
      setIsRedirecting(true);
      await router.push("/main");
    } catch (error) {
      console.error("등록 실패:", error);
      setError(
        error instanceof Error ? error.message : "등록 중 오류가 발생했습니다."
      );
      //  실패 시에도 로딩 상태 해제
      setIsRedirecting(false);
    }
  }, [
    userInput,
    pendingAuthData,
    completeAuthFlow,
    registerUserMutation,
    authState.firebaseUser,
    queryClient,
    router,
    updateVeryUserMutation,
  ]);
  // =====================================
  // ========== useEffect 훅 =============
  // =====================================
  // [1]  초기 설정: localStorage에서 pendingAuth 복원
  useEffect(() => {
    const savedPendingAuth = localStorage.getItem("pendingAuth");
    if (savedPendingAuth && !isProcessed) {
      try {
        const authData = JSON.parse(savedPendingAuth);
        setPendingAuthData(authData);
      } catch (error) {
        console.error("저장된 pendingAuth 데이터 파싱 오류:", error);
        localStorage.removeItem("pendingAuth");
      }
    }
  }, [isProcessed]);

  // [2] 완전 인증된 사용자 처리 (최우선 - 바로 리다이렉트)
  // 모든 인증이 완료되어 바로 메인으로 보내야 하는 사용자
  useEffect(() => {
    if (
      authState.isFullyAuthenticated &&
      !authState.firebaseLoading &&
      !authState.completionLoading &&
      !pendingAuthData &&
      !isRedirecting
    ) {
      console.log("이미 완료된 사용자, 메인으로 리다이렉트");
      setIsRedirecting(true);
      router.push("/main");
    }
  }, [
    authState.isFullyAuthenticated,
    authState.firebaseLoading,
    authState.completionLoading,
    pendingAuthData,
    isRedirecting,
    router,
  ]);

  // [3] 기존 사용자 재인증 처리 (pendingAuth가 있는 경우)
  // 동의는 이미 했지만, 브라우저 새로고침 등으로 인해 Firebase 인증이 끊어진 기존 사용자
  useEffect(() => {
    if (
      pendingAuthData?.isExistingUser &&
      !authState.firebaseLoading &&
      !authState.completionLoading &&
      !isRedirecting &&
      !isProcessed
    ) {
      console.log("기존 사용자 처리");
      const handleExistingUser = async () => {
        try {
          await completeAuthFlow(pendingAuthData);
          setIsProcessed(true);
        } catch (error) {
          console.error("기존 사용자 처리 실패:", error);
          //  실패 시 처리 상태 초기화 (재시도 허용)
          setIsProcessed(false);
          // 사용자에게 재시도 옵션 제공을 위해 pendingAuth는 유지
        }
      };

      handleExistingUser();
    }
  }, [
    isProcessed,
    pendingAuthData,
    authState.firebaseLoading,
    authState.completionLoading,
    isRedirecting,
    completeAuthFlow,
  ]);

  // =====================================
  // ========== UI states =============
  // =====================================
  // Loading states
  const isLoading =
    verifyUserMutation.isPending ||
    registerUserMutation.isPending ||
    assignScriptsMutation.isPending;
  const isPageLoading =
    authState.firebaseLoading ||
    authState.completionLoading ||
    isRedirecting ||
    verifyUserMutation.isPending;

  // Error display
  const displayError =
    error ||
    verifyUserMutation.error?.message ||
    registerUserMutation.error?.message;

  // =====================================
  // ========== Rendering =============
  // =====================================
  // Render loading screen
  if (isPageLoading) {
    return (
      <>
        <Head>
          <title>서비스 이용 동의</title>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, user-scalable=yes"
          />
        </Head>
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>
              {verifyUserMutation.isPending
                ? "입력한 정보를 확인하고 있습니다..."
                : isRedirecting
                ? "페이지를 이동하고 있습니다..."
                : "인증 상태를 확인하고 있습니다..."}
            </p>
          </div>
        </div>
      </>
    );
  }

  // Render auth form for non-authenticated users
  if (!pendingAuthData && !authState.isAuthenticated) {
    return (
      <>
        <Head>
          <title>음성 데이터 구축을 위한 녹음 페이지</title>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, user-scalable=yes"
          />
        </Head>
        <div className={styles.container}>
          <div className={styles.infoSection}>
            <h2>신청자 확인</h2>
            <p>신청자 확인을 위해 이름과 주민번호 앞자리를 입력해주세요.</p>
            {/* <p>
              {isAvailable
                ? "지금 음성 녹음에 참여하실 수 있습니다."
                : "음성 녹음은 평일 오후 12시~6시에 참여하실 수 있습니다."}
            </p> */}

            <p>
              {isAvailable
                ? "지금 음성 녹음에 참여하실 수 있습니다."
                : "오늘(8월 7일) 녹음은 오후 4시부터 밤 10시까지 참여하실 수 있습니다. 이용에 참고 부탁드립니다."}
            </p>

            <div className={styles.inputGroup}>
              <h3>이름</h3>
              <input
                type="text"
                value={userInput.name}
                onChange={(e) => updateUserInput({ name: e.target.value })}
                placeholder="이름을 입력하세요"
                className={styles.textInput}
                disabled={isLoading}
                autoComplete="name"
              />
            </div>

            <div className={styles.inputGroup}>
              <h3>주민등록번호 앞자리</h3>
              <input
                type="text"
                value={userInput.socialNumber}
                onChange={(e) =>
                  updateUserInput({ socialNumber: e.target.value })
                }
                placeholder="주민등록번호 앞자리를 입력하세요(123456)"
                className={styles.textInput}
                disabled={isLoading}
                maxLength={6}
              />
            </div>

            <div className={styles.submitSection}>
              <button
                type="button"
                className={`${styles.submitButton} ${
                  userInput.name && userInput.socialNumber.length === 6
                    ? styles.enabled
                    : styles.disabled
                }`}
                onClick={handleVerifyUser}
                disabled={
                  !userInput.name ||
                  userInput.socialNumber.length !== 6 ||
                  isLoading ||
                  !isAvailable
                }
              >
                {isLoading
                  ? "인증 확인 중..."
                  : !isAvailable
                  ? "현재 이용 불가 시간입니다"
                  : "여기를 눌러주세요!"}
              </button>
            </div>
          </div>

          {displayError && (
            <div className={styles.errorMessage}>❌ {displayError}</div>
          )}
        </div>
      </>
    );
  }

  // Render consent form for new users
  if (pendingAuthData && !pendingAuthData.isExistingUser) {
    return (
      <>
        <Head>
          <title>서비스 이용 동의</title>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, user-scalable=yes"
          />
        </Head>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>서비스 이용 동의</h1>
            <p>안녕하세요, {pendingAuthData.name}님!</p>
          </div>

          {/* Consent Section */}
          <div className={styles.consentSection}>
            <h2
              onClick={() => setIsConsentExpanded(!isConsentExpanded)}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              이용약관 및 개인정보처리방침
              <span style={{ marginLeft: "8px", fontSize: "15px" }}>
                {isConsentExpanded ? "접기" : "[약관 보기]"}
              </span>
            </h2>

            {isConsentExpanded && (
              <div className={styles.consentBox}>
                <div className={styles.consentContent}>
                  {consentText.split("\n").map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>
            )}
            <div className={styles.consentCheckbox}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={userInput.hasConsented}
                  onChange={(e) =>
                    updateUserInput({ hasConsented: e.target.checked })
                  }
                  className={styles.checkboxInput}
                />
                <span className={styles.checkboxText}>
                  위 내용을 모두 읽었으며 동의합니다
                </span>
              </label>
            </div>
          </div>

          {/* User Info Section */}
          <div className={styles.infoSection}>
            <h2>기본 정보 입력</h2>

            <div className={styles.inputGroup}>
              <h3>성별을 선택해주세요</h3>
              <div className={styles.buttonGroup}>
                {genders.map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    className={`${styles.selectButton} ${
                      userInput.gender === gender ? styles.selected : ""
                    }`}
                    onClick={() => updateUserInput({ gender })}
                  >
                    {gender}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.inputGroup}>
              <h3>연령대를 선택해주세요</h3>
              <div className={`${styles.buttonGroup} ${styles.vertical}`}>
                {ageGroups.map((age) => (
                  <button
                    key={age}
                    type="button"
                    className={`${styles.selectButton} ${
                      userInput.ageGroup === age ? styles.selected : ""
                    }`}
                    onClick={() => updateUserInput({ ageGroup: age })}
                  >
                    {age}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {displayError && (
            <div className={styles.errorMessage}>
              ❌ {displayError}
              {/* 🔥 Firebase 에러 시 재시도 버튼 추가 */}
              {(displayError.includes("Firebase") ||
                displayError.includes("인증")) && (
                <button
                  onClick={() => {
                    setError("");
                    setIsProcessed(false); // 재시도 허용
                    if (pendingAuthData?.isExistingUser) {
                      // 기존 사용자는 바로 재시도
                      completeAuthFlow(pendingAuthData);
                    }
                  }}
                  className={styles.retryButton}
                  style={{ marginLeft: "10px" }}
                >
                  다시 시도
                </button>
              )}
            </div>
          )}

          <div className={styles.submitSection}>
            <button
              type="button"
              className={`${styles.submitButton} ${
                userInput.gender && userInput.ageGroup && userInput.hasConsented
                  ? styles.enabled
                  : styles.disabled
              }`}
              onClick={handleCompleteRegistration}
              disabled={
                !userInput.gender ||
                !userInput.ageGroup ||
                !userInput.hasConsented ||
                isLoading
              }
            >
              {isLoading ? "처리 중..." : "동의하고 시작하기"}
            </button>
          </div>
        </div>
      </>
    );
  }

  // Fallback loading
  return (
    <>
      <Head>
        <title>서비스 이용 동의</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>사용자 상태를 확인하고 있습니다...</p>
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const consentPath = path.join(process.cwd(), "public", "consent.txt");
    const servicePath = path.join(
      process.cwd(),
      "public",
      "service-description.txt"
    );

    const consentText = fs.readFileSync(consentPath, "utf8");
    const serviceDescription = fs.readFileSync(servicePath, "utf8");

    return {
      props: { consentText, serviceDescription },
    };
  } catch (error) {
    console.error("파일 읽기 오류:", error);
    return {
      props: {
        consentText: "동의서를 불러올 수 없습니다.",
        serviceDescription: "서비스 설명을 불러올 수 없습니다.",
      },
    };
  }
};
