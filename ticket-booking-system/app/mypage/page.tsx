'use client'

import { useMemo, useState } from 'react'
import { Coins, Ticket, ArrowLeftRight } from 'lucide-react'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { formatKRW, formatDateTime, computeRefund } from '@/lib/domain'
import { OrderStatusBadge } from '@/components/status-badges'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import Link from 'next/link'

export default function MyPage() {
  const { userId, role, version, cancelOrder } = useApp()
  void version
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const orders = useMemo(() => api.listOrders(userId), [userId, version])
  const points = useMemo(() => api.listPoints(userId), [userId, version])

  const selectedOrder = selectedOrderId
    ? orders.find((o) => o.id === selectedOrderId) ?? null
    : null
  const selectedPerf = selectedOrder ? api.getPerformance(selectedOrder.performanceId) : undefined
  const selectedSession = selectedOrder
    ? api.listSessions(selectedOrder.performanceId).find((s) => s.id === selectedOrder.sessionId)
    : undefined
  const selectedPayment = selectedOrder ? api.getPayment(selectedOrder.id) : undefined
  const selectedCanCancel =
    selectedOrder != null &&
    selectedOrder.status === 'PAID' &&
    selectedSession != null &&
    computeRefund(selectedOrder.totalAmount, selectedSession.performanceStartAt).policy.refundable

  const selectedPoint = selectedPointId
    ? points.find((p) => p.id === selectedPointId) ?? null
    : null

  if (role !== 'BUYER') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-muted-foreground">구매자 전환 후 이용할 수 있습니다.</p>
      </div>
    )
  }

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
            <span className="font-semibold">{formatKRW(api.getUser(userId)?.points ?? 0)}</span>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Ticket className="size-4 text-primary" />
          <h2 className="font-semibold">주문 내역</h2>
        </div>
        <div className="space-y-3">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">주문 내역이 없습니다.</p>
          ) : (
            orders.map((order) => {
              const perf = api.getPerformance(order.performanceId)
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{perf?.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{order.items.map((it) => `${it.zone} ${it.quantity}매`).join(', ')}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span>결제금액</span>
                    <span className="font-semibold">
                      {formatKRW(order.totalAmount - (order.pointsUsed ?? 0))}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <ArrowLeftRight className="size-4 text-primary" />
          <h2 className="font-semibold">포인트 내역</h2>
        </div>
        <div className="space-y-3">
          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground">포인트 내역이 없습니다.</p>
          ) : (
            points.map((point) => (
              <button
                key={point.id}
                type="button"
                onClick={() => setSelectedPointId(point.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-secondary/20"
              >
                <div>
                  <p className="font-medium">{point.reason}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(point.createdAt)}</p>
                </div>
                <span
                  className={point.type === 'EARN' ? 'text-success font-semibold' : 'text-destructive font-semibold'}
                >
                  {point.type === 'EARN' ? '+' : '-'}{formatKRW(point.amount)}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      <div className="flex justify-center gap-2">
        <Button asChild variant="outline">
          <Link href="/waitlist">내 대기 신청 보기</Link>
        </Button>
        <Button asChild variant="outline">
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
                <DialogDescription>
                  {selectedPerf?.title ?? '-'} · {formatDateTime(selectedOrder.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">주문 상태</span>
                  <OrderStatusBadge status={selectedOrder.status} />
                </div>

                <div>
                  <p className="font-medium text-foreground">공연 정보</p>
                  <p className="mt-1">공연: {selectedPerf?.title ?? '-'}</p>
                  {selectedSession && (
                    <>
                      <p className="mt-1">회차: {selectedSession.sessionNum}회차</p>
                      <p className="mt-1">관람 일시: {formatDateTime(selectedSession.performanceStartAt)}</p>
                    </>
                  )}
                </div>

                <div>
                  <p className="font-medium text-foreground">좌석 상세</p>
                  <ul className="mt-1 space-y-1">
                    {selectedOrder.items.map((it, idx) => (
                      <li key={`${it.zone}-${idx}`} className="flex items-center justify-between">
                        <span>
                          {it.zone} · {it.quantity}매
                          {it.seatLabels.length > 0 && ` (${it.seatLabels.join(', ')})`}
                        </span>
                        <span>{formatKRW(it.unitPrice)} / 매</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="font-medium text-foreground">결제 정보</p>
                  {selectedPayment ? (
                    <>
                      <p className="mt-1">결제수단: {selectedPayment.method}</p>
                      <p className="mt-1">결제상태: {selectedPayment.status}</p>
                      <p className="mt-1">결제금액: {formatKRW(selectedPayment.amount)}</p>
                      <p className="mt-1">승인일시: {formatDateTime(selectedPayment.approvedAt)}</p>
                    </>
                  ) : (
                    <p className="mt-1">결제 정보가 없습니다.</p>
                  )}
                  {!!selectedOrder.pointsUsed && (
                    <p className="mt-1 text-warning">포인트 사용: -{formatKRW(selectedOrder.pointsUsed)}</p>
                  )}
                  {selectedOrder.refundedAmount != null && (
                    <p className="mt-1 text-destructive">환불금액: {formatKRW(selectedOrder.refundedAmount)}</p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="font-medium text-foreground">총 결제금액</span>
                  <span className="font-semibold text-foreground">
                    {formatKRW(selectedOrder.totalAmount - (selectedOrder.pointsUsed ?? 0))}
                  </span>
                </div>
              </div>

              {selectedCanCancel && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!confirm('예매를 취소하시겠습니까?')) return
                      try {
                        cancelOrder(selectedOrder.id)
                        setSelectedOrderId(null)
                      } catch (error) {
                        alert(error instanceof Error ? error.message : '예매 취소 실패')
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
                <DialogDescription>{formatDateTime(selectedPoint.createdAt)}</DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">사유</span>
                  <span>{selectedPoint.reason}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">유형</span>
                  <span>{selectedPoint.type === 'EARN' ? '적립' : '사용'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">금액</span>
                  <span
                    className={selectedPoint.type === 'EARN' ? 'text-success font-semibold' : 'text-destructive font-semibold'}
                  >
                    {selectedPoint.type === 'EARN' ? '+' : '-'}{formatKRW(selectedPoint.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">일시</span>
                  <span>{formatDateTime(selectedPoint.createdAt)}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
