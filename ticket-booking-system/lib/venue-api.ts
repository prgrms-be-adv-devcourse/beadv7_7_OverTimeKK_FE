/**
 * 공연장(Venue/Hall/Seat) 도메인 실 백엔드 연동 클라이언트
 * ------------------------------------------------------------------
 * performance-service의 venue 조회 API. hall/venue 정적 데이터가
 * lib/mock-data.ts의 seedHalls로 하드코딩돼 있던 걸 대체한다.
 *
 * 주의: hall 목록 응답에 venue_name/주소가 없다(BE-요청-hall과-구역가격-조회API 옵시디언
 * 노트 참고 — 주소 필드는 추후 백엔드에 추가 요청 예정, 우선 이름만으로 진행).
 * zone 조회는 개별 좌석이 아니라 zone 이름 목록만 내려준다 — 좌석 배치도는 대신
 * performanceApi.selectSeatZone()의 회차별 실제 티켓(seatRow/seatNum)으로 그린다.
 */

import { BASE_URL } from './performance-api'

interface ApiResponse<T> {
  success: boolean
  data: T | null
  code: string | null
  message: string | null
}

export class VenueApiError extends Error {
  code: string | null
  status: number
  constructor(message: string, code: string | null, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  const body = (await res.json()) as ApiResponse<T>
  if (!res.ok || !body.success) {
    if (res.status === 401) {
      throw new VenueApiError('로그인 정보를 확인하세요.', body.code, res.status)
    }
    throw new VenueApiError(body.message ?? '요청이 실패했습니다.', body.code, res.status)
  }
  return body.data as T
}

export interface VenueSummary {
  venueId: number
  venueName: string
}

export interface HallSummary {
  hallId: number
  hallName: string
}

export interface HallDirectoryEntry {
  hallId: number
  hallName: string
  venueId: number
  venueName: string
}

let hallDirectoryCache: Promise<Map<number, HallDirectoryEntry>> | null = null

export const venueApi = {
  // GET /api/venues
  list(): Promise<VenueSummary[]> {
    return request<VenueSummary[]>('/api/venues')
  },

  // GET /api/venues/{venueId}/halls
  halls(venueId: number): Promise<HallSummary[]> {
    return request<HallSummary[]>(`/api/venues/${venueId}/halls`)
  },

  // GET /api/venues/halls/{hallId}/zones — zone 이름 목록만 내려온다(개별 좌석 아님)
  zones(hallId: number): Promise<string[]> {
    return request<string[]>(`/api/venues/halls/${hallId}/zones`)
  },

  /**
   * 전체 venue의 hall을 한 번에 모아 hallId로 바로 찾을 수 있게 캐싱한다.
   * hall이 하나뿐인 "get hall by id" API가 없어서(venue_id로만 조회 가능), 이 방식으로 우회.
   * 앱 세션 동안 한 번만 fetch하고 재사용(모듈 레벨 캐시, 실패 시 다음 호출에서 재시도).
   */
  hallDirectory(): Promise<Map<number, HallDirectoryEntry>> {
    if (!hallDirectoryCache) {
      hallDirectoryCache = (async () => {
        const venues = await venueApi.list()
        const perVenue = await Promise.all(
          venues.map(async (venue) => {
            const halls = await venueApi.halls(venue.venueId).catch(() => [])
            return halls.map(
              (hall): [number, HallDirectoryEntry] => [
                hall.hallId,
                { hallId: hall.hallId, hallName: hall.hallName, venueId: venue.venueId, venueName: venue.venueName },
              ],
            )
          }),
        )
        return new Map(perVenue.flat())
      })().catch((e) => {
        hallDirectoryCache = null
        throw e
      })
    }
    return hallDirectoryCache
  },
}
