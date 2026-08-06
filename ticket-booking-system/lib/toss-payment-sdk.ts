import { loadTossPayments, type TossPaymentsInstance } from '@tosspayments/payment-sdk'

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ''

let instancePromise: Promise<TossPaymentsInstance> | null = null

/** 토스 결제위젯 SDK를 최초 1회만 로드해 재사용한다. */
export function getTossPayments(): Promise<TossPaymentsInstance> {
  if (!CLIENT_KEY) {
    return Promise.reject(new Error('NEXT_PUBLIC_TOSS_CLIENT_KEY가 설정되지 않았습니다.'))
  }
  if (!instancePromise) {
    instancePromise = loadTossPayments(CLIENT_KEY)
  }
  return instancePromise
}
