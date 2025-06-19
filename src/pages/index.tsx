// pages/index.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { GetStaticProps } from "next";
import fs from "fs";
import path from "path";
import styles from "@/styles/ConsentPage.module.css";
import { v4 as uuidv4 } from "uuid";

const ageGroups = [
  "60-64세",
  "65-69세",
  "70-74세",
  "75-79세",
  "80-84세",
  "85세 이상",
] as const;
const genders = ["남성", "여성"] as const;

interface UserInfo {
  id: string;
  gender: "남성" | "여성" | "";
  ageGroup: (typeof ageGroups)[number] | "";
  hasConsented: boolean;
  createdAt: string;
}

interface ConsentPageProps {
  consentText: string;
  serviceDescription: string;
}

export default function ConsentPage({
  consentText,
  serviceDescription,
}: ConsentPageProps) {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo>({
    id: "",
    gender: "",
    ageGroup: "",
    hasConsented: false,
    createdAt: "",
  });

  useEffect(() => {
    const generateNewUserId = () => {
      const newId = uuidv4();
      const createdAt = getKoreanTime();

      setUserInfo((prev) => ({
        ...prev,
        id: newId,
        createdAt: createdAt,
      }));
    };
    const existingUserInfo = localStorage.getItem("userInfo");

    if (existingUserInfo) {
      try {
        const parsedInfo = JSON.parse(existingUserInfo);

        // completedAt이 있으면 이미 완료된 사용자
        if (parsedInfo.completedAt) {
          // 바로 메인 페이지로 리다이렉트
          router.push("/main");
          return;
        }

        // completedAt이 없으면 미완료 사용자, 기존 정보 복원
        setUserInfo(parsedInfo);
      } catch (error) {
        console.error("기존 사용자 정보 파싱 오류:", error);
        // 파싱 오류 시 새로운 ID 생성
        generateNewUserId();
      }
    } else {
      // 새로운 사용자 ID 생성
      generateNewUserId();
    }
  }, []);
  const getKoreanTime = () => {
    const now = new Date();
    const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC+9
    return koreanTime.toISOString().replace("T", " ").slice(0, 19) + " KST";
  };

  const handleGenderSelect = (gender: "남성" | "여성") => {
    setUserInfo((prev) => ({ ...prev, gender }));
  };

  const handleAgeGroupSelect = (ageGroup: (typeof ageGroups)[number]) => {
    setUserInfo((prev) => ({ ...prev, ageGroup }));
  };
  const handleConsentChange = (checked: boolean) => {
    setUserInfo((prev) => ({ ...prev, hasConsented: checked }));
  };

  const handleSubmit = () => {
    if (!userInfo.gender || !userInfo.ageGroup || !userInfo.hasConsented) {
      alert("모든 항목을 선택하고 동의해주세요.");
      return;
    }

    // 완료된 시간 추가
    const completedUserInfo = {
      ...userInfo,
      completedAt: getKoreanTime(),
    };

    // 사용자 정보를 localStorage에 저장 (sessionStorage 대신)
    localStorage.setItem("userInfo", JSON.stringify(completedUserInfo));

    // sessionStorage에도 저장 (기존 로직 유지)
    sessionStorage.setItem("userInfo", JSON.stringify(completedUserInfo));
    // 다음 페이지로 이동
    router.push("/main");
  };

  const isSubmitEnabled =
    userInfo.gender && userInfo.ageGroup && userInfo.hasConsented;

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
        </div>

        {/* 서비스 설명 */}
        <div className={styles.serviceSection}>
          <h2>서비스 소개</h2>
          <div className={styles.serviceDescription}>
            {serviceDescription.split("\n").map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
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
                checked={userInfo.hasConsented}
                onChange={(e) => handleConsentChange(e.target.checked)}
                className={styles.checkboxInput}
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
                    userInfo.gender === gender ? styles.selected : ""
                  }`}
                  onClick={() => handleGenderSelect(gender)}
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
                    userInfo.ageGroup === age ? styles.selected : ""
                  }`}
                  onClick={() => handleAgeGroupSelect(age)}
                >
                  {age}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className={styles.submitSection}>
          <button
            type="button"
            className={`${styles.submitButton} ${
              isSubmitEnabled ? styles.enabled : styles.disabled
            }`}
            onClick={handleSubmit}
            disabled={!isSubmitEnabled}
          >
            동의하고 시작하기
          </button>
        </div>
      </div>
    </>
  );
}

// getStaticProps를 사용하여 빌드 시점에 파일들을 읽어옴
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
