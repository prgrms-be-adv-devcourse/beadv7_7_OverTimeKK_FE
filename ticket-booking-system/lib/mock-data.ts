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

export const seedPerformances: Performance[] = []

export const seedSessions: PerformanceSession[] = []

export const seedZonePrices: ZonePrice[] = []

export const seedInventory: SeatInventory[] = []

export const seedOrders: Order[] = []

export const seedPayments: Payment[] = []

export const seedPoints: PointTransaction[] = [
  {
    id: 'pt_2',
    userId: BUYER_ID,
    type: 'EARN',
    amount: 2540,
    reason: '이벤트 적립',
    createdAt: '2026-06-30 12:00:00',
  },
]

export const seedSettlements: Settlement[] = []

export function seatLabelFor(zone: Zone, seq: number): string {
  return `${zone}-${String(seq).padStart(2, '0')}`
}
