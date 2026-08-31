'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { useApp } from '@/lib/store'
import { userApi, userErrorMessage } from '@/lib/user-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

function validateCommon(username: string, password: string, passwordConfirm: string) {
  if (!username.trim()) return '아이디를 입력해 주세요.'
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
  if (password !== passwordConfirm) return '비밀번호가 일치하지 않습니다.'
  return null
}

/**
 * 이메일 인증 상태 관리. 백엔드가 회원가입 직전 서버 측 "인증됨" 마커를 소비하므로
 * (lib/user-api.ts 참고), 여기서의 verified는 그 마커가 존재한다는 걸 프론트가 낙관적으로
 * 반영한 것일 뿐 — 실제 최종 검증은 여전히 가입 요청 시 백엔드가 한다.
 */
function useEmailVerification() {
  const [email, setEmailState] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [verified, setVerified] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)

  function setEmail(value: string) {
    setEmailState(value)
    // 인증완료/발송 후 이메일을 바꾸면 그 인증은 더 이상 이 이메일에 대한 게 아니므로 초기화
    if (verified) setVerified(false)
    if (sent) {
      setSent(false)
      setCode('')
    }
  }

  async function sendCode() {
    if (!email.trim()) {
      alert('이메일을 입력해 주세요.')
      return
    }
    setSending(true)
    try {
      await userApi.sendVerificationCode(email)
      setSent(true)
    } catch (e) {
      alert(userErrorMessage(e, '인증번호 발송에 실패했습니다.'))
    } finally {
      setSending(false)
    }
  }

  async function confirmCode() {
    if (!code.trim()) {
      alert('인증번호를 입력해 주세요.')
      return
    }
    setConfirming(true)
    try {
      await userApi.confirmVerificationCode(email, code)
      setVerified(true)
    } catch (e) {
      alert(userErrorMessage(e, '인증에 실패했습니다.'))
    } finally {
      setConfirming(false)
    }
  }

  return { email, setEmail, sent, code, setCode, verified, sending, confirming, sendCode, confirmCode }
}

type EmailVerificationState = ReturnType<typeof useEmailVerification>

function EmailVerificationField({ id, state }: { id: string; state: EmailVerificationState }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>이메일</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="email"
          autoComplete="email"
          value={state.email}
          onChange={(e) => state.setEmail(e.target.value)}
          disabled={state.verified}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          disabled={state.sending || state.verified || !state.email.trim()}
          onClick={state.sendCode}
        >
          {state.verified ? '인증완료' : state.sending ? '발송 중...' : state.sent ? '재발송' : '인증번호 발송'}
        </Button>
      </div>
      {state.sent && !state.verified && (
        <div className="flex gap-2">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="인증번호 6자리"
            value={state.code}
            onChange={(e) => state.setCode(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            disabled={state.confirming || !state.code.trim()}
            onClick={state.confirmCode}
          >
            {state.confirming ? '확인 중...' : '확인'}
          </Button>
        </div>
      )}
      {state.verified && <p className="text-xs text-success">이메일 인증이 완료되었습니다.</p>}
    </div>
  )
}

export default function SignUpPage() {
  const router = useRouter()
  const { signUpIndividual, signUpBusiness } = useApp()

  const individualEmail = useEmailVerification()
  const [individual, setIndividual] = useState({ username: '', password: '', passwordConfirm: '' })
  const businessEmail = useEmailVerification()
  const [business, setBusiness] = useState({
    username: '',
    password: '',
    passwordConfirm: '',
    businessName: '',
    businessNumber: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmitIndividual(event: FormEvent) {
    event.preventDefault()
    const error = validateCommon(individual.username, individual.password, individual.passwordConfirm)
    if (error) {
      alert(error)
      return
    }
    if (!individualEmail.verified) {
      alert('이메일 인증을 먼저 완료해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      // passwordConfirm은 프론트 전용 검증값이라 서버로는 안 보낸다.
      const { passwordConfirm: _passwordConfirm, ...signupInput } = individual
      await signUpIndividual({ ...signupInput, email: individualEmail.email })
      router.push('/')
    } catch (e) {
      alert(userErrorMessage(e, '회원가입에 실패했습니다. 백엔드 서버 상태를 확인해 주세요.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitBusiness(event: FormEvent) {
    event.preventDefault()
    const error = validateCommon(business.username, business.password, business.passwordConfirm)
    if (error) {
      alert(error)
      return
    }
    if (!businessEmail.verified) {
      alert('이메일 인증을 먼저 완료해 주세요.')
      return
    }
    if (!business.businessName.trim() || !business.businessNumber.trim()) {
      alert('사업자명과 사업자번호를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      // passwordConfirm은 프론트 전용 검증값이라 서버로는 안 보낸다.
      const { passwordConfirm: _passwordConfirm, ...signupInput } = business
      await signUpBusiness({ ...signupInput, email: businessEmail.email })
      router.push('/')
    } catch (e) {
      alert(userErrorMessage(e, '회원가입에 실패했습니다. 백엔드 서버 상태를 확인해 주세요.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <UserPlus className="size-5 text-primary" />
          <h1 className="text-xl font-bold">회원가입</h1>
        </div>

        <Tabs defaultValue="individual">
          <TabsList className="w-full">
            <TabsTrigger value="individual" className="flex-1">
              개인
            </TabsTrigger>
            <TabsTrigger value="business" className="flex-1">
              사업자
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual">
            <form onSubmit={handleSubmitIndividual} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ind-username">아이디</Label>
                <Input
                  id="ind-username"
                  autoComplete="username"
                  value={individual.username}
                  onChange={(e) => setIndividual({ ...individual, username: e.target.value })}
                />
              </div>
              <EmailVerificationField id="ind-email" state={individualEmail} />
              <div className="space-y-1.5">
                <Label htmlFor="ind-password">비밀번호</Label>
                <Input
                  id="ind-password"
                  type="password"
                  autoComplete="new-password"
                  value={individual.password}
                  onChange={(e) => setIndividual({ ...individual, password: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">8자 이상 입력해 주세요.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ind-password-confirm">비밀번호 확인</Label>
                <Input
                  id="ind-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={individual.passwordConfirm}
                  onChange={(e) => setIndividual({ ...individual, passwordConfirm: e.target.value })}
                />
                {individual.passwordConfirm && individual.passwordConfirm !== individual.password && (
                  <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다.</p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting || !individualEmail.verified || individual.password !== individual.passwordConfirm}
              >
                {submitting ? '가입 중...' : '개인 회원가입'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="business">
            <form onSubmit={handleSubmitBusiness} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="biz-username">아이디</Label>
                <Input
                  id="biz-username"
                  autoComplete="username"
                  value={business.username}
                  onChange={(e) => setBusiness({ ...business, username: e.target.value })}
                />
              </div>
              <EmailVerificationField id="biz-email" state={businessEmail} />
              <div className="space-y-1.5">
                <Label htmlFor="biz-password">비밀번호</Label>
                <Input
                  id="biz-password"
                  type="password"
                  autoComplete="new-password"
                  value={business.password}
                  onChange={(e) => setBusiness({ ...business, password: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">8자 이상 입력해 주세요.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-password-confirm">비밀번호 확인</Label>
                <Input
                  id="biz-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={business.passwordConfirm}
                  onChange={(e) => setBusiness({ ...business, passwordConfirm: e.target.value })}
                />
                {business.passwordConfirm && business.passwordConfirm !== business.password && (
                  <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-name">사업자명</Label>
                <Input
                  id="biz-name"
                  value={business.businessName}
                  onChange={(e) => setBusiness({ ...business, businessName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-number">사업자번호</Label>
                <Input
                  id="biz-number"
                  value={business.businessNumber}
                  onChange={(e) => setBusiness({ ...business, businessNumber: e.target.value })}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting || !businessEmail.verified || business.password !== business.passwordConfirm}
              >
                {submitting ? '가입 중...' : '사업자 회원가입'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
