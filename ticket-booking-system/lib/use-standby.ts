'use client'

import { useCallback, useEffect, useState } from 'react'
import { standbyApi, type StandbyListItem } from './standby-api'

const POLL_INTERVAL_MS = 15000

/** "내 대기 신청" 화면에서 다루는 상태 — RESERVED(결제 완료)/CANCELLED는 더 이상 활성 대기가 아니라서 제외. */
const ACTIVE_STATUSES = new Set<StandbyListItem['status']>(['WAITING', 'HELD'])

/** 내 대기 신청 목록을 서버(GET /api/standby)에서 직접 조회하고 15초 간격으로 갱신한다. */
export function useMyStandby(accessToken: string) {
  const [entries, setEntries] = useState<StandbyListItem[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setEntries([])
      return
    }
    setLoading(true)
    try {
      const list = await standbyApi.list(accessToken)
      setEntries(list.filter((item) => ACTIVE_STATUSES.has(item.status)))
    } catch (error) {
      console.warn('대기 목록 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  return { entries, loading, refresh }
}
