This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.

# Info

## useUser Hook

사용자 등록 및 관리를 담당하는 React 커스텀 훅.

### 주요 기능

- 사용자 기본 정보 수집 및 관리 (성별, 연령대)
- 개인정보 처리 동의 관리
- 로컬/세션 스토리지를 통한 상태 지속성
- API 연동을 통한 서버 동기화
- 한국 시간 기준 타임스탬프 관리

### 데이터 구조

```typescript
interface User {
  id: string; // UUID 기반 고유 사용자 ID
  gender: "남성" | "여성"; // 성별
  ageGroup: string; // 연령대
  hasConsented: boolean; // 개인정보 처리 동의 여부
  createdAt: string; // 계정 생성 시간 (ISO 형식)
  lastAccessAt: string; // 마지막 접근 시간
  scriptAssignments: []; // 할당된 스크립트 정보
  completedAt?: string; // 등록 완료 시간 (선택적)
}
```

### 사용법

```typescript
const {
  // 상태
  userInfo,
  isSubmitting,
  error,
  isExistingUser,

  // 액션
  handleGenderSelect,
  handleAgeGroupSelect,
  handleConsentChange,
  registerUser,
  updateUserInfo,
  clearUserData,

  // 유틸리티
  isSubmitEnabled,
  getKoreanTime,
} = useUser();
```

### API 엔드포인트

- `POST /api/users/{userId}` - 사용자 등록
- `GET /api/users/{userId}` - 사용자 정보 조회
- `PATCH /api/users/{userId}` - 사용자 정보 업데이트

### 특징

- **자동 ID 생성**: 새로운 사용자 방문 시 UUID 기반 ID 자동 생성
- **상태 지속성**: localStorage와 sessionStorage를 활용한 데이터 보존
- **한국 시간 지원**: UTC+9 시간대 기준 타임스탬프 생성
- **에러 핸들링**: 네트워크 오류 및 데이터 파싱 오류 처리
- **완료 상태 관리**: 등록 완료된 사용자 구분 및 관리
