/**
 * 주문/결제/포인트 도메인 실제 백엔드 연동 클라이언트
 * ------------------------------------------------------------------
 * order-service (기본 http://localhost:8082) 의 주문 생성/결제 승인/취소 + 포인트 잔액/내역 조회 API.
 * 2026-07-28 기준 order-service의 TicketClient가 MockTicketClient에서
 * performance-service(8083) 실호출 TicketApiClient로 교체되어, 주문 생성 시
 * ticketId에 해당하는 실제 좌석 가격이 그대로 반영된다(더 이상 5만원 고정 아님).
 *
 * performance-service에 `GET /api/tickets`(좌석 단위 ticketId 조회)가 추가되어
 * (2026-07-28), 화면에서 고른 좌석을 real ticketId로 매핑할 수 있게 됐다 —
 * `lib/performance-api.ts`의 `performanceApi.tickets()`로 조회 후 이 클라이언트의
 * `createOrder(ticketId)`/`pay(orderId, price)`에 그대로 넘기면 된다. 더 이상
 * 고정된 placeholder ticketId를 쓰지 않는다.
 *
 * 여전히 남은 제약:
 * - cancel-completed 호출 시 결제/환불은 정상 처리되지만, 백엔드
 *   OrderServiceImpl.cancelCompletedOrder()가 좌석 release 이벤트를 발행하지
 *   않아서(cancelPendingOrder에만 있음) 취소해도 ticket이 계속 HOLD로 남는
 *   버그가 있다(2026-07-28 직접 검증).
 */

import { withAuthRetry } from './auth-refresh'

const BASE_URL = process.env.NEXT_PUBLIC_ORDER_API_BASE_URL ?? 'http://localhost:8080'

interface ApiResponse<T> {
  success: boolean
  data: T | null
  code: string | null
  message: string | null
}

export class OrderApiError extends Error {
  code: string | null
  status: number
  constructor(message: string, code: string | null, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

/**
 * 같은 논리적 결제 시도(orderId/paymentId)에 대해 재시도(새로고침, 뒤로가기 재진입, effect 재실행 등)가
 * 일어나도 항상 같은 Idempotency-Key를 보내야 서버가 실제로 중복을 잡아낸다 — 호출마다 새로
 * crypto.randomUUID()를 생성하면 재시도 케이스에서 매번 다른 키가 나가 서버 dedupe가 무력화된다.
 * sessionStorage에 캐싱해 같은 탭 내 재시도는 같은 키를 재사용하고, 새 orderId/paymentId(=새 시도)는
 * 자연히 새 키를 받는다.
 */
function getOrCreateIdempotencyKey(scope: 'pay' | 'confirm', id: number): string {
  if (typeof window === 'undefined') return crypto.randomUUID()
  const storageKey = `orderApi:idempotency:${scope}:${id}`
  const existing = sessionStorage.getItem(storageKey)
  if (existing) return existing
  const key = crypto.randomUUID()
  sessionStorage.setItem(storageKey, key)
  return key
}

async function requestOnce<T>(path: string, init?: RequestInit & { accessToken?: string }): Promise<T> {
  const { accessToken, headers, ...rest } = init ?? {}
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  })
  const body = (await res.json()) as ApiResponse<T>
  if (!res.ok || !body.success) {
    if (res.status === 401) {
      throw new OrderApiError('로그인 정보를 확인하세요.', body.code, res.status)
    }
    throw new OrderApiError(body.message ?? '요청이 실패했습니다.', body.code, res.status)
  }
  return body.data as T
}

// accessToken이 만료돼 401을 받으면 자동으로 한 번 갱신 후 재시도한다(lib/auth-refresh.ts 참고).
async function request<T>(path: string, init?: RequestInit & { accessToken?: string }): Promise<T> {
  return withAuthRetry(
    init?.accessToken,
    (error) => error instanceof OrderApiError && error.status === 401,
    (accessToken) => requestOnce<T>(path, { ...init, accessToken }),
  )
}

export interface CreateOrderResult {
  orderId: number
  orderStatus: string
}

export interface PayResult {
  paymentId: number
  status: string
  orderId: string
  amount: number
  transactionKey: string
  redirectionUrl: string
}

export interface ConfirmResult {
  paymentId: number
  status: string
}

export interface CancelOrderResult {
  orderId: number
  orderStatus: string
}

/** getOrderHistory()가 실제로 내려주는 값(PENDING/PAYMENT_STARTED는 조회 대상에서 제외됨) */
export type OrderHistoryStatus = 'COMPLETED' | 'CANCELLED' | 'EXPIRED'

export interface OrderHistoryItem {
  orderId: number
  orderStatus: OrderHistoryStatus
  performanceName: string
  orderedAt: string
  zone: string
  quantity: number
  totalAmount: number
}

export interface PointBalance {
  userId: number
  balance: number
}

export type PointLogType = 'EARN' | 'USE' | 'CANCELLED' | 'PARTIAL_CANCELLED'

/** amount/balanceAfter는 이미 부호가 반영된 값(EARN/CANCELLED/PARTIAL_CANCELLED는 +, USE는 -) — 별도로 type에 따라 부호를 뒤집지 말 것 */
export interface PointHistoryItem {
  id: number
  transactedAt: string
  type: PointLogType
  amount: number
  balanceAfter: number
}

/** Spring Data Page의 기본 JSON 직렬화 형태 (필요한 필드만) */
export interface PageResult<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  last: boolean
}

export const orderApi = {
  /** GET /api/order — 완료/취소/만료 주문 내역(orderStatus로 구분). 대상 사용자는 accessToken에서 서버가 식별한다(더 이상 userId 쿼리 없음). */
  getOrderHistory(accessToken: string): Promise<OrderHistoryItem[]> {
    return request<OrderHistoryItem[]>('/api/order', { accessToken })
  },

  /** GET /api/points/balance — 현재 포인트 잔액 */
  getPointBalance(accessToken: string): Promise<PointBalance> {
    return request<PointBalance>('/api/points/balance', { accessToken })
  },

  /** GET /api/points?page=&size= — 포인트 내역, 항상 최신순(서버가 정렬 후 페이징) */
  getPointHistory(accessToken: string, page = 0, size = 10): Promise<PageResult<PointHistoryItem>> {
    return request<PageResult<PointHistoryItem>>(`/api/points?page=${page}&size=${size}`, { accessToken })
  },

  /**
   * POST /api/order — ticketId는 performanceApi.tickets()로 조회한 실제 좌석의 ticketId.
   * price/expiredAt/holdKey는 반드시 이 호출 직전에 performanceApi.holdTicket()이 돌려준 값을
   * 그대로 넘겨야 한다(서버가 계산한 hold 정보 없이는 CreateOrderRequest 검증에 실패한다 — 클라이언트가
   * 만료시각을 임의로 조작하지 못하게 하려는 설계). 구매자 신원은 accessToken에서 서버가 식별한다.
   */
  createOrder(ticketId: number, accessToken: string, price: number, expiredAt: string, holdKey: string): Promise<CreateOrderResult> {
    return request<CreateOrderResult>('/api/order', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ ticketId, price, expiredAt, holdKey }),
    })
  },

  /**
   * POST /api/payments/pay — amount는 반드시 주문 생성 시 잡힌 실제 티켓 가격(performanceApi.tickets()의 price)과 일치해야 함.
   * 멱등성 보장을 위해 orderId 기준으로 고정된 UUID v4를 Idempotency-Key 헤더로 실어 보낸다(서버가 prefix를 붙여
   * 최대 300자로 저장) — 같은 orderId로 재시도해도 항상 같은 키가 나가야 서버 dedupe가 실제로 동작한다.
   */
  pay(orderId: number, amount: number, accessToken: string, usedPoint = 0): Promise<PayResult> {
    return request<PayResult>('/api/payments/pay', {
      method: 'POST',
      accessToken,
      headers: { 'Idempotency-Key': getOrCreateIdempotencyKey('pay', orderId) },
      body: JSON.stringify({ orderId, amount, usedPoint }),
    })
  },

  /** POST /api/payments/{paymentId}/confirm — Idempotency-Key 헤더는 pay()와 동일한 규칙(paymentId 기준 고정 UUID v4) */
  confirm(paymentId: number, transactionKey: string, accessToken: string): Promise<ConfirmResult> {
    return request<ConfirmResult>(`/api/payments/${paymentId}/confirm`, {
      method: 'POST',
      accessToken,
      headers: { 'Idempotency-Key': getOrCreateIdempotencyKey('confirm', paymentId) },
      body: JSON.stringify({ transactionKey }),
    })
  },

  /** POST /api/order/{orderId}/cancel-pending — 결제 전 주문 취소 */
  cancelPending(orderId: number, accessToken: string): Promise<CancelOrderResult> {
    return request<CancelOrderResult>(`/api/order/${orderId}/cancel-pending`, {
      method: 'POST',
      accessToken,
    })
  },

  /**
   * POST /api/order/{orderId}/cancel-completed — 결제 완료 후 주문 취소(환불 포함)
   * 백엔드가 아직 이 경로에서 좌석 release를 안 하는 버그가 있음(파일 상단 주석 참고).
   */
  cancelCompleted(orderId: number, accessToken: string, reason?: string): Promise<CancelOrderResult> {
    return request<CancelOrderResult>(`/api/order/${orderId}/cancel-completed`, {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ reason: reason ?? '고객변심' }),
    })
  },
}
