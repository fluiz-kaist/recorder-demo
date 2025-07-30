// pages/index.tsx - 수정된 버전

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { GetStaticProps } from "next";
import { useQueryClient } from "@tanstack/react-query";
import fs from "fs";
import path from "path";
import styles from "@/styles/ConsentPage.module.css";
import {
  useMinimalUserQuery,
  useUserCompletionStatusQuery,
} from "@/hooks/queries/useUserQueries";
import {
  useRegisterUserMutation,
  useUpdateScriptAssignmentsMutation,
} from "@/hooks/mutations/useUserMutations";
import { useVerifyAuthorizedUserMutation } from "@/hooks/mutations/useUserMutations";

import { useAssignScriptsMutation } from "@/hooks/mutations/useScriptMutations";
import { generateUserHash, generateSecureUserId } from "@/utils/hash";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
const ageGroups = [
  "55-59세",
  "60-64세",
  "65-69세",
  "70-74세",
  "75-79세",
  "80세 이상",
] as const;

const genders = ["남성", "여성"] as const;

interface ConsentPageProps {
  consentText: string;
  serviceDescription: string;
}

export default function ConsentPage({ consentText }: ConsentPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 🟢 쿠키 기반 인증 상태 확인

  // 🔥 수정 후 (Firebase Auth만 사용)
  const {
    user: firebaseUser,
    isLoading: firebaseLoading,
    signInWithToken,
    isAuthenticated,
  } = useFirebaseAuth();
  const { data: minimalUserInfo } = useMinimalUserQuery();
  const { data: userCompletionStatus, isLoading: completionLoading } =
    useUserCompletionStatusQuery();

  // 뮤테이션 훅들
  const verifyUserMutation = useVerifyAuthorizedUserMutation();
  const registerUserMutation = useRegisterUserMutation();
  const updateScriptsMutation = useUpdateScriptAssignmentsMutation();
  const assignScriptsMutation = useAssignScriptsMutation();

  // 로컬 상태
  const [userInput, setUserInput] = useState<{
    name: string;
    socialNumber: string;
    gender: "남성" | "여성";
    ageGroup: string;
    hasConsented: boolean;
  }>({
    name: "",
    socialNumber: "",
    gender: "남성",
    ageGroup: "",
    hasConsented: false,
  });

  const [error, setError] = useState<string>("");
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  // 🟢 로컬에서 저장된 사용자 이름 가져오기
  const userName = minimalUserInfo?.userName || "";

  // 🔧 인증된 사용자가 이미 등록 완료된 경우 메인으로 리다이렉트
  // 🔥 수정 후
  useEffect(() => {
    if (isAuthenticated && userCompletionStatus === true) {
      console.log("이미 등록 완료된 사용자, 메인으로 리다이렉트");
      setIsRedirecting(true);
      router.push("/main");
    }
  }, [isAuthenticated, userCompletionStatus, router]);

  // 🟢 기존 사용자 처리 함수 수정
  const handleCompleteExistingUser = useCallback(
    async (authData: any) => {
      try {
        console.log("🔄 기존 사용자 처리 시작:", authData);
        setIsRedirecting(true);

        // Firebase Auth 상태 체크
        if (!isAuthenticated || !firebaseUser) {
          console.log("🍪 쿠키 및 Firebase Token 생성 시작...");

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
            throw new Error(errorData.message || "쿠키 생성 실패");
          }

          const data = await response.json();
          console.log("🍪 HTTP 쿠키 생성 완료");

          if (data.customToken && !firebaseUser) {
            try {
              await signInWithToken(data.customToken);
              console.log("🔥 Firebase Auth 로그인 완료");
            } catch (error) {
              console.error("Firebase Auth 로그인 실패:", error);
            }
          }
        }

        console.log("📋 캐시 무효화 시작...");
        await queryClient.invalidateQueries({ queryKey: ["user"] });
        await queryClient.invalidateQueries({
          queryKey: ["userCompletionStatus"],
        });

        console.log("🗑️ localStorage 정리...");
        localStorage.removeItem("pendingAuth");

        console.log("🚀 메인 페이지로 이동...");
        await router.push("/main");

        console.log("✅ 기존 사용자 처리 완료");
      } catch (error) {
        console.error("기존 사용자 로그인 실패:", error);
        localStorage.removeItem("pendingAuth");
        setError("로그인에 실패했습니다. 다시 시도해주세요.");
        setIsRedirecting(false);
      }
    },
    [isAuthenticated, firebaseUser, signInWithToken, queryClient, router]
  ); // 🔧 의존성 명시

  // 🟢 pendingAuth 처리 로직 수정
  useEffect(() => {
    const pendingAuth = localStorage.getItem("pendingAuth");

    console.log("🔍 pendingAuth 확인:", {
      pendingAuth: !!pendingAuth,
      firebaseLoading,
      completionLoading,
      isAuthenticated,
      userCompletionStatus,
    });

    if (pendingAuth && !firebaseLoading && !completionLoading) {
      try {
        const authData = JSON.parse(pendingAuth);
        console.log("📋 pendingAuth 데이터:", authData);

        if (authData.isExistingUser) {
          console.log("👤 기존 사용자 감지, 처리 시작");
          handleCompleteExistingUser(authData);
        } else {
          console.log("🆕 신규 사용자 - 동의 폼 표시 예정");
        }
      } catch (error) {
        console.error("pendingAuth 데이터 파싱 오류:", error);
        localStorage.removeItem("pendingAuth");
      }
    }
  }, [
    firebaseLoading,
    completionLoading,
    handleCompleteExistingUser, // 🔧 추가
    isAuthenticated, // 🔧 추가
    userCompletionStatus, // 🔧 추가
  ]);

  // 🟢 로딩 상태 통합 및 조건 개선
  if (
    firebaseLoading ||
    completionLoading ||
    isRedirecting ||
    verifyUserMutation.isPending
  ) {
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

  // 입력 핸들러들 (기존과 동일)
  const handleNameChange = (name: string) => {
    setUserInput((prev) => ({ ...prev, name }));
    setError("");
  };

  const handleSocialNumberChange = (socialNumber: string) => {
    setUserInput((prev) => ({ ...prev, socialNumber }));
    setError("");
  };

  const handleGenderSelect = (gender: (typeof genders)[number]) => {
    setUserInput((prev) => ({ ...prev, gender }));
    setError("");
  };

  const handleAgeGroupSelect = (ageGroup: string) => {
    setUserInput((prev) => ({ ...prev, ageGroup }));
    setError("");
  };

  const handleConsentChange = (checked: boolean) => {
    setUserInput((prev) => ({ ...prev, hasConsented: checked }));
    setError("");
  };

  // 🟢 사용자 인증 함수 (기존과 동일)
  const handleVerifyUser = async () => {
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
        await handleCompleteExistingUser(result.user);
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("인증에 실패했습니다. 다시 시도해주세요.");
      }
    }
  };

  // 신규 사용자: 동의 완료 시점에 처음 Firebase Auth 로그인
  const handleCompleteRegistration = async () => {
    // 동의 완료 → Firebase Token 생성 → Firebase Auth 로그인
    if (!userInput.gender || !userInput.ageGroup || !userInput.hasConsented) {
      setError("모든 항목을 선택하고 동의해주세요.");
      return;
    }

    try {
      console.group("사용자 등록 프로세스 시작");

      const pendingAuth = localStorage.getItem("pendingAuth");
      if (!pendingAuth) {
        setError("인증 정보가 없습니다. 다시 인증해주세요.");
        return;
      }

      const authData = JSON.parse(pendingAuth);
      const userId = generateSecureUserId();
      const userHash = generateUserHash(
        authData.name,
        userInput.socialNumber || authData.name
      );

      console.log("1. 생성된 정보:", { userId, userHash });

      // 🔧 쿠키 및 Firebase Token 생성
      const authResponse = await fetch("/api/auth/completeAuth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: userId,
          userHash: userHash,
          userName: authData.name, // 🆕 userName 추가
        }),
      });

      if (!authResponse.ok) {
        throw new Error("인증 실패");
      }

      const authResult = await authResponse.json();
      console.log("2. 쿠키 및 Firebase Token 생성 완료");

      // 🆕 Firebase Auth 로그인 (선택사항)
      if (authResult.customToken && !firebaseUser) {
        try {
          await signInWithToken(authResult.customToken);
          console.log("🔥 Firebase Auth 로그인 완료");
        } catch (error) {
          console.error("Firebase Auth 로그인 실패:", error);
          // 실패해도 계속 진행
        }
      }

      // 기존 사용자 등록 로직
      const registeredUser = await registerUserMutation.mutateAsync({
        userId,
        gender: userInput.gender,
        ageGroup: userInput.ageGroup,
        hasConsented: userInput.hasConsented,
        userName: authData.name || "noName",
        authorizedUserId: userHash,
      });

      console.log("3. 사용자 등록 완료:", registeredUser);

      queryClient.invalidateQueries({ queryKey: ["authStatus"] });
      queryClient.invalidateQueries({ queryKey: ["userCompletionStatus"] });

      localStorage.removeItem("pendingAuth");
      console.groupEnd();
      console.log("✅ 모든 등록 완료");

      setIsRedirecting(true);
      router.push("/main");
    } catch (error) {
      console.error("등록 처리 중 오류:", error);
      setError(
        error instanceof Error ? error.message : "등록 중 오류가 발생했습니다."
      );
    }
  };
  // 제출 가능 여부 확인 함수 (기존과 동일)
  const isSubmitEnabled = (): boolean => {
    return (
      !!userInput.gender &&
      !!userInput.ageGroup &&
      userInput.hasConsented &&
      !registerUserMutation.isPending &&
      !assignScriptsMutation.isPending
    );
  };

  // 버튼 텍스트 생성 함수 (기존과 동일)
  const getButtonText = (): React.ReactNode => {
    if (isLoading) {
      if (registerUserMutation.isPending) return "처리 중...";
      if (updateScriptsMutation.isPending) return "스크립트 할당 중...";
      return "처리 중...";
    }

    if (!userInput.hasConsented) {
      return "동의 체크가 빠졌어요!";
    }

    if (!userInput.gender) {
      return "성별 선택이 빠졌어요!";
    }

    if (!userInput.ageGroup) {
      return "연령대 선택이 빠졌어요!";
    }

    return (
      <>
        시작하려면 여기를 눌러주세요
        <br />
        <span>동의하고 시작하기</span>
      </>
    );
  };

  // 로딩 상태 통합
  const isLoading =
    verifyUserMutation.isPending ||
    registerUserMutation.isPending ||
    assignScriptsMutation.isPending;

  // 에러 메시지 통합
  const displayError =
    error ||
    verifyUserMutation.error?.message ||
    registerUserMutation.error?.message ||
    updateScriptsMutation.error?.message;

  // 🔧 인증 단계 판별 로직 개선
  const pendingAuth = localStorage.getItem("pendingAuth");
  const isInAuthProcess = !!pendingAuth;
  const isNewUser = pendingAuth && !JSON.parse(pendingAuth).isExistingUser;

  // 🟢 인증되지 않은 사용자를 위한 인증 폼
  if (!isInAuthProcess && !isAuthenticated) {
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
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="이름을 입력하세요"
                className={styles.textInput}
                disabled={isLoading}
                autoComplete="name"
                autoCapitalize="words"
              />
            </div>

            <div className={styles.inputGroup}>
              <h3>주민등록번호 앞자리</h3>
              <input
                type="text"
                value={userInput.socialNumber}
                onChange={(e) => handleSocialNumberChange(e.target.value)}
                placeholder="주민등록번호 앞자리를 입력하세요(123456)"
                className={styles.textInput}
                disabled={isLoading}
                autoComplete="off"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
              />
            </div>

            <div className={styles.submitSection}>
              <button
                type="button"
                className={`${styles.submitButton} ${
                  userInput.name && userInput.socialNumber
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
                {!userInput.name ||
                userInput.socialNumber.length !== 6 ||
                isLoading
                  ? "이름과 주민번호를 먼저 입력해주세요"
                  : verifyUserMutation.isPending
                  ? "인증 확인 중..."
                  : "여기를 눌러주세요!"}
              </button>
            </div>
          </div>

          {displayError && (
            <div className={styles.errorMessage}>❌ {displayError}</div>
          )}

          {process.env.NODE_ENV === "development" && (
            <div className={styles.debugInfo}>
              <h4>🐛 개발 정보</h4>
              <p>하이브리드 인증이 적용되었습니다.</p>
              <p>승인된 이름과 주민번호를 입력하세요.</p>
              <p>인증상태: {isAuthenticated ? "인증됨" : "미인증"}</p>
              <p>Firebase 사용자: {firebaseUser?.uid || "없음"}</p>
              <p>완료상태: {userCompletionStatus ? "완료" : "미완료"}</p>
            </div>
          )}
        </div>
      </>
    );
  }

  // 🔧 신규 사용자만 동의 폼 표시
  if (isNewUser) {
    const authData = JSON.parse(pendingAuth);

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
            {authData.name && <p>안녕하세요, {authData.name}님!</p>}
          </div>

          {/* 동의서 내용 */}
          <div className={styles.consentSection}>
            <h2>이용약관 및 개인정보처리방침</h2>
            <div className={styles.consentBox}>
              <div className={styles.consentContent}>
                {consentText.split("\n").map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
              <div className={styles.scrollHint}>
                위아래로 스크롤하여 내용을 확인해주세요
              </div>
            </div>

            <div className={styles.consentCheckbox}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={userInput.hasConsented}
                  onChange={(e) => handleConsentChange(e.target.checked)}
                  className={styles.checkboxInput}
                  disabled={isLoading}
                />
                <span className={styles.checkboxText}>
                  위 내용을 모두 읽었으며 동의합니다
                </span>
              </label>
            </div>
          </div>

          {/* 사용자 정보 입력 */}
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
                    onClick={() => handleGenderSelect(gender)}
                    disabled={isLoading}
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
                    onClick={() => handleAgeGroupSelect(age)}
                    disabled={isLoading}
                  >
                    {age}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 디버깅 정보 */}
          {process.env.NODE_ENV === "development" && (
            <div className={styles.debugInfo}>
              <h4>🐛 디버그 정보</h4>
              <p>인증 상태: {isAuthenticated ? "인증됨" : "미인증"}</p>
              <p>사용자 ID: {authData?.userId}</p>
              <p>완료 상태: {userCompletionStatus ? "완료" : "미완료"}</p>
              <p>신규 사용자: {isNewUser ? "예" : "아니오"}</p>
              <p>입력 정보: {JSON.stringify(userInput)}</p>
            </div>
          )}

          {/* 오류 메시지 */}
          {displayError && (
            <div className={styles.errorMessage}>❌ {displayError}</div>
          )}

          {/* 제출 버튼 */}
          <div className={styles.submitSection}>
            <button
              type="button"
              className={`${styles.submitButton} ${
                isSubmitEnabled() ? styles.enabled : styles.disabled
              }`}
              onClick={handleCompleteRegistration}
              disabled={!isSubmitEnabled() || isLoading}
            >
              {getButtonText()}
            </button>
          </div>
        </div>
      </>
    );
  }

  // 🔧 기타 모든 경우 (이미 처리된 사용자 등) - 로딩 화면
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
      props: {
        consentText,
        serviceDescription,
      },
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
