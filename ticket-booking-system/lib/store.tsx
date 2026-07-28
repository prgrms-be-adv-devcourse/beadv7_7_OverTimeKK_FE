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
import { api } from './api'
import { BUYER_ID, SELLER_ID } from './mock-data'
import { performanceApi } from './performance-api'
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
  /** 현재 활동 사용자 ID */
  userId: string
  userName: string
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
  const [role, setRole] = useState<UserRole>('BUYER')
  const [version, setVersion] = useState(0)
  const [heldSeat, setHeldSeat] = useState<HeldSeat | null>(null)
  const [performancesLoaded, setPerformancesLoaded] = useState(false)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const holdSeat = useCallback((seat: HeldSeat) => setHeldSeat(seat), [])
  const releaseSeat = useCallback(() => setHeldSeat(null), [])

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

  const userId = role === 'BUYER' ? BUYER_ID : SELLER_ID
  const user = api.getUser(userId)

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
      role,
      setRole,
      userId,
      userName: user?.name ?? '사용자',
      points: user?.points ?? 0,
      version,
      refresh,
      performancesLoaded,
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
  }, [role, version, userId, user?.name, user?.points, refresh, performancesLoaded, withRefresh, heldSeat, holdSeat, releaseSeat])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
