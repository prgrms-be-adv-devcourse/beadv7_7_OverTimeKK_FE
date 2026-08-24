import type { Performance, PerformanceStatus, Zone } from './types'

/** 서비스 기준 "현재 시각". */
export const NOW = new Date()

export function now(): Date {
  return new Date()
}

/** 'yyyy-MM-dd HH:mm:ss' 또는 ISO 문자열을 Date 로 파싱 */
export function parseDateTime(value: string): Date {
  if (value.includes('T')) return new Date(value)
  return new Date(value.replace(' ', 'T'))
}

export function formatKRW(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

export function formatDateTime(value: string): string {
  const d = parseDateTime(value)
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDate(value: string): string {
  const d = parseDateTime(value)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDay(value: string): string {
  const d = parseDateTime(value)
  return d.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

export function formatTime(value: string): string {
  const d = parseDateTime(value)
  return d.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * 실 공연은 병합 시 status가 'ON_SALE'로 고정되고(취소 시에만 'CANCELLED'로 바뀜) 이후
 * 갱신되지 않아, 티켓 오픈 전/공연 기간 종료 후에도 계속 "예매중"으로 보인다 — 화면 표시용
 * 상태는 날짜 기준으로 다시 계산한다. 판매자가 명시적으로 취소한 상태(CANCELLED)는 그대로 우선한다.
 */
export function effectivePerformanceStatus(performance: Performance): PerformanceStatus {
  if (performance.status === 'CANCELLED') return 'CANCELLED'
  if (NOW.getTime() < parseDateTime(performance.ticketOpenAt).getTime()) return 'DRAFT'
  const endOfSaleDay = parseDateTime(performance.endDate)
  endOfSaleDay.setHours(23, 59, 59, 999)
  if (NOW.getTime() > endOfSaleDay.getTime()) return 'ENDED'
  return performance.status
}

export const ZONE_META: Record<Zone, { label: string; badgeClass: string }> = {
  VIP: { label: 'VIP석', badgeClass: 'bg-primary/15 text-primary border-primary/30' },
  R: { label: 'R석', badgeClass: 'bg-success/15 text-success border-success/30' },
  S: { label: 'S석', badgeClass: 'bg-warning/20 text-warning-foreground border-warning/40' },
  A: { label: 'A석', badgeClass: 'bg-muted text-muted-foreground border-border' },
}

export function canWaitlistZone(performance: Performance, zone: Zone): boolean {
  if (performance.id === 'p_1000') {
    return zone === 'VIP' || zone === 'S'
  }
  return true
}

export function getWaitlistEligibleZones(performance: Performance, zones: Zone[]): Zone[] {
  return zones.filter((zone) => canWaitlistZone(performance, zone))
}

/**
 * 취소 환불 정책 (관람일 기준 잔여 일수)
 *  - 10일 전 이상: 100% 환불 (수수료 0%)
 *  - 7~9일 전: 90% 환불 (10%)
 *  - 4~6일 전: 80% 환불 (20%)
 *  - 1~3일 전: 70% 환불 (30%)
 *  - 관람 당일/이후: 취소 불가
 */
export interface RefundPolicy {
  refundable: boolean
  rate: number
  feeRate: number
  label: string
}

export function refundPolicyForDaysBefore(daysBefore: number): RefundPolicy {
  if (daysBefore < 0) {
    return { refundable: false, rate: 0, feeRate: 1, label: '공연 시작 후 취소 불가' }
  }
  if (daysBefore >= 10) return { refundable: true, rate: 1, feeRate: 0, label: '관람일 10일 전 · 전액 환불' }
  if (daysBefore >= 7) return { refundable: true, rate: 0.9, feeRate: 0.1, label: '관람일 7~9일 전 · 90% 환불' }
  if (daysBefore >= 4) return { refundable: true, rate: 0.8, feeRate: 0.2, label: '관람일 4~6일 전 · 80% 환불' }
  if (daysBefore >= 1) return { refundable: true, rate: 0.7, feeRate: 0.3, label: '관람일 1~3일 전 · 70% 환불' }
  return { refundable: false, rate: 0, feeRate: 1, label: '관람 당일 · 취소 불가' }
}

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function computeRefund(totalAmount: number, performanceStartAt: string, at: Date = NOW): {
  policy: RefundPolicy
  refundAmount: number
  feeAmount: number
} {
  const start = parseDateTime(performanceStartAt)
  const daysBefore = daysBetween(at, start)
  const policy = refundPolicyForDaysBefore(daysBefore)
  const refundAmount = Math.round(totalAmount * policy.rate)
  return { policy, refundAmount, feeAmount: totalAmount - refundAmount }
}
