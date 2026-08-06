'use client'

import { useEffect, useState } from 'react'
import { Check, Bell } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ZoneBadge } from '@/components/status-badges'
import { useApp } from '@/lib/store'
import { formatDay, formatTime, ZONE_META } from '@/lib/domain'
import { cn } from '@/lib/utils'
import type { Performance, PerformanceSession, Zone } from '@/lib/types'
import { standbyApi, standbyErrorMessage, toBackendPerformanceId } from '@/lib/standby-api'
import { standbyStore } from '@/lib/standby-store'

const MAX_ZONES = 3

export function WaitlistDialog({
  open,
  onOpenChange,
  performance,
  session,
  zones,
  prefillZones = [],
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  performance: Performance
  session: PerformanceSession
  zones: Zone[]
  prefillZones?: Zone[]
}) {
  const { authUser } = useApp()
  const [selected, setSelected] = useState<Zone[]>([])
  const [submitting, setSubmitting] = useState(false)
  const availableZones = zones

  useEffect(() => {
    // 다이얼로그가 열릴 때에만 선택 상태를 초기화한다.
    // prefillZones/zones 는 매 렌더마다 새 배열 참조라 의존성에 넣으면
    // 구역 선택 시 리렌더 → 이펙트 재실행 → 선택이 즉시 초기화되는 버그가 발생한다.
    if (open) {
      setSelected(prefillZones.filter((zone) => zones.includes(zone)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle(zone: Zone) {
    if (!availableZones.includes(zone)) {
      toast.info('대기 신청은 매진된 구역만 선택할 수 있습니다.')
      return
    }

    setSelected((prev) => {
      if (prev.includes(zone)) return prev.filter((z) => z !== zone)
      if (prev.length >= MAX_ZONES) {
        toast.info(`대기 구역은 최대 ${MAX_ZONES}개까지 선택할 수 있습니다.`)
        return prev
      }
      return [...prev, zone]
    })
  }

  async function handleSubmit() {
    if (!authUser) {
      toast.error('로그인이 필요합니다.')
      return
    }
    setSubmitting(true)
    try {
      const result = await standbyApi.create({
        userId: authUser.userId,
        performanceId: toBackendPerformanceId(performance.id),
        sessionNum: session.sessionNum,
        zones: selected,
      })
      standbyStore.add(String(authUser.userId), {
        standbyId: result.standbyId,
        performanceId: performance.id,
        sessionId: session.id,
        sessionNum: session.sessionNum,
        zones: result.zones,
        createdAt: new Date().toISOString(),
      })
      toast.success('취소표 대기 신청이 완료되었습니다.', {
        description: '취소표가 나오면 순서대로 알려드립니다.',
      })
      onOpenChange(false)
    } catch (e) {
      toast.error(standbyErrorMessage(e, '대기 신청에 실패했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            취소표 대기 신청
          </DialogTitle>
          <DialogDescription>
            {performance.title} · {session.sessionNum}회차{' '}
            {formatDay(session.performanceStartAt)} {formatTime(session.performanceStartAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          현재 공연 기준으로 매진된 VIP석과 S석만 대기 신청할 수 있습니다. 선택한 구역 중 취소표가
          나오면 대기 순서에 따라 한 명에게 우선 예매권이 부여되며, 제한 시간(30분) 내 결제하지
          않으면 다음 대기자에게 넘어갑니다.
        </div>

        <div className="space-y-2">
          {availableZones.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              현재 대기 가능한 매진 구역이 없습니다.
            </div>
          ) : (
            availableZones.map((zone) => {
              const active = selected.includes(zone)
              return (
                <button
                  key={zone}
                  type="button"
                  onClick={() => toggle(zone)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-3 py-3 transition-colors',
                    active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                  )}
                >
                <span className="flex items-center gap-2">
                  <ZoneBadge zone={zone} />
                  <span className="text-sm font-medium">{ZONE_META[zone].label} 대기</span>
                </span>
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full border',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border',
                    )}
                  >
                    {active && <Check className="size-3.5" />}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>선택한 구역</span>
          <span className="font-medium text-foreground">
            {selected.length} / {MAX_ZONES}
          </span>
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={selected.length === 0 || submitting}
          onClick={handleSubmit}
        >
          {submitting ? '신청 중...' : '대기 신청하기'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
