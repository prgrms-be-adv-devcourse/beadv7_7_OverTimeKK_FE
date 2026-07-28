import { Badge } from '@/components/ui/badge'
import { ZONE_META } from '@/lib/domain'
import { cn } from '@/lib/utils'
import type { OrderStatus, PerformanceStatus, Zone } from '@/lib/types'

const perfStatusMap: Record<
  PerformanceStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: '오픈 예정', className: 'bg-warning/20 text-warning' },
  ON_SALE: { label: '예매중', className: 'bg-success/15 text-success' },
  SOLD_OUT: { label: '매진 · 대기가능', className: 'bg-primary/15 text-primary' },
  ENDED: { label: '공연 종료', className: 'bg-muted text-muted-foreground' },
  CANCELLED: { label: '공연 취소', className: 'bg-destructive/10 text-destructive' },
}

export function PerformanceStatusBadge({
  status,
  className,
}: {
  status: PerformanceStatus
  className?: string
}) {
  const meta = perfStatusMap[status]
  return (
    <Badge className={cn('border-transparent', meta.className, className)}>
      {meta.label}
    </Badge>
  )
}

export function ZoneBadge({ zone, className }: { zone: Zone; className?: string }) {
  const meta = ZONE_META[zone]
  return (
    <Badge variant="outline" className={cn(meta.badgeClass, className)}>
      {meta.label}
    </Badge>
  )
}

const orderStatusMap: Record<OrderStatus, { label: string; className: string }> = {
  PAID: { label: '예매완료', className: 'bg-success/15 text-success' },
  CANCEL_REQUESTED: {
    label: '취소요청',
    className: 'bg-warning/20 text-warning',
  },
  CANCELLED: { label: '취소완료', className: 'bg-muted text-muted-foreground' },
  REFUNDED: { label: '전액환불', className: 'bg-destructive/10 text-destructive' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = orderStatusMap[status]
  return <Badge className={cn('border-transparent', meta.className)}>{meta.label}</Badge>
}

/**
 * 대기(Standby) 요약 상태. 실제 백엔드 조회 API는 zoneRanks(구역별 rank/isHeld)만 내려주고
 * PURCHASED/EXPIRED 같은 세부 상태는 제공하지 않아(ticket 도메인 소관), WAITING/HELD 두 가지로 단순화.
 */
export type StandbySummaryStatus = 'WAITING' | 'HELD'

const standbyStatusMap: Record<StandbySummaryStatus, { label: string; className: string }> = {
  WAITING: { label: '대기중', className: 'bg-secondary text-secondary-foreground' },
  HELD: { label: '결제 가능', className: 'bg-warning/25 text-warning' },
}

export function WaitlistStatusBadge({ status }: { status: StandbySummaryStatus }) {
  const meta = standbyStatusMap[status]
  return <Badge className={cn('border-transparent', meta.className)}>{meta.label}</Badge>
}
