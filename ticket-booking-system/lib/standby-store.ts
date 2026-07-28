/**
 * 내 대기 신청(Standby) 목록 — 브라우저 localStorage 기반 로컬 저장소
 * ------------------------------------------------------------------
 * 백엔드에는 "내 대기 목록 전체 조회" API가 없고 GET /api/standby/{id} 로
 * 단건 조회만 가능하다 (docs/standby-api-frontend-guide.md 참고). 그래서
 * 대기 신청에 성공할 때마다 standbyId 를 여기에 보관해두고, 목록 화면에서는
 * 저장된 id들을 순회하며 각각 조회한다. 새 기기/브라우저에서는 기록이
 * 없어 목록이 비어 보이는 한계가 있다 — 실제 "내 목록" API가 추가되면 대체.
 */

import type { Zone } from './types'

export interface StandbyRecord {
  standbyId: number
  performanceId: string
  sessionId: string
  sessionNum: number
  /** 신청 시점의 지망 구역. 이후 구역별 취소로 줄어든다. */
  zones: Zone[]
  createdAt: string
  /** 매칭(isHeld) 최초 감지 시각. 백엔드가 만료시각을 제공하지 않아 30분 제한을 근사 계산하는 데 쓴다. */
  heldSince?: string
}

function storageKey(userId: string): string {
  return `standby:${userId}`
}

function readAll(userId: string): StandbyRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as StandbyRecord[]) : []
  } catch {
    return []
  }
}

function writeAll(userId: string, records: StandbyRecord[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(userId), JSON.stringify(records))
}

export const standbyStore = {
  list(userId: string): StandbyRecord[] {
    return readAll(userId)
  },

  add(userId: string, record: StandbyRecord): void {
    const records = readAll(userId)
    records.push(record)
    writeAll(userId, records)
  },

  remove(userId: string, standbyId: number): void {
    writeAll(userId, readAll(userId).filter((r) => r.standbyId !== standbyId))
  },

  removeZone(userId: string, standbyId: number, zone: Zone): void {
    const next = readAll(userId)
      .map((r) => (r.standbyId === standbyId ? { ...r, zones: r.zones.filter((z) => z !== zone) } : r))
      .filter((r) => r.zones.length > 0)
    writeAll(userId, next)
  },

  markHeld(userId: string, standbyId: number): void {
    const records = readAll(userId)
    const target = records.find((r) => r.standbyId === standbyId)
    if (target && !target.heldSince) {
      target.heldSince = new Date().toISOString()
      writeAll(userId, records)
    }
  },

  clearHeld(userId: string, standbyId: number): void {
    const records = readAll(userId)
    const target = records.find((r) => r.standbyId === standbyId)
    if (target && target.heldSince) {
      target.heldSince = undefined
      writeAll(userId, records)
    }
  },
}
