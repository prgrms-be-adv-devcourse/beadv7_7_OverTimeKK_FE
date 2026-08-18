'use client'

import { useCallback, useEffect, useState } from 'react'
import { standbyApi, StandbyApiError, type StandbyZoneRank } from './standby-api'
import { standbyStore, type StandbyRecord } from './standby-store'

export interface StandbySummaryEntry {
  record: StandbyRecord
  zoneRanks: StandbyZoneRank[]
}

const POLL_INTERVAL_MS = 15000

/** 내 대기 신청 목록을 로컬 저장소 기준으로 조회하고, 각 건의 순위/매칭 상태를 주기적으로 갱신한다. */
export function useMyStandby(userId: string, accessToken: string) {
  const [entries, setEntries] = useState<StandbySummaryEntry[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const records = standbyStore.list(userId)
    if (records.length === 0) {
      setEntries([])
      return
    }
    setLoading(true)
    const results = await Promise.all(
      records.map(async (record): Promise<StandbySummaryEntry | null> => {
        try {
          const detail = await standbyApi.get(record.standbyId, accessToken)
          if (detail.zoneRanks.some((z) => z.isHeld)) {
            standbyStore.markHeld(userId, record.standbyId)
          } else {
            standbyStore.clearHeld(userId, record.standbyId)
          }
          return { record, zoneRanks: detail.zoneRanks }
        } catch (error) {
          if (
            error instanceof StandbyApiError &&
            (error.code === 'STB404_001' || error.code === 'STB409_004')
          ) {
            standbyStore.remove(userId, record.standbyId)
            return null
          }
          // 일시적 조회 실패 — 목록에는 남기고 순위 정보만 비워둔다.
          return { record, zoneRanks: [] }
        }
      }),
    )
    setEntries(results.filter((r): r is StandbySummaryEntry => r != null))
    setLoading(false)
  }, [userId, accessToken])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  return { entries, loading, refresh }
}
