// pages/script/[type].tsx - 메인 스크립트 페이지
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import { fromSlug } from "@/lib/serviceMapping"; // 한글 ↔ 슬러그 변환
import { ScriptContainer } from "@/components/script/ScriptContainer";
import {
  useCurrentSetNumber,
  useCurrentSetId,
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
  const currentSetNumber = useCurrentSetNumber();
  const currentSetId = useCurrentSetId();

  // 선택사항: 상황발화 + 정형발화 모두 조회하고 싶다면
  const {
    data: allScripts,
    isLoading,
    isError,
  } = useAllScriptsByServiceQuery(serviceName, currentSetNumber, currentSetId);

  if (router.isFallback) {
    return <div>로딩 중...</div>;
  }

  // console.log("assl", allScripts);

  if (isLoading) return <div>로딩 중...</div>;
  if (isError) return <div>에러 발생</div>;
  if (!allScripts)
    return (
      <>
        <div>해당 스크립트 없음</div>
        <ReAssignScript />
      </>
    );

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
