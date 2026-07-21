import { Badge } from '@/components/ui/badge'
import { ZONE_META } from '@/lib/domain'
import { cn } from '@/lib/utils'
import type {
  OrderStatus,
  PerformanceStatus,
  WaitlistStatus,
  Zone,
} from '@/lib/types'

const perfStatusMap: Record<
  PerformanceStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: '오픈 예정', className: 'bg-warning/20 text-warning-foreground' },
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
    className: 'bg-warning/20 text-warning-foreground',
  },
  CANCELLED: { label: '취소완료', className: 'bg-muted text-muted-foreground' },
  REFUNDED: { label: '전액환불', className: 'bg-destructive/10 text-destructive' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = orderStatusMap[status]
  return <Badge className={cn('border-transparent', meta.className)}>{meta.label}</Badge>
}

const waitlistStatusMap: Record<WaitlistStatus, { label: string; className: string }> = {
  WAITING: { label: '대기중', className: 'bg-secondary text-secondary-foreground' },
  OFFERED: { label: '예매 가능', className: 'bg-warning/25 text-warning-foreground' },
  PURCHASED: { label: '구매완료', className: 'bg-success/15 text-success' },
  EXPIRED: { label: '대기 종료', className: 'bg-destructive/10 text-destructive' },
  CANCELLED: { label: '대기취소', className: 'bg-muted text-muted-foreground' },
}

export function WaitlistStatusBadge({ status }: { status: WaitlistStatus }) {
  const meta = waitlistStatusMap[status]
  return <Badge className={cn('border-transparent', meta.className)}>{meta.label}</Badge>
}
