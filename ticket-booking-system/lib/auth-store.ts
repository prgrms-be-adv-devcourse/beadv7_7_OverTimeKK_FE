/**
 * 로그인 토큰/사용자 정보를 localStorage에 저장하는 순수 persistence 계층 (React 의존 없음).
 * lib/standby-store.ts(persistence) + lib/use-standby.ts(React hook) 분리 패턴을 그대로 따름.
 *
 * 로그인 사용자는 브라우저 탭당 항상 1명뿐이라 standby:{userId}처럼 동적 세그먼트를
 * 둘 필요 없이, lib/performance-extras.ts의 'reseat:xxx' 전역 키 컨벤션을 쓴다.
 */

import type { UserType } from './user-api'

const AUTH_STORAGE_KEY = 'reseat:auth'

export interface StoredAuthUser {
  userId: number
  username: string
  userType: UserType
}

export interface StoredAuth {
  accessToken: string
  refreshToken: string
  user: StoredAuthUser
}

export function readAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredAuth) : null
  } catch {
    return null
  }
}

export function writeAuth(auth: StoredAuth): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
  } catch {
    // 저장 실패해도(용량 초과 등) 이번 세션 동작에는 지장 없음
  }
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // no-op
  }
}
