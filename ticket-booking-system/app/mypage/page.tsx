'use client'

import { useEffect, useState } from 'react'
import { Coins, Ticket, ArrowLeftRight } from 'lucide-react'
import { useApp } from '@/lib/store'
import { formatKRW, formatDateTime } from '@/lib/domain'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import Link from 'next/link'
import {
  orderApi,
  OrderApiError,
  type OrderHistoryItem,
  type OrderHistoryStatus,
  type PointHistoryItem,
} from '@/lib/order-api'
import { LoginRequired } from '@/components/login-required'

const POINT_TYPE_LABEL: Record<PointHistoryItem['type'], string> = {
  EARN: '적립',
  USE: '사용',
  CANCELLED: '사용취소',
  PARTIAL_CANCELLED: '부분취소',
}

const ORDER_STATUS_META: Record<OrderHistoryStatus, { label: string; className: string }> = {
  COMPLETED: { label: '예매완료', className: 'bg-success/15 text-success' },
  CANCELLED: { label: '취소됨', className: 'bg-muted text-muted-foreground' },
  EXPIRED: { label: '만료됨', className: 'bg-muted text-muted-foreground' },
}

export default function MyPage() {
  const { points, authUser, accessToken, authLoading } = useApp()
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!authUser || !accessToken) return
    let cancelled = false
    setOrdersLoading(true)
    orderApi
      .getOrderHistory(accessToken)
      .then((data) => {
        if (!cancelled) setOrders(data)
      })
      .catch((e) => {
        if (cancelled) return
        setOrdersError(e instanceof OrderApiError ? `${e.code ?? ''} ${e.message}` : '주문 내역을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshTick, authUser, accessToken])

  // 상단 잔액은 useApp().points(store.tsx가 실 API로 관리)를 그대로 쓴다 — 헤더와 같은 값을
  // 유지하기 위해 여기서 따로 조회하지 않는다. 아래는 내역 리스트 전용 상태.
  const [pointHistory, setPointHistory] = useState<PointHistoryItem[]>([])
  const [pointsLoading, setPointsLoading] = useState(true)
  const [pointsError, setPointsError] = useState<string | null>(null)
  const [pointsPage, setPointsPage] = useState(0)
  const [pointsHasMore, setPointsHasMore] = useState(false)
  const [pointsLoadingMore, setPointsLoadingMore] = useState(false)

  useEffect(() => {
    if (!authUser || !accessToken) return
    let cancelled = false
    setPointsLoading(true)
    orderApi
      .getPointHistory(accessToken, 0)
      .then((history) => {
        if (cancelled) return
        setPointHistory(history.content)
        setPointsPage(0)
        setPointsHasMore(!history.last)
      })
      .catch((e) => {
        if (cancelled) return
        setPointsError(e instanceof OrderApiError ? `${e.code ?? ''} ${e.message}` : '포인트 내역을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setPointsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshTick, authUser, accessToken])

  async function loadMorePoints() {
    if (!authUser || !accessToken) return
    setPointsLoadingMore(true)
    try {
      const nextPage = pointsPage + 1
      const history = await orderApi.getPointHistory(accessToken, nextPage)
      setPointHistory((prev) => [...prev, ...history.content])
      setPointsPage(nextPage)
      setPointsHasMore(!history.last)
    } catch (e) {
      alert(e instanceof OrderApiError ? `${e.code ?? ''} ${e.message}` : '포인트 내역을 더 불러오지 못했습니다.')
    } finally {
      setPointsLoadingMore(false)
    }
  }

  const selectedOrder = selectedOrderId
    ? orders.find((o) => o.orderId === selectedOrderId) ?? null
    : null

  const selectedPoint = selectedPointId
    ? pointHistory.find((p) => p.id === selectedPointId) ?? null
    : null

  if (authLoading) return null
  if (!authUser || !accessToken) return <LoginRequired message="마이페이지는 로그인 후 이용할 수 있습니다." />

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">마이페이지</p>
            <h1 className="mt-1 text-2xl font-bold">포인트 · 주문 내역</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-warning/10 px-3 py-2 text-warning">
            <Coins className="size-4" />
            <span className="font-semibold">{formatKRW(points)}</span>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Ticket className="size-4 text-primary" />
          <h2 className="font-semibold">주문 내역</h2>
        </div>
        <div className="space-y-3">
          {ordersLoading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : ordersError ? (
            <p className="text-sm text-destructive">{ordersError}</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">주문 내역이 없습니다.</p>
          ) : (
            orders.map((order) => (
              <button
                key={order.orderId}
                type="button"
                onClick={() => setSelectedOrderId(order.orderId)}
                className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{order.performanceName}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(order.orderedAt)}</p>
                  </div>
                  <Badge className={cn('border-transparent', ORDER_STATUS_META[order.orderStatus].className)}>
                    {ORDER_STATUS_META[order.orderStatus].label}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{order.zone} {order.quantity}매</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>결제금액</span>
                  <span className="font-semibold">{formatKRW(order.totalAmount)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <ArrowLeftRight className="size-4 text-primary" />
          <h2 className="font-semibold">포인트 내역</h2>
        </div>
        <div className="space-y-3">
          {pointsLoading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : pointsError ? (
            <p className="text-sm text-destructive">{pointsError}</p>
          ) : pointHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">포인트 내역이 없습니다.</p>
          ) : (
            <>
              {pointHistory.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => setSelectedPointId(point.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-secondary/20"
                >
                  <div>
                    <p className="font-medium">{POINT_TYPE_LABEL[point.type]}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(point.transactedAt)}</p>
                  </div>
                  <span
                    className={point.amount >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'}
                  >
                    {point.amount >= 0 ? '+' : ''}
                    {formatKRW(point.amount)}
                  </span>
                </button>
              ))}
              {pointsHasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={pointsLoadingMore}
                  onClick={loadMorePoints}
                >
                  {pointsLoadingMore ? '불러오는 중...' : '더 보기'}
                </Button>
              )}
            </>
          )}
        </div>
      </section>

      <div className="flex justify-center gap-2">
        <Button  variant="outline">
          <Link href="/waitlist">내 대기 신청 보기</Link>
        </Button>
        <Button  variant="outline">
          <Link href="/">공연 둘러보기</Link>
        </Button>
      </div>

      <Dialog open={selectedOrder != null} onOpenChange={(v) => !v && setSelectedOrderId(null)}>
        <DialogContent className="max-w-md">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ticket className="size-5 text-primary" />
                  주문 상세
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <span>{selectedOrder.performanceName} · {formatDateTime(selectedOrder.orderedAt)}</span>
                  <Badge className={cn('border-transparent', ORDER_STATUS_META[selectedOrder.orderStatus].className)}>
                    {ORDER_STATUS_META[selectedOrder.orderStatus].label}
                  </Badge>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">좌석 상세</p>
                  <p className="mt-1">{selectedOrder.zone} · {selectedOrder.quantity}매</p>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="font-medium text-foreground">총 결제금액</span>
                  <span className="font-semibold text-foreground">{formatKRW(selectedOrder.totalAmount)}</span>
                </div>
              </div>

              {selectedOrder.orderStatus === 'COMPLETED' && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!confirm('예매를 취소하시겠습니까?')) return
                      try {
                        await orderApi.cancelCompleted(selectedOrder.orderId, accessToken)
                        setSelectedOrderId(null)
                        setRefreshTick((t) => t + 1)
                      } catch (error) {
                        alert(error instanceof OrderApiError ? `${error.code ?? ''} ${error.message}` : '예매 취소 실패')
                      }
                    }}
                  >
                    예매 취소
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={selectedPoint != null} onOpenChange={(v) => !v && setSelectedPointId(null)}>
        <DialogContent className="max-w-md">
          {selectedPoint && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="size-5 text-primary" />
                  포인트 상세
                </DialogTitle>
                <DialogDescription>{formatDateTime(selectedPoint.transactedAt)}</DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">유형</span>
                  <span>{POINT_TYPE_LABEL[selectedPoint.type]}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">금액</span>
                  <span
                    className={selectedPoint.amount >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'}
                  >
                    {selectedPoint.amount >= 0 ? '+' : ''}
                    {formatKRW(selectedPoint.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">거래 후 잔액</span>
                  <span>{formatKRW(selectedPoint.balanceAfter)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">일시</span>
                  <span>{formatDateTime(selectedPoint.transactedAt)}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
