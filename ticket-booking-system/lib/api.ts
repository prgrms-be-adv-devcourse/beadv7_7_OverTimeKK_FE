/**
 * API 클라이언트
 * ------------------------------------------------------------------
 * 현재는 브라우저 메모리 상의 Mock DB 를 조작합니다.
 * 각 함수의 주석은 대응되는 Spring Boot REST 엔드포인트를 나타냅니다.
 * 실제 연동 시 각 함수 본문을 `fetch(...)` 호출로 교체하면 됩니다.
 */

import { seedHalls, seatLabelFor } from './mock-data'
import { computeRefund, NOW, parseDateTime } from './domain'
import { getPerformanceExtras } from './performance-extras'
import type { RealPerformance, RealSession } from './performance-api'
import {
  ZONES,
  type Hall,
  type Order,
  type Payment,
  type Performance,
  type PerformanceSession,
  type PointTransaction,
  type SeatInventory,
  type User,
  type Zone,
  type ZonePrice,
} from './types'

function clone<T>(v: T): T {
  return structuredClone(v)
}

/**
 * 실 공연 병합 시 채워넣는 placeholder — GET /api/performances/detail* 응답엔 여전히
 * sellerId가 없다. app/seller/page.tsx는 실 공연(숫자 id) 소유권을 이 값이 아니라
 * GET /api/performances/seller(performanceApi.sellerPerformances())로 따로 조회해 거른다.
 */
const UNKNOWN_SELLER_ID = 'unknown-seller'

// 시드 데이터의 ID(o_1001, pay_1001 등)와 충돌하지 않도록 충분히 높은 값에서 시작
let counter = 100000
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}_${counter}`
}

// ------------------------------------------------------------------
// 인메모리 DB (mutable)
// ------------------------------------------------------------------
const db = {
  // 사용자/주문/결제/포인트/정산은 더 이상 mock 시드가 없다 — 실 로그인 사용자가 처음
  // 활동할 때 ensureMockUser()가 그때그때 만든다(포인트 0부터 시작, 가짜 보너스 없음).
  users: [] as User[],
  halls: clone(seedHalls) as Hall[],
  // 공연/회차/구역가격/재고도 마찬가지로 mock 시드가 없다 — 전부 importRealPerformances()로
  // 앱 시작 시 채워지는 실 공연 데이터 기준으로만 채워진다.
  performances: [] as Performance[],
  sessions: [] as PerformanceSession[],
  zonePrices: [] as ZonePrice[],
  inventory: [] as SeatInventory[],
  orders: [] as Order[],
  payments: [] as Payment[],
  points: [] as PointTransaction[],
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

  /**
   * 실 로그인 사용자가 처음 활동할 때(마이페이지 진입, 결제 등) mock 장부 레코드를 만들어
   * 준다. 이미 있으면 그대로 반환 — 포인트는 0부터 시작한다(가짜 보너스 없음).
   * lib/store.tsx가 authUser 복원/로그인 시 호출한다.
   */
  ensureMockUser(id: string, name: string): User {
    let user = db.users.find((u) => u.id === id)
    if (!user) {
      user = { id, name, email: '', role: 'BUYER', points: 0 }
      db.users.push(user)
    }
    return clone(user)
  },

  // GET /api/halls
  listHalls(): Hall[] {
    return clone(db.halls)
  },

  // GET /api/halls/{id}
  getHall(id: string): Hall | undefined {
    return clone(db.halls.find((h) => h.id === id))
  },

  /**
   * performance-service에서 실제로 받아온 공연+회차를 mock db에 병합한다.
   * 좌석 등급/가격/잔여석/포스터/카테고리는 lib/performance-extras.ts의 정적 데이터로 채운다
   * (백엔드에 조회 API가 없음). 이미 반영된 performanceId는 건너뛴다(중복 호출 안전).
   */
  importRealPerformances(items: { real: RealPerformance; sessions: RealSession[] }[]): void {
    for (const { real, sessions } of items) {
      const id = String(real.performanceId)
      if (db.performances.some((p) => p.id === id)) continue

      const extras = getPerformanceExtras(real.title)

      db.performances.push({
        id,
        // 백엔드 GET /api/performances/detail* 응답에 sellerId가 없어서 실 소유자를 알 수
        // 없다(BE-요청 노트로 별도 정리함) — 이 값은 실 공연 소유권 판단에 쓰지 말 것.
        sellerId: UNKNOWN_SELLER_ID,
        title: real.title,
        description: real.description,
        runtime: real.runtime,
        startDate: real.startDate,
        endDate: real.endDate,
        ticketOpenAt: real.ticketOpenAt,
        // 실 hallId를 그대로 저장(mock hall 매핑 아님) — hall 이름/좌석배치는
        // lib/venue-api.ts(venueApi.hallDirectory(), performanceApi.selectSeatZone())로 조회.
        hallId: String(real.hallId),
        posterUrl: extras.posterUrl,
        status: 'ON_SALE',
      })

      for (const zone of ZONES) {
        const price = extras.zonePrices[zone]
        if (price == null) continue
        db.zonePrices.push({ id: nextId('zp'), performanceId: id, zone, price })
      }

      for (const s of sessions) {
        const sessionId = `${id}-${s.sessionNum}`
        db.sessions.push({
          id: sessionId,
          performanceId: id,
          sessionNum: s.sessionNum,
          actor: s.actor,
          performanceStartAt: s.performanceStartAt,
        })
        for (const zone of ZONES) {
          const price = extras.zonePrices[zone]
          if (price == null) continue
          db.inventory.push({
            sessionId,
            zone,
            // mock 재고 총량은 이제 렌더링에 안 쓰인다(잔여석은 실 티켓 조회로 계산) —
            // 고정값으로만 채워서 다른 mock 로직(있다면)이 깨지지 않게만 유지.
            total: 100,
            sold: 0,
            occupiedSeats: [],
          })
        }
      }
    }
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

  // GET /api/users/{id}/points
  listPoints(userId: string): PointTransaction[] {
    return clone(
      db.points
        .filter((p) => p.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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
        occupiedSeats: [],
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
    pointsUsed?: number
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
        inv.occupiedSeats.push(s.seatLabels[k])
        seatLabels.push(s.seatLabels[k])
      }
      return { zone: s.zone, quantity: s.seatLabels.length, unitPrice: price.price, seatLabels }
    })
    if (items.length === 0) throw new Error('선택된 좌석이 없습니다.')

    const totalAmount = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0)

    const buyer = db.users.find((u) => u.id === input.buyerId)
    const pointsUsed = Math.max(0, Math.min(input.pointsUsed ?? 0, buyer?.points ?? 0, totalAmount))

    const order: Order = {
      id: nextId('o'),
      buyerId: input.buyerId,
      performanceId: input.performanceId,
      sessionId: input.sessionId,
      items,
      totalAmount,
      pointsUsed,
      status: 'PAID',
      fromWaitlist: input.fromWaitlist ?? false,
      createdAt: formatNow(),
    }
    db.orders.push(order)

    const payment: Payment = {
      id: nextId('pay'),
      orderId: order.id,
      amount: totalAmount - pointsUsed,
      method: input.method ?? '토스페이',
      status: 'APPROVED',
      pgTransactionKey: `toss_${Math.random().toString(16).slice(2, 12)}`,
      approvedAt: formatNow(),
    }
    db.payments.push(payment)

    if (pointsUsed > 0 && buyer) {
      buyer.points -= pointsUsed
      db.points.push({
        id: nextId('pt'),
        userId: input.buyerId,
        type: 'USE',
        amount: pointsUsed,
        reason: `티켓 구매 시 포인트 사용 #${order.id}`,
        createdAt: formatNow(),
      })
    }

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

    // 좌석 재고 반환. 취소표 대기열 매칭은 이제 실제 standby 백엔드가 처리한다 (mock에서는 다루지 않음).
    for (const item of order.items) {
      const inv = db.inventory.find((i) => i.sessionId === order.sessionId && i.zone === item.zone)
      if (inv) {
        inv.sold = Math.max(0, inv.sold - item.quantity)
        inv.occupiedSeats = inv.occupiedSeats.filter((label) => !item.seatLabels.includes(label))
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
    return { refundedOrders }
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
