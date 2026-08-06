# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code(claude.ai/code)에게 가이드를 제공합니다.

## 명령어

```bash
npm run dev     # 개발 서버 실행 (Next.js + Turbopack), http://localhost:3000
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 빌드 실행
npx tsc --noEmit # 타입 체크 (아래 참고 — 수동으로 직접 실행해야 함)
```

- 이 프로젝트에는 구성된 테스트 스위트/프레임워크가 없습니다.
- `npm run lint`가 package.json에 정의되어 있지만 ESLint 자체가 **설치되어 있지 않습니다** (`eslint`나 `eslint-config-next` 의존성 없음) — 그대로 실행하면 실패합니다.
- `next.config.mjs`에 `typescript: { ignoreBuildErrors: true }`가 설정되어 있어서, 타입 에러가 있어도 `next build`는 성공합니다. 변경 전후로 회귀가 생겼는지는 직접 `npx tsc --noEmit`을 실행해서 확인해야 합니다.
- 패키지 매니저는 pnpm입니다 (`pnpm-lock.yaml` 존재). `package-lock.json`도 함께 있지만 package.json의 `pnpm.overrides`와의 일관성을 위해 pnpm 사용을 권장합니다.
- 실제 백엔드 연동에 쓰이는 3개의 `NEXT_PUBLIC_*_API_BASE_URL` 환경 변수는 `.env.production`에 정의되어 있고(모두 배포된 도메인 하나를 가리킴), 로컬 개발 시 값이 없으면 각 API 클라이언트(`lib/order-api.ts`, `lib/performance-api.ts`, `lib/standby-api.ts`)가 `http://localhost:8082`(order-service) / `http://localhost:8083`(performance-service)로 폴백합니다.

## 아키텍처

이 프로젝트는 한국형 티켓 예매 + 취소표 대기 플랫폼("ReSeat")의 프론트엔드입니다. **처음엔 순수 mock 프로토타입이었지만, 지금은 도메인별로 실제 Spring Boot 백엔드(order-service, performance-service)와 연동이 섞여 있는 과도기 상태**입니다 — 어떤 화면이 mock을 쓰는지 실 API를 쓰는지 도메인마다 다르므로, 아래 구분을 먼저 확인하고 작업하세요.

### 도메인별 연동 상태

| 도메인 | 상태 | 비고 |
|---|---|---|
| 대기(standby) | **완전 실 연동** | `lib/standby-api.ts` (performance-service). mock `WaitlistEntry` 타입/로직은 완전히 제거됨 |
| 공연 목록/회차 | **실 연동 + mock 병합** | `lib/performance-api.ts`로 조회한 실제 공연을 앱 시작 시 mock db에 병합 |
| 좌석 등급/가격/포스터/카테고리 | mock (정적) | 백엔드에 해당 조회 API가 없음 |
| 주문/결제(화면 표시) | mock | `lib/api.ts`의 `createOrder`가 즉시 성공하는 가짜 주문을 만듦 |
| 주문/결제(실 백엔드) | 실 연동이지만 "그림자" 호출 | 실패해도 화면에 영향 없음 (아래 참고) |

### `lib/` 아래의 mock 백엔드 계층 (여전히 UI의 주 데이터 소스)

- `lib/mock-data.ts` — 시드(seed) 픽스처 데이터 (사용자, 공연장, 공연, 회차, 주문, 포인트 등).
- `lib/api.ts` — 모듈 로드 시 시드 데이터를 한 번 복제해 만든 인메모리 `db` 객체와, REST 엔드포인트를 흉내 내는 메서드를 가진 `api` 객체. 각 메서드 주석은 대응하는 실제 엔드포인트를 나타내고, 변경은 `db`에 직접 가해집니다(`structuredClone`으로 입출력 깊은 복제). **화면에 보이는 예매/주문/포인트 흐름의 단일 진실 공급원은 여전히 이 파일**입니다.
- `lib/types.ts` — 도메인 타입. Spring Boot + JPA 엔티티 형태를 따라가도록 작성됨.
- `lib/store.tsx` — 컴포넌트가 mock 백엔드에 접근하는 단일 React Context (`AppProvider` / `useApp()`). `role`(`'BUYER' | 'SELLER'`, 헤더 토글 — 실제 인증 없음), 구매자 `points`, `withRefresh`(호출 후 `version` 카운터 증가로 구독 컴포넌트 리렌더)를 제공. 읽기 경로는 각 페이지의 `useMemo(..., [version])` 안에서 `api.xxx()`를 직접 호출하는 방식 — mock 데이터를 읽는 곳은 항상 `version`을 deps에 넣어야(`void version`이라도) 갱신 누락을 피할 수 있음.
- **ID 충돌 주의**: `nextId()`는 시드 ID(예: `o_1001`)보다 충분히 높은 값(100000+)에서 시작하는 모듈 레벨 카운터. 이 값을 건드릴 때는 런타임 생성 ID가 시드 ID와 겹치지 않는지 확인할 것 — 충돌 시 `.find()` 조회가 엉뚱한 시드 레코드를 조용히 반환함.

### 실 백엔드 연동 계층 (`lib/*-api.ts`)

세 클라이언트 모두 `{ success, data, code, message }` 형태의 공통 응답 포맷을 가정하고, 실패 시 도메인별 `*ApiError`를 던집니다.

- **`lib/standby-api.ts`** — 취소표 대기 CRUD (`POST /api/standby`, `GET/DELETE /api/standby/{id}`, 구역별 취소). 이 도메인만 mock을 완전히 대체했습니다.
  - `STANDBY_USER_ID = 1`: 실제 인증이 없어 고정한 숫자 사용자 ID. mock 쪽 `BUYER_ID`(문자열 `'u_buyer'`)와는 별개 — 로그인이 붙기 전까지는 두 ID 체계가 공존함.
  - `toBackendPerformanceId()`: mock `Performance.id`(`'p_1001'` 등 문자열)를 숫자로 변환하는 임시방편. 공연 데이터 자체가 실 API로 완전히 넘어가면 제거 대상.
  - 백엔드가 대기 오퍼의 만료 시각을 내려주지 않으므로, `lib/standby-store.ts`가 매칭 감지 시각(`heldSince`)을 기록해두고 `STANDBY_OFFER_TTL_SECONDS`(1800)를 더해 30분 제한을 프론트에서 근사 계산함(`components/waitlist-payment-dialog.tsx`의 `remainingSeconds()`).
- **`lib/standby-store.ts`** — "내 대기 목록 전체 조회" API가 백엔드에 없어서(단건 조회만 가능), 신청 성공 시마다 `standbyId`를 `localStorage`(`standby:{userId}` 키)에 쌓아두고 목록 화면에서 순회 조회하는 방식. **다른 기기/브라우저에서는 기록이 없어 목록이 비어 보이는 한계**가 있음 — "내 목록" API가 추가되면 대체 대상.
- **`lib/use-standby.ts`** — `standbyStore`의 로컬 레코드들을 15초 간격(`POLL_INTERVAL_MS`)으로 각각 실 조회해 순위/매칭 상태 갱신. `STB404_001`/`STB409_004`(이미 없어졌거나 취소된 신청) 에러를 받으면 로컬 레코드도 조용히 제거.
- **`lib/performance-api.ts`** — 공연/회차/좌석 조회. `performanceApi.selectSeatZone()`(`POST /api/tickets/select/seat`)이 특정 회차·구역의 실제 발행된 좌석(ticketId 포함)과 구역 가격을 함께 내려줌 — 화면에서 고른 좌석을 실제 주문에 쓸 `ticketId`로 매핑하는 유일한 통로.
- **`lib/order-api.ts`** — 주문 생성/결제/취소. `cancelCompleted()`에는 알려진 백엔드 버그가 있음: 결제 완료 후 취소해도 `OrderServiceImpl.cancelCompletedOrder()`가 좌석 release 이벤트를 발행하지 않아 티켓이 계속 HOLD로 남음(2026-07-28 확인). 새로 관련 작업을 할 때는 이 제약이 여전히 유효한지 먼저 확인할 것.
- **`lib/performance-extras.ts`** — 백엔드에 없는 필드(포스터, 카테고리, 구역별 가격)를 **공연 title 기준**으로 매핑해 보완하는 프론트 정적 데이터. **id가 아니라 title로 매핑하는 이유**: performance-service가 개발 중 `ddl-auto=create`로 재기동될 때마다 auto-increment가 1부터 다시 시작해 같은 title이라도 실행마다 `performanceId`가 바뀌기 때문 — title 매칭이 재기동에 안전함. 셀러가 새 공연을 등록하면 `registerPerformanceExtras()`로 런타임에 추가되고 `localStorage`(`reseat:performance-extras`)에도 저장돼 새로고침 후에도 유지됨.

### 실 공연과 mock 공연의 병합 (`lib/store.tsx`)

앱 마운트 시 `performanceApi.list()` + `performanceApi.sessions()`로 실제 공연/회차를 가져와 `api.importRealPerformances()`로 mock `db`에 병합합니다(실패해도 무시 — 백엔드 미기동 시에도 mock만으로 앱이 정상 동작해야 함). 병합된 공연은 **숫자 ID**를 그대로 쓰고, mock 전용 공연은 `'p_1001'` 같은 **문자열 접두 ID**를 씁니다. `components/booking-dialog.tsx`의 `isRealPerformance = /^\d+$/.test(performance.id)`가 이 구분으로 좌석 배치도를 mock 재고 기반으로 그릴지 실제 발행된 티켓(`performanceApi.selectSeatZone()`) 기반으로 그릴지를 분기합니다. `AppContextValue.performancesLoaded`가 true가 되기 전에는 실 공연 상세 페이지에서 `notFound()`로 단정하면 안 됨(직접 URL 진입/새로고침 시 오탐 방지).

### 주문 흐름의 "그림자 호출" (`components/booking-dialog.tsx`의 `syncRealOrder`)

화면에 표시되는 예매 완료는 항상 `lib/api.ts`의 mock `createOrder`가 담당합니다. 실 공연(`isRealPerformance`)에 한해서만, 결제 성공 직후 실제 `ticketId`로 `orderApi.createOrder → pay → confirm`을 추가로 호출해 order-service에도 흔적을 남기지만, **이 호출이 실패해도 UI는 이미 완료된 것으로 표시되고 콘솔 경고만 남습니다**(mock 예매와 독립적인 그림자 호출). 이 부분을 수정할 때 실패 시 UI 롤백을 추가하는 식으로 "고치지" 말 것 — 의도된 설계.

### 좌석 점유 상태 vs. 다이얼로그 로컬 상태

구매자가 예매를 진행하는 동안의 좌석 "점유" 상태는 예매 다이얼로그의 로컬 `useState`가 아니라 `lib/store.tsx`의 전역 컨텍스트에 `heldSeat`로 관리됩니다. 클라이언트 사이드 네비게이션에는 유지되어야 하지만 완전한 새로고침 시에는 사라져야 하는데, 이는 인메모리 React 컨텍스트 상태의 동작 방식과 정확히 일치합니다. 이 요구사항을 다시 확인하지 않은 채 다이얼로그 로컬 상태로 되돌리지 마세요.

### 예매 플로우 (3단계)

`components/booking-dialog.tsx`는 `select → price → pay → done` 단계 상태 머신을 갖습니다:
1. **select** — 좌석 배치도 (구역별 그리드, 한 번에 한 좌석). 실 공연이면 `performanceApi.selectSeatZone()`으로 실제 좌석 상태를 조회.
2. **price** — 티켓 가격 내역 + 포인트 사용.
3. **pay** — `components/toss-payment.tsx`를 통한 가짜 PG 위젯(`setTimeout` 지연으로 실제 `@tosspayments/payment-sdk` 연동을 흉내 냄).

`components/waitlist-payment-dialog.tsx`(대기 매칭 결제)는 동일한 `price`/`pay` 단계와 `components/booking-steps.tsx`를 재사용하지만 좌석 선택 단계는 생략합니다(대기열 오퍼는 좌석 단위가 아니라 구역 단위). 취소는 `standbyApi.cancelZone()`(실 API)을 호출하지만, 결제 확정은 여전히 mock `createOrder`를 씁니다.

### 취소표 대기 시스템 (실 백엔드, `components/waitlist-dialog.tsx` / `app/waitlist/page.tsx`)

신청은 `standbyApi.create()`로 실 백엔드에 생성되고 `standbyStore`에 로컬로도 기록됩니다. 매칭 여부(`zoneRanks[].isHeld`)는 `useMyStandby` 훅이 15초마다 폴링해 판단하며, 매칭되면 `WaitlistPaymentDialog`에서 30분 내 결제(mock)하거나 `standbyApi.cancelZone()`으로 취소해야 합니다. 헤더 알림 벨(`components/site-header.tsx`)은 이 실 API 기반 상태를 그대로 읽습니다.

### UI 프리미티브는 Radix가 아니라 Base UI

`components/ui/*`는 shadcn 스타일 래퍼이지만 Radix가 아니라 `@base-ui/react`(Button, Dialog, Menu, Input 등) 위에 만들어져 있습니다. 알아둬야 할 동작 차이:
- `Button`(`components/ui/button.tsx`)은 `asChild` prop을 **지원하지 않습니다** — 기존 파일 몇 개(`app/mypage/page.tsx`, `app/seller/mypage/page.tsx`, `app/seller/page.tsx`)가 그럼에도 `asChild`를 넘겨서 `tsc --noEmit`이 실패합니다. 이는 이미 알려진 기존 타입 에러이며, 요청받지 않은 이상 관련 없는 작업의 부수 효과로 "고치지" 마세요.
- `DropdownMenuLabel`(Base UI의 `Menu.GroupLabel`을 감쌈)은 `DropdownMenuGroup`/`DropdownMenuRadioGroup` 안에 중첩되지 않으면 런타임에서 에러를 던집니다. 독립적인 라벨이 필요하면 그냥 일반 텍스트(예: `<p>`)를 사용하세요.

### 테마

`app/globals.css`는 밝은/어두운 테마 토큰을 `oklch()` CSS 변수로 정의하고(Tailwind v4 `@theme inline`), shadcn 기본값 위에 커스텀 `--success`/`--warning` 토큰이 얹혀 있습니다. `*-foreground` 변형(예: `--warning-foreground`)은 **불투명한 solid 배경** 위 텍스트용으로 조정된 색입니다 — 이를 단독 강조 텍스트 색으로 쓰거나 반투명 배경(`bg-warning/10`) 위에 쓰면 다크 테마에서 거의 안 보이게 됩니다. 인라인 강조 텍스트에는 `components/status-badges.tsx`에 쓰이는 패턴대로 기본 토큰(`text-warning`, `text-success`, `text-primary`)을 사용하세요.
