/**
 * 회원(User) 도메인 실제 백엔드 연동 클라이언트
 * ------------------------------------------------------------------
 * user-service (기본 http://localhost:8081) 의 회원가입/로그인/토큰갱신/내정보조회 API.
 *
 * userType(Role)은 'INDIVIDUAL' | 'BUSINESS' — 프론트의 role('BUYER'|'SELLER')과는
 * 다른 축의 개념이다(주문 화면에서 쓰는 role 토글과 이 로그인 상태는 lib/store.tsx에서
 * 의도적으로 분리되어 있음). 개인은 구매, 사업자는 공연 등록/판매 목적으로 가입한다고 가정.
 *
 * GET /api/users/{userId}는 서비스 간 내부 전용 API다(백엔드 컨트롤러 주석에 명시) —
 * 프론트는 절대 호출하면 안 되고, 반드시 GET /api/users/me(Authorization 헤더 기반)만 쓴다.
 */

const BASE_URL = process.env.NEXT_PUBLIC_USER_API_BASE_URL ?? 'http://localhost:8081'

export type UserType = 'INDIVIDUAL' | 'BUSINESS'
export type UserStatus = 'ACTIVE' | 'DORMANT' | 'WITHDRAWN'

export interface UserResponse {
  userId: number
  email: string
  username: string
  status: UserStatus
  userType: UserType
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  code: string | null
  message: string | null
}

export class UserApiError extends Error {
  code: string | null
  status: number
  constructor(message: string, code: string | null, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  USR409_001: '이미 사용 중인 아이디입니다.',
  USR409_002: '이미 사용 중인 이메일입니다.',
  USR409_003: '이미 등록된 사업자번호입니다.',
  USR404_001: '존재하지 않는 아이디입니다.',
  USR401_001: '비밀번호가 일치하지 않습니다.',
  USR401_002: '다시 로그인해주세요.',
  USR403_001: '탈퇴한 계정입니다.',
}

export function userErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UserApiError) {
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
    throw new UserApiError('회원 서버에 연결할 수 없습니다.', null, 0)
  }

  if (res.status === 204) return null

  let body: ApiResponse<T> | null = null
  try {
    body = (await res.json()) as ApiResponse<T>
  } catch {
    // no-op: 본문이 없거나 JSON이 아닌 응답
  }

  if (!res.ok || !body || !body.success) {
    throw new UserApiError(body?.message ?? '요청에 실패했습니다.', body?.code ?? null, res.status)
  }
  return body.data
}

export interface SignUpIndividualInput {
  username: string
  email: string
  password: string
}

export interface SignUpBusinessInput extends SignUpIndividualInput {
  businessName: string
  businessNumber: string
}

export const userApi = {
  // POST /api/users/signup/individual
  async signUpIndividual(input: SignUpIndividualInput): Promise<UserResponse> {
    const data = await request<UserResponse>('/api/users/signup/individual', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    if (!data) throw new UserApiError('회원가입 응답이 비어있습니다.', null, 500)
    return data
  },

  // POST /api/users/signup/business
  async signUpBusiness(input: SignUpBusinessInput): Promise<UserResponse> {
    const data = await request<UserResponse>('/api/users/signup/business', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    if (!data) throw new UserApiError('회원가입 응답이 비어있습니다.', null, 500)
    return data
  },

  // POST /api/users/login
  async login(username: string, password: string): Promise<LoginResponse> {
    const data = await request<LoginResponse>('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (!data) throw new UserApiError('로그인 응답이 비어있습니다.', null, 500)
    return data
  },

  // POST /api/users/token/refresh
  async refresh(refreshToken: string): Promise<LoginResponse> {
    const data = await request<LoginResponse>('/api/users/token/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })
    if (!data) throw new UserApiError('토큰 갱신 응답이 비어있습니다.', null, 500)
    return data
  },

  // POST /api/users/logout (Authorization 필요)
  async logout(accessToken: string): Promise<void> {
    await request<void>('/api/users/logout', { method: 'POST', accessToken })
  },

  // GET /api/users/me (Authorization 필요) — 다른 사용자 조회용 GET /api/users/{id}는 내부 전용이라 쓰지 않는다
  async getMe(accessToken: string): Promise<UserResponse> {
    const data = await request<UserResponse>('/api/users/me', { method: 'GET', accessToken })
    if (!data) throw new UserApiError('회원 정보 응답이 비어있습니다.', null, 500)
    return data
  },
}
