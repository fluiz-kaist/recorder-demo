// pages/script/[type].tsx - 메인 스크립트 페이지
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import { fromSlug } from "@/lib/serviceMapping"; // 한글 ↔ 슬러그 변환
import { ScriptContainer } from "@/components/script/ScriptContainer";
import { ScriptDataManager } from "@/utils/scriptDataManager";
import {
  useUserQuery,
  useCurrentRoundQuery,
  useAuthStatusQuery,
} from "@/hooks/queries/useUserQueries";

import { SERVICE_NAME_TO_SLUG, ServiceName } from "@/lib/serviceMapping";
import {
  useAllScriptsByServiceQuery, // 선택사항: 상황발화 + 정형발화 모두
} from "@/hooks/queries/useScriptQueries";
import { ScriptType, SituationalScript, FormalScript } from "@/types/firebase";
import ReAssignScript from "@/components/ReassignScriptBtn";
interface ScriptPageProps {
  serviceName: ServiceName;
}

export interface MergedScript {
  scriptType: ScriptType.SITUATIONAL | ScriptType.FORMAL;
  situation: SituationalScript;
  formal: FormalScript[];
}

const mergeScriptsByTaskKey = (
  situational: SituationalScript[],
  formal: FormalScript[]
): MergedScript[] => {
  console.log("여기서 받은 foraml ", formal);
  console.log("여기서 받은 situ", situational);
  const formalMap = formal.reduce<Record<string, FormalScript[]>>(
    (acc, item) => {
      if (!acc[item.task_key]) acc[item.task_key] = [];
      acc[item.task_key].push(item);
      return acc;
    },
    {}
  );

  return situational.map((situ) => ({
    scriptType: ScriptType.SITUATIONAL,
    situation: situ,
    formal: formalMap[situ.task_key] || [],
  }));
};

export default function ScriptPage({ serviceName }: ScriptPageProps) {
  const router = useRouter();
  const { data: authStatus } = useAuthStatusQuery();
  const { data: fullUser, isLoading: isUserLoading } = useUserQuery(
    authStatus?.userId
  );
  const currentRoundNumber = fullUser?.currentStatus?.currentRoundNumber || 0;
  const { data: currentRound, isLoading: isRoundLoading } =
    useCurrentRoundQuery(authStatus?.userId, currentRoundNumber);

  const currentSetId = currentRound?.formalSetId || 1;

  // 선택사항: 상황발화 + 정형발화 모두 조회하고 싶다면
  const {
    data: allScripts,
    isLoading,
    isError,
  } = useAllScriptsByServiceQuery(
    serviceName,
    currentRoundNumber, // setNumber (라운드 번호)
    currentRoundNumber // setId (상황발화 세트 ID, 라운드번호와 동일)
  );

  if (router.isFallback) {
    return <div>로딩 중...</div>;
  }

  // isLoading은 스크립트 쿼리 로딩
  if (isUserLoading || isRoundLoading || isLoading) {
    return <div>데이터 로딩 중...</div>;
  }

  if (isError) return <div>에러 발생</div>;

  const handleServiceNamePatch = () => {
    const patchResult = ScriptDataManager.patchServiceNameFromFinanceToBank();
    if (patchResult) {
      alert("패치가 완료되었습니다. 페이지를 새로고침합니다.");
      window.location.reload();
    } else {
      alert("패치할 데이터가 없거나 이미 패치되었습니다.");
    }
  };

  // allScripts가 없거나 빈 경우 (localStorage에 데이터가 없거나 일치하지 않는 경우)
  if (
    !allScripts ||
    (allScripts.situational.length === 0 && allScripts.formal.length === 0)
  ) {
    return (
      <>
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            fontSize: "18px",
            lineHeight: "1.6",
          }}
        >
          이 화면이 보이신다면 아래 대본 다시 받기 버튼을 눌러주세요. <br />
          버튼을 누른 이후에도 화면이 동일하다면 새로고침 버튼을 눌러주세요.
          {/* 은행 서비스일 때만 패치 안내 및 버튼 표시 */}
          {serviceName === "은행" && (
            <div
              style={{
                marginTop: "20px",
                padding: "15px",
                backgroundColor: "#fff3cd",
                border: "1px solid #ffeaa7",
                borderRadius: "8px",
              }}
            >
              <p
                style={{
                  fontSize: "16px",
                  color: "#856404",
                  margin: "0 0 10px 0",
                }}
              >
                💡 [은행] 항목을 진행하러 들어오셨나요?
                <br />
                아래 버튼을 눌러주세요.
              </p>
              <button
                onClick={handleServiceNamePatch}
                style={{
                  width: "200px",
                  height: "50px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  backgroundColor: "#ff9f43",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                  touchAction: "manipulation",
                }}
              >
                [은행] 정상 진행하기
              </button>
            </div>
          )}
          <div style={{ marginTop: "30px" }}>
            <ReAssignScript />
            <div style={{ marginTop: "20px" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  width: "200px",
                  height: "60px",
                  fontSize: "20px",
                  fontWeight: "bold",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                  touchAction: "manipulation",
                }}
              >
                🔄 새로고침
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!currentRound) {
    console.log("여긴가?", currentRound);
    return (
      <>
        <div>
          현재 진행 중인 작업이 없습니다(이 문구는 로그아웃 중에 잠시 보일 수
          있습니다. 그 경우 잠시 기다려주세요.)
        </div>
        <ReAssignScript />
      </>
    );
  }

  console.log("allScripts?", allScripts);

  const mergedScripts = mergeScriptsByTaskKey(
    allScripts.situational,
    allScripts.formal
  );

  return (
    <div>
      <Head>
        <title>{serviceName} 스크립트 녹음</title>
      </Head>
      <ScriptContainer scripts={mergedScripts} />
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const serviceSlugs = Object.values(SERVICE_NAME_TO_SLUG); // ✅ 슬러그 자동 추출

  const paths = serviceSlugs.map((slug) => ({
    params: { serviceName: slug },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const slug = context.params?.serviceName;

  if (typeof slug !== "string") {
    return { notFound: true };
  }

  const korName = fromSlug(slug as any); // 슬러그를 한글로 변환

  return {
    props: {
      serviceName: korName,
    },
  };
};
