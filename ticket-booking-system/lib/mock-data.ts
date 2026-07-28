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

/**
 * performance-service의 실제 venue/hall/seat 시드 데이터(data.sql) 기준으로 옮겨온 공연장 정보.
 * capacity/seatLayout은 백엔드 seat 테이블(hall_id=1, 7, 13)을 그대로 반영한 값이며,
 * 좌석/가격/잔여석은 여전히 프론트 정적 데이터로 관리한다(백엔드에 조회 API가 없음).
 */
export const seedHalls: Hall[] = [
  {
    id: 'h1',
    name: '서울 아트센터 1홀',
    location: '서울 강남구',
    capacity: { VIP: 32, R: 32, S: 40, A: 48 },
    seatLayout: {
      VIP: [
        { row: 'A', count: 10 },
        { row: 'B', count: 10 },
        { row: 'C', count: 10 },
        { row: 'D', count: 2 },
      ],
      R: [
        { row: 'A', count: 10 },
        { row: 'B', count: 10 },
        { row: 'C', count: 10 },
        { row: 'D', count: 2 },
      ],
      S: [
        { row: 'A', count: 10 },
        { row: 'B', count: 10 },
        { row: 'C', count: 10 },
        { row: 'D', count: 10 },
      ],
      A: [
        { row: 'A', count: 10 },
        { row: 'B', count: 10 },
        { row: 'C', count: 10 },
        { row: 'D', count: 10 },
        { row: 'E', count: 8 },
      ],
    },
  },
  {
    id: 'h2',
    name: '한강 문화회관 2홀',
    location: '서울 영등포구',
    capacity: { VIP: 28, R: 40, S: 40, A: 44 },
    seatLayout: {
      VIP: [
        { row: 'A', count: 12 },
        { row: 'B', count: 12 },
        { row: 'C', count: 4 },
      ],
      R: [
        { row: 'A', count: 10 },
        { row: 'B', count: 10 },
        { row: 'C', count: 10 },
        { row: 'D', count: 10 },
      ],
      S: [
        { row: 'A', count: 8 },
        { row: 'B', count: 8 },
        { row: 'C', count: 8 },
        { row: 'D', count: 8 },
        { row: 'E', count: 8 },
      ],
      A: [
        { row: 'A', count: 8 },
        { row: 'B', count: 8 },
        { row: 'C', count: 8 },
        { row: 'D', count: 8 },
        { row: 'E', count: 8 },
        { row: 'F', count: 4 },
      ],
    },
  },
  {
    id: 'h3',
    name: '인천 공연예술관 3홀',
    location: '인천 남동구',
    capacity: { VIP: 32, R: 40, S: 36, A: 44 },
    seatLayout: {
      VIP: [
        { row: 'A', count: 12 },
        { row: 'B', count: 12 },
        { row: 'C', count: 8 },
      ],
      R: [
        { row: 'A', count: 10 },
        { row: 'B', count: 10 },
        { row: 'C', count: 10 },
        { row: 'D', count: 10 },
      ],
      S: [
        { row: 'A', count: 10 },
        { row: 'B', count: 10 },
        { row: 'C', count: 10 },
        { row: 'D', count: 6 },
      ],
      A: [
        { row: 'A', count: 12 },
        { row: 'B', count: 12 },
        { row: 'C', count: 12 },
        { row: 'D', count: 8 },
      ],
    },
  },
]

export const seedPerformances: Performance[] = [
  {
    id: 'p_1000',
    sellerId: SELLER_ID,
    title: '오페라 〈라 트라비아타〉',
    description:
      '베르디 불멸의 명작. 사랑과 희생을 그린 오페라의 정수를 서울 아트센터 무대에서 만나보세요.',
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
    id: 'p_1001',
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
    id: 'p_1002',
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
    id: 'p_1003',
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
    id: 'p_1004',
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
  { id: 's_opera_1', performanceId: 'p_1000', sessionNum: 1, actor: '조수미, 이용훈', performanceStartAt: '2026-08-05 19:30:00' },
  { id: 's_opera_2', performanceId: 'p_1000', sessionNum: 2, actor: '홍혜란, 김우경', performanceStartAt: '2026-08-09 15:00:00' },
  { id: 's_opera_3', performanceId: 'p_1000', sessionNum: 3, actor: '조수미, 이용훈', performanceStartAt: '2026-08-16 15:00:00' },
  // 위키드 (매진)
  { id: 's_wicked_1', performanceId: 'p_1001', sessionNum: 1, actor: '옥주현, 정선아', performanceStartAt: '2026-07-25 19:30:00' },
  { id: 's_wicked_2', performanceId: 'p_1001', sessionNum: 2, actor: '손승연, 나하나', performanceStartAt: '2026-08-01 14:00:00' },
  // 블루밍 페스티벌 (오픈 전)
  { id: 's_concert_1', performanceId: 'p_1002', sessionNum: 1, actor: 'DAY1 라인업', performanceStartAt: '2026-09-12 18:00:00' },
  { id: 's_concert_2', performanceId: 'p_1002', sessionNum: 2, actor: 'DAY2 라인업', performanceStartAt: '2026-09-13 18:00:00' },
  // 레베카
  { id: 's_mystery_1', performanceId: 'p_1003', sessionNum: 1, actor: '신영숙, 민영기', performanceStartAt: '2026-08-20 19:30:00' },
  { id: 's_mystery_2', performanceId: 'p_1003', sessionNum: 2, actor: '옥주현, 카이', performanceStartAt: '2026-08-23 14:00:00' },
  // 그날의 노래 (종료)
  { id: 's_ballad_1', performanceId: 'p_1004', sessionNum: 1, actor: '이하나 밴드', performanceStartAt: '2026-06-28 19:00:00' },
]

export const seedZonePrices: ZonePrice[] = [
  // 라 트라비아타
  { id: 'zp_opera_vip', performanceId: 'p_1000', zone: 'VIP', price: 190000 },
  { id: 'zp_opera_r', performanceId: 'p_1000', zone: 'R', price: 150000 },
  { id: 'zp_opera_s', performanceId: 'p_1000', zone: 'S', price: 110000 },
  { id: 'zp_opera_a', performanceId: 'p_1000', zone: 'A', price: 70000 },
  // 위키드
  { id: 'zp_wicked_vip', performanceId: 'p_1001', zone: 'VIP', price: 170000 },
  { id: 'zp_wicked_r', performanceId: 'p_1001', zone: 'R', price: 140000 },
  { id: 'zp_wicked_s', performanceId: 'p_1001', zone: 'S', price: 100000 },
  { id: 'zp_wicked_a', performanceId: 'p_1001', zone: 'A', price: 70000 },
  // 블루밍 페스티벌
  { id: 'zp_concert_vip', performanceId: 'p_1002', zone: 'VIP', price: 165000 },
  { id: 'zp_concert_r', performanceId: 'p_1002', zone: 'R', price: 132000 },
  { id: 'zp_concert_s', performanceId: 'p_1002', zone: 'S', price: 99000 },
  // 레베카
  { id: 'zp_mystery_vip', performanceId: 'p_1003', zone: 'VIP', price: 160000 },
  { id: 'zp_mystery_r', performanceId: 'p_1003', zone: 'R', price: 130000 },
  { id: 'zp_mystery_s', performanceId: 'p_1003', zone: 'S', price: 90000 },
  { id: 'zp_mystery_a', performanceId: 'p_1003', zone: 'A', price: 60000 },
  // 그날의 노래
  { id: 'zp_ballad_r', performanceId: 'p_1004', zone: 'R', price: 88000 },
  { id: 'zp_ballad_s', performanceId: 'p_1004', zone: 'S', price: 66000 },
]

/**
 * booking-dialog.tsx의 좌석 그리드와 동일한 규칙(zone-row-col, 줄 단위 순서)으로
 * 앞에서부터 count개의 좌석 라벨을 생성한다. 시드 재고의 occupiedSeats를 채우는 데 쓴다.
 */
function seatIdsForZone(hall: Hall, zone: Zone, count: number): string[] {
  const layout = hall.seatLayout[zone] ?? []
  const ids: string[] = []
  for (const rowLayout of layout) {
    for (let col = 1; col <= rowLayout.count; col += 1) {
      if (ids.length >= count) return ids
      ids.push(`${zone}-${rowLayout.row}-${col}`)
    }
  }
  return ids
}

function hallForSession(sessionId: string): Hall | undefined {
  const session = seedSessions.find((s) => s.id === sessionId)
  const performance = session && seedPerformances.find((p) => p.id === session.performanceId)
  return performance ? seedHalls.find((h) => h.id === performance.hallId) : undefined
}

/**
 * 회차 x 구역 좌석 재고. 매진 공연은 sold === total.
 * total은 각 공연의 hallId(h1/h2/h3)에 대응하는 seedHalls[].capacity와 일치해야 함
 * (실제 performance-service seed 데이터 기준 좌석 수).
 */
const seedInventoryCounts: Array<{ sessionId: string; zone: Zone; total: number; sold: number }> = [
  // 라 트라비아타 (h1: VIP32/R32/S40/A48) - 판매중, 일부 잔여
  { sessionId: 's_opera_1', zone: 'VIP', total: 32, sold: 31 },
  { sessionId: 's_opera_1', zone: 'R', total: 32, sold: 29 },
  { sessionId: 's_opera_1', zone: 'S', total: 40, sold: 30 },
  { sessionId: 's_opera_1', zone: 'A', total: 48, sold: 19 },
  { sessionId: 's_opera_2', zone: 'VIP', total: 32, sold: 16 },
  { sessionId: 's_opera_2', zone: 'R', total: 32, sold: 16 },
  { sessionId: 's_opera_2', zone: 'S', total: 40, sold: 18 },
  { sessionId: 's_opera_2', zone: 'A', total: 48, sold: 16 },
  { sessionId: 's_opera_3', zone: 'VIP', total: 32, sold: 32 },
  { sessionId: 's_opera_3', zone: 'R', total: 32, sold: 32 },
  { sessionId: 's_opera_3', zone: 'S', total: 40, sold: 40 },
  { sessionId: 's_opera_3', zone: 'A', total: 48, sold: 48 },
  // 위키드 (h2: VIP28/R40/S40/A44) - 전 회차 매진 (s_wicked_1 R석 1장은 취소표 발생 → 우선예매 배정용으로 비워둠)
  { sessionId: 's_wicked_1', zone: 'VIP', total: 28, sold: 28 },
  { sessionId: 's_wicked_1', zone: 'R', total: 40, sold: 39 },
  { sessionId: 's_wicked_1', zone: 'S', total: 40, sold: 40 },
  { sessionId: 's_wicked_1', zone: 'A', total: 44, sold: 44 },
  { sessionId: 's_wicked_2', zone: 'VIP', total: 28, sold: 28 },
  { sessionId: 's_wicked_2', zone: 'R', total: 40, sold: 40 },
  { sessionId: 's_wicked_2', zone: 'S', total: 40, sold: 40 },
  { sessionId: 's_wicked_2', zone: 'A', total: 44, sold: 44 },
  // 블루밍 페스티벌 (h3: VIP32/R40/S36/A44) - 오픈 전 (판매 0)
  { sessionId: 's_concert_1', zone: 'VIP', total: 32, sold: 0 },
  { sessionId: 's_concert_1', zone: 'R', total: 40, sold: 0 },
  { sessionId: 's_concert_1', zone: 'S', total: 36, sold: 0 },
  { sessionId: 's_concert_2', zone: 'VIP', total: 32, sold: 0 },
  { sessionId: 's_concert_2', zone: 'R', total: 40, sold: 0 },
  { sessionId: 's_concert_2', zone: 'S', total: 36, sold: 0 },
  // 레베카 (h2: VIP28/R40/S40/A44) - 판매중
  { sessionId: 's_mystery_1', zone: 'VIP', total: 28, sold: 27 },
  { sessionId: 's_mystery_1', zone: 'R', total: 40, sold: 29 },
  { sessionId: 's_mystery_1', zone: 'S', total: 40, sold: 20 },
  { sessionId: 's_mystery_1', zone: 'A', total: 44, sold: 17 },
  { sessionId: 's_mystery_2', zone: 'VIP', total: 28, sold: 28 },
  { sessionId: 's_mystery_2', zone: 'R', total: 40, sold: 38 },
  { sessionId: 's_mystery_2', zone: 'S', total: 40, sold: 29 },
  { sessionId: 's_mystery_2', zone: 'A', total: 44, sold: 27 },
  // 그날의 노래 (h2: R40/S40) - 종료
  { sessionId: 's_ballad_1', zone: 'R', total: 40, sold: 40 },
  { sessionId: 's_ballad_1', zone: 'S', total: 40, sold: 39 },
]

export const seedInventory: SeatInventory[] = seedInventoryCounts.map((entry) => {
  const hall = hallForSession(entry.sessionId)
  return {
    ...entry,
    occupiedSeats: hall ? seatIdsForZone(hall, entry.zone, entry.sold) : [],
  }
})

export const seedOrders: Order[] = [
  {
    id: 'o_1001',
    buyerId: BUYER_ID,
    performanceId: 'p_1000',
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
    performanceId: 'p_1004',
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
    performanceId: 'p_1004',
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
    performanceId: 'p_1000',
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
