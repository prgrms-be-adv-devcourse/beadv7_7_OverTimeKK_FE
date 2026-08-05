'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatKRW } from '@/lib/domain'
import { getTossPayments } from '@/lib/toss-payment-sdk'

/**
 * 실제 토스페이먼츠 결제창(SDK)을 여는 컴포넌트. method를 '카드'로 고정해서 호출한다
 * (테스트 결제에서 정상 동작 확인된 방식). 수단별 버튼을 우리 UI에 여러 개 두지 않고
 * 결제하기 버튼 하나만 노출한다.
 *
 * `orderId`/`paymentId`는 order-service의 pay() 응답 그대로 넘겨야 하고,
 * 결제 승인은 successUrl로 리다이렉트된 이후 별도 페이지(app/payment/success)에서
 * paymentKey를 받아 confirm()을 호출하는 방식으로 완료된다 — 이 컴포넌트는 결제창을
 * 여는 시점까지만 책임진다(성공 콜백을 기다리지 않음, 성공 시 브라우저가 이탈함).
 */
export function RealTossPayment({
  amount,
  orderId,
  paymentId,
  orderName,
  customerName,
  submitLabel = '결제하기',
}: {
  amount: number
  orderId: string
  paymentId: number
  orderName: string
  customerName?: string
  submitLabel?: string
}) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    setProcessing(true)
    setError(null)
    try {
      const tossPayments = await getTossPayments()
      const origin = window.location.origin
      await tossPayments.requestPayment('카드', {
        amount,
        orderId,
        orderName,
        customerName,
        successUrl: `${origin}/payment/success?paymentId=${paymentId}`,
        failUrl: `${origin}/payment/fail?paymentId=${paymentId}`,
      })
      // 성공 시 토스 결제창이 successUrl로 브라우저를 이동시키므로 이 아래는 보통 실행되지 않는다.
    } catch (e) {
      setProcessing(false)
      // 사용자가 결제창을 닫거나 취소한 경우(PAY_PROCESS_CANCELED 등)도 여기로 들어온다.
      setError(e instanceof Error ? e.message : '결제창을 여는 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-success" />
        토스페이먼츠 카드 결제창으로 이동합니다 (테스트 결제)
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">최종 결제금액</span>
        <span className="text-lg font-bold">{formatKRW(amount)}</span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button className="w-full" size="lg" onClick={handlePay} disabled={processing}>
        {processing ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            결제창 여는 중...
          </>
        ) : (
          <>
            <CreditCard className="size-4" />
            {formatKRW(amount)} {submitLabel}
          </>
        )}
      </Button>
    </div>
  )
}
