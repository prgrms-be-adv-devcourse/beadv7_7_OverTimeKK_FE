/**
 * API 클라이언트
 * ------------------------------------------------------------------
 * 현재는 브라우저 메모리 상의 Mock DB 를 조작합니다.
 * 각 함수의 주석은 대응되는 Spring Boot REST 엔드포인트를 나타냅니다.
 * 실제 연동 시 각 함수 본문을 `fetch(...)` 호출로 교체하면 됩니다.
 */

import {
  seedHalls,
  seedInventory,
  seedOrders,
  seedPayments,
  seedPerformances,
  seedPoints,
  seedSessions,
  seedSettlements,
  seedUsers,
  seedWaitlist,
  seedZonePrices,
  seatLabelFor,
} from './mock-data'
import { computeRefund, NOW, parseDateTime } from './domain'
import {
  PLATFORM_FEE_RATE,
  WAITLIST_OFFER_TTL_SECONDS,
  type Hall,
  type Order,
  type Payment,
  type Performance,
  type PerformanceSession,
  type PointTransaction,
  type SeatInventory,
  type Settlement,
  type User,
  type WaitlistEntry,
  type Zone,
  type ZonePrice,
} from './types'

function clone<T>(v: T): T {
  return structuredClone(v)
}

let counter = 1000
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}_${counter}`
}

// ------------------------------------------------------------------
// 인메모리 DB (mutable)
// ------------------------------------------------------------------
const db = {
  users: clone(seedUsers) as User[],
  halls: clone(seedHalls) as Hall[],
  performances: clone(seedPerformances) as Performance[],
  sessions: clone(seedSessions) as PerformanceSession[],
  zonePrices: clone(seedZonePrices) as ZonePrice[],
  inventory: clone(seedInventory) as SeatInventory[],
  orders: clone(seedOrders) as Order[],
  payments: clone(seedPayments) as Payment[],
  waitlist: clone(seedWaitlist) as WaitlistEntry[],
  points: clone(seedPoints) as PointTransaction[],
  settlements: clone(seedSettlements) as Settlement[],
}

export type DbSnapshot = typeof db

/** 전체 상태 스냅샷 (React 스토어 동기화용) */
export function snapshot(): DbSnapshot {
  return clone(db)
}

function ticketOpened(p: Performance): boolean {
  return parseDateTime(p.ticketOpenAt).getTime() <= NOW.getTime()
}

/** 편의: 회차의 특정 구역 잔여석 */
function availableSeats(sessionId: string, zone: Zone): number {
  const inv = db.inventory.find((i) => i.sessionId === sessionId && i.zone === zone)
  if (!inv) return 0
  return inv.total - inv.sold
}

// ------------------------------------------------------------------
// 조회
// ------------------------------------------------------------------

export const api = {
  // GET /api/users/{id}
  getUser(id: string): User | undefined {
    return clone(db.users.find((u) => u.id === id))
  },

  // GET /api/halls
  listHalls(): Hall[] {
    return clone(db.halls)
  },

  // GET /api/performances
  listPerformances(): Performance[] {
    return clone(db.performances)
  },

  // GET /api/performances/{id}
  getPerformance(id: string): Performance | undefined {
    return clone(db.performances.find((p) => p.id === id))
  },

  // GET /api/performances/{id}/sessions
  listSessions(performanceId: string): PerformanceSession[] {
    return clone(
      db.sessions
        .filter((s) => s.performanceId === performanceId)
        .sort((a, b) => a.sessionNum - b.sessionNum),
    )
  },

  // GET /api/performances/{id}/prices
  listZonePrices(performanceId: string): ZonePrice[] {
    return clone(db.zonePrices.filter((z) => z.performanceId === performanceId))
  },

  // GET /api/sessions/{id}/inventory
  listInventory(sessionId: string): SeatInventory[] {
    return clone(db.inventory.filter((i) => i.sessionId === sessionId))
  },

  // GET /api/performances/{id}/sessions/inventory (집계)
  performanceInventory(performanceId: string): SeatInventory[] {
    const sessionIds = db.sessions
      .filter((s) => s.performanceId === performanceId)
      .map((s) => s.id)
    return clone(db.inventory.filter((i) => sessionIds.includes(i.sessionId)))
  },

  // GET /api/buyers/{id}/orders
  listOrders(buyerId: string): Order[] {
    return clone(
      db.orders
        .filter((o) => o.buyerId === buyerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  },

  // GET /api/sellers/{id}/orders
  listSellerOrders(sellerId: string): Order[] {
    const performanceIds = db.performances
      .filter((p) => p.sellerId === sellerId)
      .map((p) => p.id)
    return clone(
      db.orders
        .filter((o) => performanceIds.includes(o.performanceId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  },

  // GET /api/orders/{id}/payment
  getPayment(orderId: string): Payment | undefined {
    return clone(db.payments.find((p) => p.orderId === orderId))
  },

  // GET /api/buyers/{id}/payments
  listPayments(buyerId: string): Payment[] {
    const orderIds = db.orders.filter((o) => o.buyerId === buyerId).map((o) => o.id)
    return clone(db.payments.filter((p) => orderIds.includes(p.orderId)))
  },

  // GET /api/sellers/{id}/payments
  listSellerPayments(sellerId: string): Payment[] {
    const orderIds = this.listSellerOrders(sellerId).map((o) => o.id)
    return clone(db.payments.filter((p) => orderIds.includes(p.orderId)))
  },

  // GET /api/buyers/{id}/waitlist
  listWaitlist(buyerId: string): WaitlistEntry[] {
    return clone(
      db.waitlist
        .filter((w) => w.buyerId === buyerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  },

  // GET /api/sessions/{id}/waitlist (전체 대기열)
  listSessionWaitlist(sessionId: string): WaitlistEntry[] {
    return clone(db.waitlist.filter((w) => w.sessionId === sessionId))
  },

  // GET /api/users/{id}/points
  listPoints(userId: string): PointTransaction[] {
    return clone(
      db.points
        .filter((p) => p.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  },

  // GET /api/sellers/{id}/settlements
  listSettlements(sellerId: string): Settlement[] {
    return clone(
      db.settlements
        .filter((s) => s.sellerId === sellerId)
        .sort((a, b) => b.settledAt.localeCompare(a.settledAt)),
    )
  },

  ticketOpened,
  availableSeats,

  // ----------------------------------------------------------------
  // 판매자 - 공연/회차/좌석가 관리
  // ----------------------------------------------------------------

  // POST /api/performances
  createPerformance(
    input: Omit<Performance, 'id' | 'status'> & { status?: Performance['status'] },
  ): Performance {
    const perf: Performance = {
      ...input,
      id: nextId('p'),
      status: input.status ?? 'DRAFT',
    }
    db.performances.push(perf)
    return clone(perf)
  },

  // PUT /api/performances/{id}
  updatePerformance(id: string, patch: Partial<Performance>): Performance {
    const perf = db.performances.find((p) => p.id === id)
    if (!perf) throw new Error('공연을 찾을 수 없습니다.')
    if (ticketOpened(perf)) throw new Error('티켓 오픈 이후에는 수정할 수 없습니다.')
    Object.assign(perf, patch)
    return clone(perf)
  },

  // DELETE /api/performances/{id}
  deletePerformance(id: string): void {
    const perf = db.performances.find((p) => p.id === id)
    if (!perf) throw new Error('공연을 찾을 수 없습니다.')
    if (ticketOpened(perf)) throw new Error('티켓 오픈 이후에는 삭제할 수 없습니다.')
    db.performances = db.performances.filter((p) => p.id !== id)
    const sessionIds = db.sessions.filter((s) => s.performanceId === id).map((s) => s.id)
    db.sessions = db.sessions.filter((s) => s.performanceId !== id)
    db.zonePrices = db.zonePrices.filter((z) => z.performanceId !== id)
    db.inventory = db.inventory.filter((i) => !sessionIds.includes(i.sessionId))
  },

  // POST /api/performances/{id}/sessions
  createSession(
    performanceId: string,
    input: Omit<PerformanceSession, 'id' | 'performanceId'>,
  ): PerformanceSession {
    const perf = db.performances.find((p) => p.id === performanceId)
    if (perf && ticketOpened(perf)) throw new Error('티켓 오픈 이후에는 회차를 추가할 수 없습니다.')
    const session: PerformanceSession = { ...input, id: nextId('s'), performanceId }
    db.sessions.push(session)
    // 기존 구역 가격에 맞춰 좌석 재고 생성
    const hall = perf ? db.halls.find((h) => h.id === perf.hallId) : undefined
    const prices = db.zonePrices.filter((z) => z.performanceId === performanceId)
    for (const price of prices) {
      db.inventory.push({
        sessionId: session.id,
        zone: price.zone,
        total: hall ? hall.capacity[price.zone] : 100,
        sold: 0,
      })
    }
    return clone(session)
  },

  // DELETE /api/sessions/{id}
  deleteSession(sessionId: string): void {
    const session = db.sessions.find((s) => s.id === sessionId)
    if (!session) return
    const perf = db.performances.find((p) => p.id === session.performanceId)
    if (perf && ticketOpened(perf)) throw new Error('티켓 오픈 이후에는 삭제할 수 없습니다.')
    db.sessions = db.sessions.filter((s) => s.id !== sessionId)
    db.inventory = db.inventory.filter((i) => i.sessionId !== sessionId)
  },

  // PUT /api/performances/{id}/prices
  setZonePrices(performanceId: string, prices: { zone: Zone; price: number }[]): ZonePrice[] {
    const perf = db.performances.find((p) => p.id === performanceId)
    if (perf && ticketOpened(perf)) throw new Error('티켓 오픈 이후에는 좌석 금액을 수정할 수 없습니다.')
    db.zonePrices = db.zonePrices.filter((z) => z.performanceId !== performanceId)
    const created = prices.map((p) => ({
      id: nextId('zp'),
      performanceId,
      zone: p.zone,
      price: p.price,
    }))
    db.zonePrices.push(...created)
    return clone(created)
  },

  // ----------------------------------------------------------------
  // 구매자 - 예매 / 결제 / 취소
  // ----------------------------------------------------------------

  // POST /api/orders  (토스 PG 결제 승인 포함)
  createOrder(input: {
    buyerId: string
    performanceId: string
    sessionId: string
    selections: { zone: Zone; quantity: number }[]
    selectedSeats?: { zone: Zone; seatLabels: string[] }[]
    method?: string
    fromWaitlist?: boolean
  }): { order: Order; payment: Payment } {
    const prices = db.zonePrices.filter((z) => z.performanceId === input.performanceId)
    const seatSelections = (input.selectedSeats ?? input.selections.map((s) => ({
      zone: s.zone,
      seatLabels: Array.from({ length: s.quantity }, (_, idx) => seatLabelFor(s.zone, idx + 1)),
    }))).filter((s) => s.seatLabels.length > 0)

    const items = seatSelections.map((s) => {
      const price = prices.find((p) => p.zone === s.zone)
      if (!price) throw new Error('좌석 금액 정보가 없습니다.')
      const inv = db.inventory.find((i) => i.sessionId === input.sessionId && i.zone === s.zone)
      if (!inv || inv.total - inv.sold < s.seatLabels.length) {
        throw new Error('잔여 좌석이 부족합니다.')
      }
      const seatLabels: string[] = []
      for (let k = 0; k < s.seatLabels.length; k++) {
        inv.sold += 1
        seatLabels.push(s.seatLabels[k])
      }
      return { zone: s.zone, quantity: s.seatLabels.length, unitPrice: price.price, seatLabels }
    })
    if (items.length === 0) throw new Error('선택된 좌석이 없습니다.')

    const totalAmount = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0)
    const order: Order = {
      id: nextId('o'),
      buyerId: input.buyerId,
      performanceId: input.performanceId,
      sessionId: input.sessionId,
      items,
      totalAmount,
      status: 'PAID',
      fromWaitlist: input.fromWaitlist ?? false,
      createdAt: formatNow(),
    }
    db.orders.push(order)

    const payment: Payment = {
      id: nextId('pay'),
      orderId: order.id,
      amount: totalAmount,
      method: input.method ?? '토스페이',
      status: 'APPROVED',
      pgTransactionKey: `toss_${Math.random().toString(16).slice(2, 12)}`,
      approvedAt: formatNow(),
    }
    db.payments.push(payment)

    // 매진 여부 갱신
    refreshSoldOut(input.performanceId)

    return { order: clone(order), payment: clone(payment) }
  },

  // POST /api/orders/{id}/cancel  (환불 정책 적용)
  cancelOrder(orderId: string): { order: Order; refundAmount: number } {
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) throw new Error('주문을 찾을 수 없습니다.')
    if (order.status !== 'PAID') throw new Error('취소할 수 없는 주문입니다.')
    const session = db.sessions.find((s) => s.id === order.sessionId)
    if (!session) throw new Error('회차 정보를 찾을 수 없습니다.')
    if (parseDateTime(session.performanceStartAt).getTime() <= NOW.getTime()) {
      throw new Error('이미 시작한 공연은 취소할 수 없습니다.')
    }

    const { refundAmount } = computeRefund(order.totalAmount, session.performanceStartAt)
    order.status = 'CANCELLED'
    order.refundedAmount = refundAmount

    // 결제 취소 처리
    const payment = db.payments.find((p) => p.orderId === orderId)
    if (payment) {
      payment.status = refundAmount === order.totalAmount ? 'CANCELLED' : 'PARTIAL_CANCELLED'
    }

    // 좌석 재고 반환 + 대기열에 취소표 알림
    for (const item of order.items) {
      const inv = db.inventory.find((i) => i.sessionId === order.sessionId && i.zone === item.zone)
      if (inv) inv.sold = Math.max(0, inv.sold - item.quantity)
      for (let k = 0; k < item.quantity; k++) {
        offerToNextWaiter(order.sessionId, item.zone)
      }
    }
    refreshSoldOut(order.performanceId)

    return { order: clone(order), refundAmount }
  },

  // POST /api/orders/{id}/request-cancel  (취소 요청만 생성)
  requestCancelOrder(orderId: string): { order: Order } {
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) throw new Error('주문을 찾을 수 없습니다.')
    if (order.status !== 'PAID') throw new Error('취소 요청을 보낼 수 없는 주문입니다.')
    const session = db.sessions.find((s) => s.id === order.sessionId)
    if (!session) throw new Error('회차 정보를 찾을 수 없습니다.')
    if (parseDateTime(session.performanceStartAt).getTime() <= NOW.getTime()) {
      throw new Error('이미 시작한 공연은 취소 요청을 보낼 수 없습니다.')
    }

    order.status = 'CANCEL_REQUESTED'
    return { order: clone(order) }
  },

  // POST /api/performances/{id}/cancel  (판매자 취소 → 전액 환불)
  sellerCancelPerformance(performanceId: string): { refundedOrders: number } {
    const perf = db.performances.find((p) => p.id === performanceId)
    if (!perf) throw new Error('공연을 찾을 수 없습니다.')
    perf.status = 'CANCELLED'
    const sessionIds = db.sessions.filter((s) => s.performanceId === performanceId).map((s) => s.id)
    let refundedOrders = 0
    for (const order of db.orders) {
      if (sessionIds.includes(order.sessionId) && order.status === 'PAID') {
        order.status = 'REFUNDED'
        order.refundedAmount = order.totalAmount
        const payment = db.payments.find((p) => p.orderId === order.id)
        if (payment) payment.status = 'CANCELLED'
        refundedOrders += 1
      }
    }
    // 대기열 전체 취소
    for (const w of db.waitlist) {
      if (sessionIds.includes(w.sessionId) && (w.status === 'WAITING' || w.status === 'OFFERED')) {
        w.status = 'CANCELLED'
      }
    }
    return { refundedOrders }
  },

  // ----------------------------------------------------------------
  // 취소표 대기열
  // ----------------------------------------------------------------

  // POST /api/sessions/{id}/waitlist
  joinWaitlist(input: {
    buyerId: string
    performanceId: string
    sessionId: string
    zones: Zone[]
  }): WaitlistEntry {
    if (input.zones.length === 0 || input.zones.length > 3) {
      throw new Error('대기 구역은 1~3개까지 선택할 수 있습니다.')
    }
    const exists = db.waitlist.find(
      (w) =>
        w.buyerId === input.buyerId &&
        w.sessionId === input.sessionId &&
        (w.status === 'WAITING' || w.status === 'OFFERED'),
    )
    if (exists) throw new Error('이미 해당 회차에 대기 중입니다.')

    const maxPos = db.waitlist
      .filter((w) => w.sessionId === input.sessionId && w.status === 'WAITING')
      .reduce((m, w) => Math.max(m, w.position), 0)

    const entry: WaitlistEntry = {
      id: nextId('w'),
      buyerId: input.buyerId,
      performanceId: input.performanceId,
      sessionId: input.sessionId,
      zones: input.zones,
      position: maxPos + 1,
      status: 'WAITING',
      createdAt: formatNow(),
    }
    db.waitlist.push(entry)
    return clone(entry)
  },

  // DELETE /api/waitlist/{id}
  cancelWaitlist(entryId: string): void {
    const entry = db.waitlist.find((w) => w.id === entryId)
    if (!entry) return
    entry.status = 'CANCELLED'
    entry.position = 0
    recomputePositions(entry.sessionId)
  },

  cancelWaitlistZone(entryId: string, zone: Zone): WaitlistEntry {
    const entry = db.waitlist.find((w) => w.id === entryId)
    if (!entry) throw new Error('대기 정보를 찾을 수 없습니다.')
    if (entry.status !== 'WAITING') throw new Error('대기 중인 신청만 구역별로 취소할 수 있습니다.')
    entry.zones = entry.zones.filter((z) => z !== zone)
    if (entry.zones.length === 0) {
      entry.status = 'CANCELLED'
      entry.position = 0
    } else {
      recomputePositions(entry.sessionId)
    }
    return clone(entry)
  },

  // POST /api/admin/sessions/{id}/simulate-cancel  (데모: 취소표 1장 발생)
  simulateCancellation(sessionId: string, zone: Zone): WaitlistEntry | null {
    const offered = offerToNextWaiter(sessionId, zone)
    return offered ? clone(offered) : null
  },

  // POST /api/waitlist/{id}/accept  (우선예매 결제 → 발권)
  acceptWaitlistOffer(entryId: string, method?: string): { order: Order; payment: Payment } {
    const entry = db.waitlist.find((w) => w.id === entryId)
    if (!entry) throw new Error('대기 정보를 찾을 수 없습니다.')
    if (entry.status !== 'OFFERED') throw new Error('예매 가능한 상태가 아닙니다.')
    if (entry.offerExpiresAt && new Date(entry.offerExpiresAt).getTime() < Date.now()) {
      throw new Error('결제 제한 시간이 지났습니다.')
    }
    const zone = entry.offeredZone!
    const result = this.createOrder({
      buyerId: entry.buyerId,
      performanceId: entry.performanceId,
      sessionId: entry.sessionId,
      selections: [{ zone, quantity: 1 }],
      method,
      fromWaitlist: true,
    })
    entry.status = 'PURCHASED'
    entry.position = 0
    // 같은 구역을 기다리던 다른 대기자는 취소표가 소진되었으므로 대기 종료
    db.waitlist
      .filter((w) => w.id !== entry.id && w.sessionId === entry.sessionId && w.status === 'WAITING' && w.zones.includes(zone))
      .forEach((w) => {
        w.status = 'EXPIRED'
        w.position = 0
      })
    // 결제 성공 → 이 구매자가 해당 공연에 점유하던 다른 대기 신청은 모두 취소
    db.waitlist
      .filter(
        (w) =>
          w.id !== entry.id &&
          w.buyerId === entry.buyerId &&
          w.performanceId === entry.performanceId &&
          (w.status === 'WAITING' || w.status === 'OFFERED'),
      )
      .forEach((w) => {
        w.status = 'CANCELLED'
        w.position = 0
      })
    recomputePositions(entry.sessionId)
    return result
  },

  // POST /api/waitlist/{id}/cancel-offer  (우선예매 결제 취소 → 대기열 취소, 취소표는 다음 대기자에게)
  cancelWaitlistOffer(entryId: string): WaitlistEntry | null {
    const entry = db.waitlist.find((w) => w.id === entryId)
    if (!entry) throw new Error('대기 정보를 찾을 수 없습니다.')
    if (entry.status !== 'OFFERED') throw new Error('예매 대기 상태가 아닙니다.')
    const zone = entry.offeredZone!
    entry.status = 'CANCELLED'
    entry.position = 0
    // 배정됐던 취소표는 다음 대기자에게 이전
    const next = offerToNextWaiter(entry.sessionId, zone)
    recomputePositions(entry.sessionId)
    return next ? clone(next) : null
  },

  // POST /api/waitlist/{id}/decline  (또는 시간 초과 → 다음 대기자에게 이전)
  declineWaitlistOffer(entryId: string): WaitlistEntry | null {
    const entry = db.waitlist.find((w) => w.id === entryId)
    if (!entry) return null
    if (entry.status !== 'OFFERED') return null
    const zone = entry.offeredZone!
    entry.status = 'EXPIRED'
    const next = offerToNextWaiter(entry.sessionId, zone)
    recomputePositions(entry.sessionId)
    return next ? clone(next) : null
  },

  // 공연 종료 익일 포인트 적립 배치 (데모용 트리거)
  // POST /api/batch/reward-points
  runPointReward(): number {
    let count = 0
    for (const perf of db.performances) {
      if (perf.status !== 'ENDED') continue
      const sessionIds = db.sessions.filter((s) => s.performanceId === perf.id).map((s) => s.id)
      for (const order of db.orders) {
        if (!sessionIds.includes(order.sessionId) || order.status !== 'PAID') continue
        const alreadyRewarded = db.points.some(
          (p) => p.reason.includes(order.id),
        )
        if (alreadyRewarded) continue
        const reward = Math.round(order.totalAmount * 0.01)
        db.points.push({
          id: nextId('pt'),
          userId: order.buyerId,
          type: 'EARN',
          amount: reward,
          reason: `공연 관람 적립 (${perf.title}) #${order.id}`,
          createdAt: formatNow(),
        })
        const user = db.users.find((u) => u.id === order.buyerId)
        if (user) user.points += reward
        count += 1
      }
    }
    return count
  },
}

// ------------------------------------------------------------------
// 내부 헬퍼
// ------------------------------------------------------------------

function formatNow(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function refreshSoldOut(performanceId: string): void {
  const perf = db.performances.find((p) => p.id === performanceId)
  if (!perf || perf.status === 'CANCELLED' || perf.status === 'ENDED' || perf.status === 'DRAFT') return
  const sessionIds = db.sessions.filter((s) => s.performanceId === performanceId).map((s) => s.id)
  const invs = db.inventory.filter((i) => sessionIds.includes(i.sessionId))
  const allSold = invs.length > 0 && invs.every((i) => i.sold >= i.total)
  perf.status = allSold ? 'SOLD_OUT' : 'ON_SALE'
}

/** 취소표가 나온 구역에 대해 다음 대기자에게 우선 예매권 부여 */
function offerToNextWaiter(sessionId: string, zone: Zone): WaitlistEntry | null {
  const candidates = db.waitlist
    .filter((w) => w.sessionId === sessionId && w.status === 'WAITING' && w.zones.includes(zone))
    .sort((a, b) => a.position - b.position)
  const next = candidates[0]
  if (!next) return null
  next.status = 'OFFERED'
  next.offeredZone = zone
  next.position = 0
  next.offeredAt = formatNow()
  next.offerExpiresAt = new Date(Date.now() + WAITLIST_OFFER_TTL_SECONDS * 1000).toISOString()
  recomputePositions(sessionId)
  return next
}

/** WAITING 상태 대기자 순번 재계산 */
function recomputePositions(sessionId: string): void {
  const waiting = db.waitlist
    .filter((w) => w.sessionId === sessionId && w.status === 'WAITING')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  waiting.forEach((w, idx) => {
    w.position = idx + 1
  })
}

export { PLATFORM_FEE_RATE }
