// pages/index.tsx - 쿠키 기반 인증으로 수정
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { GetStaticProps } from "next";
import { useQueryClient } from "@tanstack/react-query";
import fs from "fs";
import path from "path";
import styles from "@/styles/ConsentPage.module.css";
import {
  useAuthStatusQuery,
  // useUserQuery,
  useIsAuthenticated,
  useLocalUserQuery,
} from "@/hooks/queries/useUserQueries";
import {
  useRegisterUserMutation,
  useUpdateScriptAssignmentsMutation,
} from "@/hooks/mutations/useUserMutations";

import { useHybridAuthMutation } from "@/hooks/mutations/useHybridAuth";
import { useAssignScriptsMutation } from "@/hooks/mutations/useScriptMutations";
import {
  generateUserHash,
  generateSecureUserId,
  maskPersonalInfo,
} from "@/utils/hash";
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

export default function ConsentPage({
  consentText,
}: // serviceDescription,
ConsentPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient(); // 상단에 추가

  // 🟢 쿠키 기반 인증 상태 확인
  const { data: authStatus, isLoading: authLoading } = useAuthStatusQuery();
  // const { data: user, isLoading: userLoading } = useUserQuery();
  const { data: localUser } = useLocalUserQuery();
  const isAuthenticated = useIsAuthenticated();

  // 뮤테이션 훅들
  const verifyUserMutation = useHybridAuthMutation();
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
  const userName = localUser?.name || "";
  // 🟢 기존 사용자 처리 함수 추가
  const handleCompleteExistingUser = async (authData: any) => {
    try {
      setIsRedirecting(true);

      // console.log("authData.userId?", authData.userId);
      // console.log("authdat?", authData);

      // 바로 쿠키 생성 (동의는 이미 완료됨)
      await fetch("/api/auth/completeAuth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: authData.userId,
          userHash: authData.userHash, // 🟢 localStorage에서 받은 해시 사용
        }),
      });

      console.log("🍪 기존 사용자 쿠키 생성 완료");

      // React Query 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["authStatus"] });

      localStorage.removeItem("pendingAuth");
      router.push("/main");
    } catch (error) {
      console.error("기존 사용자 로그인 실패:", error);
      localStorage.removeItem("pendingAuth");
      setError("로그인에 실패했습니다. 다시 시도해주세요.");
      setIsRedirecting(false);
    }
  };
  // 🟢 세션 스토리지 기반 인증 상태 확인으로 변경
  useEffect(() => {
    const pendingAuth = localStorage.getItem("pendingAuth");
    // console.log("pendingAuth?", pendingAuth);
    if (pendingAuth) {
      try {
        const authData = JSON.parse(pendingAuth);
        // console.log("authData?", authData);
        if (authData.isExistingUser) {
          console.log("기존 사용자 감지, 쿠키 생성 후 메인으로 이동");
          handleCompleteExistingUser(authData); // 🟢 함수 호출로 변경
        }
      } catch (error) {
        console.error("세션 데이터 파싱 오류:", error);
      }
    }
  }, [router]);

  // 🟢 인증 상태 확인 중이거나 리다이렉트 중일 때는 로딩 표시
  if (authLoading || isRedirecting || verifyUserMutation.isPending) {
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
                ? "인증 처리 중입니다..."
                : "인증 상태를 확인하고 있습니다..."}
            </p>
          </div>
        </div>
      </>
    );
  }

  // 입력 핸들러들
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

  // 🟢 사용자 인증 함수 (쿠키 자동 설정됨)
  const handleVerifyUser = async () => {
    if (!userInput.name || !userInput.socialNumber) {
      setError("이름과 주민번호를 입력해주세요.");
      return;
    }

    try {
      await verifyUserMutation.mutateAsync({
        name: userInput.name,
        socialNumber: userInput.socialNumber,
      });
      // 성공 시 쿠키가 자동으로 설정되고 페이지가 새로고침됨
      // 기존 catch 블록 전체를 이렇게 교체
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("인증에 실패했습니다. 다시 시도해주세요.");
      }
    }
  };

  // 🟢 사용자 등록 및 스크립트 할당 통합 함수
  const handleCompleteRegistration = async () => {
    if (!userInput.gender || !userInput.ageGroup || !userInput.hasConsented) {
      setError("모든 항목을 선택하고 동의해주세요.");
      return;
    }

    try {
      console.log("사용자 등록/로그인 시작");

      // 🆕 세션에서 인증 데이터 가져오기
      const pendingAuth = localStorage.getItem("pendingAuth");
      if (!pendingAuth) {
        setError("인증 정보가 없습니다. 다시 인증해주세요.");
        return;
      }

      const authData = JSON.parse(pendingAuth);
      const userId = generateSecureUserId();

      // 🆕 authorizedUsersV2에 userId 저장
      const userHash = generateUserHash(
        authData.name,
        userInput.socialNumber || authData.name
      );

      console.log("인덱스에서 생성하는 userHash", userHash);
      console.log("여기서 userId?", userId);

      await fetch("/api/auth/completeAuth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: userId,
          userHash: userHash, // 해시도 함께 전달
        }),
      });

      console.log("🍪 쿠키 생성 완료");

      // 🟢 React Query 캐시 무효화 추가

      queryClient.invalidateQueries({ queryKey: ["authStatus"] });

      // 사용자 등록
      const registeredUser = await registerUserMutation.mutateAsync({
        userId,
        gender: userInput.gender,
        ageGroup: userInput.ageGroup,
        hasConsented: userInput.hasConsented,         
        userName: authData.name || "noName",
        authorizedUserId: userHash,
      });

      // 스크립트 할당
      await assignScriptsMutation.mutateAsync({ userId });

      // 세션 정리
      localStorage.removeItem("pendingAuth");

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

  // 제출 가능 여부 확인 함수 수정
  const isSubmitEnabled = (): boolean => {
    return (
      !!userInput.gender &&
      !!userInput.ageGroup &&
      userInput.hasConsented &&
      !registerUserMutation.isPending &&
      !assignScriptsMutation.isPending
    );
  };

  // 버튼 텍스트 생성 함수 추가
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

  // 🟢 인증되지 않은 사용자를 위한 인증 폼
  const pendingAuth = localStorage.getItem("pendingAuth");
  if (!pendingAuth) {
    // 세션에 인증 데이터가 없으면 인증 폼 표시
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
          {/* <div className={styles.header}>
            <h1>서비스 이용 동의</h1>
          </div> */}

          {/* 서비스 설명 */}
          {/* <div className={styles.serviceSection}>
            <h2>서비스 소개</h2>
            <div className={styles.serviceDescription}>
              {serviceDescription.split("\n").map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div> */}

          {/* 인증 정보 입력 */}
          <div className={styles.infoSection}>
            <h2>신청자 확인</h2>
            <p>신청자 확인을 위해 이름과 주민번호 앞자리를 입력해주세요.</p>
            {/* 이름 입력 필드 */}
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

            {/* 주민번호 입력 필드 */}
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

          {/* 에러 메시지 */}
          {displayError && (
            <div className={styles.errorMessage}>❌ {displayError}</div>
          )}

          {/* 개발용 정보 */}
          {process.env.NODE_ENV === "development" && (
            <div className={styles.debugInfo}>
              <h4>🐛 개발 정보</h4>
              <p>하이브리드 인증이 적용되었습니다. (해시 기반 → 기존 방식)</p>
              <p>승인된 이름과 주민번호를 입력하세요.</p>
            </div>
          )}
        </div>
      </>
    );
  }

  const aaa = localStorage.getItem("pendingAuth");
  const authData = aaa ? JSON.parse(aaa) : null;

  // 🟢 기존 사용자면 로딩 화면만 표시
  if (authData?.isExistingUser) {
    return (
      <>
        <Head>
          <title>서비스 이용 동의</title>
        </Head>
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>로그인 처리 중입니다...</p>
          </div>
        </div>
      </>
    );
  }

  // 🟢 인증된 사용자를 위한 동의 및 정보 입력 폼
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
          {userName && <p>안녕하세요, {userName}님!</p>}
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

          {/* 성별 선택 */}
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

          {/* 연령대 선택 */}
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
            <h4>🐛 디버그 정보 (쿠키 기반)</h4>
            <p>
              인증 상태: {authStatus?.isAuthenticated ? "인증됨" : "미인증"}
            </p>
            <p>사용자 ID: {authStatus?.userId}</p>
            <p>로컬 사용자: {localUser ? "있음" : "없음"}</p>
            <p>완료 상태: {localUser?.completedAt ? "완료" : "미완료"}</p>
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
