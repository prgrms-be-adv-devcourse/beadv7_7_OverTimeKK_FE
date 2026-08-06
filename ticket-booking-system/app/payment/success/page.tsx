'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { orderApi, OrderApiError } from '@/lib/order-api'
import { readPendingPaymentLedger, clearPendingPaymentLedger } from '@/lib/pending-payment'
import { standbyStore } from '@/lib/standby-store'
import { useApp } from '@/lib/store'

function PaymentSuccessInner() {
  const params = useSearchParams()
  const { createOrder } = useApp()
  const [state, setState] = useState<'confirming' | 'done' | 'error'>('confirming')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const paymentIdRaw = params.get('paymentId')
    const paymentKey = params.get('paymentKey')
    const paymentId = paymentIdRaw ? Number(paymentIdRaw) : null

    if (!paymentId || !paymentKey) {
      setState('error')
      setError('필수 결제 정보가 없습니다.')
      return
    }

    orderApi
      .confirm(paymentId, paymentKey)
      .then(() => {
        setState('done')

        // 포인트 잔액을 읽어오는 실 API가 아직 없어서, 마이페이지 포인트 내역은 여전히
        // mock 장부로 관리한다 — 결제창으로 이동하기 전 booking-dialog가 남겨둔 정보를
        // 여기서 소비해 mock 주문/포인트를 기록한다. 없거나 실패해도 실 결제 완료 자체엔
        // 영향 없음(다른 브라우저/기기에서 결제를 마친 경우엔 이 정보가 없을 수 있음).
        const ledger = readPendingPaymentLedger(paymentId)
        if (ledger) {
          try {
            createOrder(ledger)
          } catch (e) {
            console.warn('포인트 장부(mock) 갱신 실패 — 결제 자체는 완료됨:', e)
          }
          if (ledger.standbyCleanup) {
            standbyStore.remove(ledger.standbyCleanup.userId, ledger.standbyCleanup.standbyId)
          }
          clearPendingPaymentLedger(paymentId)
        }
      })
      .catch((e) => {
        setState('error')
        setError(e instanceof OrderApiError ? `${e.code ?? ''} ${e.message}`.trim() : '결제 승인에 실패했습니다.')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      {state === 'confirming' && (
        <>
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">결제를 확인하고 있습니다...</p>
        </>
      )}
      {state === 'done' && (
        <>
          <CheckCircle2 className="size-12 text-success" />
          <h1 className="text-xl font-bold">결제가 완료되었습니다</h1>
          <p className="text-sm text-muted-foreground">마이페이지에서 예매 내역을 확인할 수 있습니다.</p>
          <div className="flex gap-2">
            <Link href="/mypage" className={buttonVariants()}>
              마이페이지로 이동
            </Link>
            <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
              공연 둘러보기
            </Link>
          </div>
        </>
      )}
      {state === 'error' && (
        <>
          <XCircle className="size-12 text-destructive" />
          <h1 className="text-xl font-bold">결제 승인에 실패했습니다</h1>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Link href="/" className={buttonVariants({ variant: 'outline' })}>
            홈으로
          </Link>
        </>
      )}
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PaymentSuccessInner />
    </Suspense>
  )
}
