// pages/script/[type].tsx - 메인 스크립트 페이지
import React from "react";
import { useRouter } from "next/router";
import { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";

import { ScriptContainer } from "@/components/script/ScriptContainer";
import { ScriptType } from "@/types/firebase";

interface ScriptPageProps {
  scriptType: ScriptType;
}

export default function ScriptPage({ scriptType }: ScriptPageProps) {
  const router = useRouter();

  if (router.isFallback) {
    return <div>로딩 중...</div>;
  }

  const getPageTitle = (type: ScriptType): string => {
    switch (type) {
      case ScriptType.SITUATIONAL:
        return "상황별 녹음";
      case ScriptType.FORMAL:
        return "정형 녹음";
      case ScriptType.QA_SCENARIO:
        return "질의응답 녹음";

      // case ScriptType.TUTORIAL:
      //   return "녹음 연습하기";
      default:
        return "스크립트 녹음";
    }
  };

  return (
    <>
      <Head>
        <title>{getPageTitle(scriptType)}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, user-scalable=yes"
        />
      </Head>
      <ScriptContainer scriptType={scriptType} />
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  // 지원하는 스크립트 타입들
  const scriptTypes = [
    ScriptType.SITUATIONAL,
    ScriptType.FORMAL,
    ScriptType.QA_SCENARIO,
  ];

  const paths = scriptTypes.map((type) => ({
    params: { type: type.toLowerCase() },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const typeParam = params?.type as string;

  // 타입 매핑
  const typeMap: Record<string, ScriptType> = {
    situational: ScriptType.SITUATIONAL,
    formal: ScriptType.FORMAL,
    qa_scenario: ScriptType.QA_SCENARIO,
  };

  const scriptType = typeMap[typeParam];

  if (!scriptType) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      scriptType,
    },
  };
};
