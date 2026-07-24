'use client'

import { useMemo } from 'react'
import { Coins, ReceiptText, Wallet, TrendingUp } from 'lucide-react'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { formatKRW } from '@/lib/domain'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function SellerMyPage() {
  const { role, userId, version } = useApp()
  void version

  const orders = useMemo(() => api.listSellerOrders(userId), [userId, version])
  const payments = useMemo(() => api.listSellerPayments(userId), [userId, version])
  const settlements = useMemo(() => api.listSettlements(userId), [userId, version])
  const points = useMemo(() => api.listPoints(userId), [userId, version])

  if (role !== 'SELLER') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-muted-foreground">판매자 전환 후 이용할 수 있습니다.</p>
      </div>
    )
  }

  const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0)
  const totalNet = settlements.reduce((sum, s) => sum + s.netAmount, 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">판매자 마이페이지</p>
            <h1 className="mt-1 text-2xl font-bold">포인트 · 주문 · 정산 내역</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-warning/10 px-3 py-2 text-warning">
            <Coins className="size-4" />
            <span className="font-semibold">{formatKRW(api.getUser(userId)?.points ?? 0)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <Wallet className="size-4" />
            <h2 className="font-semibold">총 판매금액</h2>
          </div>
          <p className="mt-3 text-2xl font-bold">{formatKRW(totalSales)}</p>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp className="size-4" />
            <h2 className="font-semibold">정산 예정액</h2>
          </div>
          <p className="mt-3 text-2xl font-bold">{formatKRW(totalNet)}</p>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <ReceiptText className="size-4" />
            <h2 className="font-semibold">정산 건수</h2>
          </div>
          <p className="mt-3 text-2xl font-bold">{settlements.length}건</p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">주문 및 결제 내역</h2>
          <div className="space-y-3">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">주문 내역이 없습니다.</p>
            ) : (
              orders.map((order) => {
                const perf = api.getPerformance(order.performanceId)
                return (
                  <div key={order.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{perf?.title}</span>
                      <span className="text-muted-foreground">{order.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{order.items.map((it) => `${it.zone} ${it.quantity}매`).join(', ')}</p>
                    <p className="mt-2 font-semibold">{formatKRW(order.totalAmount)}</p>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">정산 내역</h2>
          <div className="space-y-3">
            {settlements.length === 0 ? (
              <p className="text-sm text-muted-foreground">정산 내역이 없습니다.</p>
            ) : (
              settlements.map((settlement) => (
                <div key={settlement.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{settlement.period}</span>
                    <span className="text-muted-foreground">{settlement.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">수수료 {formatKRW(settlement.platformFee)}</p>
                  <p className="mt-2 font-semibold">실정산액 {formatKRW(settlement.netAmount)}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">포인트 내역</h2>
        <div className="space-y-3">
          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground">포인트 내역이 없습니다.</p>
          ) : (
            points.map((point) => (
              <div key={point.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <span>{point.reason}</span>
                <span className={point.type === 'EARN' ? 'text-success' : 'text-destructive'}>
                  {point.type === 'EARN' ? '+' : '-'}{formatKRW(point.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="text-center">
        <Button asChild variant="outline">
          <Link href="/">공연 둘러보기</Link>
        </Button>
      </div>
    </div>
  )
}
