/**
 * 도메인 타입 정의
 * ------------------------------------------------------------------
 * Spring Boot + JPA 백엔드의 엔티티/DTO 계약을 기준으로 작성되었습니다.
 * 프론트엔드는 이 타입을 그대로 사용하며, 추후 실제 API 응답으로 교체됩니다.
 * 날짜/시간 문자열은 백엔드 포맷(yyyy-MM-dd HH:mm:ss 또는 ISO)을 따릅니다.
 */

export type UserRole = 'BUYER' | 'SELLER'

/** 좌석 구역. 판매자는 VIP, R, S, A 중 최대 4개까지 사용 가능 */
export type Zone = 'VIP' | 'R' | 'S' | 'A'

export const ZONES: Zone[] = ['VIP', 'R', 'S', 'A']

export interface User {
  id: string
  name: string
  email: string
  /** SELLER 는 구매도 가능 */
  role: UserRole
  points: number
}

export interface Hall {
  id: string
  name: string
  location: string
  /** 구역별 총 좌석 수 */
  capacity: Record<Zone, number>
}

export type PerformanceStatus =
  | 'DRAFT' // 등록됨, 티켓 오픈 전 (수정/삭제 가능)
  | 'ON_SALE' // 티켓 오픈됨 (수정/삭제 불가)
  | 'SOLD_OUT' // 전량 판매
  | 'ENDED' // 공연 종료
  | 'CANCELLED' // 판매자 취소 (전액 환불)

export interface Performance {
  id: string
  sellerId: string
  title: string
  description: string
  /** 러닝타임(분) */
  runtime: number
  /** 공연 기간 시작일 yyyy-MM-dd */
  startDate: string
  /** 공연 기간 종료일 yyyy-MM-dd */
  endDate: string
  /** 티켓 오픈 시각 yyyy-MM-dd HH:mm:ss */
  ticketOpenAt: string
  hallId: string
  posterUrl: string
  category: string
  status: PerformanceStatus
}

export interface PerformanceSession {
  id: string
  performanceId: string
  /** 회차 번호 */
  sessionNum: number
  /** 출연진 */
  actor: string
  /** 공연 시작 시각 yyyy-MM-dd HH:mm:ss */
  performanceStartAt: string
}

export interface ZonePrice {
  id: string
  performanceId: string
  zone: Zone
  price: number
}

/** 회차 x 구역 별 좌석 재고 (판매 현황) */
export interface SeatInventory {
  sessionId: string
  zone: Zone
  total: number
  sold: number
}

export type OrderStatus =
  | 'PAID' // 결제 완료 (발권됨)
  | 'CANCEL_REQUESTED' // 취소 요청됨
  | 'CANCELLED' // 취소/환불 완료
  | 'REFUNDED' // 판매자 취소로 전액 환불

export interface OrderItem {
  zone: Zone
  quantity: number
  unitPrice: number
  seatLabels: string[]
}

export interface Order {
  id: string
  buyerId: string
  performanceId: string
  sessionId: string
  items: OrderItem[]
  totalAmount: number
  /** 취소 시 실제 환불된 금액 */
  refundedAmount?: number
  status: OrderStatus
  /** 대기열을 통한 우선예매 주문 여부 */
  fromWaitlist: boolean
  createdAt: string
}

export type PaymentStatus = 'APPROVED' | 'CANCELLED' | 'PARTIAL_CANCELLED'

export interface Payment {
  id: string
  orderId: string
  amount: number
  method: string
  status: PaymentStatus
  /** 토스 PG 거래 키 (시뮬레이션) */
  pgTransactionKey: string
  approvedAt: string
}

export type WaitlistStatus =
  | 'WAITING' // 대기 중
  | 'OFFERED' // 우선 예매 권한 부여됨 (제한시간 내 결제 필요)
  | 'PURCHASED' // 구매 완료
  | 'EXPIRED' // 제한시간 초과로 다음 대기자에게 이전됨
  | 'CANCELLED' // 대기 취소

export interface WaitlistEntry {
  id: string
  buyerId: string
  performanceId: string
  sessionId: string
  /** 신청한 구역 (최대 3개) */
  zones: Zone[]
  /** 대기 순번 (1부터). OFFERED/이후 상태에서는 0 */
  position: number
  status: WaitlistStatus
  createdAt: string
  /** 우선예매 권한 부여 시각 */
  offeredAt?: string
  /** 결제 마감 시각 (ISO). 초과 시 다음 대기자에게 이전 */
  offerExpiresAt?: string
  /** 실제로 배정된 구역 (취소표가 나온 구역) */
  offeredZone?: Zone
}

export type SettlementStatus = 'SCHEDULED' | 'COMPLETED'

export interface Settlement {
  id: string
  sellerId: string
  performanceId: string
  /** 정산 대상 월 yyyy-MM */
  period: string
  /** 총 판매액 */
  grossAmount: number
  /** 플랫폼 수수료 */
  platformFee: number
  /** 실 정산액 */
  netAmount: number
  status: SettlementStatus
  /** 정산 예정일/완료일 yyyy-MM-dd (매월 15일) */
  settledAt: string
}

export type PointType = 'EARN' | 'USE'

export interface PointTransaction {
  id: string
  userId: string
  type: PointType
  amount: number
  reason: string
  createdAt: string
}

/** 플랫폼 수수료율 (정산 시 차감) */
export const PLATFORM_FEE_RATE = 0.05
/** 공연 종료 다음 날 구매자에게 지급되는 포인트 적립률 */
export const POINT_EARN_RATE = 0.01
/** 우선 예매 권한 결제 제한 시간(초) — 취소표 배정 후 30분 내 결제 필요 */
export const WAITLIST_OFFER_TTL_SECONDS = 1800
