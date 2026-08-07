/**
 * 실제 API로 받아온 공연(RealPerformance)에 덧붙이는 프론트 전용 정적 정보.
 * ------------------------------------------------------------------
 * 백엔드엔 카테고리 필드가 없고, 좌석 등급별 가격·잔여석 조회 API도 없다
 * (performance-service는 등록 시에만 좌석가격을 받고, 다시 읽어오는 API가 없음).
 * 그래서 이 정보들은 프론트에서 "정적 데이터"로 관리하기로 결정했다.
 * 포스터 이미지(postUrl)는 GET /api/performances?page=N(performanceApi.listAllPostUrls)에서
 * 조립된 URL로 내려주므로 여기서 관리하지 않는다 — lib/api.ts의 importRealPerformances가
 * 그 값을 그대로 받아 쓴다.
 *
 * performanceId(숫자)로 매핑하지 않고 title로 매핑하는 이유: performance-service는
 * 개발 중 ddl-auto=create로 서버를 재기동할 때마다 auto-increment가 1부터 다시 시작해서
 * 같은 title이라도 실행마다 performanceId가 달라진다. title 매칭이 재기동에 안전하다.
 */

import type { Zone } from './types'

export interface PerformanceExtras {
  category: string
  /** lib/mock-data.ts seedHalls 중 하나 (h1/h2/h3) — 좌석 배치도/정원 조회용 */
  hallId: string
  /** 구역별 가격. 여기 없는 구역은 해당 공연에서 판매하지 않는 것으로 취급 */
  zonePrices: Partial<Record<Zone, number>>
}

const DEFAULT_EXTRAS: PerformanceExtras = {
  category: '기타',
  hallId: 'h1',
  zonePrices: { VIP: 120000, R: 90000, S: 60000, A: 40000 },
}

/**
 * title 기준 curated 값. 없는 title은 DEFAULT_EXTRAS로 대체된다.
 * `registerPerformanceExtras`로 런타임에도 추가된다(셀러가 새 공연을 등록할 때).
 */
const EXTRAS_BY_TITLE: Record<string, PerformanceExtras> = {
  '최종 검증 공연': {
    category: '기타',
    hallId: 'h1',
    zonePrices: { VIP: 100000, R: 80000 },
  },
}

export function getPerformanceExtras(title: string): PerformanceExtras {
  return EXTRAS_BY_TITLE[title] ?? DEFAULT_EXTRAS
}

/**
 * 셀러가 프론트에서 새 공연을 등록할 때, 그 자리에서 입력한 값을 title 기준으로 등록해둔다.
 * 메모리(JS 모듈 상태)에만 남는다 — 페이지를 새로고침하거나 다른 브라우저/탭에서 보면
 * 사라지고 DEFAULT_EXTRAS로 되돌아간다(localStorage로 브라우저 간 동기화하지 않기로 함).
 */
export function registerPerformanceExtras(title: string, extras: PerformanceExtras): void {
  EXTRAS_BY_TITLE[title] = extras
}

/**
 * 셀러 등록 폼에서 고를 수 있는 실제 공연장 목록.
 * backendHallId는 performance-service seed 데이터(hall.hall_id)의 실제 값,
 * localHallId는 lib/mock-data.ts seedHalls(좌석 배치도/정원 조회용)와 매칭된다.
 * 이 3개만 지원하는 이유: 백엔드에 hall 목록 조회 API가 없어서(issue 6),
 * 좌석 배치도 데이터를 프론트에 직접 옮겨둔 hall만 등록 가능하게 제한함.
 */
export const HALL_OPTIONS: { localHallId: string; backendHallId: number; label: string }[] = [
  { localHallId: 'h1', backendHallId: 1, label: '서울 아트센터 1홀' },
  { localHallId: 'h2', backendHallId: 7, label: '한강 문화회관 2홀' },
  { localHallId: 'h3', backendHallId: 13, label: '인천 공연예술관 3홀' },
]
