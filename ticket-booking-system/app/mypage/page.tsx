'use client'

import { useMemo, useState } from 'react'
import { Coins, ReceiptText, Ticket, ArrowLeftRight } from 'lucide-react'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { formatKRW, formatDateTime } from '@/lib/domain'
import { OrderStatusBadge } from '@/components/status-badges'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function MyPage() {
  const { userId, role, version, cancelOrder, requestCancelOrder } = useApp()
  void version
  const [expandedPointId, setExpandedPointId] = useState<string | null>(null)

  const orders = useMemo(() => api.listOrders(userId), [userId, version])
  const payments = useMemo(() => api.listPayments(userId), [userId, version])
  const points = useMemo(() => api.listPoints(userId), [userId, version])

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
            <h1 className="mt-1 text-2xl font-bold">포인트 · 주문 · 결제 내역</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-warning/10 px-3 py-2 text-warning-foreground">
            <Coins className="size-4" />
            <span className="font-semibold">{formatKRW(api.getUser(userId)?.points ?? 0)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
                  <div key={order.id} className="rounded-lg border border-border p-3">
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
                      <span className="font-semibold">{formatKRW(order.totalAmount)}</span>
                    </div>
                    {order.status === 'PAID' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            try {
                              requestCancelOrder(order.id)
                            } catch (error) {
                              alert(error instanceof Error ? error.message : '취소 요청 실패')
                            }
                          }}
                        >
                          취소 요청
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            try {
                              cancelOrder(order.id)
                            } catch (error) {
                              alert(error instanceof Error ? error.message : '즉시 취소 실패')
                            }
                          }}
                        >
                          즉시 취소
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText className="size-4 text-primary" />
            <h2 className="font-semibold">결제 내역</h2>
          </div>
          <div className="space-y-3">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">결제 내역이 없습니다.</p>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{payment.method}</span>
                    <span className="text-sm text-muted-foreground">{payment.status}</span>
                  </div>
                  <p className="mt-1 text-sm">{formatKRW(payment.amount)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(payment.approvedAt)}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <ArrowLeftRight className="size-4 text-primary" />
          <h2 className="font-semibold">포인트 내역</h2>
        </div>
        <div className="space-y-3">
          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground">포인트 내역이 없습니다.</p>
          ) : (
            points.map((point) => {
              const isExpanded = expandedPointId === point.id
              return (
                <div key={point.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{point.reason}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(point.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedPointId((prev) => (prev === point.id ? null : point.id))}
                      className={point.type === 'EARN' ? 'text-success font-semibold' : 'text-destructive font-semibold'}
                    >
                      {point.type === 'EARN' ? '+' : '-'}{formatKRW(point.amount)}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 rounded-md border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">상세 내용</p>
                      <p className="mt-1">사유: {point.reason}</p>
                      <p className="mt-1">유형: {point.type === 'EARN' ? '적립' : '사용'}</p>
                      <p className="mt-1">금액: {point.type === 'EARN' ? '+' : '-'}{formatKRW(point.amount)}</p>
                      <p className="mt-1">일시: {formatDateTime(point.createdAt)}</p>
                    </div>
                  )}
                </div>
              )
            })
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
    </div>
  )
}
