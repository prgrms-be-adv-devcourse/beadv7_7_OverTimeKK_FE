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

export const BASE_URL = process.env.NEXT_PUBLIC_PERFORMANCE_API_BASE_URL ?? 'http://localhost:8080'

export interface RealPerformance {
  performanceId: number
  title: string
  description: string
  runtime: number
  startDate: string
  endDate: string
  ticketOpenAt: string
  hallId: number
  /** 포스터 이미지 presigned GET URL. 발급 후 1800초(30분)면 만료되므로 캐시하지 말고 매번 새로 조회할 것 */
  postUrl: string
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

/**
 * GET /api/performances/{id}/sessions/seats 응답의 sessions 배열 원소 — 회차 x 구역 한 줄.
 * performanceStartAt가 이미 지난 회차는 zone/price/availableSeatCount가 전부 null로 내려온다.
 */
export interface RealSessionSeat {
  sessionNum: number
  performanceStartAt: string
  actor: string
  zone: string | null
  price: number | null
  availableSeatCount: number | null
}

/** GET /api/performances/{id}/sessions/seats 응답 — 전체 회차 x 구역의 가격/잔여석을 한 번에 내려준다 */
export interface RealPerformanceSessionSeats {
  performanceId: number
  ticketOpenAt: string
  sessions: RealSessionSeat[]
}

/**
 * PUT /api/tickets/status/hold 응답 — 이 호출이 실제로 좌석을 5분간 hold한다(TimeLimits.orderHoldTicket5Min).
 * holdExpiredAt/holdKey는 서버가 생성한 값 그대로 order-api.ts의 createOrder에 넘겨야 한다
 * (order-service의 CreateOrderRequest가 이 세 값을 그대로 검증에 사용 — 클라이언트가 임의로 만들면 안 됨).
 */
export interface TicketHoldResult {
  ticketId: number
  price: number
  holdExpiredAt: string
  holdKey: string
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

async function request<T>(path: string, init?: RequestInit & { accessToken?: string }): Promise<T> {
  const { accessToken, headers, ...rest } = init ?? {}
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  })
  // DELETE /api/performances/{id}는 ApiResponse 봉투 없이 204 No Content로 응답한다.
  if (res.status === 204) return null as T
  const body = (await res.json()) as ApiResponse<T>
  if (!res.ok || !body.success) {
    if (res.status === 401) {
      throw new PerformanceApiError('로그인 정보를 확인하세요.', body.code, res.status)
    }
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

/** GET /api/performances?page= 목록 한 줄 — 상세 화면과 달리 요약 필드(hallName 포함, hallId 없음)만 내려온다 */
export interface RealPerformanceListItem {
  performanceId: number
  title: string
  startDate: string
  endDate: string
  hallName: string
  /** 포스터 이미지 presigned GET URL. 발급 후 1800초(30분)면 만료되므로 캐시하지 말 것 */
  postUrl: string
}

export interface RealPerformanceListPage {
  pageCount: number
  performances: RealPerformanceListItem[]
}

export const performanceApi = {
  /** GET /api/performances/detail — 전체 공연 목록 (원본 정보만) */
  list(): Promise<RealPerformance[]> {
    return request<RealPerformance[]>('/api/performances/detail')
  },

  /** GET /api/performances?page={page} — 홈 화면 공연 목록(서버 페이지네이션) */
  listPaged(page: number): Promise<RealPerformanceListPage> {
    return request<RealPerformanceListPage>(`/api/performances?page=${page}`)
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
   * GET /api/performances/{id}/sessions/seats — 티켓 오픈 시각 + 전체 회차 x 구역의
   * 가격/잔여석을 한 번에 조회. 예매 패널의 회차별 구역 가격·잔여석 표시가 이 응답 하나로
   * 충분해서, 구역마다 좌석 단위로 내려주는 selectSeatZone()을 반복 호출할 필요가 없다.
   */
  sessionSeats(performanceId: number): Promise<RealPerformanceSessionSeats> {
    return request<RealPerformanceSessionSeats>(`/api/performances/${performanceId}/sessions/seats`)
  },

  /**
   * PUT /api/tickets/status/hold — orderApi.createOrder 전에 반드시 한 번 호출해야 한다.
   * 여기서 받은 price/holdExpiredAt/holdKey를 그대로 주문 생성에 넘긴다.
   * 좌석을 5분간 hold하므로, 호출 후 사용자가 이탈하면 releaseTicket()으로 명시적으로
   * 풀어줘야 한다(이후 네트워크 등 추가적인상황으로 오류 발생을 대비해 서버 스케줄러가 자동 해제).
   * (booking-dialog.tsx는 "좌석 선택 완료" 클릭 시). 신원은 accessToken에서 서버가 식별한다.
   */
  holdTicket(ticketId: number, accessToken: string, orderType: 'GENERAL' | 'STANDBY' = 'GENERAL'): Promise<TicketHoldResult> {
    return request<TicketHoldResult>('/api/tickets/status/hold', {
      method: 'PUT',
      accessToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, orderType }),
    })
  },

  /**
   * PUT /api/tickets/status/release — holdTicket()으로 잡아둔 hold를 결제 전에 취소한다.
   * holdKey는 holdTicket() 응답에서 받은 값을 그대로 넘겨야 한다(다른 사람의 hold를 못 풀게 하는 검증용).
   */
  releaseTicket(ticketId: number, holdKey: string): Promise<void> {
    return request<null>('/api/tickets/status/release', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, holdKey }),
    }).then(() => undefined)
  },

  /**
   * POST /api/v2/performances — 공연+회차+좌석가격 등록(티켓 발행까지 한 번에).
   * 응답에 생성된 performanceId가 안 내려오므로, 호출 뒤 title로 목록을 다시 조회해서 찾아야 한다.
   */
  register(input: RegisterPerformanceInput, accessToken: string): Promise<void> {
    return request<null>('/api/v2/performances', {
      method: 'POST',
      accessToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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

  /** PUT /api/performances/{id} — 공연 기본 정보 수정. 판매자 소유 확인은 accessToken에서 서버가 식별 */
  update(performanceId: number, input: UpdatePerformanceInput, accessToken: string): Promise<void> {
    return request<null>(`/api/performances/${performanceId}`, {
      method: 'PUT',
      accessToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then(() => undefined)
  },

  /** DELETE /api/performances/{id} — 판매자 소유 확인은 accessToken에서 서버가 식별 */
  delete(performanceId: number, accessToken: string): Promise<void> {
    return request<null>(`/api/performances/${performanceId}`, {
      method: 'DELETE',
      accessToken,
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
  /** POST /api/images/upload-url — 포스터 등 이미지의 S3 presigned PUT URL 발급. 다른 엔드포인트와 동일한 ApiResponse envelope으로 응답한다. */
  getUploadUrl(fileName: string, contentType: string, fileSize: number): Promise<ImageUploadUrl> {
    return request<ImageUploadUrl>('/api/images/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, contentType, fileSize }),
    })
  },

  /** presigned PUT URL로 업로드한 이미지의 공개 조회 URL */
  toDisplayUrl(objectKey: string): string {
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${objectKey}`
  },
}
