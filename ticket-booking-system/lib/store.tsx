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
import { userApi, type SignUpBusinessInput, type SignUpIndividualInput } from './user-api'
import { readAuth, writeAuth, clearAuth, type StoredAuth, type StoredAuthUser } from './auth-store'
import type { UserRole, Zone } from './types'

/** 좌석 선택 중 임시로 점유된 좌석. 새로고침 시 초기화되고, 페이지 이동만으로는 유지된다. */
export interface HeldSeat {
  performanceId: string
  sessionId: string
  zone: Zone
  seatId: string
}

interface AppContextValue {
  role: UserRole
  setRole: (role: UserRole) => void
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
   * 실 user-service 로그인 상태. 기존 role(BUYER/SELLER) 토글과는 완전히 별개다 —
   * role은 여전히 화면 전환용 mock 토글이고, authUser는 실제 로그인 여부만 나타낸다.
   * 로그인 안 했으면 null. 마운트 시 localStorage에서 복원되기 전엔 authLoading이 true.
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
  cancelOrder: typeof api.cancelOrder
  requestCancelOrder: typeof api.requestCancelOrder

  // 판매자 액션
  createPerformance: typeof api.createPerformance
  updatePerformance: typeof api.updatePerformance
  deletePerformance: typeof api.deletePerformance
  createSession: typeof api.createSession
  deleteSession: typeof api.deleteSession
  setZonePrices: typeof api.setZonePrices
  sellerCancelPerformance: (performanceId: string) => void
  runPointReward: () => number
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [roleState, setRoleState] = useState<UserRole>('BUYER')
  const [version, setVersion] = useState(0)
  const [heldSeat, setHeldSeat] = useState<HeldSeat | null>(null)
  const [performancesLoaded, setPerformancesLoaded] = useState(false)
  const [auth, setAuth] = useState<StoredAuth | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const holdSeat = useCallback((seat: HeldSeat) => setHeldSeat(seat), [])
  const releaseSeat = useCallback(() => setHeldSeat(null), [])

  // 마운트 시 localStorage에 저장된 로그인 상태를 복원한다. 백엔드에 다시 검증하지는
  // 않음(액세스 토큰 만료/자동 갱신은 범위 밖) — 로그인 필요한 호출이 401을 받으면
  // 그 화면에서 개별적으로 처리한다.
  useEffect(() => {
    setAuth(readAuth())
    setAuthLoading(false)
  }, [])

  // 개인(INDIVIDUAL) 회원은 판매자 화면으로 전환할 수 없다. 로그인 중 SELLER로 바뀌는
  // 걸 막는 것과 별개로, 이미 SELLER인 상태에서 개인 계정으로 로그인/전환되면 되돌린다.
  useEffect(() => {
    if (auth?.user.userType === 'INDIVIDUAL' && roleState === 'SELLER') {
      setRoleState('BUYER')
      toast.error('개인 회원은 판매자로 전환할 수 없습니다.')
    }
  }, [auth, roleState])

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

  const setRole = useCallback(
    (next: UserRole) => {
      if (next === 'SELLER' && auth?.user.userType === 'INDIVIDUAL') {
        toast.error('개인 회원은 판매자로 전환할 수 없습니다.')
        return
      }
      setRoleState(next)
    },
    [auth],
  )

  const loginWithCredentials = useCallback(async (username: string, password: string) => {
    const tokens = await userApi.login(username, password)
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
      role: roleState,
      setRole,
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
      cancelOrder: withRefresh(api.cancelOrder.bind(api)),
      requestCancelOrder: withRefresh(api.requestCancelOrder.bind(api)),
      createPerformance: withRefresh(api.createPerformance.bind(api)),
      updatePerformance: withRefresh(api.updatePerformance.bind(api)),
      deletePerformance: withRefresh((id: string) => {
        api.deletePerformance(id)
      }),
      createSession: withRefresh(api.createSession.bind(api)),
      deleteSession: withRefresh((sessionId: string) => {
        api.deleteSession(sessionId)
      }),
      setZonePrices: withRefresh(api.setZonePrices.bind(api)),
      sellerCancelPerformance: withRefresh((performanceId: string) => {
        api.sellerCancelPerformance(performanceId)
      }),
      runPointReward: withRefresh(api.runPointReward.bind(api)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roleState,
    setRole,
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
