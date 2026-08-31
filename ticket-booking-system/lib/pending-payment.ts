import type { Zone } from '@/lib/types'

/**
 * 토스 결제창은 페이지를 완전히 이탈시키므로(성공 시 successUrl로 리다이렉트),
 * booking-dialog의 로컬 상태(선택 좌석/포인트 등)는 리다이렉트 이후 사라진다.
 * mock 포인트 장부(createOrder) 기록에 필요한 최소 정보만 paymentId 기준으로
 * sessionStorage에 남겨뒀다가, /payment/success에서 소비한다.
 */
export interface PendingPaymentLedger {
  buyerId: string
  performanceId: string
  sessionId: string
  selections: { zone: Zone; quantity: number }[]
  selectedSeats?: { zone: Zone; seatLabels: string[] }[]
  method?: string
  pointsUsed?: number
  fromWaitlist?: boolean
}

function key(paymentId: number) {
  return `reseat:pending-payment:${paymentId}`
}

export function writePendingPaymentLedger(paymentId: number, ledger: PendingPaymentLedger) {
  try {
    sessionStorage.setItem(key(paymentId), JSON.stringify(ledger))
  } catch {
    // sessionStorage 접근 불가(프라이빗 모드 등) — mock 포인트 장부만 못 남기고 실 결제엔 영향 없음
  }
}

export function readPendingPaymentLedger(paymentId: number): PendingPaymentLedger | null {
  try {
    const raw = sessionStorage.getItem(key(paymentId))
    return raw ? (JSON.parse(raw) as PendingPaymentLedger) : null
  } catch {
    return null
  }
}

export function clearPendingPaymentLedger(paymentId: number) {
  try {
    sessionStorage.removeItem(key(paymentId))
  } catch {
    // no-op
  }
}
