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

## 아키텍처

이 프로젝트는 한국형 티켓 예매 + 취소표 대기 플랫폼("ReSeat")의 **프론트엔드 전용 프로토타입**입니다. 실제 백엔드가 없고, 모든 것이 클라이언트에서 메모리상으로 시뮬레이션됩니다.

### `lib/` 아래의 mock 백엔드 계층

- `lib/mock-data.ts` — 시드(seed) 픽스처 데이터 (사용자, 공연장, 공연, 회차, 주문, 대기 신청 등).
- `lib/api.ts` — 모듈 로드 시 시드 데이터를 한 번 복제해 만든 인메모리 `db` 객체와, REST 엔드포인트를 흉내 내는 메서드를 가진 `api` 객체. 모든 메서드에는 실제로 대응하는 엔드포인트를 명시하는 주석이 달려 있고(예: `// POST /api/orders`), 변경은 `db`에 직접 가해집니다 (호출자가 실제 참조를 갖지 않도록 `structuredClone`으로 입출력을 깊은 복제). `lib/api.ts`를 모든 비즈니스 규칙(주문 생성, 환불 정책, 대기열 오퍼/만료 로직, 판매자 취소 시 연쇄 처리, 포인트 적립/차감 등)의 단일 진실 공급원(single source of truth)으로 취급하세요.
- `lib/types.ts` — **향후 실제 Spring Boot + JPA 백엔드**의 엔티티/DTO 형태를 그대로 따르도록 작성된 도메인 타입 (파일 자체 헤더 주석 참고). 이 타입들을 함부로 바꾸기 전에 이를 사용하는 `lib/api.ts`의 모든 메서드를 반드시 확인하세요.
- `lib/store.tsx` — 컴포넌트가 mock 백엔드에 접근하는 유일한 통로인 단일 React Context (`AppProvider` / `useApp()`). 현재 `role`(`'BUYER' | 'SELLER'`, 헤더에서 토글 — 실제 인증 없음), 구매자의 `points`, 그리고 모든 변경 액션을 감싸는 `withRefresh`(호출 후 `version` 카운터를 올려서 구독 중인 모든 컴포넌트를 리렌더시킴)를 제공합니다. **읽기 경로는 각 페이지/컴포넌트의 `useMemo(..., [version])` 안에서 바로 `api.xxx()`를 호출하는 방식**입니다 — mock 데이터를 읽는 곳이라면 어디든 `version`을 의존성에 넣어야(`void version`으로라도) 변경 후 UI가 갱신되지 않는 문제를 피할 수 있습니다.
- **ID 충돌 주의**: `lib/api.ts`의 `nextId()`는 시드 데이터 자체의 숫자 ID보다 충분히 높은 값에서 시작하는 모듈 레벨 카운터를 씁니다 (시드 주문/결제는 `o_1001`/`pay_1001` 등). 이 카운터 값을 낮추거나 새 시드 엔티티를 추가할 때는, 런타임에 생성되는 새 ID가 시드 ID와 겹치지 않는지 반드시 확인하세요 — 충돌이 나면 `.find()` 조회(예: `getPayment`)가 새로 만든 레코드가 아니라 엉뚱한 시드 레코드를 조용히 반환하게 됩니다.

### 좌석 점유 상태 vs. 다이얼로그 로컬 상태

구매자가 예매를 진행하는 동안의 좌석 "점유" 상태는 예매 다이얼로그의 로컬 `useState`가 아니라 `lib/store.tsx`의 전역 컨텍스트에 `heldSeat`로 관리됩니다. 이는 의도된 설계입니다: 클라이언트 사이드 네비게이션(예: 상세 페이지를 벗어났다가 다시 돌아오는 경우)에는 유지되어야 하지만, 완전한 새로고침 시에는 사라져야 하는데, 이는 인메모리 React 컨텍스트 상태의 동작 방식과 정확히 일치합니다. 이 요구사항을 다시 확인하지 않은 채 다이얼로그 로컬 상태로 되돌리지 마세요.

### 예매 플로우 (3단계, 국내 티켓 예매 사이트들의 일반적인 구조를 따름)

`components/booking-dialog.tsx`는 `select → price → pay → done` 단계 상태 머신을 갖습니다:
1. **select** — 좌석 배치도 (구역별 그리드, 한 번에 한 좌석).
2. **price** — 티켓 가격 내역 + 포인트 사용 (`createOrder({ pointsUsed })`를 통해 차감되는 적립 포인트).
3. **pay** — `components/toss-payment.tsx`를 통한 결제수단 선택 화면 (실제 `@tosspayments/payment-sdk` 연동을 대신하는, `setTimeout` 지연을 흉내 낸 가짜 PG 위젯).

`components/waitlist-payment-dialog.tsx`(매칭된 대기 신청 결제)는 동일한 `price`/`pay` 단계와 공용 `components/booking-steps.tsx` 단계 표시줄을 재사용하지만, **좌석 선택 단계는 생략**합니다 — 대기열 오퍼는 좌석 단위가 아니라 구역 단위(구역 내 비지정석)이기 때문입니다.

### 대기열 / 취소표 재판매 시스템

`WaitlistEntry.status`는 `WAITING → OFFERED → PURCHASED | EXPIRED | CANCELLED` 순서로 전이됩니다. 오퍼에는 30분 TTL이 있고(`lib/types.ts`의 `WAITLIST_OFFER_TTL_SECONDS`), `lib/api.ts`가 좌석이 풀렸을 때 다음 대기자에게 오퍼를 넘기는 것, 만료된 오퍼 처리, 구매자가 실제 구매를 완료했을 때 같은 공연에 대한 나머지 대기 신청을 취소하는 것까지 처리합니다. 헤더의 알림 벨(`components/site-header.tsx`)은 별도의 알림 저장소 없이 `api.listWaitlist()`에서 `OFFERED` 상태 항목을 바로 읽어옵니다.

### UI 프리미티브는 Radix가 아니라 Base UI

`components/ui/*`는 shadcn 스타일의 래퍼이지만 Radix가 아니라 `@base-ui/react`(Button, Dialog, Menu, Input 등) 위에 만들어져 있습니다. shadcn/Radix 관례를 그대로 가정하기 전에 알아둬야 할 동작 차이 두 가지:
- `Button`(`components/ui/button.tsx`)은 `asChild` prop을 **지원하지 않습니다** — 기존 파일 몇 개(`app/mypage/page.tsx`, `app/seller/mypage/page.tsx`, `app/seller/page.tsx`)가 그럼에도 `asChild`를 넘겨서 `tsc --noEmit`이 실패합니다. 이는 이미 알려진 기존 타입 에러이며, 요청받지 않은 이상 관련 없는 작업의 부수 효과로 "고치지" 마세요.
- `DropdownMenuLabel`(Base UI의 `Menu.GroupLabel`을 감쌈)은 `DropdownMenuGroup`/`DropdownMenuRadioGroup` 안에 중첩되지 않으면 런타임에서 에러를 던집니다. 독립적인 라벨이 필요하면 그냥 일반 텍스트(예: `<p>`)를 사용하세요.

### 테마

`app/globals.css`는 밝은/어두운 테마 토큰을 `oklch()` CSS 변수로 정의하고(Tailwind v4 `@theme inline`), shadcn 기본값 위에 커스텀 `--success`/`--warning` 토큰이 얹혀 있습니다. 색상의 `*-foreground` 변형(예: `--warning-foreground`)은 **불투명한 solid 배경** 위에 올라가는 텍스트용으로 조정된 색입니다 — 이를 단독 강조 텍스트 색으로 쓰거나(또는 `bg-warning/10` 같은 반투명 배경 위에 쓰면) 다크 테마에서 어두운 배경 위에 어두운 텍스트가 되어 거의 안 보이게 됩니다. 인라인 강조 텍스트에는 `components/status-badges.tsx` 전반에 이미 쓰이고 있는 패턴대로 기본 토큰(`text-warning`, `text-success`, `text-primary`)을 사용하세요.
