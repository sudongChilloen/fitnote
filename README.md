# FitNote

PT 센터 · 트레이너 · 회원을 위한 **운동 기록 + PT 알림장 + 수업 관리** 웹앱.
트레이너가 회원을 관리하고 수업을 기록하면, 그 내용이 회원의 운동 기록으로 이어진다.

개발 경과와 설계 판단은 [`docs/PROGRESS.md`](docs/PROGRESS.md) 에 있다.

## 기술 스택

Next.js 16 (App Router) · React 19 · Prisma 7 + Postgres(Supabase) · Tailwind 4 + shadcn ·
zod 4 · 직접 구현한 JWT 인증(`jose` + `bcryptjs`)

> 이 프로젝트의 Next.js 는 익숙한 버전과 다르다 (`middleware` → `proxy.ts` 등).
> 코드를 쓰기 전에 `node_modules/next/dist/docs/` 를 먼저 볼 것. 자세한 내용은 `AGENTS.md`.

## 시작하기

```bash
npm install
cp .env.example .env   # 없으면 아래 환경변수를 직접 채운다
npx prisma migrate deploy
npx prisma db seed     # 기구 · 운동 시드 (선택)
npm run dev
```

http://localhost:3000 에서 확인한다. 패키지 매니저는 **npm** 이다 (pnpm 락파일을 두지 말 것).

### 환경변수

| 변수                        | 용도                                       | 비고                                              |
| --------------------------- | ------------------------------------------ | ------------------------------------------------- |
| `DATABASE_URL`              | 앱 런타임 연결                             | Supabase pgbouncer **6543** (transaction 모드)    |
| `DIRECT_URL`                | 마이그레이션                               | Supabase **5432** (session 모드)                  |
| `SESSION_SECRET`            | 세션 JWT 서명                              | `openssl rand -base64 32`                         |
| `SUPABASE_URL`              | 사진 저장소 (선택)                         | 없으면 사진 영역만 "저장소가 설정되지 않았어요"   |
| `SUPABASE_SERVICE_ROLE_KEY` | 사진 서명 주소 발급 (선택)                 | **서버 전용.** 브라우저로 나가면 안 된다          |
| `SUPABASE_PHOTO_BUCKET`     | 사진 버킷 이름 (선택)                      | 기본값 `fitnote-photos`                           |
| `FCM_PROJECT_ID` · `FCM_CLIENT_EMAIL` · `FCM_PRIVATE_KEY` | 푸시 알림 (선택) | 세 값이 모두 있어야 켜진다. 서버 전용 |
| `APP_URL`                   | 푸시를 눌렀을 때 열 주소 (선택)            | `https://도메인` 처럼 끝에 `/` 없이               |

`DATABASE_URL` 과 `SESSION_SECRET` 이 없으면 빌드가 실패한다 (모듈 로드 시점에 검사).
사진 버킷은 새 환경에서 한 번만 만든다: `npx tsx --conditions=react-server scripts/setup-storage.mts`

## 스크립트

| 명령                       | 내용                                                      |
| -------------------------- | --------------------------------------------------------- |
| `npm run dev`              | 개발 서버                                                 |
| `npm run build` / `start`  | 빌드 / 실행                                               |
| `npm run typecheck`        | `tsc --noEmit`                                            |
| `npm run lint`             | eslint                                                    |
| `npm test`                 | 단위 테스트                                               |
| `npm run test:integration` | 통합 테스트 — 임시 Postgres 를 띄운다. 운영 DB 는 안 건드림 |

CI(`.github/workflows/ci.yml`)가 PR 마다 위 순서대로 돌린다.

## 구조

```
app/
  (auth)/        로그인 · 가입 (트레이너가 만든 계정 이어받기 포함)
  (user)/        회원 화면: 홈, 운동 기록, 운동 라이브러리, 식단, 체성분·목표, 알림장, 내 PT
  trainer/       트레이너 화면: 회원, 일정, 수업 진행, 알림장 작성, 계약
  api/           운동·워크아웃 REST API
  lib/           jwt · session · dal(권한 확인) · rate-limit · zod 스키마
server/          도메인별 서비스 (페이지와 액션이 직접 호출)
  pt/ workouts/ trainers/ journals/ diet/ body/ ...
lib/             prisma, storage, date(KST) 등 공용
prisma/          schema · migrations · seed
generated/prisma 생성된 Prisma 클라이언트 (커밋한다)
tests/           단위 · 통합 테스트
proxy.ts         쿠키만 보는 낙관적 라우트 보호
```

### 알아둘 규칙

- **인증은 2단계.** `proxy.ts` 는 JWT 서명만 보고, 실제 방어선은 `app/lib/dal.ts` 의 DB 조회다.
  서버 액션과 서비스는 `requireUser` / `requireTrainerProfile` 로 다시 확인한다.
- **`generated/prisma` 는 커밋한다.** 스키마를 바꾸면 `npx prisma generate` 후 결과를 함께
  커밋해야 Vercel 빌드가 통과한다. 필드 순서가 통째로 바뀌어 diff 가 커도 정상이다.
- **날짜 경계는 KST** 로 고정한다 (`lib/date.ts`). 서버는 UTC 로 돈다.
- **서비스를 나눌 때는 진입점을 남긴다.** `pt.service.ts`, `workout.service.ts` 는 하위 파일을
  다시 내보내는 얇은 파일이라 import 경로가 바뀌지 않는다.

## 배포 (Vercel)

환경변수를 등록하고, **코드를 올리기 전에** 새 마이그레이션을 먼저 적용한다
(`npx prisma migrate deploy`, `DIRECT_URL` 필요). 자세한 내용은 `docs/PROGRESS.md` 3장과 7-4.
