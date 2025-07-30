// pages/index.tsx - 리팩토링 버전

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { GetStaticProps } from "next";
import { useQueryClient } from "@tanstack/react-query";
import fs from "fs";
import path from "path";
import styles from "@/styles/ConsentPage.module.css";

// Hooks
import {
  useMinimalUserQuery,
  useUserCompletionStatusQuery,
} from "@/hooks/queries/useUserQueries";
import {
  useRegisterUserMutation,
  useUpdateScriptAssignmentsMutation,
  useVerifyAuthorizedUserMutation,
} from "@/hooks/mutations/useUserMutations";
import { useAssignScriptsMutation } from "@/hooks/mutations/useScriptMutations";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";

// Utils
import { generateUserHash, generateSecureUserId } from "@/utils/hash";

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

// Custom hook for auth state management
function useAuthState() {
  const {
    user: firebaseUser,
    isLoading: firebaseLoading,
    signInWithToken,
    isAuthenticated,
  } = useFirebaseAuth();
  const { data: minimalUserInfo } = useMinimalUserQuery();
  const { data: userCompletionStatus, isLoading: completionLoading } =
    useUserCompletionStatusQuery();

  return {
    firebaseUser,
    firebaseLoading,
    signInWithToken,
    isAuthenticated,
    minimalUserInfo,
    userCompletionStatus,
    completionLoading,
    isFullyAuthenticated: isAuthenticated && userCompletionStatus === true,
  };
}

// Main component
export default function ConsentPage({ consentText }: ConsentPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State management hooks
  const authState = useAuthState();

  // Mutations
  const verifyUserMutation = useVerifyAuthorizedUserMutation();
  const registerUserMutation = useRegisterUserMutation();
  const updateScriptsMutation = useUpdateScriptAssignmentsMutation();
  const assignScriptsMutation = useAssignScriptsMutation();

  // Local state
  const [userInput, setUserInput] = useState<UserInput>({
    name: "",
    socialNumber: "",
    gender: "남성",
    ageGroup: "",
    hasConsented: false,
  });
  const [error, setError] = useState<string>("");
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  const [pendingAuthData, setPendingAuthData] =
    useState<PendingAuthData | null>(null);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);

  // Auth completion handler
  const completeAuthFlow = useCallback(
    async (authData: PendingAuthData) => {
      if (isRedirecting) return;

      try {
        setIsRedirecting(true);
        console.log("🔄 인증 플로우 완료 시작:", authData);

        // Step 1: Create auth cookies and Firebase token
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

        // Step 2: Firebase Auth login if needed
        if (data.customToken && !authState.firebaseUser) {
          try {
            const user = await authState.signInWithToken(data.customToken);
            const idToken = await user.getIdToken();
            document.cookie = `firebase-token=${idToken}; path=/; max-age=3600`;
            console.log("🔥 Firebase Auth 완료");
          } catch (error) {
            console.error("Firebase Auth 실패:", error);
          }
        }

        // Step 3: Invalidate caches
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["user"] }),
          queryClient.invalidateQueries({ queryKey: ["userCompletionStatus"] }),
        ]);

        // Step 4: Clean up and redirect
        localStorage.removeItem("pendingAuth");
        setPendingAuthData(null);
        await router.push("/main");

        console.log("✅ 인증 플로우 완료");
      } catch (error) {
        console.error("인증 플로우 실패:", error);

        setError("인증에 실패했습니다. 다시 시도해주세요.");
        setIsRedirecting(false);
      }
    },
    [authState, queryClient, router, isRedirecting, setPendingAuthData]
  );
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

  // Auto-redirect for completed users
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

  // Handle pending auth for existing users (only once)
  useEffect(() => {
    if (
      pendingAuthData?.isExistingUser &&
      !authState.firebaseLoading &&
      !authState.completionLoading &&
      !isRedirecting
    ) {
      console.log("기존 사용자 처리");
      completeAuthFlow(pendingAuthData);
      setIsProcessed(true); // 중복 실행 방지
    }
  }, [
    pendingAuthData,
    authState.firebaseLoading,
    authState.completionLoading,
    isRedirecting,
    completeAuthFlow,
  ]);

  // Input handlers
  const updateUserInput = useCallback((updates: Partial<UserInput>) => {
    setUserInput((prev) => ({ ...prev, ...updates }));
    setError("");
  }, []);

  // User verification
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

  // New user registration
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
      const userId = generateSecureUserId();
      const userHash = generateUserHash(
        pendingAuthData.name,
        userInput.socialNumber || pendingAuthData.name
      );

      // Complete auth flow first
      await completeAuthFlow({
        ...pendingAuthData,
        userId,
        userHash,
      });

      // Register user
      await registerUserMutation.mutateAsync({
        userId,
        gender: userInput.gender,
        ageGroup: userInput.ageGroup,
        hasConsented: userInput.hasConsented,
        userName: pendingAuthData.name || "noName",
        authorizedUserId: userHash,
      });

      console.log("✅ 신규 사용자 등록 완료");
    } catch (error) {
      console.error("등록 실패:", error);
      setError(
        error instanceof Error ? error.message : "등록 중 오류가 발생했습니다."
      );
    }
  }, [userInput, pendingAuthData, completeAuthFlow, registerUserMutation]);

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
    registerUserMutation.error?.message ||
    updateScriptsMutation.error?.message;

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
                  isLoading
                }
              >
                {isLoading ? "인증 확인 중..." : "여기를 눌러주세요!"}
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
            <h2>이용약관 및 개인정보처리방침</h2>
            <div className={styles.consentBox}>
              <div className={styles.consentContent}>
                {consentText.split("\n").map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            </div>
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
            <div className={styles.errorMessage}>❌ {displayError}</div>
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
