'use client'

import { readAuth, writeAuth, clearAuth, type StoredAuth } from './auth-store'
import { userApi } from './user-api'

/**
 * accessToken이 백그라운드에서 갱신되거나(refresh 성공) 완전히 만료됐을 때(refresh 실패)
 * 전역에 알리는 이벤트명. lib/store.tsx의 AppProvider가 구독해 React auth 상태를 동기화한다 —
 * 이 파일은 순수 모듈이라 React 상태를 직접 못 건드리므로 window 이벤트로 알리는 방식을 쓴다.
 */
export const AUTH_REFRESHED_EVENT = 'reseat:auth-refreshed'
export const AUTH_EXPIRED_EVENT = 'reseat:auth-expired'

let refreshing: Promise<StoredAuth | null> | null = null

/**
 * accessToken 만료(401)를 감지했을 때 호출한다. 여러 요청이 동시에 401을 받아도
 * 실제 갱신 호출은 한 번만 나가도록(single-flight) 이미 진행 중인 Promise를 공유한다.
 * 성공하면 localStorage에 새 토큰을 반영하고 그 값을 반환하며, refresh token마저
 * 만료/무효라면 로컬 세션을 정리하고 null을 반환한다.
 */
export function refreshAccessTokenOnce(): Promise<StoredAuth | null> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

async function doRefresh(): Promise<StoredAuth | null> {
  const stored = readAuth()
  if (!stored) return null
  try {
    const tokens = await userApi.refresh(stored.refreshToken)
    // 사용자 정보(username/userType)는 refresh로 바뀌지 않으므로 재조회 없이 그대로 재사용한다.
    const nextAuth: StoredAuth = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: stored.user,
    }
    writeAuth(nextAuth)
    notify(AUTH_REFRESHED_EVENT, nextAuth)
    return nextAuth
  } catch {
    clearAuth()
    notify(AUTH_EXPIRED_EVENT)
    return null
  }
}

function notify(event: string, detail?: StoredAuth): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(event, { detail }))
}

/**
 * accessToken을 실은 요청이 401을 받았을 때만 갱신을 한 번 시도하고 새 토큰으로 정확히 한 번
 * 재시도한다. accessToken 없이 보낸 요청(로그인 등)의 401은 세션 만료가 아니므로 건드리지 않고,
 * 갱신에 실패하면(refresh token도 만료) 원래 에러를 그대로 던진다 — 호출부의 기존 에러 처리를
 * 그대로 재사용할 수 있게.
 */
export async function withAuthRetry<T>(
  accessToken: string | undefined,
  isUnauthorized: (error: unknown) => boolean,
  call: (accessToken: string | undefined) => Promise<T>,
): Promise<T> {
  try {
    return await call(accessToken)
  } catch (error) {
    if (!accessToken || !isUnauthorized(error)) throw error
    const refreshed = await refreshAccessTokenOnce()
    if (!refreshed) throw error
    return call(refreshed.accessToken)
  }
}
