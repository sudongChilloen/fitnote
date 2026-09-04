# FitNote 개발 진행 현황

> 최종 갱신: 2026-09-04
> 기획 원본: `~/Downloads/FitNote_통합기획서_v3_참고화면반영/08_재구성_기획_v1.md`

---

## 1. 서비스 개요

PT 센터/헬스장 회원을 위한 **운동 기록 + PT 알림장 + 기구 기반 운동 추천** 서비스.

### 역할 구조

```
CENTER_ADMIN (헬스장 관리자)
   ├─ 헬스장 등록, 트레이너 초대
   ├─ PT 상품(가격/횟수) 등록·관리
   └─ (선택) 헬스장 보유 기구 프리셋 등록
        │
        ▼
TRAINER (N명)
   ├─ 배정된 회원 관리
   ├─ 알림장 작성 → 회원에게 FCM 알림
   └─ PT 완료 처리 → 잔여 횟수 자동 차감
        │
        ▼
MEMBER (회원)
   ├─ 운동/식단/신체 기록
   └─ 알림장 확인
```

`CenterMembership` 한 테이블에 role 을 통합하고, 자기참조
`assignedTrainerMembershipId` 로 회원 → 담당 트레이너를 배정한다.

### 핵심 설계 판단

| 결정 | 이유 |
|---|---|
| **기구 카탈로그는 플랫폼이 시드로 제공** | 덤벨·바벨·머신 등은 어느 헬스장이나 이름이 같다. 헬스장이 등록해줄 때까지 기다리면 콜드스타트에 걸린다 |
| **기본값 = 전체 운동 노출** | "내가 쓸 수 있는 기구 체크"를 가입 조건으로 두면 이탈한다. 헬스장 연결은 나중에 옵션으로 |
| **User 는 헬스장 없이도 존재 가능** | 헬스장 고객이 0명이어도 개인 사용자로 서비스가 돌아가야 한다 |
| **웹소켓 미도입, FCM 만 사용** | 알림장·PT 일정은 비동기 이벤트다. 실시간 양방향 통신이 필요한 기능이 없다 |
| **AI 는 `AiAnalysis` 범용 테이블로 자리만 확보** | LLM 비용 부담이 커서 MVP 에서 제외. 나중에 붙일 때 스키마 변경 불필요 |

---

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js **16.3.4** (Turbopack, App Router) |
| ORM | Prisma **7.10.0** + `@prisma/adapter-pg` (driver adapter) |
| DB | Supabase Postgres |
| 인증 | 직접 구현 (JWT `jose` + `bcryptjs`) |
| 검증 | zod 4 |
| 스타일 | Tailwind CSS 4 + shadcn (`base-nova`) |
| 패키지 매니저 | **npm** (pnpm 아님 — 3장 참고) |

### Next.js 16 주의사항

`AGENTS.md` 지침대로 `node_modules/next/dist/docs/` 를 확인한 내용:

- **`middleware.ts` → `proxy.ts` 로 개명됨.** 프로젝트 루트에 위치
- `cookies()` 가 async → `await cookies()`
- 동적 라우트/페이지는 전역 타입 헬퍼 사용: `PageProps<"/exercises/[id]">`,
  `RouteContext<"/api/exercises/[id]">` — `params` 는 Promise 이므로 `await` 필요
- 위 타입은 `next dev` / `next build` / `next typegen` 실행 시 생성됨

---

## 3. 배포 설정 (Vercel)

### 3-1. pnpm 락파일 문제 — 해결 완료

프로젝트를 pnpm 으로 시작했다가 npm 으로 옮겼는데 `pnpm-lock.yaml` 이 커밋에 남아
있었다. Vercel 은 pnpm 락파일을 먼저 감지해 `--frozen-lockfile` 로 설치를 시도하고,
락파일이 `package.json` 과 달라 실패했다.

```
ERR_PNPM_OUTDATED_LOCKFILE
Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date
```

**조치**

1. `pnpm-lock.yaml` 삭제 + git 추적 해제 (`package-lock.json` 만 유지)
2. `package.json` 에 패키지 매니저 고정 명시

```json
"packageManager": "npm@11.6.2"
```

> 락파일은 **하나만** 커밋해야 한다. 두 개가 있으면 로컬(npm)과 CI(pnpm)가
> 서로 다른 의존성 트리로 동작한다.

### 3-2. 환경변수 — 배포 전 반드시 설정

환경변수 없이 빌드하면 **page data 수집 단계에서 실패**한다.
`lib/prisma.ts`, `app/lib/jwt.ts` 가 모듈 로드 시점에 검사하기 때문이다.

```
Error: Failed to collect page data for /api/exercises
  [cause]: Error: DATABASE_URL is not defined
```

Vercel > Settings > Environment Variables 에 등록할 값:

| 변수 | 용도 | 비고 |
|---|---|---|
| `DATABASE_URL` | 앱 런타임 | Supabase **pgbouncer 6543** (transaction 모드) |
| `DIRECT_URL` | 마이그레이션 | Supabase **5432** (session 모드) |
| `SESSION_SECRET` | JWT 서명 | `openssl rand -base64 32` |

> **연결 이원화가 중요하다.** 서버리스는 커넥션이 폭증하므로 런타임은 pooler(6543)를
> 써야 하고, 마이그레이션은 advisory lock 때문에 direct(5432)를 써야 한다.
> `prisma.config.ts` 의 datasource 가 `DIRECT_URL` 을 보는 이유다.

### 3-3. 참고

- `generated/prisma` (2.9MB, 40개 파일)는 **커밋되어 있다.** 따라서 Vercel 에서
  `prisma generate` 를 따로 돌리지 않아도 빌드된다. 대신 스키마를 바꾸면
  `npx prisma generate` 후 **반드시 함께 커밋**해야 한다
- `npm audit` 에 high 4건이 뜨지만 Prisma CLI(devDependency)의 transitive
  dependency(`mysql2`, `deepmerge-ts`)라 런타임 번들에 포함되지 않는다.
  `audit fix --force` 하면 Prisma 6 으로 다운그레이드되므로 두었다

---

## 4. 완료된 작업

### 4-1. DB 스키마

- **32개 모델 / 22개 enum**
- 마이그레이션 2건 적용 완료
  - `20260903055341_init`
  - `20260903065446_add_equipment_exercise_unique`

주요 설계:

| 모델 | 포인트 |
|---|---|
| `CenterMembership` | role 통합 + 자기참조로 트레이너 배정. `@@unique([centerId, userId])` |
| `PTContract` | `productNameSnapshot` / `priceSnapshot` — 상품가가 바뀌어도 과거 계약 보호 |
| `TrainerPTPrice` | 트레이너별 단가를 상품과 분리 |
| `AiAnalysis` | PENDING/PROCESSING/COMPLETED/FAILED 범용 비동기 작업 테이블 |
| `ExerciseEquipment` | `isPrimary` 로 핵심 장비 구분 |
| `WorkoutAlternative` | `type` / `priority` / `reason` 을 가진 대체 운동 그래프 |

> `PTSession` 완료 시 `usedSessions` 차감은 스키마가 아니라
> **앱 트랜잭션 로직**으로 처리해야 한다. (아직 미구현)

### 4-2. 시드 데이터

`prisma/seed.ts` — 기구 20 / 운동 50 / 운동-기구 매핑 58 / 대체 운동 11

운동 정의의 `equipment: [핵심장비, 보조장비]` **배열 순서가 `isPrimary` 판정 기준**이다.

```ts
for (const [index, equipmentName] of exercise.equipment.entries()) {
  const isPrimary = index === 0;
```

검증: primary 50개(운동당 정확히 1개), 보조 8개, 이상 0건.

### 4-3. 인증

Next.js 공식 가이드의 **optimistic / secure 2단계 패턴**을 따랐다.

```
proxy.ts        쿠키의 JWT 서명만 확인 (낙관적, DB 접근 없음)
    ↓
app/lib/dal.ts  실제 DB 조회로 세션 유효성 검증 (실질적 방어선)
```

| 파일 | 역할 |
|---|---|
| `app/lib/jwt.ts` | JWT 서명/검증 **전용**. Prisma 의존 없음 |
| `app/lib/session.ts` | `createSession` / `deleteSession` |
| `app/lib/dal.ts` | `getOptionalSession` / `verifySession` / `getCurrentUser` / `requireUser` |
| `app/lib/definitions.ts` | zod 스키마 |
| `app/actions/auth.ts` | signup / login / logout Server Actions |
| `proxy.ts` | 라우트 보호 |

**jwt.ts 를 분리한 이유**: `proxy.ts` 가 `session.ts` 를 import 하면 Prisma 와
`server-only` 가 proxy 번들에 딸려 들어간다. `jwt.ts` 는 `jose` 만 의존한다.

보안 처리:

- 쿠키에는 원본 토큰이 아니라 `{ userId, sessionId }` JWT 를 담는다
- DB 에는 별도 랜덤 토큰의 **sha256 해시만** 저장 → 유출돼도 세션 복원 불가
- 로그인 실패 메시지를 통일해 **계정 존재 여부가 드러나지 않도록** 함
- 쿠키: `httpOnly`, `sameSite=lax`, 프로덕션에서 `secure`

### 4-4. 디자인 시스템

v2 프로토타입(v0 생성물)에서 **프론트만 선별 이식**했다.

| 가져온 것 | 내용 |
|---|---|
| `app/globals.css` | shadcn 전체 토큰(light / `.dark` / system dark 3중), sidebar·chart·radius 스케일 |
| `components.json` | `base-nova` 스타일, lucide 아이콘 |
| `lib/utils.ts` | `cn()` |
| `app/layout.tsx` | `lang="ko"`, metadata, `viewport.colorScheme` / `themeColor` |

**의도적으로 버린 것**

- `lib/mongodb.ts` + `/api/fitness` — MongoDB 기반이며, `type` 문자열로 컬렉션을
  바꾸는 단일 엔드포인트에 **인증이 없고** 요청 body 를 그대로 DB 에 spread 한다
  (mass assignment). 패턴 자체를 참고하면 안 된다
- `next.config.mjs` 의 `typescript.ignoreBuildErrors: true` — 타입 에러를 덮는다
- **아이콘 4종** — `icon.svg` 를 열어보니 FitNote 가 아니라 **v0.app 로고**였다.
  파비콘은 별도 제작 필요
- v2 의 `Role = 'member' | 'trainer'` 2역할 토글 — 확정 기획(3역할)과 맞지 않는다

한글 폰트 처리: Geist 에 한글 글리프가 없어 폴백을 명시했다.

```css
--font-sans: var(--font-geist-sans), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
```

### 4-5. 운동 API

| 엔드포인트 | 설명 |
|---|---|
| `GET /api/exercises` | 목록. `search` / `bodyPart` / `difficulty` / `movementType` / `equipmentId` / `page` / `limit` |
| `GET /api/exercises/[id]` | 상세. 없으면 404 |

`server/exercises/exercise.service.ts` 에서 **공통 `exerciseInclude` + `toExerciseDto()`**
를 쓴다. 목록과 상세가 각자 매퍼를 가지면 응답 형태가 어긋나기 쉽기 때문이다.

대체 운동에는 **해당 대체 운동의 장비도 함께** 내려준다. "기구가 없어요" 흐름에서
추가 API 호출 없이 지금 쓸 수 있는 운동인지 판단하기 위해서다.

### 4-6. 운동 화면

| 경로 | 파일 |
|---|---|
| `/exercises` | `app/(user)/exercises/page.tsx` (서버 컴포넌트) |
| | `exercise-filters.tsx` (클라이언트: 검색 + 필터 칩) |
| | `exercise-card.tsx` |
| `/exercises/[id]` | `app/(user)/exercises/[id]/page.tsx` |
| 공통 | `lib/exercise-labels.ts` — enum → 한글 라벨 |

설계 판단:

- **HTTP fetch 대신 서비스 직접 호출.** 서버 컴포넌트가 자기 서버의 `/api` 를
  fetch 하면 왕복이 한 번 더 생긴다. `/api` 는 향후 모바일/외부용으로 남긴다
- **필터 상태는 URL 에.** 공유·뒤로가기·새로고침이 그대로 동작하고,
  서버에서 필터링하니 50개를 전부 클라이언트로 내려보낼 필요가 없다
- **enum 은 `import type` 만.** 라벨 맵이 Prisma 런타임을 클라이언트 번들로
  끌고 오지 않도록 했다
- **잘못된 쿼리 방어.** `?bodyPart=INVALID` 가 Prisma 까지 내려가면 500 이 난다.
  `pickEnum()` 으로 걸러 무시한다

React 관련 수정: URL → 입력창 동기화를 `useEffect` + `setState` 로 했더니
cascading render 경고가 떴다. **렌더 중 state 조정** 패턴으로 변경했다.

```tsx
if (syncedSearch !== currentSearch) {
  setSyncedSearch(currentSearch);
  setSearch(currentSearch);
}
```

---

## 5. 검증 완료 항목

**인증**
- 미로그인 `/home`, `/exercises` → `/login` 307 리다이렉트
- 실제 DB E2E: 회원생성 → 비밀번호 정/오 검증 → JWT 왕복 → 위조 토큰 거부 →
  DAL 조회 → 로그아웃 무효화

**운동 목록/상세** (실제 로그인 세션으로 렌더 확인)
- 카드 20개 / 총 50개 / 필터 칩 23개(부위10 + 난이도3 + 동작10)
- 필터 `bodyPart=CHEST` → 7개, `BEGINNER + SQUAT` → 2개
- 한글 검색 "스쿼트" 6개 / "프레스" 10개 / 없는 검색어 → 빈 상태 UI
- 검색어가 입력창에 유지됨
- `?bodyPart=INVALID` → 무시하고 전체 노출(500 아님), `?page=abc` → 1페이지
- 상세: 기구·운동방법·호흡·주의사항·대체운동 섹션 렌더
- **대체운동 클릭 → 해당 운동 상세로 이동** (데드리프트 → 루마니안 데드리프트)
- 없는 id → 404

**빌드**
- `next build` / `tsc --noEmit` / `eslint` 통과
- `npm ci --dry-run` 통과 (락파일 일관성)

---

## 6. 다음 작업

### 우선순위 1 — 운동 기록 (P0)

```
WorkoutSession  운동 세션 시작/종료
      ↓
WorkoutRecord   세션 안의 개별 운동
      ↓
WorkoutSet      세트별 중량 × 횟수
```

구현 시 필요한 계산 로직:

- 볼륨 = 중량 × 횟수 × 세트
- 추정 1RM
- PR(개인 최고 기록) 판정

> **여기부터는 개인 데이터다.** `/api/*` 는 현재 `proxy.ts` matcher 에서
> 제외되어 있으므로, 라우트 핸들러 내부에서 **반드시 `verifySession()` 을
> 호출**해야 한다.

### 우선순위 2

- 헬스장 / 트레이너 / 회원 배정
- PT 상품 · 계약 · 세션 차감 (트랜잭션 처리 주의)
- 알림장 + FCM

### 정리 필요

- `favicon` 제작 (현재 Next.js 기본 로고)
- 삭제된 `.agents/skills/prisma-composer/SKILL.md` 등 4건이 git status 에
  `D` 로 남아있음 — 의도 확인 필요
- `postinstall: "prisma skills sync || exit 0"` 이 Vercel 빌드에서도 실행됨
  (`|| exit 0` 로 실패는 무시되지만 불필요)
