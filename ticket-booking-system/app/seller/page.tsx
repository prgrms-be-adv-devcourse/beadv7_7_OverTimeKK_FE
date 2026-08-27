'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Plus, Trash2, DollarSign, Users, Minus } from 'lucide-react'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { effectivePerformanceStatus, formatKRW } from '@/lib/domain'
import { performanceApi, PerformanceApiError, imagesApi } from '@/lib/performance-api'
import { registerPerformanceExtras } from '@/lib/performance-extras'
import { venueApi, type VenueSummary, type HallSummary, type HallDirectoryEntry } from '@/lib/venue-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PerformanceStatusBadge } from '@/components/status-badges'
import { LoginRequired } from '@/components/login-required'
import type { Zone } from '@/lib/types'

/** <input type="date">가 요구하는 'yyyy-MM-dd' — offsetDays만큼 오늘에서 이동한 날짜 */
function dateOnly(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** 백엔드가 기대하는 'yyyy-MM-dd HH:mm:ss' 형식의 현재 시각 — 티켓 오픈일 기본값(등록 즉시 예매 테스트 가능하도록) */
function defaultTicketOpenAt(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:00`
}

/** 'yyyy-MM-dd HH:mm:ss' → <input type="datetime-local">이 요구하는 'yyyy-MM-ddTHH:mm' */
function dateTimeToInputValue(value: string): string {
  const [datePart, timePart = '00:00:00'] = value.split(' ')
  return `${datePart}T${timePart.slice(0, 5)}`
}

/** <input type="datetime-local"> 값('yyyy-MM-ddTHH:mm') → 백엔드가 기대하는 'yyyy-MM-dd HH:mm:ss' */
function inputValueToDateTime(value: string): string {
  const [datePart, timePart = '00:00'] = value.split('T')
  return `${datePart} ${timePart}:00`
}

export default function SellerPage() {
  const {
    role,
    userId,
    version,
    refresh,
    sellerCancelPerformance,
    deletePerformance,
    authUser,
    accessToken,
    authLoading,
  } = useApp()
  void version
  const [submitting, setSubmitting] = useState(false)
  const [isUploadingPoster, setIsUploadingPoster] = useState(false)
  const [posterUploadError, setPosterUploadError] = useState<string | null>(null)
  /** 수정/삭제 버튼이 실 API 호출 중인 공연 id — 중복 클릭 방지용 */
  const [actionPendingId, setActionPendingId] = useState<string | null>(null)

  const [venues, setVenues] = useState<VenueSummary[]>([])
  const [halls, setHalls] = useState<HallSummary[]>([])
  const [hallsLoading, setHallsLoading] = useState(false)
  // 공연 카드에 hall 이름을 보여주기 위한 hallId → hall/venue 이름 조회 캐시.
  // "hall 단건 조회" API가 없어서(venue_id로만 조회 가능) 전체를 한 번에 모아서 씀.
  const [hallDirectory, setHallDirectory] = useState<Map<number, HallDirectoryEntry> | null>(null)

  useEffect(() => {
    venueApi.list().then(setVenues).catch(() => setVenues([]))
    venueApi.hallDirectory().then(setHallDirectory).catch(() => setHallDirectory(null))
  }, [])

  const performances = useMemo(() => {
    const all = api.listPerformances()
    // 실 공연(숫자 id)은 백엔드 응답에 sellerId가 없어서 소유권을 알 수 없다 — 필터링하지
    // 않고 전부 보여준다(BE-요청: PerformanceDetailResponse.sellerId 추가). mock 공연(문자열
    // id, 현재는 없음)만 소유권으로 거른다.
    return all.filter((performance) => /^\d+$/.test(performance.id) || performance.sellerId === userId)
  }, [version, userId])

  const [draftMode, setDraftMode] = useState(false)
  const [form, setForm] = useState<{
    title: string
    description: string
    runtime: string
    startDate: string
    endDate: string
    ticketOpenAt: string
    venueId: number | null
    hallId: number | null
    posterUrl: string
    posterObjectKey: string
  }>({
    title: '',
    description: '',
    runtime: '',
    startDate: dateOnly(0),
    endDate: dateOnly(1),
    ticketOpenAt: defaultTicketOpenAt(),
    venueId: null,
    hallId: null,
    posterUrl: '',
    posterObjectKey: '',
  })

  // venue 선택이 바뀌면 그 venue의 hall 목록을 새로 불러오고, 이전에 고른 hall 선택은 초기화한다.
  useEffect(() => {
    if (form.venueId == null) {
      setHalls([])
      return
    }
    let cancelled = false
    setHallsLoading(true)
    venueApi
      .halls(form.venueId)
      .then((result) => {
        if (!cancelled) setHalls(result)
      })
      .catch(() => {
        if (!cancelled) setHalls([])
      })
      .finally(() => {
        if (!cancelled) setHallsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.venueId])
  const [sessions, setSessions] = useState([
    { sessionNum: '1', actor: '', performanceStartAt: `${dateOnly(1)} 19:00:00` },
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
        performanceStartAt: `${dateOnly(1)} 19:00:00`,
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

  async function handlePosterUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingPoster(true)
    setPosterUploadError(null)

    try {
      const { uploadUrl, objectKey } = await imagesApi.getUploadUrl(
        file.name,
        file.type || 'application/octet-stream',
        file.size
      )

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error('S3 업로드에 실패했습니다.')
      }

      setForm((prev) => ({ ...prev, posterUrl: imagesApi.toDisplayUrl(objectKey), posterObjectKey: objectKey }))
    } catch (error) {
      setPosterUploadError(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingPoster(false)
      event.target.value = ''
    }
  }

  const selectedVenueLabel = venues.find((v) => v.venueId === form.venueId)?.venueName ?? '공연장(venue) 선택'
  const selectedHallLabel = halls.find((h) => h.hallId === form.hallId)?.hallName ?? (hallsLoading ? '불러오는 중...' : '홀 선택')

  // 실제 performance-service(v2 등록 API)로 공연을 등록한다.
  async function handleCreatePerformance() {
    if (!authUser || !accessToken) {
      alert('로그인이 필요합니다.')
      return
    }
    if (!form.title.trim()) {
      alert('공연 제목을 입력해 주세요.')
      return
    }
    if (form.hallId == null) {
      alert('공연장을 선택해 주세요.')
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

    setSubmitting(true)
    try {
      await performanceApi.register(
        {
          title: form.title,
          description: form.description,
          runtime: Number(form.runtime),
          startDate: form.startDate,
          endDate: form.endDate,
          ticketOpenAt: form.ticketOpenAt,
          hallId: form.hallId,
          postUrl: form.posterObjectKey,
          sessions: sessions.map((session) => ({
            sessionNum: Number(session.sessionNum) || 1,
            actor: session.actor,
            performanceStartAt: session.performanceStartAt,
          })),
          seatPrices: prices.map((p) => ({ zone: p.zone, price: p.price })),
        },
        accessToken,
      )

      // 등록 응답엔 performanceId가 안 내려오므로, title로 목록을 다시 조회해서 찾는다.
      const list = await performanceApi.list()
      const created = [...list].reverse().find((p) => p.title === form.title)
      if (created) {
        const realSessions = await performanceApi.sessions(created.performanceId).catch(() => [])
        registerPerformanceExtras(form.title, {
          posterUrl: form.posterUrl,
          zonePrices: Object.fromEntries(prices.map((p) => [p.zone, p.price])),
        })
        api.importRealPerformances([{ real: created, sessions: realSessions }])
        refresh()
      }

      setDraftMode(false)
      setForm({
        title: '',
        description: '',
        runtime: '',
        startDate: dateOnly(0),
        endDate: dateOnly(1),
        ticketOpenAt: defaultTicketOpenAt(),
        venueId: null,
        hallId: null,
        posterUrl: '',
        posterObjectKey: '',
      })
      setSessions([{ sessionNum: '1', actor: '', performanceStartAt: `${dateOnly(1)} 19:00:00` }])
      setPriceRows([{ id: 1, zone: 'VIP', price: '' }])
    } catch (e) {
      const message = e instanceof PerformanceApiError ? e.message : '공연 등록에 실패했습니다. 백엔드 서버 상태를 확인해 주세요.'
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeletePerformance(performance: (typeof performances)[number]) {
    if (!authUser || !accessToken) {
      alert('로그인이 필요합니다.')
      return
    }
    if (!confirm(`"${performance.title}"을(를) 삭제하시겠습니까?`)) return
    setActionPendingId(performance.id)
    try {
      await performanceApi.delete(Number(performance.id), accessToken)
      deletePerformance(performance.id)
    } catch (e) {
      const message = e instanceof PerformanceApiError ? e.message : '공연 삭제에 실패했습니다.'
      alert(message)
    } finally {
      setActionPendingId(null)
    }
  }

  if (authLoading) return null
  if (!authUser) return <LoginRequired message="공연 관리는 로그인 후 이용할 수 있습니다." />
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
              <Select
                value={form.venueId != null ? String(form.venueId) : ''}
                onValueChange={(value) =>
                  value && setForm({ ...form, venueId: Number(value), hallId: null })
                }
              >
                <SelectTrigger className="w-full">
                  <span>{selectedVenueLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  {venues.map((venue) => (
                    <SelectItem key={venue.venueId} value={String(venue.venueId)}>
                      {venue.venueName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="러닝타임(분, 숫자만 입력)" type="number" value={form.runtime} onChange={(e) => setForm({ ...form, runtime: e.target.value })} />
              <Select
                value={form.hallId != null ? String(form.hallId) : ''}
                onValueChange={(value) => value && setForm({ ...form, hallId: Number(value) })}
              >
                <SelectTrigger className="w-full" disabled={form.venueId == null}>
                  <span>{selectedHallLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  {halls.map((hall) => (
                    <SelectItem key={hall.hallId} value={String(hall.hallId)}>
                      {hall.hallName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="md:col-span-2 space-y-1.5">
                <p className="text-sm text-muted-foreground">공연이 진행되는 시작일과 종료일을 선택하세요 (모든 회차는 이 기간 안에 있어야 합니다)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="performance-start-date">시작일</Label>
                    <Input id="performance-start-date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="performance-end-date">종료일</Label>
                    <Input id="performance-end-date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="performance-ticket-open">티켓 오픈 일시</Label>
                <Input
                  id="performance-ticket-open"
                  type="datetime-local"
                  value={dateTimeToInputValue(form.ticketOpenAt)}
                  onChange={(e) => setForm({ ...form, ticketOpenAt: inputValueToDateTime(e.target.value) })}
                />
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-accent">
                  <Plus className="mr-2 size-4" />
                  {isUploadingPoster ? '업로드 중...' : '포스터 이미지 업로드'}
                  <input type="file" accept="image/*" className="sr-only" onChange={handlePosterUpload} />
                </label>
              </div>
              {form.posterUrl ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-medium">업로드된 포스터</p>
                  <img src={form.posterUrl} alt="공연 포스터 미리보기" className="h-40 w-full rounded-md object-cover" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">이미지를 업로드하면 포스터가 표시됩니다.</p>
              )}
              {posterUploadError ? <p className="text-sm text-destructive">{posterUploadError}</p> : null}
            </div>
            <div className="space-y-1">
              <Textarea
                placeholder="공연 설명"
                maxLength={255}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <p className="text-right text-xs text-muted-foreground">{form.description.length}/255</p>
            </div>
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
                      type="datetime-local"
                      value={dateTimeToInputValue(session.performanceStartAt)}
                      onChange={(e) => updateSession(index, { performanceStartAt: inputValueToDateTime(e.target.value) })}
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
                  <p className="mt-1 text-sm text-muted-foreground">
                    {hallDirectory?.get(Number(performance.hallId))?.hallName ?? '공연장 정보 없음'}
                  </p>
                </div>
                <PerformanceStatusBadge status={effectivePerformanceStatus(performance)} />
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
                <Button  size="sm" variant="outline">
                  <Link href={`/performances/${performance.id}`}>상세 보기</Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionPendingId === performance.id}
                  onClick={() => handleDeletePerformance(performance)}
                >
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
