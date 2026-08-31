'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { api } from './api'
import { performanceApi } from './performance-api'
import { orderApi } from './order-api'
import { userApi, UserApiError, type SignUpBusinessInput, type SignUpIndividualInput } from './user-api'
import { readAuth, writeAuth, clearAuth, type StoredAuth, type StoredAuthUser } from './auth-store'
import { refreshAccessTokenOnce, AUTH_REFRESHED_EVENT, AUTH_EXPIRED_EVENT } from './auth-refresh'
import type { Zone } from './types'

/** 좌석 선택 중 임시로 점유된 좌석. 새로고침 시 초기화되고, 페이지 이동만으로는 유지된다. */
export interface HeldSeat {
  performanceId: string
  sessionId: string
  zone: Zone
  seatId: string
}

interface AppContextValue {
  /** 실 로그인 사용자의 mock 장부 ID(문자열로 변환된 authUser.userId). 로그인 안 했으면 null. */
  userId: string | null
  userName: string
  /** 실 포인트 잔액(order-service `GET /api/points/balance`). 비로그인/조회 실패 시 0. */
  points: number
  /** 데이터 변경 카운터 — 구독 컴포넌트 리렌더 트리거 */
  version: number
  refresh: () => void
  /**
   * 실제 performance-service 공연 fetch 시도가 끝났는지(성공/실패 무관).
   * true가 되기 전엔 "존재하지 않는 공연"인지 "아직 안 불러왔을 뿐"인지 구분할 수 없으므로,
   * 실제 공연 상세 페이지 등에서 notFound() 판단은 이 값이 true인 뒤에만 해야 한다.
   */
  performancesLoaded: boolean

  /**
   * 실 user-service 로그인 상태. 로그인 안 했으면 null.
   * 마운트 시 localStorage에서 복원되기 전엔 authLoading이 true.
   * 화면 접근 범위는 authUser.userType('INDIVIDUAL' | 'BUSINESS')으로 결정된다 —
   * BUSINESS는 구매자 기능에 판매자 기능(공연 관리, 판매자 마이페이지)이 추가로 열린다.
   */
  authUser: StoredAuthUser | null
  /** 인증 필요 API 호출 시 Authorization: Bearer 헤더로 그대로 실어 보낼 값. 비로그인 시 null. */
  accessToken: string | null
  authLoading: boolean
  loginWithCredentials: (username: string, password: string) => Promise<void>
  signUpIndividual: (input: SignUpIndividualInput) => Promise<void>
  signUpBusiness: (input: SignUpBusinessInput) => Promise<void>
  logoutAuth: () => Promise<void>

  /** 현재 점유 중인 좌석 (한 번에 하나만 선택 가능) */
  heldSeat: HeldSeat | null
  /** 좌석을 점유한다. 이미 점유된 좌석이 있다면 자동으로 해제되고 새 좌석으로 대체된다. */
  holdSeat: (seat: HeldSeat) => void
  /** 점유를 해제한다. */
  releaseSeat: () => void

  // 구매자 액션
  createOrder: typeof api.createOrder
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const [heldSeat, setHeldSeat] = useState<HeldSeat | null>(null)
  const [performancesLoaded, setPerformancesLoaded] = useState(false)
  const [auth, setAuth] = useState<StoredAuth | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const holdSeat = useCallback((seat: HeldSeat) => setHeldSeat(seat), [])
  const releaseSeat = useCallback(() => setHeldSeat(null), [])

  // 마운트 시 localStorage에 저장된 로그인 상태를 서버에 재검증한다. 토큰 만료 여부를
  // 로컬에서 판단할 방법이 없어서(만료 시각을 저장해두지 않음) getMe()로 실제로 찔러본다.
  // 401(만료/무효)이면 refresh 시도 → 그마저 실패하면 로그아웃 처리. 네트워크 에러 등
  // getMe 자체가 서버에 도달 못 한 경우는 토큰 유효성과 무관하므로 로그아웃시키지 않고
  // 저장된 값을 그대로 믿는다 — 백엔드 미기동 시에도 mock만으로 앱이 동작해야 하는
  // 기존 컨벤션(lib/store.tsx의 pointsBalance 조회 등)과 맞춤.
  useEffect(() => {
    const stored = readAuth()
    if (!stored) {
      setAuthLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        await userApi.getMe(stored.accessToken)
        if (!cancelled) setAuth(stored)
      } catch (error) {
        if (!(error instanceof UserApiError) || error.status !== 401) {
          if (!cancelled) setAuth(stored)
          return
        }
        // lib/auth-refresh.ts의 공용 갱신 로직을 그대로 재사용한다(성공/실패 시
        // AUTH_REFRESHED_EVENT/AUTH_EXPIRED_EVENT도 함께 쐈다가 아래 리스너 effect가 반영함) —
        // 여기서도 반환값으로 즉시 반영해서 첫 렌더부터 최신 상태가 보이게 한다.
        const refreshed = await refreshAccessTokenOnce()
        if (!cancelled) setAuth(refreshed)
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 세션 중간에 어떤 API 호출이든 401을 받아 백그라운드에서 토큰이 갱신/만료되면
  // (lib/auth-refresh.ts의 withAuthRetry) 이 컴포넌트의 auth 상태도 그에 맞춰 동기화한다.
  // 이게 없으면 헤더 등은 계속 "로그인됨"으로 보이는데 실제 accessToken은 낡은 채로 남는다.
  useEffect(() => {
    function handleRefreshed(event: Event) {
      const detail = (event as CustomEvent<StoredAuth>).detail
      if (detail) setAuth(detail)
    }
    function handleExpired() {
      setAuth(null)
      toast.error('세션이 만료되어 로그아웃되었습니다.', { description: '다시 로그인해 주세요.' })
    }
    window.addEventListener(AUTH_REFRESHED_EVENT, handleRefreshed)
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired)
    return () => {
      window.removeEventListener(AUTH_REFRESHED_EVENT, handleRefreshed)
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired)
    }
  }, [])

  // 실 로그인 사용자가 확인될 때마다(마운트 시 복원 포함) mock 장부 레코드를 보장해둔다 —
  // 없으면 포인트 0으로 새로 만들고, 있으면 그대로 둔다. (판매자 마이페이지 등 아직
  // mock 장부만 쓰는 화면을 위해 여전히 필요 — 아래 실 포인트 잔액 조회와는 별개)
  useEffect(() => {
    if (auth) {
      api.ensureMockUser(String(auth.user.userId), auth.user.username)
      setVersion((v) => v + 1)
    }
  }, [auth])

  // 헤더/예매 다이얼로그 등 앱 전역에서 쓰는 포인트 잔액은 실 API 기준.
  // version이 바뀔 때마다(결제 성공 후 payment/success의 mock createOrder 호출 포함) 다시 조회해서
  // 최신 잔액을 반영한다. 백엔드 미기동 등으로 실패해도 조용히 무시(0 유지) — mock만으로도 앱은 동작해야 함.
  const [pointsBalance, setPointsBalance] = useState(0)
  useEffect(() => {
    if (!auth) {
      setPointsBalance(0)
      return
    }
    let cancelled = false
    orderApi
      .getPointBalance(auth.accessToken)
      .then((res) => {
        if (!cancelled) setPointsBalance(res.balance)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [auth, version])

  const loginWithCredentials = useCallback(async (username: string, password: string) => {
    const tokens = await userApi.loginWithQueue(username, password)
    const me = await userApi.getMe(tokens.accessToken)
    const nextAuth: StoredAuth = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { userId: me.userId, username: me.username, userType: me.userType },
    }
    writeAuth(nextAuth)
    setAuth(nextAuth)
  }, [])

  const signUpIndividual = useCallback(
    async (input: SignUpIndividualInput) => {
      await userApi.signUpIndividual(input)
      await loginWithCredentials(input.username, input.password)
    },
    [loginWithCredentials],
  )

  const signUpBusiness = useCallback(
    async (input: SignUpBusinessInput) => {
      await userApi.signUpBusiness(input)
      await loginWithCredentials(input.username, input.password)
    },
    [loginWithCredentials],
  )

  const logoutAuth = useCallback(async () => {
    const token = auth?.accessToken
    try {
      if (token) await userApi.logout(token)
    } catch {
      // 실 로그아웃 호출이 실패해도(네트워크 등) 로컬 로그아웃은 항상 진행한다
    } finally {
      clearAuth()
      setAuth(null)
    }
  }, [auth])

  // 실제 performance-service의 공연/회차를 mock 목록에 추가로 불러온다.
  // 백엔드가 꺼져 있거나 실패해도 mock 데이터만으로 앱은 정상 동작해야 하므로 조용히 무시한다.
  useEffect(() => {
    let cancelled = false
    async function loadRealPerformances() {
      try {
        const realPerformances = await performanceApi.list()
        const items = await Promise.all(
          realPerformances.map(async (real) => ({
            real,
            sessions: await performanceApi.sessions(real.performanceId).catch(() => []),
          })),
        )
        if (cancelled) return
        api.importRealPerformances(items)
        setVersion((v) => v + 1)
      } catch {
        // 백엔드 미기동 등 — mock 데이터만으로 계속 진행
      } finally {
        if (!cancelled) setPerformancesLoaded(true)
      }
    }
    loadRealPerformances()
    return () => {
      cancelled = true
    }
  }, [])

  const userId = auth ? String(auth.user.userId) : null

  const withRefresh = useCallback(
    <TArgs extends unknown[], TReturn>(fn: (...args: TArgs) => TReturn) =>
      (...args: TArgs): TReturn => {
        const result = fn(...args)
        setVersion((v) => v + 1)
        return result
      },
    [],
  )

  const value = useMemo<AppContextValue>(() => {
    return {
      userId,
      userName: auth?.user.username ?? '게스트',
      points: pointsBalance,
      version,
      refresh,
      performancesLoaded,
      authUser: auth?.user ?? null,
      accessToken: auth?.accessToken ?? null,
      authLoading,
      loginWithCredentials,
      signUpIndividual,
      signUpBusiness,
      logoutAuth,
      heldSeat,
      holdSeat,
      releaseSeat,
      createOrder: withRefresh(api.createOrder.bind(api)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    version,
    userId,
    pointsBalance,
    refresh,
    performancesLoaded,
    auth,
    authLoading,
    loginWithCredentials,
    signUpIndividual,
    signUpBusiness,
    logoutAuth,
    withRefresh,
    heldSeat,
    holdSeat,
    releaseSeat,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
