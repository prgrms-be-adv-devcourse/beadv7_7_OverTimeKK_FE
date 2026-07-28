/**
 * 주문/결제 도메인 실제 백엔드 연동 클라이언트
 * ------------------------------------------------------------------
 * order-service (기본 http://localhost:8082) 의 주문 생성/결제 승인/취소 API.
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

const BASE_URL = process.env.NEXT_PUBLIC_ORDER_API_BASE_URL ?? 'http://localhost:8082'

/** 실제 인증이 아직 없어 주문 생성에 쓸 숫자 사용자 ID. lib/standby-api.ts STANDBY_USER_ID와 같은 임시방편 */
export const ORDER_USER_ID = 1

/** POST /api/order의 orderType — 일반 예매 흐름에서는 항상 GENERAL, 대기열 매칭 구매는 STANDBY */
export type OrderType = 'GENERAL' | 'STANDBY'

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = (await res.json()) as ApiResponse<T>
  if (!res.ok || !body.success) {
    throw new OrderApiError(body.message ?? '요청이 실패했습니다.', body.code, res.status)
  }
  return body.data as T
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

export interface OrderHistoryItem {
  orderId: number
  performanceName: string
  orderedAt: string
  zone: string
  quantity: number
  totalAmount: number
}

export const orderApi = {
  /** GET /api/order?userId= — 결제 완료된 주문 내역 */
  getOrderHistory(userId: number = ORDER_USER_ID): Promise<OrderHistoryItem[]> {
    return request<OrderHistoryItem[]>(`/api/order?userId=${userId}`)
  },

  /** POST /api/order — ticketId는 performanceApi.tickets()로 조회한 실제 좌석의 ticketId */
  createOrder(ticketId: number, orderType: OrderType = 'GENERAL'): Promise<CreateOrderResult> {
    return request<CreateOrderResult>('/api/order', {
      method: 'POST',
      body: JSON.stringify({ userId: ORDER_USER_ID, ticketId, orderType }),
    })
  },

  /** POST /api/payments/pay — amount는 반드시 주문 생성 시 잡힌 실제 티켓 가격(performanceApi.tickets()의 price)과 일치해야 함 */
  pay(orderId: number, amount: number, usedPoint = 0): Promise<PayResult> {
    return request<PayResult>('/api/payments/pay', {
      method: 'POST',
      body: JSON.stringify({ orderId, amount, usedPoint }),
    })
  },

  /** POST /api/payments/{paymentId}/confirm */
  confirm(paymentId: number, transactionKey: string): Promise<ConfirmResult> {
    return request<ConfirmResult>(`/api/payments/${paymentId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ transactionKey }),
    })
  },

  /** POST /api/order/{orderId}/cancel-pending — 결제 전 주문 취소 */
  cancelPending(orderId: number): Promise<CancelOrderResult> {
    return request<CancelOrderResult>(`/api/order/${orderId}/cancel-pending`, {
      method: 'POST',
    })
  },

  /**
   * POST /api/order/{orderId}/cancel-completed — 결제 완료 후 주문 취소(환불 포함)
   * 백엔드가 아직 이 경로에서 좌석 release를 안 하는 버그가 있음(파일 상단 주석 참고).
   */
  cancelCompleted(orderId: number, reason?: string): Promise<CancelOrderResult> {
    return request<CancelOrderResult>(`/api/order/${orderId}/cancel-completed`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },
}
