import type { Hall, Zone } from './types'

/**
 * Mock 데이터 시드
 * ------------------------------------------------------------------
 * 기준일: 2026-08-04. 사용자/주문/결제/포인트/정산 시드는 전부 제거됨 — 실 로그인 사용자
 * (lib/auth-store.ts) 기준으로 lib/api.ts의 ensureMockUser()가 그때그때 만든다.
 * 남은 건 hall(공연장) 정적 데이터뿐 — 백엔드에 조회 API가 없어서 여전히 여기 있음
 * (관련: BE-요청-hall과-구역가격-조회API 옵시디언 노트).
 */

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

export function seatLabelFor(zone: Zone, seq: number): string {
  return `${zone}-${String(seq).padStart(2, '0')}`
}
