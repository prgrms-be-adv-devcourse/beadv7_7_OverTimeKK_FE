/**
 * 실제 API로 받아온 공연(RealPerformance)에 덧붙이는 프론트 전용 정적 정보.
 * ------------------------------------------------------------------
 * 백엔드엔 포스터 필드가 없고, 좌석 등급별 가격·잔여석 조회 API도 없다
 * (performance-service는 등록 시에만 좌석가격을 받고, 다시 읽어오는 API가 없음).
 * 그래서 이 정보들은 프론트에서 "정적 데이터"로 관리하기로 결정했다.
 *
 * performanceId(숫자)로 매핑하지 않고 title로 매핑하는 이유: performance-service는
 * 개발 중 ddl-auto=create로 서버를 재기동할 때마다 auto-increment가 1부터 다시 시작해서
 * 같은 title이라도 실행마다 performanceId가 달라진다. title 매칭이 재기동에 안전하다.
 */

import type { Zone } from './types'

export interface PerformanceExtras {
  posterUrl: string
  /** 구역별 가격. 여기 없는 구역은 해당 공연에서 판매하지 않는 것으로 취급 */
  zonePrices: Partial<Record<Zone, number>>
}

const DEFAULT_EXTRAS: PerformanceExtras = {
  posterUrl: '',
  zonePrices: { VIP: 120000, R: 90000, S: 60000, A: 40000 },
}

/**
 * title 기준 curated 값. 없는 title은 DEFAULT_EXTRAS로 대체된다.
 * `registerPerformanceExtras`로 런타임에도 추가된다(셀러가 새 공연을 등록할 때).
 */
const EXTRAS_BY_TITLE: Record<string, PerformanceExtras> = {
  '최종 검증 공연': {
    posterUrl: '',
    zonePrices: { VIP: 100000, R: 80000 },
  },
}

const RUNTIME_EXTRAS_STORAGE_KEY = 'reseat:performance-extras'

// 페이지를 새로고침하면 JS 모듈이 다시 초기화돼서 EXTRAS_BY_TITLE에 런타임에 추가한 값이
// 사라진다. 셀러가 등록한 공연의 가격이 새로고침마다 기본값으로 돌아가지 않도록
// localStorage에도 같이 저장해두고, 모듈 로드 시 복원한다.
function loadRuntimeExtras(): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(RUNTIME_EXTRAS_STORAGE_KEY)
    if (!raw) return
    Object.assign(EXTRAS_BY_TITLE, JSON.parse(raw) as Record<string, PerformanceExtras>)
  } catch {
    // 저장된 값이 깨졌으면 무시하고 기본값으로 진행
  }
}
loadRuntimeExtras()

export function getPerformanceExtras(title: string): PerformanceExtras {
  return EXTRAS_BY_TITLE[title] ?? DEFAULT_EXTRAS
}

/** 셀러가 프론트에서 새 공연을 등록할 때, 그 자리에서 입력한 값을 title 기준으로 등록해둔다 */
export function registerPerformanceExtras(title: string, extras: PerformanceExtras): void {
  EXTRAS_BY_TITLE[title] = extras
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RUNTIME_EXTRAS_STORAGE_KEY, JSON.stringify(EXTRAS_BY_TITLE))
  } catch {
    // 저장 실패해도(용량 초과 등) 이번 세션 동작에는 지장 없음
  }
}
