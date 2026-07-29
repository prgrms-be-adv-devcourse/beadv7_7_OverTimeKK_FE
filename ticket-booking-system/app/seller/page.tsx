'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, DollarSign, Users, Minus } from 'lucide-react'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { formatKRW } from '@/lib/domain'
import { performanceApi, PerformanceApiError } from '@/lib/performance-api'
import { HALL_OPTIONS, registerPerformanceExtras } from '@/lib/performance-extras'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PerformanceStatusBadge } from '@/components/status-badges'
import type { Zone } from '@/lib/types'

export default function SellerPage() {
  const {
    role,
    version,
    refresh,
    sellerCancelPerformance,
    updatePerformance,
    deletePerformance,
  } = useApp()
  void version
  const [submitting, setSubmitting] = useState(false)

  const performances = useMemo(() => {
    const all = api.listPerformances()
    return all.filter((performance) => performance.sellerId === api.getUser('u_seller')?.id)
  }, [version])

  const [draftMode, setDraftMode] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    runtime: '120',
    startDate: '2026-08-01',
    endDate: '2026-08-02',
    ticketOpenAt: '2026-07-21 12:00:00',
    hallId: 'h1',
    posterUrl: '/basic.jpeg',
    category: '콘서트',
  })
  const [sessions, setSessions] = useState([
    { sessionNum: '1', actor: '', performanceStartAt: '2026-08-01 19:00:00' },
  ])
  const [priceRows, setPriceRows] = useState<Array<{ id: number; zone: Zone | ''; price: string }>>([
    { id: 1, zone: 'VIP', price: '' },
  ])

  function updateSession(index: number, patch: Partial<(typeof sessions)[number]>) {
    setSessions((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function addSession() {
    setSessions((prev) => [
      ...prev,
      {
        sessionNum: String(prev.length + 1),
        actor: '',
        performanceStartAt: '2026-08-02 19:00:00',
      },
    ])
  }

  function removeSession(index: number) {
    setSessions((prev) => (prev.length > 1 ? prev.filter((_, itemIndex) => itemIndex !== index) : prev))
  }

  function updatePriceRow(id: number, patch: Partial<(typeof priceRows)[number]>) {
    setPriceRows((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function addPriceRow() {
    setPriceRows((prev) => [...prev, { id: Date.now(), zone: '', price: '' }])
  }

  function removePriceRow(id: number) {
    setPriceRows((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev))
  }

  // 실제 performance-service(v2 등록 API)로 공연을 등록한다.
  // 좌석 배치도 데이터가 있는 3개 공연장(HALL_OPTIONS)만 지원 — lib/performance-extras.ts 참고.
  async function handleCreatePerformance() {
    if (!form.title.trim()) {
      alert('공연 제목을 입력해 주세요.')
      return
    }

    if (sessions.some((session) => !session.actor.trim() || !session.performanceStartAt.trim())) {
      alert('각 회차의 출연진과 공연 시작 시간을 모두 입력해 주세요.')
      return
    }

    const prices = priceRows
      .filter((row) => row.zone && row.price && Number(row.price) > 0)
      .map((row) => ({ zone: row.zone as Zone, price: Number(row.price) }))

    if (prices.length === 0) {
      alert('좌석 구역과 가격을 최소 1개 이상 입력해 주세요.')
      return
    }

    const hallOption = HALL_OPTIONS.find((h) => h.localHallId === form.hallId) ?? HALL_OPTIONS[0]

    setSubmitting(true)
    try {
      await performanceApi.register({
        title: form.title,
        description: form.description,
        runtime: Number(form.runtime),
        startDate: form.startDate,
        endDate: form.endDate,
        ticketOpenAt: form.ticketOpenAt,
        hallId: hallOption.backendHallId,
        sessions: sessions.map((session) => ({
          sessionNum: Number(session.sessionNum) || 1,
          actor: session.actor,
          performanceStartAt: session.performanceStartAt,
        })),
        seatPrices: prices.map((p) => ({ zone: p.zone, price: p.price })),
      })

      // 등록 응답엔 performanceId가 안 내려오므로, title로 목록을 다시 조회해서 찾는다.
      const list = await performanceApi.list()
      const created = [...list].reverse().find((p) => p.title === form.title)
      if (created) {
        const realSessions = await performanceApi.sessions(created.performanceId).catch(() => [])
        registerPerformanceExtras(form.title, {
          posterUrl: form.posterUrl,
          category: form.category,
          hallId: hallOption.localHallId,
          zonePrices: Object.fromEntries(prices.map((p) => [p.zone, p.price])),
        })
        api.importRealPerformances([{ real: created, sessions: realSessions }])
        refresh()
      }

      setDraftMode(false)
      setForm({
        title: '',
        description: '',
        runtime: '120',
        startDate: '2026-08-01',
        endDate: '2026-08-02',
        ticketOpenAt: '2026-07-21 12:00:00',
        hallId: 'h1',
        posterUrl: '/basic.jpeg',
        category: '콘서트',
      })
      setSessions([{ sessionNum: '1', actor: '', performanceStartAt: '2026-08-01 19:00:00' }])
      setPriceRows([{ id: 1, zone: 'VIP', price: '' }])
    } catch (e) {
      const message = e instanceof PerformanceApiError ? e.message : '공연 등록에 실패했습니다. 백엔드 서버 상태를 확인해 주세요.'
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (role !== 'SELLER') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-muted-foreground">판매자 전환 후 이용할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">공연 관리</p>
            <h1 className="mt-1 text-2xl font-bold">판매자 공연 · 회차 · 가격 관리</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              티켓 오픈 전에는 공연 정보와 가격을 수정·삭제할 수 있고, 오픈 이후에는 변경이 불가합니다.
            </p>
          </div>
          <Button onClick={() => setDraftMode((prev) => !prev)}>
            <Plus className="mr-2 size-4" />{draftMode ? '닫기' : '새 공연 등록'}
          </Button>
        </div>
      </div>

      {draftMode && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                1
              </div>
              <h2 className="font-semibold">기본 정보</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="공연 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input placeholder="카테고리" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <Input placeholder="러닝타임(분)" type="number" value={form.runtime} onChange={(e) => setForm({ ...form, runtime: e.target.value })} />
              <Select value={form.hallId} onValueChange={(value) => value && setForm({ ...form, hallId: value })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="공연장 선택" />
                </SelectTrigger>
                <SelectContent>
                  {HALL_OPTIONS.map((hall) => (
                    <SelectItem key={hall.localHallId} value={hall.localHallId}>
                      {hall.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              <Input placeholder="티켓 오픈 yyyy-MM-dd HH:mm:ss" value={form.ticketOpenAt} onChange={(e) => setForm({ ...form, ticketOpenAt: e.target.value })} />
              <Input placeholder="포스터 URL" value={form.posterUrl} onChange={(e) => setForm({ ...form, posterUrl: e.target.value })} />
            </div>
            <Textarea placeholder="공연 설명" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  2
                </div>
                <h2 className="font-semibold">회차 등록</h2>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addSession}>
                <Plus className="mr-1 size-3.5" />회차 추가
              </Button>
            </div>
            <div className="space-y-3">
              {sessions.map((session, index) => (
                <div key={`${session.sessionNum}-${index}`} className="rounded-lg border border-border p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">회차 {index + 1}</p>
                    {sessions.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeSession(index)}>
                        <Minus className="mr-1 size-3.5" />삭제
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      placeholder="회차 번호"
                      type="number"
                      value={session.sessionNum}
                      onChange={(e) => updateSession(index, { sessionNum: e.target.value })}
                    />
                    <Input
                      placeholder="출연진"
                      value={session.actor}
                      onChange={(e) => updateSession(index, { actor: e.target.value })}
                    />
                    <Input
                      placeholder="공연 시작 yyyy-MM-dd HH:mm:ss"
                      value={session.performanceStartAt}
                      onChange={(e) => updateSession(index, { performanceStartAt: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  3
                </div>
                <h2 className="font-semibold">좌석 가격</h2>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPriceRow}>
                <Plus className="mr-1 size-3.5" />좌석 가격 추가
              </Button>
            </div>
            <div className="space-y-3">
              {priceRows.map((row, index) => {
                const usedZones = priceRows
                  .filter((item) => item.id !== row.id && item.zone)
                  .map((item) => item.zone)

                return (
                  <div key={row.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 md:flex-row md:items-end">
                    <div className="flex-1">
                      <p className="mb-2 text-sm font-medium">좌석 {index + 1}</p>
                      <Select
                        value={row.zone}
                        onValueChange={(value) => updatePriceRow(row.id, { zone: value as Zone })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="좌석 구역 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {(['VIP', 'R', 'S', 'A'] as Zone[]).map((zone) => {
                            const isDisabled = usedZones.includes(zone) && row.zone !== zone
                            return (
                              <SelectItem key={zone} value={zone} disabled={isDisabled}>
                                {zone}석
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <p className="mb-2 text-sm font-medium">가격</p>
                      <Input
                        placeholder="가격 입력"
                        type="number"
                        value={row.price}
                        onChange={(e) => updatePriceRow(row.id, { price: e.target.value })}
                      />
                    </div>
                    {priceRows.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removePriceRow(row.id)}>
                        <Minus className="mr-1 size-3.5" />삭제
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <Button type="button" onClick={handleCreatePerformance} disabled={submitting}>
            {submitting ? '등록 중...' : '공연 등록'}
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {performances.map((performance) => {
          const sessions = api.listSessions(performance.id)
          const prices = api.listZonePrices(performance.id)
          return (
            <div key={performance.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{performance.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{performance.category}</p>
                </div>
                <PerformanceStatusBadge status={performance.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="size-4" />
                  <span>{sessions.length}회차 · {prices.length}개 구역</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="size-4" />
                  <span>기본 가격: {prices.length > 0 ? formatKRW(Math.min(...prices.map((p) => p.price))) : '-'}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/performances/${performance.id}`}>상세 보기</Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  updatePerformance(performance.id, {
                    title: `${performance.title} (수정됨)`,
                    description: `${performance.description}\n\n[수정됨]`,
                  })
                }}>
                  <Pencil className="mr-1 size-3.5" />수정
                </Button>
                <Button size="sm" variant="outline" onClick={() => deletePerformance(performance.id)}>
                  <Trash2 className="mr-1 size-3.5" />삭제
                </Button>
                {performance.status !== 'CANCELLED' && (
                  <Button size="sm" variant="destructive" onClick={() => sellerCancelPerformance(performance.id)}>
                    공연 취소
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
