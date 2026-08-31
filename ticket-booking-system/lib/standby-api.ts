/**
 * 대기(Standby) 도메인 실제 백엔드 연동 클라이언트
 * ------------------------------------------------------------------
 * performance-service (기본 http://localhost:8083) 의 취소표 대기 API.
 * 근거 문서: beadv7_7_OverTimeKK_BE/docs/standby-api-frontend-guide.md (2026-07-26 기준)
 *
 * 이 도메인만 실제 API로 연동되어 있고, 공연/회차/주문 등 나머지는 여전히
 * lib/api.ts 의 인메모리 mock을 사용합니다.
 */

import type { Zone } from './types'

const BASE_URL = process.env.NEXT_PUBLIC_STANDBY_API_BASE_URL ?? 'http://localhost:8080'

/**
 * mock Performance.id(예: 'p_1001')를 백엔드 숫자 performanceId로 변환.
 * 프론트 공연/회차 데이터가 아직 mock이라 실제 backend ID와 일치를 보장할 수 없다 —
 * 공연/회차 데이터 자체가 실제 API로 교체되면 이 변환은 제거하고 실제 ID를 그대로 써야 한다.
 */
export function toBackendPerformanceId(performanceId: string): number {
  const digits = performanceId.replace(/\D/g, '')
  return digits ? Number(digits) : 1
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  code: string | null
  message: string | null
}

export class StandbyApiError extends Error {
  code: string | null
  status: number
  constructor(message: string, code: string | null, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  STB400_001: '대기 구역은 1~3개까지 선택할 수 있습니다.',
  STB400_002: '같은 구역을 중복해서 선택할 수 없습니다.',
  STB400_003: '해당 공연에서 사용하지 않는 구역입니다.',
  STB400_004: '신청하지 않은 구역은 취소할 수 없습니다.',
  STB409_001: '이미 해당 회차에 대기 신청이 있습니다.',
  STB409_002: '아직 매진되지 않은 구역입니다.',
  STB409_004: '이미 취소된 대기 신청입니다.',
  STB404_001: '대기 신청 정보를 찾을 수 없습니다.',
  STB403_001: '본인의 대기 신청만 조회할 수 있습니다.',
}

export function standbyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof StandbyApiError) {
    return (error.code && ERROR_MESSAGES[error.code]) || error.message || fallback
  }
  return fallback
}

async function request<T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<T | null> {
  const { accessToken, headers, ...rest } = init
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    })
  } catch {
    throw new StandbyApiError('대기 서버에 연결할 수 없습니다.', null, 0)
  }

  if (res.status === 204) return null

  let body: ApiResponse<T> | null = null
  try {
    body = (await res.json()) as ApiResponse<T>
  } catch {
    // no-op: 본문이 없거나 JSON이 아닌 응답
  }

  if (!res.ok || !body || !body.success) {
    if (res.status === 401) {
      throw new StandbyApiError('로그인 정보를 확인하세요.', body?.code ?? null, res.status)
    }
    throw new StandbyApiError(body?.message ?? '요청에 실패했습니다.', body?.code ?? null, res.status)
  }
  return body.data
}

export interface CreateStandbyInput {
  performanceId: number
  sessionNum: number
  zones: Zone[]
}

export interface CreateStandbyResult {
  standbyId: number
  zones: Zone[]
  status: 'WAITING'
}

export interface StandbyZoneRank {
  zone: Zone
  rank: number
  isHeld: boolean
  /** 매칭(isHeld) 시 배정된 실 티켓 id — 실 결제(orderApi.createOrder)에 그대로 넘긴다 */
  ticketId: number | null
}

export interface StandbyDetail {
  standbyId: number
  zoneRanks: StandbyZoneRank[]
}

export type StandbyStatus = 'WAITING' | 'HELD' | 'RESERVED' | 'CANCELLED'

/** GET /api/standby 응답 항목 — 공연명/회차시각/매칭구역/결제만료시각까지 서버가 조인해서 내려준다. */
export interface StandbyListItem {
  standbyId: number
  performanceId: number
  sessionNum: number
  performanceTitle: string
  performanceStartAt: string
  zones: Zone[]
  matchedZone: Zone | null
  ticketId: number | null
  status: StandbyStatus
  reservedAt: string
  /** HELD 상태일 때의 결제 제한(만료) 시각. WAITING이면 null. */
  expiredAt: string | null
}

export const standbyApi = {
  // POST /api/standby — 신청자는 accessToken에서 서버가 식별한다
  async create(input: CreateStandbyInput, accessToken: string): Promise<CreateStandbyResult> {
    const data = await request<CreateStandbyResult>('/api/standby', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(input),
    })
    if (!data) throw new StandbyApiError('대기 신청 응답이 비어있습니다.', null, 500)
    return data
  },

  // GET /api/standby — 내 대기 신청 전체 목록(공연/회차/매칭 정보 포함)
  async list(accessToken: string): Promise<StandbyListItem[]> {
    const data = await request<StandbyListItem[]>('/api/standby', {
      method: 'GET',
      accessToken,
    })
    return data ?? []
  },

  // GET /api/standby/{standbyId} (Authorization: Bearer)
  async get(standbyId: number, accessToken: string): Promise<StandbyDetail> {
    const data = await request<StandbyDetail>(`/api/standby/${standbyId}`, {
      method: 'GET',
      accessToken,
    })
    if (!data) throw new StandbyApiError('대기 조회 응답이 비어있습니다.', null, 500)
    return data
  },

  // DELETE /api/standby/{standbyId} (Authorization: Bearer)
  async cancel(standbyId: number, accessToken: string): Promise<void> {
    await request<void>(`/api/standby/${standbyId}`, { method: 'DELETE', accessToken })
  },

  // DELETE /api/standby/{standbyId}/zones/{zone} (Authorization: Bearer)
  async cancelZone(standbyId: number, zone: Zone, accessToken: string): Promise<void> {
    await request<void>(`/api/standby/${standbyId}/zones/${zone}`, { method: 'DELETE', accessToken })
  },
}
