import type {
  Hall,
  Order,
  Payment,
  Performance,
  PerformanceSession,
  PointTransaction,
  SeatInventory,
  Settlement,
  User,
  WaitlistEntry,
  Zone,
  ZonePrice,
} from './types'

/**
 * Mock 데이터 시드
 * ------------------------------------------------------------------
 * 기준일: 2026-07-21. 실제 서비스에서는 Spring API 응답으로 대체됩니다.
 */

export const SELLER_ID = 'u_seller'
export const BUYER_ID = 'u_buyer'

export const seedUsers: User[] = [
  {
    id: BUYER_ID,
    name: '김구매',
    email: 'buyer@ticketwait.kr',
    role: 'BUYER',
    points: 3200,
  },
  {
    id: SELLER_ID,
    name: '박기획',
    email: 'seller@ticketwait.kr',
    role: 'SELLER',
    points: 12000,
  },
]

export const seedHalls: Hall[] = [
  {
    id: 'h1',
    name: '예술의전당 오페라극장',
    location: '서울 서초구',
    capacity: { VIP: 60, R: 120, S: 200, A: 300 },
  },
  {
    id: 'h2',
    name: '블루스퀘어 신한카드홀',
    location: '서울 용산구',
    capacity: { VIP: 40, R: 100, S: 180, A: 260 },
  },
  {
    id: 'h3',
    name: 'KSPO DOME',
    location: '서울 송파구',
    capacity: { VIP: 150, R: 400, S: 700, A: 900 },
  },
]

export const seedPerformances: Performance[] = [
  {
    id: 'p_opera',
    sellerId: SELLER_ID,
    title: '오페라 〈라 트라비아타〉',
    description:
      '베르디 불멸의 명작. 사랑과 희생을 그린 오페라의 정수를 예술의전당 무대에서 만나보세요.',
    runtime: 165,
    startDate: '2026-08-05',
    endDate: '2026-08-16',
    ticketOpenAt: '2026-06-01 14:00:00',
    hallId: 'h1',
    posterUrl: '/posters/opera.png',
    category: '오페라',
    status: 'ON_SALE',
  },
  {
    id: 'p_wicked',
    sellerId: SELLER_ID,
    title: '뮤지컬 〈위키드〉',
    description:
      '오즈의 두 마녀 이야기. 화려한 무대와 압도적인 넘버로 사랑받는 초대형 블록버스터 뮤지컬.',
    runtime: 175,
    startDate: '2026-07-25',
    endDate: '2026-09-30',
    ticketOpenAt: '2026-05-20 20:00:00',
    hallId: 'h2',
    posterUrl: '/posters/wicked.png',
    category: '뮤지컬',
    status: 'SOLD_OUT',
  },
  {
    id: 'p_concert',
    sellerId: SELLER_ID,
    title: '블루밍 페스티벌 2026',
    description:
      '여름밤을 수놓을 대형 콘서트. 최정상 아티스트들의 라인업으로 찾아옵니다.',
    runtime: 200,
    startDate: '2026-09-12',
    endDate: '2026-09-13',
    ticketOpenAt: '2026-08-01 20:00:00',
    hallId: 'h3',
    posterUrl: '/posters/concert.png',
    category: '콘서트',
    status: 'DRAFT',
  },
  {
    id: 'p_mystery',
    sellerId: SELLER_ID,
    title: '뮤지컬 〈레베카〉',
    description:
      '대저택에서 벌어지는 미스터리 스릴러. 강렬한 넘버 「레베카」로 유명한 명작 뮤지컬.',
    runtime: 160,
    startDate: '2026-08-20',
    endDate: '2026-10-10',
    ticketOpenAt: '2026-06-15 14:00:00',
    hallId: 'h2',
    posterUrl: '/posters/mystery.png',
    category: '뮤지컬',
    status: 'ON_SALE',
  },
  {
    id: 'p_ballad',
    sellerId: SELLER_ID,
    title: '그날의 노래 - 어쿠스틱 콘서트',
    description: '따뜻한 통기타 선율로 채우는 감성 어쿠스틱 무대.',
    runtime: 120,
    startDate: '2026-06-28',
    endDate: '2026-06-28',
    ticketOpenAt: '2026-05-01 14:00:00',
    hallId: 'h2',
    posterUrl: '/posters/ballad.png',
    category: '콘서트',
    status: 'ENDED',
  },
]

export const seedSessions: PerformanceSession[] = [
  // 라 트라비아타
  { id: 's_opera_1', performanceId: 'p_opera', sessionNum: 1, actor: '조수미, 이용훈', performanceStartAt: '2026-08-05 19:30:00' },
  { id: 's_opera_2', performanceId: 'p_opera', sessionNum: 2, actor: '홍혜란, 김우경', performanceStartAt: '2026-08-09 15:00:00' },
  { id: 's_opera_3', performanceId: 'p_opera', sessionNum: 3, actor: '조수미, 이용훈', performanceStartAt: '2026-08-16 15:00:00' },
  // 위키드 (매진)
  { id: 's_wicked_1', performanceId: 'p_wicked', sessionNum: 1, actor: '옥주현, 정선아', performanceStartAt: '2026-07-25 19:30:00' },
  { id: 's_wicked_2', performanceId: 'p_wicked', sessionNum: 2, actor: '손승연, 나하나', performanceStartAt: '2026-08-01 14:00:00' },
  // 블루밍 페스티벌 (오픈 전)
  { id: 's_concert_1', performanceId: 'p_concert', sessionNum: 1, actor: 'DAY1 라인업', performanceStartAt: '2026-09-12 18:00:00' },
  { id: 's_concert_2', performanceId: 'p_concert', sessionNum: 2, actor: 'DAY2 라인업', performanceStartAt: '2026-09-13 18:00:00' },
  // 레베카
  { id: 's_mystery_1', performanceId: 'p_mystery', sessionNum: 1, actor: '신영숙, 민영기', performanceStartAt: '2026-08-20 19:30:00' },
  { id: 's_mystery_2', performanceId: 'p_mystery', sessionNum: 2, actor: '옥주현, 카이', performanceStartAt: '2026-08-23 14:00:00' },
  // 그날의 노래 (종료)
  { id: 's_ballad_1', performanceId: 'p_ballad', sessionNum: 1, actor: '이하나 밴드', performanceStartAt: '2026-06-28 19:00:00' },
]

export const seedZonePrices: ZonePrice[] = [
  // 라 트라비아타
  { id: 'zp_opera_vip', performanceId: 'p_opera', zone: 'VIP', price: 190000 },
  { id: 'zp_opera_r', performanceId: 'p_opera', zone: 'R', price: 150000 },
  { id: 'zp_opera_s', performanceId: 'p_opera', zone: 'S', price: 110000 },
  { id: 'zp_opera_a', performanceId: 'p_opera', zone: 'A', price: 70000 },
  // 위키드
  { id: 'zp_wicked_vip', performanceId: 'p_wicked', zone: 'VIP', price: 170000 },
  { id: 'zp_wicked_r', performanceId: 'p_wicked', zone: 'R', price: 140000 },
  { id: 'zp_wicked_s', performanceId: 'p_wicked', zone: 'S', price: 100000 },
  { id: 'zp_wicked_a', performanceId: 'p_wicked', zone: 'A', price: 70000 },
  // 블루밍 페스티벌
  { id: 'zp_concert_vip', performanceId: 'p_concert', zone: 'VIP', price: 165000 },
  { id: 'zp_concert_r', performanceId: 'p_concert', zone: 'R', price: 132000 },
  { id: 'zp_concert_s', performanceId: 'p_concert', zone: 'S', price: 99000 },
  // 레베카
  { id: 'zp_mystery_vip', performanceId: 'p_mystery', zone: 'VIP', price: 160000 },
  { id: 'zp_mystery_r', performanceId: 'p_mystery', zone: 'R', price: 130000 },
  { id: 'zp_mystery_s', performanceId: 'p_mystery', zone: 'S', price: 90000 },
  { id: 'zp_mystery_a', performanceId: 'p_mystery', zone: 'A', price: 60000 },
  // 그날의 노래
  { id: 'zp_ballad_r', performanceId: 'p_ballad', zone: 'R', price: 88000 },
  { id: 'zp_ballad_s', performanceId: 'p_ballad', zone: 'S', price: 66000 },
]

/** 회차 x 구역 좌석 재고. 매진 공연은 sold === total */
export const seedInventory: SeatInventory[] = [
  // 라 트라비아타 - 판매중, 일부 잔여
  { sessionId: 's_opera_1', zone: 'VIP', total: 60, sold: 58 },
  { sessionId: 's_opera_1', zone: 'R', total: 120, sold: 110 },
  { sessionId: 's_opera_1', zone: 'S', total: 200, sold: 150 },
  { sessionId: 's_opera_1', zone: 'A', total: 300, sold: 120 },
  { sessionId: 's_opera_2', zone: 'VIP', total: 60, sold: 30 },
  { sessionId: 's_opera_2', zone: 'R', total: 120, sold: 60 },
  { sessionId: 's_opera_2', zone: 'S', total: 200, sold: 90 },
  { sessionId: 's_opera_2', zone: 'A', total: 300, sold: 100 },
  { sessionId: 's_opera_3', zone: 'VIP', total: 60, sold: 60 },
  { sessionId: 's_opera_3', zone: 'R', total: 120, sold: 118 },
  { sessionId: 's_opera_3', zone: 'S', total: 200, sold: 200 },
  { sessionId: 's_opera_3', zone: 'A', total: 300, sold: 280 },
  // 위키드 - 전 회차 매진
  { sessionId: 's_wicked_1', zone: 'VIP', total: 40, sold: 40 },
  { sessionId: 's_wicked_1', zone: 'R', total: 100, sold: 100 },
  { sessionId: 's_wicked_1', zone: 'S', total: 180, sold: 180 },
  { sessionId: 's_wicked_1', zone: 'A', total: 260, sold: 260 },
  { sessionId: 's_wicked_2', zone: 'VIP', total: 40, sold: 40 },
  { sessionId: 's_wicked_2', zone: 'R', total: 100, sold: 100 },
  { sessionId: 's_wicked_2', zone: 'S', total: 180, sold: 180 },
  { sessionId: 's_wicked_2', zone: 'A', total: 260, sold: 260 },
  // 블루밍 페스티벌 - 오픈 전 (판매 0)
  { sessionId: 's_concert_1', zone: 'VIP', total: 150, sold: 0 },
  { sessionId: 's_concert_1', zone: 'R', total: 400, sold: 0 },
  { sessionId: 's_concert_1', zone: 'S', total: 700, sold: 0 },
  { sessionId: 's_concert_2', zone: 'VIP', total: 150, sold: 0 },
  { sessionId: 's_concert_2', zone: 'R', total: 400, sold: 0 },
  { sessionId: 's_concert_2', zone: 'S', total: 700, sold: 0 },
  // 레베카 - 판매중
  { sessionId: 's_mystery_1', zone: 'VIP', total: 40, sold: 38 },
  { sessionId: 's_mystery_1', zone: 'R', total: 100, sold: 72 },
  { sessionId: 's_mystery_1', zone: 'S', total: 180, sold: 90 },
  { sessionId: 's_mystery_1', zone: 'A', total: 260, sold: 100 },
  { sessionId: 's_mystery_2', zone: 'VIP', total: 40, sold: 40 },
  { sessionId: 's_mystery_2', zone: 'R', total: 100, sold: 95 },
  { sessionId: 's_mystery_2', zone: 'S', total: 180, sold: 130 },
  { sessionId: 's_mystery_2', zone: 'A', total: 260, sold: 160 },
  // 그날의 노래 - 종료
  { sessionId: 's_ballad_1', zone: 'R', total: 100, sold: 100 },
  { sessionId: 's_ballad_1', zone: 'S', total: 180, sold: 176 },
]

export const seedOrders: Order[] = [
  {
    id: 'o_1001',
    buyerId: BUYER_ID,
    performanceId: 'p_opera',
    sessionId: 's_opera_2',
    items: [{ zone: 'R', quantity: 2, unitPrice: 150000, seatLabels: ['R-12', 'R-13'] }],
    totalAmount: 300000,
    status: 'PAID',
    fromWaitlist: false,
    createdAt: '2026-06-02 10:14:22',
  },
  {
    id: 'o_1002',
    buyerId: BUYER_ID,
    performanceId: 'p_ballad',
    sessionId: 's_ballad_1',
    items: [{ zone: 'S', quantity: 1, unitPrice: 66000, seatLabels: ['S-45'] }],
    totalAmount: 66000,
    status: 'PAID',
    fromWaitlist: false,
    createdAt: '2026-05-02 09:03:11',
  },
]

export const seedPayments: Payment[] = [
  {
    id: 'pay_1001',
    orderId: 'o_1001',
    amount: 300000,
    method: '토스페이',
    status: 'APPROVED',
    pgTransactionKey: 'toss_5f3a9c21e8',
    approvedAt: '2026-06-02 10:14:25',
  },
  {
    id: 'pay_1002',
    orderId: 'o_1002',
    amount: 66000,
    method: '신용카드',
    status: 'APPROVED',
    pgTransactionKey: 'toss_1a7bd0c93f',
    approvedAt: '2026-05-02 09:03:14',
  },
]

export const seedWaitlist: WaitlistEntry[] = [
  {
    id: 'w_1',
    buyerId: BUYER_ID,
    performanceId: 'p_wicked',
    sessionId: 's_wicked_1',
    zones: ['VIP', 'R', 'S'],
    position: 2,
    status: 'WAITING',
    createdAt: '2026-05-21 09:00:00',
  },
  // 앞선 대기자들 (순번 시뮬레이션용)
  {
    id: 'w_0',
    buyerId: 'u_other_1',
    performanceId: 'p_wicked',
    sessionId: 's_wicked_1',
    zones: ['VIP', 'R'],
    position: 1,
    status: 'WAITING',
    createdAt: '2026-05-20 21:03:00',
  },
  {
    id: 'w_2',
    buyerId: 'u_other_2',
    performanceId: 'p_wicked',
    sessionId: 's_wicked_1',
    zones: ['S', 'A'],
    position: 3,
    status: 'WAITING',
    createdAt: '2026-05-22 11:20:00',
  },
]

export const seedPoints: PointTransaction[] = [
  {
    id: 'pt_1',
    userId: BUYER_ID,
    type: 'EARN',
    amount: 660,
    reason: '공연 관람 적립 (그날의 노래)',
    createdAt: '2026-06-29 00:10:00',
  },
  {
    id: 'pt_2',
    userId: BUYER_ID,
    type: 'EARN',
    amount: 2540,
    reason: '이벤트 적립',
    createdAt: '2026-06-30 12:00:00',
  },
]

export const seedSettlements: Settlement[] = [
  {
    id: 'st_1',
    sellerId: SELLER_ID,
    performanceId: 'p_ballad',
    period: '2026-07',
    grossAmount: 11924000,
    platformFee: 596200,
    netAmount: 11327800,
    status: 'COMPLETED',
    settledAt: '2026-07-15',
  },
  {
    id: 'st_2',
    sellerId: SELLER_ID,
    performanceId: 'p_opera',
    period: '2026-08',
    grossAmount: 42600000,
    platformFee: 2130000,
    netAmount: 40470000,
    status: 'SCHEDULED',
    settledAt: '2026-08-15',
  },
]

export function seatLabelFor(zone: Zone, seq: number): string {
  return `${zone}-${String(seq).padStart(2, '0')}`
}
