'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'
import { BUYER_ID, SELLER_ID } from './mock-data'
import type { UserRole, Zone } from './types'

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

  // 구매자 액션
  createOrder: typeof api.createOrder
  cancelOrder: typeof api.cancelOrder
  requestCancelOrder: typeof api.requestCancelOrder
  joinWaitlist: (input: { performanceId: string; sessionId: string; zones: Zone[] }) => void
  cancelWaitlist: (entryId: string) => void
  cancelWaitlistZone: (entryId: string, zone: Zone) => ReturnType<typeof api.cancelWaitlistZone>
  acceptWaitlistOffer: (entryId: string, method?: string) => ReturnType<typeof api.acceptWaitlistOffer>
  declineWaitlistOffer: (entryId: string) => void
  cancelWaitlistOffer: (entryId: string) => ReturnType<typeof api.cancelWaitlistOffer>
  simulateCancellation: (sessionId: string, zone: Zone) => ReturnType<typeof api.simulateCancellation>

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

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

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
      createOrder: withRefresh(api.createOrder.bind(api)),
      cancelOrder: withRefresh(api.cancelOrder.bind(api)),
      requestCancelOrder: withRefresh(api.requestCancelOrder.bind(api)),
      joinWaitlist: withRefresh((input: { performanceId: string; sessionId: string; zones: Zone[] }) =>
        api.joinWaitlist({ buyerId: userId, ...input }),
      ),
      cancelWaitlist: withRefresh((entryId: string) => api.cancelWaitlist(entryId)),
      cancelWaitlistZone: withRefresh((entryId: string, zone: Zone) => api.cancelWaitlistZone(entryId, zone)),
      acceptWaitlistOffer: withRefresh(api.acceptWaitlistOffer.bind(api)),
      declineWaitlistOffer: withRefresh((entryId: string) => {
        api.declineWaitlistOffer(entryId)
      }),
      cancelWaitlistOffer: withRefresh((entryId: string) => api.cancelWaitlistOffer(entryId)),
      simulateCancellation: withRefresh(api.simulateCancellation.bind(api)),
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
  }, [role, version, userId, user?.name, user?.points, refresh, withRefresh])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
