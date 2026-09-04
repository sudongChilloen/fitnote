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

#### 색: 파스텔 주황을 "버튼 색"으로 쓸 수 없다

포인트는 파스텔 주황, 기본은 어두운 색으로 정했다. 그런데 파스텔 주황 위에
흰 글씨는 **어떤 밝기를 골라도 WCAG AA(4.5:1)를 넘지 못한다.** oklch 명도를
0.62~0.78 로 바꿔가며 sRGB 로 변환해 직접 계산해 봤고 대비는 2.0~3.8 에 머물렀다.
밝기를 더 낮추면 대비는 오르지만 그 시점엔 이미 파스텔이 아니다.

그래서 색을 하나로 쓰지 않고 **역할을 쪼갰다.**

| 토큰 | hex | 역할 | 대비 |
|---|---|---|---|
| `primary` | `#261d18` | 기본 버튼·강조 배경 (웜 차콜) | 흰 글씨 15.8:1 |
| `brand` | `#f7a062` | **면을 채울 때만** — 진행바, 배지, 아이콘 타일 | (글자 금지) |
| `brand-strong` | `#a84811` | **글자·아이콘용** 주황 | 흰 배경 5.8:1 |
| `accent` | `#ffecdc` | 옅은 칩 배경 | + `accent-foreground` 7.8:1 |
| `background` | `#fcfaf6` | 웜 화이트 (순백을 피해 주황과 안 싸우게) | |

**규칙: `brand` 위에 글자를 올리지 않는다. 주황 글자가 필요하면 `brand-strong`.**
이 규칙과 대비 수치는 `app/globals.css` 상단 주석에도 적어 뒀다.

팔레트는 `light-dark()` 로 **한 번만** 선언한다. 기존 shadcn 토큰은 `:root` /
`.dark` / `@media (prefers-color-scheme)` 3곳에 같은 변수를 중복 정의해서,
색 하나 바꾸려면 세 군데를 고쳐야 했다. Lightning CSS 가 구형 브라우저용
폴백까지 자동 생성해 주는 것을 빌드 산출물에서 확인했다.

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

### 4-7. 운동 기록 API

| 엔드포인트 | 설명 |
|---|---|
| `POST /api/workouts/sessions` | 세션 시작 |
| `GET /api/workouts/sessions` | 지난 기록 목록 (페이지네이션, 기간 필터) |
| `GET /api/workouts/sessions/active` | 진행중 세션 조회 (없으면 200 + `null`) |
| `GET /api/workouts/sessions/[id]` | 세션 상세 |
| `PATCH /api/workouts/sessions/[id]` | 종료 / 취소 / 메모 |
| `POST /api/workouts/sessions/[id]/records` | 운동 추가 (+ 직전 기록 반환) |
| `DELETE /api/workouts/records/[id]` | 운동 제거 |
| `POST /api/workouts/records/[id]` | 세트 추가 |
| `PATCH`·`DELETE` `/api/workouts/sets/[id]` | 세트 수정 / 삭제 |
| `GET /api/workouts/last-record?exerciseId=` | 직전 기록 조회 |

**하루 여러 번 운동** — `WorkoutSession` 에 날짜 유니크 제약이 없고 `startedAt`
(DateTime)을 쓰므로 자연히 지원된다. 대신 종료하지 않은 세션이 쌓이지 않도록
세션 시작 시 진행중 세션을 확인한다.

권장 흐름은 **시작 전에 먼저 물어보는 것**이다.

```
GET /api/workouts/sessions/active
          ↓
     진행중 있음?
      ↙        ↘
    YES         NO
     ↓           ↓
"이어서?"    POST (바로 시작)
  ↙   ↘
이어서  새로 시작
  ↓       ↓
기존 ID  POST mode:"new"
```

`active` 는 홈 화면의 "운동 중" 배너에도 쓴다. POST 만으로도 409 로 알 수 있지만,
그 경우 사용자가 이미 시작 버튼을 누른 뒤라 흐름이 끊긴다.

| mode | 동작 |
|---|---|
| `ask` (기본) | 진행중 세션이 있으면 **409 + activeSession** 반환 → 사용자에게 질문 |
| `resume` | 기존 세션을 이어서 사용 |
| `new` | 기존 세션을 마감하고 새로 시작. **기록이 없으면 CANCELLED** 로 정리해 빈 세션이 이력에 남지 않게 함 |

> `new` 로 기존 세션을 마감하는 이유: `getActiveSession` 은 `findFirst` 라서
> IN_PROGRESS 가 둘 이상이면 나머지는 영영 조회되지 않는 유령 세션이 된다.
> 기본값이 `ask` 라 자동으로 마감되는 일은 없고, 사용자가 "새로 시작" 을
> 명시적으로 고른 경우에만 동작한다.

**이전 기록 불러오기** — 운동을 추가하면 응답에 `previousRecord` 가 함께 온다.
클라이언트가 추가 호출 없이 값을 채울 수 있다.

```json
{ "record": { ... },
  "previousRecord": { "performedAt": "...", "maxWeight": 70,
                      "totalVolume": 1580, "sets": [...] } }
```

이 조회가 `WorkoutRecord.userId` 비정규화의 이유다. 세션을 조인하면
`[exerciseId, createdAt]` 인덱스가 **전체 사용자**의 기록을 훑는다.
운동은 50종뿐이라 카디널리티가 낮아 사용자가 늘수록 무의미해진다.

```prisma
@@index([userId, exerciseId, createdAt(sort: Desc)])
```

**주의해서 처리한 것**

- **Decimal 직렬화** — `weight` / `totalVolume` / `rpe` 는 Prisma Decimal 이라
  JSON 에서 **문자열**이 된다(`{"w":"62.5"}` 로 실측 확인). DTO 경계에서
  `Number()` 변환. 안 하면 프론트에서 `"62.5" + 5 = "62.55"` 가 된다
- **totalVolume 재계산** — 세트 추가/수정/삭제와 **같은 트랜잭션**에서 갱신.
  완료(`completed`)한 세트만 합산한다
- **setNumber 재정렬** — `(recordId, setNumber)` 유니크 제약 때문에 세트 삭제 후
  번호를 다시 매긴다. 오름차순으로 내려 쓰면 목표 번호가 항상 먼저 비어 충돌하지 않는다
- **소유권 검증** — 모든 조회/변경 쿼리의 `where` 에 `userId` 를 넣어
  남의 세션·기록·세트에 접근하면 404
- **API 인증** — `dal` 의 `requireUser` 는 `redirect()` 를 호출해 API 에서 쓰면
  JSON 대신 리다이렉트가 나간다. `app/api/_lib/api.ts` 의 `requireApiUser()` 가
  **401 JSON** 을 반환한다

### 4-8. 레이아웃 셸 + 홈

`app/(user)/layout.tsx` 가 **모바일 셸을 혼자 책임진다.**

- `max-w-md` 중앙 정렬 (데스크톱에서 폭이 늘어지지 않게)
- 하단 탭 5개: 홈 / 운동 / 캘린더 / 알림장 / 내정보
- 하단 여백 `calc(4.25rem + env(safe-area-inset-bottom))` — 아이폰 홈 인디케이터에
  버튼이 가리지 않도록

덕분에 하위 페이지는 `<main className="flex flex-col gap-N px-5 pt-N">` 만 쓰면 된다.
페이지마다 하단 여백을 다시 계산하면 언젠가 한 곳을 빠뜨린다.

캘린더는 별도 탭으로 뒀다. 홈에 주간 스트립을 넣고 캘린더를 홈 안에 접어 두면
"지난달 기록 보기"가 홈 스크롤 안에 묻힌다.

홈 구성: 인사 → 진행중 세션 배너(있을 때만) → 운동 시작 버튼 → 최근 7일 스트립 →
운동 라이브러리 링크. 준비 중인 탭(캘린더/알림장/내정보)은 빈 화면 대신
"준비 중" 안내를 띄운다.

**렌더 중 `Date.now()` 금지.** React 19 의 `react-hooks/purity` 규칙이 서버
컴포넌트에서도 이걸 에러로 잡는다. 경과 시간은 `toSessionDto` 가 `elapsedSec`
필드로 계산해서 내려준다. API 소비자에게도 필요한 값이라 설계상으로도 맞다.
클라이언트 타이머는 이 값을 초기값으로 받고 **마운트 이후부터만** 흐른다
(렌더 시점에 다시 계산하면 하이드레이션 불일치가 난다).

날짜 경계는 `lib/date.ts` 에서 **KST 고정**이다. Vercel 은 UTC 로 돌기 때문에
서버 로컬 시간으로 하루를 나누면 밤 9시 이후 운동이 다음 날 기록이 된다.

### 4-9. 세트 입력 화면

| 파일 | 역할 |
|---|---|
| `app/(user)/workouts/[id]/page.tsx` | 세션 화면 (서버 컴포넌트) |
| `add-exercise-drawer.tsx` | 운동 검색 + 추가 |
| `record-card.tsx` | 운동 카드 + `SetRow` 인라인 편집 |
| `actions.ts` | 서버 액션 6종 |

**운동 추가는 Drawer 로.** `/exercises` 로 이동시키면 "어느 세션에 담는 중이었나"
라는 맥락이 끊긴다. 검색은 250ms 디바운스 + `AbortController` 로 이전 요청을 끊는다.

**세트 입력은 blur 에서만 저장한다.** 타이핑마다 서버 액션을 부르면 요청이
폭증한다. 값이 바뀌지 않았으면 아예 부르지 않는다. 반면 **완료 토글은 즉시** 저장한다
— 볼륨이 완료한 세트만 합산하므로 바로 반영돼야 한다.

**세트 행은 `set.id` 로 key 한다.** 삭제하면 서버가 `setNumber` 를 다시 매기는데,
번호로 key 하면 편집 중이던 입력값이 엉뚱한 행으로 옮겨 붙는다.

세트를 추가할 때 값은 `직전 세트 → 지난 기록의 첫 세트 → 빈 값` 순으로 채운다.
매번 60kg 을 다시 입력하게 만들면 안 된다. 운동마다 `getLastRecord` 를 **병렬로**
조회해 "지난 기록 60kg×10" 도 함께 보여준다.

종료된 세션은 입력 UI 를 감추고 값만 보여준다.

에러 처리는 `run()` 하나로 모은다. 서비스가 `null` 이면 "대상을 찾을 수 없습니다",
`WorkoutError` 면 그 메시지를 그대로, 나머지는 500 문구. 성공하면
`revalidatePath` 로 세션 화면과 홈을 갱신한다.

### 4-10. 운동 선택 (부위 칩 + 다중 선택)

검색만으로는 부족하다. **운동 이름을 모르는 사람은 검색을 못 한다.**

처음에는 "부위 목록 → 그 부위 운동" 2단계로 만들었는데, 레퍼런스 앱 화면을 보고
바꿨다. 검색창 아래 **가로 스크롤 칩 한 줄**(전체/가슴/등/…)이면 한 번만 누르면 된다.
운동이 0개인 부위는 칩 자체를 만들지 않는다 — 눌러서 빈 화면을 만나면 고장 난 걸로 보인다.
(시드 기준 `OTHER` 만 0개)

**다중 선택.** 하나 고를 때마다 드로어가 닫히면 "오늘 가슴 3개" 담는 데 같은 작업을
세 번 한다. 체크로 여러 개 고르고 하단 고정 버튼(`N개 추가`)으로 한 번에 담는다.

`addRecords()` 는 `orderIndex` 를 각각 계산하지 않는다. 따로 계산하면 같이 넣을 때
번호가 겹친다. 마지막 번호를 **한 번만** 읽고 이어 붙이며, 고른 순서를 유지한다.

**즐겨찾기**(`WorkoutFavorite`)는 모델만 있고 안 쓰이고 있었다. 매번 같은 5~6개를
하는 사람에게는 이게 사실상 첫 화면이다. 응답을 기다리면 별이 늦게 켜져 두 번 누르게
되므로 먼저 반영하고 실패 시 되돌린다.

> 검색 결과 0건에서 UI 가 깨지던 원인: **드로어 높이를 내용에 맡겼다.** 타이핑할수록
> 결과가 줄면서 드로어가 같이 줄고, 0개가 되면 납작해진다. `h-[85dvh]` 로 고정했다.

썸네일은 뺐다. `Exercise.thumbnailUrl` 필드는 있지만 시드에 값이 없어서
지금 넣으면 빈 네모 50개가 된다.

### 4-11. 기록 방식 두 축 (실시간 / 몰아서, 본인 / 트레이너)

운동하면서 실시간으로 적는 사람만 있는 게 아니다. 다 끝내고 앉아서 한 번에 넣는
사람에게 "시작 → 종료" 는 맞지 않고, **어제 운동은 아예 입력할 방법이 없었다.**

`WorkoutSession` 에 **서로 다른 축 두 개**를 넣었다. 하나로 합칠 수 없다.

| 필드 | 질문 | 값 |
|---|---|---|
| `entryMode` | **어떻게** 입력했나 | `LIVE` / `MANUAL` |
| `recordedByUserId` | **누가** 입력했나 | `null`=본인 / 트레이너 id |

**`entryMode` 가 필요한 이유.** 둘 다 편집하는 동안 `IN_PROGRESS` 여야 하는데,
구분이 없으면 어제 기록을 입력하는 중에 홈에 "운동 진행중" 타이머가 뜨고
새 운동 시작이 409 로 막힌다. `getActiveSession` 과 시작 충돌 검사를 `LIVE` 로 한정했다.

**`recordedByUserId` 가 필요한 이유.** 트레이너는 수업이 끝난 뒤에 적어 주므로
항상 `MANUAL` 이다. 그래서 축을 합치고 싶어지는데, 합치면 **어느 트레이너가 적었는지**
를 못 담는다. "김OO 트레이너가 기록" 표시도, 트레이너 화면의 "내가 적어 준 기록"
조회도 안 된다. 기록의 주인은 어디까지나 `userId` 의 회원이므로 트레이너 계정이
지워져도 기록은 남게 `SetNull`.

> 트레이너가 적는 도중에 회원에게 반쯤 적힌 기록이 보이면 안 되는데, 이건
> `IN_PROGRESS`(작성 중) → `COMPLETED`(전달됨) 로 이미 표현된다. 별도 필드가 필요 없다.

**MANUAL 의 시간 처리가 미묘하다.**

- 저장할 때 소요 시간을 **벽시계로 재지 않는다.** 그러면 *입력하는 데 걸린 시간*이
  운동 시간이 되고, 지난 날짜면 며칠짜리 운동이 된다. `durationSec` 은 비워 두고
  화면에는 `—` 를 보여준다
- `elapsedSec` 도 `null` 이다. `startedAt` 이 며칠 전이라 "3일 경과" 가 된다

같은 날짜를 다시 열면 **작성 중인** 세션을 재사용한다(매번 새로 만들면 입력하다
나갔다 온 사람에게 빈 세션이 쌓인다). 반면 이미 저장한 세션은 재사용하지 않는다 —
**하루에 두 번 운동한 걸 하나로 합치면 안 된다.**

### 4-12. 캘린더

`app/(user)/calendar/page.tsx`. 날짜를 누르면 그날 세션이 아래 목록으로 나온다.

- **하루에 두 번 운동할 수 있으니 항상 목록이다.** 기록이 있든 없든
  "이 날짜에 기록 추가" 를 함께 둔다. 빈 날에만 추가할 수 있게 하면
  오전에 하고 저녁에 또 한 사람이 막힌다
- `month` 와 `date` 를 **따로** 받는다. 하나로 묶으면 9월 30일을 고른 채 10월로
  넘겼을 때 선택이 화면 밖으로 사라진다
- 운동한 날은 **색이 아니라 점**으로 표시한다. 색만으로 구분하면 색각 이상이 있는
  사람이 구분하지 못한다
- `getMonthSummary` 는 세션 전체를 끌어오지 않는다. 점을 찍는 데는 날짜와 세트 수만
  있으면 되므로 `sets` 는 `_count` 로만 센다
- `IN_PROGRESS` 배지를 `입력 중`(MANUAL) / `진행 중`(LIVE) 로 구분한다

`buildMonthGrid` 는 앞뒤를 이전/다음 달 날짜로 채워 **항상 7의 배수**로 맞춘다.
빈 칸으로 두면 주 단위 줄이 어긋난다.

> 뒤를 채우는 반복문에서 `cells.length` 를 **루프 안에서 다시 읽어** 날짜가
> 건너뛰는 버그가 있었다(9/30 다음 칸이 10/4). 윤년·연말연시 포함 34개 케이스로
> 연속성을 검사해 잡았다.

### 4-13. 완료한 기록 수정

"종료" 는 운동이 끝났다는 뜻이지 **데이터가 굳었다는 뜻이 아니다.** 집에 와서 무게를
잘못 적은 걸 발견하는 일은 흔하다.

작업 중 **실제 구멍을 찾았다.** 상태 검사가 운동 추가에만 있고 세트 추가/수정/삭제와
운동 삭제에는 아예 없었다. 그래서 "종료된 세션에는 기록할 수 없습니다" 를 띄우면서도
세트는 고쳐졌고, **취소한 세션의 세트까지 수정됐다.** UI 가 가려서 안 보였을 뿐이다.

`assertEditable()` 한 곳으로 모아 다섯 군데에 모두 걸었다.

| 상태 | 수정 |
|---|---|
| `IN_PROGRESS` | 가능 |
| `COMPLETED` | **가능** ← 바뀐 부분 |
| `CANCELLED` | 차단 |

화면에서는 완료된 세션에 **`수정` 토글**을 둔다. 항상 입력칸을 띄워 두면 지난 기록을
훑어보다가 실수로 값이 바뀌는데 그게 더 나쁘다. 수정 모드에서는 운동 추가도 열어 준다 —
깜빡하고 안 적은 운동이 있다. 진행중 세션은 지금 입력하는 중이므로 토글 없이 늘 열려 있다.

**수정해도 `durationSec` 과 `status` 는 건드리지 않는다.** 나중에 고쳤다고 운동 시간이
다시 측정되면 안 된다.

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

**운동 기록 API** — E2E 38개 항목 전부 통과
- 미인증 요청 → 401 JSON (리다이렉트 아님)
- 진행중 세션 있을 때 재시작 → 409 + activeSession / `resume` → 동일 세션
- 볼륨: 60×10 + 70×8 + 70×6 = **1580** 정확
- `weight` 가 `number` 로 나감 (문자열 아님)
- 종료된 세션에 기록 추가 → 409
- **같은 날 두 번째 세션 생성됨**
- 이전 기록: 세트 3개 / `maxWeight` 70 / `totalVolume` 1580
- 세트 수정 → 2200, 삭제 → 1200 재계산, `setNumber` [1,2] 재정렬,
  재정렬 후 세트 추가 시 유니크 충돌 없음
- `completed: false` 세트는 볼륨에서 제외
- **타 사용자(B)가 A 의 세션/기록/세트 접근 → 전부 404**, 이전 기록도 격리
- 입력 검증: 음수 중량·RPE 11·소수 횟수 → 400 / 없는 운동 → 404
- User 삭제 시 Session·Record·Set 전부 cascade 정리 확인

**세트 입력 화면** — 렌더 28개 + 서버 액션 19개 통과

서버 액션은 클릭해야만 실행되므로, **브라우저와 똑같은 방식으로 HTTP 호출**해 검증했다.
`next build` 산출물의 `server-reference-manifest.json` 에서 액션 ID 를 뽑고
클라이언트 청크에서 함수 이름과 매핑한 뒤,
`POST /workouts/<id>` + `Next-Action: <id>` 헤더로 직접 호출한다.

> 응답 파싱 주의: 성공하면 `revalidatePath` 때문에 재렌더된 트리가 함께 실려 오고,
> 그 안에는 라우터가 쓰는 `"error":"$undefined"` 가 들어 있다. 액션 반환값은
> 독립된 flight 행(`3:{"error":...}`)이므로 그것만 집어내야 한다.

- 운동 추가/삭제, 세트 추가/수정/삭제 전부 성공 + DB 반영 확인
- 볼륨 재계산 1160 → 1360, 완료 해제 시 560
- 세트 삭제 후 `setNumber` 1 로 재정렬
- 검증 실패(음수 중량·소수 횟수) → 화면 문구로 노출
- **타 사용자의 세트 수정 / 운동 삭제 차단** (값이 그대로임까지 확인)
- 종료된 세션에 운동 추가 차단

**운동 선택** — 18개
- 부위 집계 합 = 전체 활성 운동 수 / 0개 부위 제외 / 없는 검색어 → 200 + 빈 배열
- 일괄 추가 시 고른 순서 유지, `orderIndex` 0,1,2 → 이어서 넣으면 3,4
- 빈 선택 / 없는 운동 / 유효+무효 혼합 시 유효한 것만 추가
- 타인 세션·종료 세션 차단, 즐겨찾기 추가/해제/없는 운동

**지난 운동 몰아서 기록** — 20개
- **MANUAL 이 "진행중" 으로 안 잡힘** → 그 상태에서 새 운동 시작 가능(409 아님)
- `entryMode=MANUAL`, `startedAt` 이 지정한 날짜(KST), `recordedByUserId=null`
- 저장 시 `durationSec=null`, `endedAt=startedAt` / LIVE 는 그대로 시간 계산
- 미래 날짜·잘못된 형식 거부, 같은 날 재진입 시 재사용, 완료본은 새로 생성

**캘린더** — 18개 + 월 그리드 34개
- 하루 두 번 운동한 날 세션 2개 모두 표시, 취소 세션은 목록·점 모두 제외
- 달 이동해도 선택 날짜 목록 유지, `입력 중` / `진행 중` 배지 구분
- 잘못된 파라미터(`?date=aaa&month=zz`)에도 500 아님 → 오늘로 되돌아감
- 타 사용자 기록 안 보임
- 월 그리드: 7의 배수, 첫 칸이 일요일, 날짜 연속성(윤년 2024-02 / 연말 2025-12 포함)

**완료 후 수정** — 20개
- 완료된 세션의 세트 수정/추가/삭제 + 운동 추가 가능, 볼륨 재계산
- **수정해도 `durationSec`·`status` 유지**
- 취소 세션 5종 전부 차단(세트 수정/삭제/추가, 운동 추가/삭제) — 값이 그대로인지까지 확인
- 완료 세션엔 수정 버튼 / 진행중 세션엔 없음

---

## 6. 다음 작업

### 우선순위 1 — 세션 요약 화면

지금은 종료하면 `/home` 으로 바로 돌아간다. 방금 한 운동의 총 볼륨 · 소요 시간 ·
세트 수 · 신기록을 보여줘야 한다. 이어서 **PR 판정 / 추정 1RM**
(`[userId, exerciseId, createdAt DESC]` 인덱스는 이미 있다).

MANUAL 세션에는 소요 시간이 없으므로 요약에서도 `—` 로 두거나 항목 자체를 빼야 한다.

### 우선순위 2 — 센터 / 역할 / 공유

> 사용자와 합의한 결론이 한 번 더 정리됐다. 아래 내용이 최신이다.

**회원가입은 역할별로 나누지 않는다.** 이유는 §1 참고 — `User` 에는 role 이 없고
role 은 `CenterMembership` 에 있다. 가입 화면에 "관리자로 가입"을 두면 그대로
권한 상승 통로가 된다. 역할은 `CenterInvitation` 초대 코드로만 얻는다.
`CENTER_ADMIN` 은 초대로도 만들 수 없어 초기엔 수동 생성한다.

**공유 대상은 "관리자"가 아니라 담당 트레이너**(`assignedTrainerMembershipId`)다.
센터 관리자에게 회원의 식단 사진과 체중을 열어 주면 사고가 난다.

공유 방식은 **항목별 동의**로 간다. `TrainerSharingSetting` 같은 **별도 모델**로
관리한다. `WorkoutSession.isSharedWithTrainer` 처럼 기록마다 불리언을 붙이면
항목을 늘릴 때마다 컬럼을 늘려야 하고, 무엇보다 **회원이 기록할 때마다 스위치를
눌러야 해서 결국 아무도 안 켠다.** 설정은 **회원 × 트레이너 1개**로 둔다.

| 항목 | 공유 |
|---|---|
| 식단 (사진 / 내용 / 시간) | 선택 |
| 체중 · 체성분 | 선택 |
| 운동 기록 · 중량 / 횟수 · 메모 | 선택 |
| 개인 루틴 | 선택 |
| **PT 수업 운동 기록** | **자동** (동의 불필요) |
| 트레이너가 쓴 일지 | 회원에게 공개 |

**PT 수업 기록만 예외**인 이유: 트레이너가 적어 준 기록을 회원이 다시 공유해 줘야
보인다면 말이 안 된다. 이건 스키마에 이미 있다 — `WorkoutRecord.ptSessionId`
+ `recordType(PERSONAL | PT)`.

**기본값은 코드에 박지 않는다.** 기본 ON 은 결국 회원이 모르는 채로 공개되는 것이다.
대신 **트레이너와 연결되는 순간 "무엇을 공유할까요?" 화면을 한 번** 띄우고,
거기서 식단·체중을 미리 켜 둔 상태로 보여준다. 기본 ON 의 실익은 챙기면서
회원이 알고 켠 것이 된다.

필요한 것:

- `MemberDataConsent` (memberMembershipId, scope, enabled)
- `DataAccessLog` — 누가 언제 무엇을 봤는지. 회원이 직접 확인할 수 있으면
  동의 장벽이 크게 내려간다
- `assertTrainerCanView(trainerUserId, memberUserId, scope)` **단일 게이트.**
  라우트마다 조건문을 흩뿌리면 언젠가 한 곳을 빠뜨린다

역방향(트레이너 → 회원)은 동의가 필요 없고 모델도 이미 있다
(`Journal`, `DietFeedback`, `Routine`).

### 우선순위 3

- 트레이너 화면
- PT 상품 · 계약 · 세션 차감 (`PTSession` 완료 시 `usedSessions` 차감을
  트랜잭션으로 처리해야 함)
- 알림장 + FCM

### 정리 필요

- `favicon` 제작 (v2 에서 가져온 아이콘이 v0.app 로고라 지웠고, 기본 템플릿
  에셋도 함께 지워서 현재 아이콘이 없다)
- 알림장 / 내정보 탭은 "준비 중" 상태
- `Exercise.thumbnailUrl` 이 시드에 비어 있어 운동 목록에 이미지가 없다
- MANUAL 세션에 소요 시간을 직접 입력하는 칸 (지금은 비워 둔 채로만 저장된다)
- `postinstall: "prisma skills sync || exit 0"` 이 Vercel 빌드에서도 실행됨
  (`|| exit 0` 로 실패는 무시되지만 불필요)
- 스키마 변경 시 `npx prisma generate` 결과(`generated/prisma`)를
  **반드시 함께 커밋**해야 한다. 안 하면 Vercel 빌드가 타입 에러로 실패한다
