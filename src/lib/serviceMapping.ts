// serviceMapping.ts

export const SERVICE_NAME_TO_SLUG = {
  건강: "health",
  교통: "traffic",
  은행: "finance",
  메시지: "message",
  생활: "life",
  영상: "video",
  의료: "medical",
  이동정보: "navigation",
} as const;

export const SLUG_TO_SERVICE_NAME: Record<ServiceSlug, ServiceName> =
  Object.entries(SERVICE_NAME_TO_SLUG).reduce((acc, [kor, eng]) => {
    acc[eng as ServiceSlug] = kor as ServiceName;
    return acc;
  }, {} as Record<ServiceSlug, ServiceName>);

export type ServiceName = keyof typeof SERVICE_NAME_TO_SLUG; // "건강" | "교통" | ...
export type ServiceSlug = (typeof SERVICE_NAME_TO_SLUG)[ServiceName]; // "health" | "traffic" | ...

// 서비스별 아이콘과 색상 정의
export const SERVICE_CONFIG = {
  건강: {
    icon: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 1.01 4.5 2.09C13.09 4.01 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
    iconColor: "cardGreen",
    description: "건강 관련 음성 명령",
  },
  교통: {
    icon: "M18.92,6.01C18.72,5.42 18.16,5 17.5,5H15V4A2,2 0 0,0 13,2H11A2,2 0 0,0 9,4V5H6.5C5.84,5 5.28,5.42 5.08,6.01L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6.01M6.5,6.5H17.5L19,11H5L6.5,6.5M7.5,16A1.5,1.5 0 0,1 6,14.5A1.5,1.5 0 0,1 7.5,13A1.5,1.5 0 0,1 9,14.5A1.5,1.5 0 0,1 7.5,16M16.5,16A1.5,1.5 0 0,1 15,14.5A1.5,1.5 0 0,1 16.5,13A1.5,1.5 0 0,1 18,14.5A1.5,1.5 0 0,1 16.5,16Z",
    iconColor: "cardBlue",
    description: "교통수단 이용 관련",
  },
  은행: {
    icon: "M20,8H4V6H20M20,18H4V12H20M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.11,4 20,4Z",
    iconColor: "cardYellow",
    description: "은행 업무 관련",
  },
  메시지: {
    icon: "M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M6,9V7H18V9H6M14,13V11H18V13H14M6,13V11H12V13H6Z",
    iconColor: "cardPurple",
    description: "메시지 보내기 및 영상 통화 관련",
  },
  생활: {
    icon: "M12,3L20,9V21H15V14H9V21H4V9L12,3M12,7.5A1.5,1.5 0 0,0 10.5,9A1.5,1.5 0 0,0 12,10.5A1.5,1.5 0 0,0 13.5,9A1.5,1.5 0 0,0 12,7.5Z",
    iconColor: "cardOrange",
    description: "생활 편의 서비스",
  },
  영상: {
    icon: "M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z",
    iconColor: "cardRed",
    description: "영상 콘텐츠 관련",
  },
  의료: {
    icon: "M12 2C12.6 2 13 2.4 13 3V7H17C17.6 7 18 7.4 18 8V10C18 10.6 17.6 11 17 11H13V15C13 15.6 12.6 16 12 16H10C9.4 16 9 15.6 9 15V11H5C4.4 11 4 10.6 4 10V8C4 7.4 4.4 7 5 7H9V3C9 2.4 9.4 2 10 2H12Z",
    iconColor: "cardTeal",
    description: "의료 서비스 관련",
  },
  이동정보: {
    icon: "M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z",
    iconColor: "cardIndigo",
    description: "길찾기 및 이동정보",
  },
};
// serviceMapping.ts

export const toSlug = (korName: ServiceName): ServiceSlug =>
  SERVICE_NAME_TO_SLUG[korName];

export const fromSlug = (slug: ServiceSlug): ServiceName =>
  SLUG_TO_SERVICE_NAME[slug];

// 서비스 순서 정의
const SERVICE_ORDER = Object.keys(SERVICE_CONFIG) as ServiceName[];
export const getNextServiceSlug = (
  currentServiceName: ServiceName
): string | null => {
  const currentIndex = SERVICE_ORDER.indexOf(currentServiceName);
  if (currentIndex === -1 || currentIndex >= SERVICE_ORDER.length - 1)
    return null;
  const nextServiceName = SERVICE_ORDER[currentIndex + 1];
  return toSlug(nextServiceName); // 예: "health", "traffic", ...
};
