/**
 * 공연(Performance) 도메인 실제 백엔드 연동 클라이언트
 * ------------------------------------------------------------------
 * performance-service (기본 http://localhost:8083) 의 공연/회차/티켓 조회 API.
 *
 * 좌석 등급/포스터/카테고리는 백엔드에 조회 API가 없어서 여전히 프론트 정적
 * 데이터(lib/performance-extras.ts)로 관리하지만, 좌석 단위 실제 ticketId/가격은
 * `POST /api/tickets/select/seat`(2026-07-29, 백엔드 팀 정식 구현 — 임시로 있던
 * `GET /api/tickets`를 대체함)로 조회할 수 있다 — order-api.ts의 주문 생성이 이
 * ticketId를 그대로 사용한다.
 *
 * GET /api/performances 는 과거 hall/venue 조인 버그(VEN404_002, 2026-07-26 기준)가
 * 있었으나 이후 해결 확인됨(2026-07-28). 다만 이 클라이언트는 여전히 hallId만 필요한
 * /api/performances/detail 계열을 쓴다(요청 필드가 더 적어서 그대로 유지).
 */

export const BASE_URL = process.env.NEXT_PUBLIC_PERFORMANCE_API_BASE_URL ?? 'http://localhost:8083'

export interface RealPerformance {
  performanceId: number
  title: string
  description: string
  runtime: number
  startDate: string
  endDate: string
  ticketOpenAt: string
  hallId: number
}

export interface RealSession {
  sessionNum: number
  performanceId: number
  actor: string
  performanceStartAt: string
}

export type RealTicketStatus = 'AVAILABLE' | 'HOLD' | 'RESERVED' | 'CANCELED'

export interface RealTicket {
  ticketId: number
  seatRow: string
  seatNum: string
  ticketStatus: RealTicketStatus
}

/** POST /api/tickets/select/seat 응답 — 구역 가격은 좌석 목록과 함께 한 번에 내려온다 */
export interface RealTicketZone {
  zone: string
  price: number
  sessionZones: RealTicket[]
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  code: string | null
  message: string | null
}

export class PerformanceApiError extends Error {
  code: string | null
  status: number
  constructor(message: string, code: string | null, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init)
  // DELETE /api/performances/{id}는 ApiResponse 봉투 없이 204 No Content로 응답한다.
  if (res.status === 204) return null as T
  const body = (await res.json()) as ApiResponse<T>
  if (!res.ok || !body.success) {
    throw new PerformanceApiError(body.message ?? '요청이 실패했습니다.', body.code, res.status)
  }
  return body.data as T
}

export interface RegisterPerformanceInput {
  title: string
  description: string
  runtime: number
  startDate: string
  endDate: string
  ticketOpenAt: string
  hallId: number
  /** S3에 업로드한 포스터 이미지의 objectKey(또는 URL). imagesApi.getUploadUrl() 참고 */
  postUrl: string
  sessions: { sessionNum: number; actor: string; performanceStartAt: string }[]
  seatPrices: { zone: string; price: number }[]
}

export interface UpdatePerformanceInput {
  title: string
  description: string
  runtime: number
  startDate: string
  endDate: string
  ticketOpenAt: string
  hallId: number
}

export const performanceApi = {
  /** GET /api/performances/detail — 전체 공연 목록 (원본 정보만) */
  list(): Promise<RealPerformance[]> {
    return request<RealPerformance[]>('/api/performances/detail')
  },

  /** GET /api/performances/detail/{id} */
  get(performanceId: number): Promise<RealPerformance> {
    return request<RealPerformance>(`/api/performances/detail/${performanceId}`)
  },

  /** GET /api/performance/{id}/session */
  sessions(performanceId: number): Promise<RealSession[]> {
    return request<RealSession[]>(`/api/performance/${performanceId}/session`)
  },

  /** POST /api/tickets/select/seat — 회차+구역의 좌석(티켓) 목록 + 구역 가격. 좌석 클릭 → 실제 ticketId 매핑에 사용 */
  selectSeatZone(performanceId: number, sessionNum: number, zone: string): Promise<RealTicketZone> {
    return request<RealTicketZone>('/api/tickets/select/seat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ performanceId, sessionNum, zone }),
    })
  },

  /**
   * POST /api/v2/performances — 공연+회차+좌석가격 등록(티켓 발행까지 한 번에).
   * 응답에 생성된 performanceId가 안 내려오므로, 호출 뒤 title로 목록을 다시 조회해서 찾아야 한다.
   */
  register(input: RegisterPerformanceInput, sellerId: number): Promise<void> {
    return request<null>('/api/v2/performances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: sellerId,
        performanceRequest: {
          title: input.title,
          description: input.description,
          runtime: input.runtime,
          startDate: input.startDate,
          endDate: input.endDate,
          ticketOpenAt: input.ticketOpenAt,
          hallId: input.hallId,
          postUrl: input.postUrl,
        },
        sessionRequests: input.sessions,
        seatPriceRequests: input.seatPrices,
      }),
    }).then(() => undefined)
  },

  /** PUT /api/performances/{id} — 공연 기본 정보 수정. 판매자 소유 확인용 X-User-Id 헤더 필요 */
  update(performanceId: number, input: UpdatePerformanceInput, sellerId: number): Promise<void> {
    return request<null>(`/api/performances/${performanceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': String(sellerId) },
      body: JSON.stringify(input),
    }).then(() => undefined)
  },

  /** DELETE /api/performances/{id} — 판매자 소유 확인용 X-User-Id 헤더 필요 */
  delete(performanceId: number, sellerId: number): Promise<void> {
    return request<null>(`/api/performances/${performanceId}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': String(sellerId) },
    }).then(() => undefined)
  },
}

export interface ImageUploadUrl {
  uploadUrl: string
  objectKey: string
}

// performance-service application.properties의 cloud.aws.s3.bucket / cloud.aws.region 값.
// S3ImageService의 조회용 presigned URL(createReadUrl)은 주석 처리되어 미구현 상태라
// 업로드된 객체는 버킷 직접 URL로 조회한다.
const S3_BUCKET = 'team01-reseat-bucket'
const S3_REGION = 'ap-northeast-2'

export const imagesApi = {
  /**
   * POST /api/images/upload-url — 포스터 등 이미지의 S3 presigned PUT URL 발급.
   * S3ImageController가 ImgUploadUrlResponse를 ApiResponse envelope 없이 그대로 반환하므로
   * (다른 performance-service 엔드포인트와 다름) request<T> 헬퍼를 쓰지 않는다.
   */
  async getUploadUrl(fileName: string, contentType: string): Promise<ImageUploadUrl> {
    const res = await fetch(`${BASE_URL}/api/images/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, contentType }),
    })
    if (!res.ok) {
      throw new Error('이미지 업로드 준비에 실패했습니다.')
    }
    return res.json() as Promise<ImageUploadUrl>
  },

  /** presigned PUT URL로 업로드한 이미지의 공개 조회 URL */
  toDisplayUrl(objectKey: string): string {
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${objectKey}`
  },
}
