import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, Search, Settings,
  CalendarDays, Clock3, Users, X, Trash2, Check, RotateCcw, Inbox, Bell,
  Sparkles, Send, Bot, UserRound, LoaderCircle
} from 'lucide-react'
import './styles.css'

type View = 'month' | 'week' | 'day'
type EventItem = {
  id: number
  title: string
  date: string
  start: string
  end: string
  color: string
  calendarName: string
  description?: string
  notified?: boolean
  // null/undefined = 알림 없음, 0 = 시작 시각 정시, 그 외 = 시작 몇 분 전
  reminderMinutes?: number | null
}

const REMINDER_OPTIONS: {value:number, label:string}[] = [
  { value: 0, label: '일정 시작 시각(정시)' },
  { value: 5, label: '5분 전' },
  { value: 10, label: '10분 전' },
  { value: 30, label: '30분 전' },
  { value: 60, label: '1시간 전' },
  { value: 1440, label: '1일 전' },
]
// 알림이 울릴 실제 시각을 "8월 12일 오전 8:50" 형태로 계산
const alarmClockLabel = (date:string, start:string, reminderMinutes:number) => {
  const [y,m,d] = date.split('-').map(Number)
  const [hh,mm] = start.split(':').map(Number)
  const eventT = new Date(y, m-1, d, hh, mm, 0, 0)
  const alarmT = new Date(eventT.getTime() - reminderMinutes*60000)
  const isPM = alarmT.getHours() >= 12
  const h12 = alarmT.getHours() % 12 === 0 ? 12 : alarmT.getHours() % 12
  const sameDate = alarmT.getFullYear()===y && alarmT.getMonth()===m-1 && alarmT.getDate()===d
  const dayPrefix = sameDate ? '' : `${alarmT.getMonth()+1}월 ${alarmT.getDate()}일 `
  return `${dayPrefix}${isPM?'오후':'오전'} ${h12}:${pad(alarmT.getMinutes())}`
}
type CalendarInfo = { id: number, name: string, color: string }
type TrashedCalendar = { id: number, name: string, color: string, events: EventItem[], deletedAt: string }
type TrashedEvent = { trashId: number, batchId: number, event: EventItem, deletedAt: string }
type AiMessage = { id: number, role: 'assistant' | 'user', content: string }
type AiSuggestion = { label: string, prompt: string }
type AiCalendarAction = {
  type: 'create_event' | 'create_event_range' | 'update_event' | 'delete_event' | 'set_reminder' | 'delete_all_events' | 'restore_event' | 'restore_all_events' | 'restore_last_deleted'
  eventId?: number | null
  trashId?: number | null
  batchId?: number | null
  title?: string | null
  date?: string | null
  rangeEndDate?: string | null
  recurrenceMode?: 'none' | 'daily' | 'weekdays'
  start?: string | null
  end?: string | null
  calendarName?: string | null
  description?: string | null
  reminderMode?: 'keep' | 'none' | 'set'
  reminderMinutes?: number | null
}
type AiApiResponse = { reply?: string, actions?: AiCalendarAction[], error?: string }

const replaceBrandText = (value: string) => value
  .replace(/NEXUS/g, 'MODUI')
  .replace(/Nexus/g, 'MODUI')
  .replace(/nexus/g, 'modui')

const normalizeBrand = <T,>(value: T): T => {
  if (typeof value === 'string') return replaceBrandText(value) as T
  if (Array.isArray(value)) return value.map(normalizeBrand) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeBrand(v)])) as T
  }
  return value
}

const loadStorage = <T,>(newKey: string, oldKey: string, fallback: T): T => {
  try {
    const current = localStorage.getItem(newKey)
    if (current) return normalizeBrand(JSON.parse(current)) as T
    const legacy = localStorage.getItem(oldKey)
    if (legacy) {
      const migrated = normalizeBrand(JSON.parse(legacy)) as T
      localStorage.setItem(newKey, JSON.stringify(migrated))
      return migrated
    }
  } catch {}
  return fallback
}

const AI_SUGGESTIONS: AiSuggestion[] = [
  { label: '현재 캘린더를 요약해줄까요?', prompt: '현재 캘린더 전체를 간단히 요약해줘. 중요한 일정, 회의, 마감일을 우선순위와 함께 알려줘.' },
  { label: '이번 주 핵심 일정을 정리할까요?', prompt: '이번 주에 있는 중요한 일정과 마감일을 날짜순으로 정리해줘. 특히 준비가 필요한 일정은 따로 표시해줘.' },
  { label: '겹치는 일정을 찾아드릴까요?', prompt: '캘린더에서 시간이 겹치거나 너무 촘촘하게 이어지는 일정을 찾아줘. 문제가 있다면 조정 방법도 제안해줘.' },
  { label: '빈 시간을 찾아드릴까요?', prompt: '이번 주 일정 사이에서 집중 업무나 추가 회의를 잡기 좋은 빈 시간을 찾아서 추천해줘.' },
]

const colors = ['#1a73e8', '#188038', '#9334e6', '#d93025', '#e37400']
const initialCalendars: CalendarInfo[] = [
  { id: 1, name: 'MODUI 플랫폼', color: '#1a73e8' },
  { id: 2, name: 'ERP 고도화', color: '#188038' },
  { id: 3, name: 'AI 회의록', color: '#9334e6' },
  { id: 4, name: '개인 일정', color: '#d93025' }
]

const initialEvents: EventItem[] = [
  { id: 1, title: '주간 프로젝트 회의', date: '2026-08-10', start: '10:00', end: '11:00', color: '#1a73e8', calendarName: 'MODUI 플랫폼', description: '이번 주 개발 진행 상황과 이슈 공유' },
  { id: 2, title: 'AI 회의록 모듈 개발', date: '2026-08-12', start: '13:00', end: '15:00', color: '#9334e6', calendarName: 'AI 회의록', description: '회의 음성 → 텍스트 → 요약 파이프라인 구현' },
  { id: 3, title: 'ERP 요구사항 정리', date: '2026-08-14', start: '09:30', end: '11:00', color: '#188038', calendarName: 'ERP 고도화' },
  { id: 4, title: '디자인 리뷰', date: '2026-08-18', start: '14:00', end: '15:00', color: '#d93025', calendarName: 'MODUI 플랫폼' },
  { id: 5, title: '프로젝트 중간 발표', date: '2026-08-21', start: '16:00', end: '17:30', color: '#e37400', calendarName: 'MODUI 플랫폼' },
  { id: 6, title: '개발자 스터디', date: '2026-08-25', start: '19:00', end: '20:30', color: '#188038', calendarName: '개인 일정' }
]

const pad = (n:number) => String(n).padStart(2,'0')
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const sameDay = (a:Date,b:Date) => fmtDate(a) === fmtDate(b)
const validDateValue = (value?: string | null) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
const validTimeValue = (value?: string | null) => Boolean(value && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))
const addMinutesToTime = (time:string, minutes:number) => {
  const [h,m] = time.split(':').map(Number)
  const total = ((h * 60 + m + minutes) % (24 * 60) + (24 * 60)) % (24 * 60)
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}
const timeToMinutes = (time:string) => {
  const [h,m] = time.split(':').map(Number)
  return h * 60 + m
}
const eventDurationMinutes = (start:string, end:string) => {
  const startMinutes = timeToMinutes(start)
  let endMinutes = timeToMinutes(end)
  if (endMinutes <= startMinutes) endMinutes += 24 * 60
  const duration = endMinutes - startMinutes
  return duration > 0 && duration <= 12 * 60 ? duration : 60
}
const validReminderMinutes = (value?: number | null) =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 10080
const reminderText = (value:number|null|undefined) => {
  if (value === null || value === undefined) return '알림 없음'
  if (value === 0) return '정시'
  if (value < 60) return `${value}분 전`
  if (value < 1440 && value % 60 === 0) return `${value / 60}시간 전`
  if (value % 1440 === 0) return `${value / 1440}일 전`
  return `${value}분 전`
}
const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const weekNames = ['일','월','화','수','목','금','토']

function App() {
  const [today, setToday] = useState(() => new Date())
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<View>('month')
  const [events, setEvents] = useState<EventItem[]>(() => {
    return loadStorage('modui-calendar-events', 'nexus-calendar-events', initialEvents)
  })
  const eventsRef = useRef(events)
  const [calendars, setCalendars] = useState<CalendarInfo[]>(() => {
    return loadStorage('modui-calendar-calendars', 'nexus-calendar-calendars', initialCalendars)
  })
  const [visibleCalendars, setVisibleCalendars] = useState<Record<number,boolean>>(() => {
    return loadStorage('modui-calendar-visible-calendars', 'nexus-calendar-visible-calendars', Object.fromEntries(initialCalendars.map(c => [c.id, true])))
  })
  const [trash, setTrash] = useState<TrashedCalendar[]>(() => {
    return loadStorage('modui-calendar-trash', 'nexus-calendar-trash', [])
  })
  const [trashedEvents, setTrashedEvents] = useState<TrashedEvent[]>(() => {
    return loadStorage('modui-calendar-event-trash', 'nexus-calendar-event-trash', [])
  })
  const trashedEventsRef = useRef(trashedEvents)

  useEffect(() => {
    eventsRef.current = events
    try { localStorage.setItem('modui-calendar-events', JSON.stringify(events)) } catch {}
  }, [events])
  useEffect(() => {
    try { localStorage.setItem('modui-calendar-visible-calendars', JSON.stringify(visibleCalendars)) } catch {}
  }, [visibleCalendars])
  useEffect(() => {
    try { localStorage.setItem('modui-calendar-calendars', JSON.stringify(calendars)) } catch {}
  }, [calendars])
  useEffect(() => {
    try { localStorage.setItem('modui-calendar-trash', JSON.stringify(trash)) } catch {}
  }, [trash])
  useEffect(() => {
    trashedEventsRef.current = trashedEvents
    try { localStorage.setItem('modui-calendar-event-trash', JSON.stringify(trashedEvents)) } catch {}
  }, [trashedEvents])

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )

  // 날짜가 바뀌어도 새로고침 없이 '오늘' 표시가 자동으로 갱신됩니다.
  useEffect(() => {
    const refreshToday = () => setToday(new Date())
    const timer = window.setInterval(refreshToday, 30000)
    window.addEventListener('focus', refreshToday)
    document.addEventListener('visibilitychange', refreshToday)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshToday)
      document.removeEventListener('visibilitychange', refreshToday)
    }
  }, [])

  // 알림 권한 요청은 브라우저 정책상 사용자 클릭에서 실행해야 안정적으로 동작합니다.
  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported')
      return
    }
    try {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      if (permission === 'granted') {
        new Notification('MODUI Calendar', { body: '알림이 켜졌습니다. 일정 알림을 이 브라우저에서 받을 수 있어요.', tag: 'modui-notification-enabled' })
      }
    } catch {}
  }

  // 설정한 알림 시각이 되면 브라우저 알림 발송 (일정 시작 시각 기준으로 몇 분 전/정시)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      setEvents(prev => {
        let changed = false
        const next = prev.map(e => {
          if (e.notified) return e
          if (e.reminderMinutes === null || e.reminderMinutes === undefined) return e
          const [y, m, d] = e.date.split('-').map(Number)
          const [hh, mm] = e.start.split(':').map(Number)
          const eventTime = new Date(y, m - 1, d, hh, mm).getTime()
          const alarmTime = eventTime - e.reminderMinutes * 60000
          // 백그라운드 탭은 타이머가 1분 이상 지연될 수 있으므로,
          // 정확히 60초 안에 들어왔을 때만 보내는 방식 대신 일정 시작 전까지 놓친 알림을 보냅니다.
          if (now >= alarmTime && now <= eventTime && 'Notification' in window && Notification.permission === 'granted') {
            const body = e.reminderMinutes === 0
              ? `지금 시작합니다 · ${e.calendarName}`
              : `${e.reminderMinutes < 60 ? `${e.reminderMinutes}분` : e.reminderMinutes < 1440 ? `${e.reminderMinutes/60}시간` : `${e.reminderMinutes/1440}일`} 후 ${e.start}에 시작 · ${e.calendarName}`
            try {
              new Notification(e.title, { body, tag: `modui-event-${e.id}` })
              changed = true
              return { ...e, notified: true }
            } catch {}
          }
          return e
        })
        return changed ? next : prev
      })
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  const [filterOpen, setFilterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [calendarListOpen, setCalendarListOpen] = useState(true)
  const [calendarModal, setCalendarModal] = useState<{open:boolean, calendar?: CalendarInfo}>({open:false})
  const [modal, setModal] = useState<{open:boolean,date:string}>({open:false,date:fmtDate(today)})
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [query, setQuery] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    { id: 1, role: 'assistant', content: '안녕하세요. MODUI Calendar AI예요. 캘린더를 요약하거나, 일정 충돌을 찾고, 빈 시간을 추천하는 일을 도와드릴 수 있어요.' }
  ])


  const visibleEvents = useMemo(() => {
    const activeCalendarNames = new Set(
      calendars.filter(c => visibleCalendars[c.id] !== false).map(c => c.name)
    )
    const q = query.trim().toLowerCase()
    return events.filter(e =>
      activeCalendarNames.has(e.calendarName) &&
      (!q || e.title.toLowerCase().includes(q) || e.calendarName.toLowerCase().includes(q))
    )
  }, [events, calendars, visibleCalendars, query])

  const applyAiActions = (actions: AiCalendarAction[]) => {
    if (!Array.isArray(actions) || actions.length === 0) return [] as string[]

    let next = [...eventsRef.current]
    let nextTrash = [...trashedEventsRef.current]
    const results: string[] = []
    let nextId = Math.max(Date.now(), ...next.map(e => e.id + 1), 1)
    let nextTrashId = Math.max(Date.now(), ...nextTrash.map(t => t.trashId + 1), 1)
    let eventsChanged = false
    let trashChanged = false

    const normalizeKey = (value?: string | null) => (value || '').trim().toLowerCase().replace(/\s+/g, '')

    const findCalendar = (name?: string | null) => {
      const key = normalizeKey(name)
      if (!key) return calendars.length === 1 ? calendars[0] : undefined
      return calendars.find(c => normalizeKey(c.name) === key)
    }

    const findTarget = (action: AiCalendarAction) => {
      if (typeof action.eventId === 'number') {
        const byId = next.find(e => e.id === action.eventId)
        if (byId) return byId
      }
      if (action.title) {
        const titleKey = normalizeKey(action.title)
        let candidates = next.filter(e => normalizeKey(e.title) === titleKey)
        if (action.date) candidates = candidates.filter(e => e.date === action.date)
        if (action.start) candidates = candidates.filter(e => e.start === action.start)
        if (candidates.length === 1) return candidates[0]
      }
      return undefined
    }

    const makeTrashBatch = (targets: EventItem[], batchId = Date.now()) => {
      const deletedAt = new Date().toISOString()
      const items = targets.map(event => ({
        trashId: nextTrashId++,
        batchId,
        event: { ...event },
        deletedAt,
      }))
      nextTrash = [...items, ...nextTrash]
      trashChanged = true
      return items
    }

    const findTrashTarget = (action: AiCalendarAction) => {
      if (typeof action.trashId === 'number') {
        const byTrashId = nextTrash.find(item => item.trashId === action.trashId)
        if (byTrashId) return byTrashId
      }
      if (typeof action.eventId === 'number') {
        const byEventId = nextTrash
          .filter(item => item.event.id === action.eventId)
          .sort((a,b) => b.deletedAt.localeCompare(a.deletedAt))[0]
        if (byEventId) return byEventId
      }
      if (action.title) {
        const titleKey = normalizeKey(action.title)
        let candidates = nextTrash.filter(item => normalizeKey(item.event.title) === titleKey)
        if (action.date) candidates = candidates.filter(item => item.event.date === action.date)
        if (action.calendarName) candidates = candidates.filter(item => normalizeKey(item.event.calendarName) === normalizeKey(action.calendarName))
        return candidates.sort((a,b) => b.deletedAt.localeCompare(a.deletedAt))[0]
      }
      return undefined
    }

    const restoreTrashItems = (items: TrashedEvent[]) => {
      if (items.length === 0) return [] as EventItem[]
      const existingIds = new Set(next.map(e => e.id))
      const restored: EventItem[] = []
      for (const item of items) {
        const source = item.event
        const restoredEvent: EventItem = {
          ...source,
          id: existingIds.has(source.id) ? nextId++ : source.id,
          notified: false,
        }
        existingIds.add(restoredEvent.id)
        next.push(restoredEvent)
        restored.push(restoredEvent)
      }
      const trashIds = new Set(items.map(item => item.trashId))
      nextTrash = nextTrash.filter(item => !trashIds.has(item.trashId))
      eventsChanged = true
      trashChanged = true
      return restored
    }

    const parseIsoDate = (value: string) => {
      const [year, month, day] = value.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      return Number.isNaN(date.getTime()) ? null : date
    }

    const formatIsoDate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    const datesInRange = (startDate: string, endDate: string, recurrenceMode: 'none' | 'daily' | 'weekdays' = 'daily') => {
      const startDateValue = parseIsoDate(startDate)
      const endDateValue = parseIsoDate(endDate)
      if (!startDateValue || !endDateValue || startDateValue > endDateValue) return [] as string[]

      const dates: string[] = []
      const cursor = new Date(startDateValue)
      // 실수로 지나치게 많은 일정을 생성하지 않도록 최대 366일까지만 허용합니다.
      for (let guard = 0; guard < 366 && cursor <= endDateValue; guard += 1) {
        const day = cursor.getDay()
        if (recurrenceMode !== 'weekdays' || (day !== 0 && day !== 6)) {
          dates.push(formatIsoDate(cursor))
        }
        cursor.setDate(cursor.getDate() + 1)
      }
      return dates
    }

    for (const action of actions.slice(0, 10)) {
      if (action.type === 'create_event_range') {
        const calendar = findCalendar(action.calendarName)
        if (!calendar || !action.title?.trim() || !validDateValue(action.date) || !validDateValue(action.rangeEndDate) || !validTimeValue(action.start)) {
          results.push('⚠️ 반복 일정 추가에 필요한 시작일·종료일·시간·캘린더 정보를 확실히 확인하지 못해서 반영하지 않았어요.')
          continue
        }

        if (action.reminderMode === 'set' && !validReminderMinutes(action.reminderMinutes)) {
          results.push('⚠️ 알림 시간을 정확히 해석하지 못해서 반복 일정을 반영하지 않았어요.')
          continue
        }

        const recurrenceMode = action.recurrenceMode === 'weekdays' ? 'weekdays' : 'daily'
        const targetDates = datesInRange(action.date!, action.rangeEndDate!, recurrenceMode)
        if (targetDates.length === 0) {
          results.push('⚠️ 반복 일정의 날짜 범위를 확인하지 못해서 추가하지 않았어요.')
          continue
        }

        const start = action.start!
        const end = validTimeValue(action.end) && action.end !== start ? action.end! : addMinutesToTime(start, 60)
        const reminderMinutes = action.reminderMode === 'set' ? Number(action.reminderMinutes) : null
        let createdCount = 0
        let skippedCount = 0

        for (const date of targetDates) {
          const duplicate = next.some(event =>
            event.date === date &&
            event.start === start &&
            normalizeKey(event.title) === normalizeKey(action.title) &&
            normalizeKey(event.calendarName) === normalizeKey(calendar.name)
          )
          if (duplicate) {
            skippedCount += 1
            continue
          }

          next.push({
            id: nextId++,
            title: action.title.trim(),
            date,
            start,
            end,
            color: calendar.color,
            calendarName: calendar.name,
            description: action.description?.trim() || '',
            reminderMinutes,
            notified: false,
          })
          createdCount += 1
        }

        if (createdCount > 0) eventsChanged = true
        const recurrenceLabel = recurrenceMode === 'weekdays' ? '평일' : '매일'
        results.push(
          createdCount > 0
            ? `✅ ${action.date}부터 ${action.rangeEndDate}까지 ${recurrenceLabel} ${start}에 “${action.title.trim()}” 일정 ${createdCount}개를 추가했어요.${skippedCount ? `\nℹ️ 이미 같은 일정이 있던 날짜 ${skippedCount}개는 중복 추가하지 않았어요.` : ''}\n🔔 ${reminderText(reminderMinutes)}`
            : `ℹ️ 해당 날짜 범위에는 이미 같은 “${action.title.trim()}” 일정이 모두 등록되어 있어 중복 추가하지 않았어요.`
        )
        continue
      }

      if (action.type === 'create_event') {
        const calendar = findCalendar(action.calendarName)
        if (!calendar || !action.title?.trim() || !validDateValue(action.date) || !validTimeValue(action.start)) {
          results.push('⚠️ 일정 추가에 필요한 날짜·시간·캘린더 정보를 확실히 확인하지 못해서 반영하지 않았어요.')
          continue
        }

        if (action.reminderMode === 'set' && !validReminderMinutes(action.reminderMinutes)) {
          results.push('⚠️ 알림 시간을 정확히 해석하지 못해서 일정을 반영하지 않았어요. 예: “5분 전에 알려줘”처럼 다시 말해주세요.')
          continue
        }

        const start = action.start!
        const end = validTimeValue(action.end) && action.end !== start ? action.end! : addMinutesToTime(start, 60)
        const reminderMinutes = action.reminderMode === 'set' ? Number(action.reminderMinutes) : null
        const item: EventItem = {
          id: nextId++,
          title: action.title.trim(),
          date: action.date!,
          start,
          end,
          color: calendar.color,
          calendarName: calendar.name,
          description: action.description?.trim() || '',
          reminderMinutes,
          notified: false,
        }
        next.push(item)
        eventsChanged = true
        results.push(`✅ ${item.date} ${item.start}~${item.end} “${item.title}” 일정을 ${item.calendarName} 캘린더에 추가했어요.\n🔔 ${reminderText(item.reminderMinutes)}${item.reminderMinutes !== null && notificationPermission !== 'granted' ? '\n⚠️ 브라우저 알림 권한이 꺼져 있어요. 우측 상단 설정에서 알림을 켜주세요.' : ''}`)
        continue
      }

      if (action.type === 'set_reminder') {
        const target = findTarget(action)
        if (!target) {
          results.push('⚠️ 알림을 바꿀 기존 일정을 하나로 특정하지 못해서 변경하지 않았어요.')
          continue
        }

        if (action.reminderMode === 'set' && !validReminderMinutes(action.reminderMinutes)) {
          results.push('⚠️ 변경할 알림 시간을 정확히 확인하지 못해서 알림을 수정하지 않았어요.')
          continue
        }

        const newReminder = action.reminderMode === 'none'
          ? null
          : (action.reminderMode === 'set' ? Number(action.reminderMinutes) : (target.reminderMinutes ?? null))

        next = next.map(e => e.id === target.id ? {
          ...e,
          reminderMinutes: newReminder,
          notified: false,
        } : e)
        eventsChanged = true

        const updated = next.find(e => e.id === target.id)!
        results.push(`✅ “${updated.title}” 일정의 알림만 ${reminderText(updated.reminderMinutes)}으로 변경했어요.\n🕒 일정 시간은 ${updated.start}~${updated.end} 그대로예요.${updated.reminderMinutes !== null && notificationPermission !== 'granted' ? '\n⚠️ 브라우저 알림 권한이 꺼져 있어요. 우측 상단 설정에서 알림을 켜주세요.' : ''}`)
        continue
      }

      if (action.type === 'delete_all_events') {
        const calendar = action.calendarName ? findCalendar(action.calendarName) : undefined
        if (action.calendarName && !calendar) {
          results.push(`⚠️ “${action.calendarName}” 캘린더를 찾지 못해서 일정을 삭제하지 않았어요.`)
          continue
        }

        const targets = calendar
          ? next.filter(e => e.calendarName === calendar.name)
          : [...next]

        if (targets.length === 0) {
          results.push(calendar ? `ℹ️ “${calendar.name}” 캘린더에는 삭제할 일정이 없어요.` : 'ℹ️ 삭제할 일정이 없어요.')
          continue
        }

        makeTrashBatch(targets, Date.now())
        const targetIds = new Set(targets.map(e => e.id))
        next = next.filter(e => !targetIds.has(e.id))
        eventsChanged = true
        results.push(calendar
          ? `✅ “${calendar.name}” 캘린더의 일정 ${targets.length}개를 모두 휴지통으로 이동했어요. “복구해줘”라고 하면 다시 꺼낼 수 있어요.`
          : `✅ 캘린더에 있던 일정 ${targets.length}개를 모두 휴지통으로 이동했어요. “복구해줘”라고 하면 이번에 지운 일정들을 다시 꺼낼 수 있어요.`)
        continue
      }

      if (action.type === 'restore_last_deleted') {
        if (nextTrash.length === 0) {
          results.push('ℹ️ 휴지통에 복구할 일정이 없어요.')
          continue
        }
        const batchId = typeof action.batchId === 'number'
          ? action.batchId
          : nextTrash.slice().sort((a,b) => b.deletedAt.localeCompare(a.deletedAt))[0].batchId
        const targets = nextTrash.filter(item => item.batchId === batchId)
        const restored = restoreTrashItems(targets)
        if (restored.length === 1) {
          results.push(`✅ 휴지통에서 “${restored[0].title}” 일정을 복구했어요.`)
        } else {
          results.push(`✅ 방금 삭제했던 일정 ${restored.length}개를 휴지통에서 모두 복구했어요.`)
        }
        continue
      }

      if (action.type === 'restore_all_events') {
        const calendarName = action.calendarName?.trim()
        const targets = calendarName
          ? nextTrash.filter(item => normalizeKey(item.event.calendarName) === normalizeKey(calendarName))
          : [...nextTrash]
        if (targets.length === 0) {
          results.push(calendarName ? `ℹ️ 휴지통에 “${calendarName}” 캘린더 일정이 없어요.` : 'ℹ️ 휴지통에 복구할 일정이 없어요.')
          continue
        }
        const restored = restoreTrashItems(targets)
        results.push(calendarName
          ? `✅ 휴지통에 있던 “${calendarName}” 일정 ${restored.length}개를 모두 복구했어요.`
          : `✅ 휴지통에 있던 일정 ${restored.length}개를 모두 복구했어요.`)
        continue
      }

      if (action.type === 'restore_event') {
        const target = findTrashTarget(action)
        if (!target) {
          results.push('⚠️ 휴지통에서 복구할 일정을 하나로 특정하지 못했어요. 일정 제목을 같이 말해주세요.')
          continue
        }
        const [restored] = restoreTrashItems([target])
        results.push(`✅ 휴지통에서 “${restored.title}” 일정을 복구했어요.`)
        continue
      }

      if (action.type === 'update_event') {
        const target = findTarget(action)
        if (!target) {
          results.push('⚠️ 수정할 기존 일정을 하나로 특정하지 못해서 변경하지 않았어요.')
          continue
        }

        if (action.reminderMode === 'set' && !validReminderMinutes(action.reminderMinutes)) {
          results.push('⚠️ 변경할 알림 시간을 정확히 확인하지 못해서 일정을 수정하지 않았어요.')
          continue
        }

        const calendar = action.calendarName ? findCalendar(action.calendarName) : undefined
        if (action.calendarName && !calendar) {
          results.push(`⚠️ “${action.calendarName}” 캘린더를 찾지 못해서 일정을 수정하지 않았어요.`)
          continue
        }

        const oldDuration = eventDurationMinutes(target.start, target.end)
        const newStart = validTimeValue(action.start) ? action.start! : target.start
        const newEnd = validTimeValue(action.end)
          ? action.end!
          : (validTimeValue(action.start) ? addMinutesToTime(newStart, oldDuration) : target.end)
        let newReminder = target.reminderMinutes ?? null
        if (action.reminderMode === 'none') newReminder = null
        if (action.reminderMode === 'set') newReminder = Number(action.reminderMinutes)

        next = next.map(e => e.id === target.id ? {
          ...e,
          title: action.title?.trim() || e.title,
          date: validDateValue(action.date) ? action.date! : e.date,
          start: newStart,
          end: newEnd,
          calendarName: calendar?.name || e.calendarName,
          color: calendar?.color || e.color,
          description: action.description !== null && action.description !== undefined ? action.description : e.description,
          reminderMinutes: newReminder,
          notified: false,
        } : e)
        eventsChanged = true
        const updated = next.find(e => e.id === target.id)!
        results.push(`✅ “${updated.title}” 일정을 ${updated.date} ${updated.start}~${updated.end}로 수정했어요.\n🔔 ${reminderText(updated.reminderMinutes)}${updated.reminderMinutes !== null && notificationPermission !== 'granted' ? '\n⚠️ 브라우저 알림 권한이 꺼져 있어요. 우측 상단 설정에서 알림을 켜주세요.' : ''}`)
        continue
      }

      if (action.type === 'delete_event') {
        const target = findTarget(action)
        if (!target) {
          results.push('⚠️ 삭제할 기존 일정을 하나로 특정하지 못해서 삭제하지 않았어요.')
          continue
        }
        makeTrashBatch([target], Date.now())
        next = next.filter(e => e.id !== target.id)
        eventsChanged = true
        results.push(`✅ “${target.title}” 일정을 휴지통으로 이동했어요. “복구해줘”라고 하면 다시 꺼낼 수 있어요.`)
      }
    }

    if (eventsChanged) {
      eventsRef.current = next
      setEvents(next)
    }
    if (trashChanged) {
      trashedEventsRef.current = nextTrash
      setTrashedEvents(nextTrash)
    }
    return results
  }

  const sendAiMessage = async (rawPrompt: string) => {
    const prompt = rawPrompt.trim()
    if (!prompt || aiLoading) return

    const userMessage: AiMessage = { id: Date.now(), role: 'user', content: prompt }
    const history = [...aiMessages, userMessage]
    setAiMessages(history)
    setAiInput('')
    setAiLoading(true)
    setAiOpen(true)

    const sortedEvents = [...events]
      .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`))
      .slice(0, 300)

    try {
      const response = await fetch('/api/calendar-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.slice(-12).map(({ role, content }) => ({ role, content })),
          calendar: {
            today: fmtDate(today),
            cursorDate: fmtDate(cursor),
            view,
            calendars: calendars.map(c => ({ ...c, visible: visibleCalendars[c.id] !== false })),
            events: sortedEvents,
            trashedEvents: trashedEvents.map(item => ({
              trashId: item.trashId,
              batchId: item.batchId,
              event: item.event,
              deletedAt: item.deletedAt,
            })),
          }
        })
      })

      const data: AiApiResponse = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || 'AI 응답을 가져오지 못했습니다.')

      const actions = Array.isArray(data.actions) ? data.actions : []
      const actionResults = applyAiActions(actions)
      // 실제 일정 작업이 있으면 AI의 "완료했다"는 표현이 아니라
      // React가 실제로 반영한 결과만 사용자에게 보여줍니다.
      const assistantContent = actions.length > 0
        ? (actionResults.length > 0 ? actionResults.join('\n\n') : (data.reply || '요청을 확인했습니다.'))
        : (data.reply || '요청을 확인했습니다.')
      setAiMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: assistantContent }])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 연결 중 오류가 발생했습니다.'
      setAiMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: `연결에 문제가 있어요. ${message}` }])
    } finally {
      setAiLoading(false)
    }
  }

  const toggleCalendar = (id:number) => {
    setVisibleCalendars(prev => ({...prev, [id]: prev[id] === false}))
  }

  const allCalendarsVisible = calendars.length > 0 && calendars.every(c => visibleCalendars[c.id] !== false)
  const hiddenCount = calendars.filter(c => visibleCalendars[c.id] === false).length

  const openNew = (date = fmtDate(cursor)) => { setSelected(null); setModal({open:true,date}) }

  const saveCalendar = (name:string, color:string, id?:number) => {
    const clean = name.trim()
    if (!clean) return
    if (id) {
      setCalendars(prev => prev.map(c => c.id === id ? { ...c, name: clean, color } : c))
      setEvents(prev => prev.map(e => e.calendarName === calendars.find(c => c.id === id)?.name ? { ...e, calendarName: clean } : e))
    } else {
      setCalendars(prev => [...prev, { id: Date.now(), name: clean, color }])
    }
    setCalendarModal({open:false})
  }

  // 캘린더 삭제 시 완전히 지우지 않고 휴지통으로 이동
  const deleteCalendar = (id:number) => {
    const calendar = calendars.find(c => c.id === id)
    if (!calendar) return
    const linked = events.filter(e => e.calendarName === calendar.name)
    const msg = linked.length > 0
      ? `${calendar.name} 캘린더와 연결된 일정 ${linked.length}개가 함께 휴지통으로 이동합니다. 계속하시겠습니까?`
      : `${calendar.name} 캘린더를 휴지통으로 이동하시겠습니까?`
    if (!window.confirm(msg)) return
    setTrash(prev => [{ id: calendar.id, name: calendar.name, color: calendar.color, events: linked, deletedAt: fmtDate(new Date()) }, ...prev])
    setCalendars(prev => prev.filter(c => c.id !== id))
    setEvents(prev => prev.filter(e => e.calendarName !== calendar.name))
    setVisibleCalendars(prev => { const next = {...prev}; delete next[id]; return next })
  }

  const restoreCalendar = (id:number) => {
    const item = trash.find(t => t.id === id)
    if (!item) return
    setCalendars(prev => [...prev, { id: item.id, name: item.name, color: item.color }])
    setEvents(prev => [...prev, ...item.events])
    setTrash(prev => prev.filter(t => t.id !== id))
  }

  const permanentlyDeleteCalendar = (id:number) => {
    const item = trash.find(t => t.id === id)
    if (!item) return
    if (window.confirm(`${item.name} 캘린더를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      setTrash(prev => prev.filter(t => t.id !== id))
    }
  }

  const restoreTrashedEvent = (trashId:number) => {
    const item = trashedEventsRef.current.find(t => t.trashId === trashId)
    if (!item) return
    const calendarExists = calendars.some(c => c.name === item.event.calendarName)
    if (!calendarExists) {
      const newCalendar: CalendarInfo = { id: Date.now(), name: item.event.calendarName, color: item.event.color }
      setCalendars(prev => [...prev, newCalendar])
      setVisibleCalendars(prev => ({ ...prev, [newCalendar.id]: true }))
    }
    const currentIds = new Set(eventsRef.current.map(e => e.id))
    const restored = {
      ...item.event,
      id: currentIds.has(item.event.id) ? Date.now() : item.event.id,
      notified: false,
    }
    const nextEvents = [...eventsRef.current, restored]
    const nextTrash = trashedEventsRef.current.filter(t => t.trashId !== trashId)
    eventsRef.current = nextEvents
    trashedEventsRef.current = nextTrash
    setEvents(nextEvents)
    setTrashedEvents(nextTrash)
  }

  const permanentlyDeleteTrashedEvent = (trashId:number) => {
    const item = trashedEventsRef.current.find(t => t.trashId === trashId)
    if (!item) return
    if (window.confirm(`“${item.event.title}” 일정을 휴지통에서 영구적으로 삭제하시겠습니까?`)) {
      const nextTrash = trashedEventsRef.current.filter(t => t.trashId !== trashId)
      trashedEventsRef.current = nextTrash
      setTrashedEvents(nextTrash)
    }
  }

  const emptyTrash = () => {
    if (trash.length === 0 && trashedEvents.length === 0) return
    if (window.confirm('휴지통을 비우시겠습니까? 삭제된 일정과 캘린더가 영구 삭제되며 되돌릴 수 없습니다.')) {
      setTrash([])
      trashedEventsRef.current = []
      setTrashedEvents([])
    }
  }

  const saveEvent = (e: EventItem) => {
    setEvents(prev => {
      const exists = prev.some(x => x.id === e.id)
      return exists ? prev.map(x => x.id === e.id ? { ...e, notified: false } : x) : [...prev, { ...e, notified: false }]
    })
    setModal({open:false,date:e.date}); setSelected(null)
  }
  const deleteEvent = (id:number) => {
    const target = eventsRef.current.find(e => e.id === id)
    if (target) {
      const now = Date.now()
      const trashed: TrashedEvent = {
        trashId: now,
        batchId: now,
        event: { ...target },
        deletedAt: new Date().toISOString(),
      }
      const nextEvents = eventsRef.current.filter(e => e.id !== id)
      const nextTrash = [trashed, ...trashedEventsRef.current]
      eventsRef.current = nextEvents
      trashedEventsRef.current = nextTrash
      setEvents(nextEvents)
      setTrashedEvents(nextTrash)
    }
    setModal({open:false,date:fmtDate(cursor)})
    setSelected(null)
  }

  const shift = (n:number) => {
    const d = new Date(cursor)
    if (view === 'month') d.setMonth(d.getMonth()+n)
    else d.setDate(d.getDate()+n*(view==='week'?7:1))
    setCursor(d)
  }

  return <div className="app">
    <header className="topbar">
      <div className="brand"><div className="logo">M</div><span>MODUI</span><b>Calendar</b></div>
      <button className="today-btn" onClick={()=>setCursor(today)}>오늘</button>
      <div className="nav"><button onClick={()=>shift(-1)}><ChevronLeft/></button><button onClick={()=>shift(1)}><ChevronRight/></button></div>
      <h1>{view==='month' ? `${cursor.getFullYear()}년 ${monthNames[cursor.getMonth()]}` : `${cursor.getFullYear()}년 ${monthNames[cursor.getMonth()]} ${cursor.getDate()}일`}</h1>
      <div className="spacer"/>
      <button className={`ai-top-btn ${aiOpen ? 'active' : ''}`} onClick={()=>setAiOpen(v=>!v)} title="MODUI Calendar AI">
        <Sparkles size={17}/> AI
      </button>
      {notificationPermission !== 'unsupported' && notificationPermission !== 'granted' &&
        <button className="notification-enable" onClick={enableNotifications} title="브라우저 알림 권한 켜기"><Bell size={17}/> 알림 켜기</button>}
      {notificationPermission === 'denied' && <span className="notification-denied">브라우저에서 알림이 차단됨</span>}
      <div className="search"><Search size={18}/><input placeholder="일정 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <div className="settings-wrap">
        <button className="icon-btn" onClick={()=>setSettingsOpen(v=>!v)} title="설정"><Settings size={19}/></button>
        {settingsOpen && <>
          <div className="dropdown-backdrop" onClick={()=>setSettingsOpen(false)}/>
          <div className="settings-menu">
            <button className="settings-item" onClick={()=>setSettingsOpen(false)}>설정</button>
            <button className="settings-item" onClick={()=>{setTrashOpen(true);setSettingsOpen(false)}}>
              휴지통 {(trash.length + trashedEvents.length)>0 && <span className="filter-count">{trash.length + trashedEvents.length}</span>}
            </button>
            <div className="settings-divider"/>
            <button className="settings-item disabled" disabled>모양</button>
            <button className="settings-item disabled" disabled>인쇄</button>
            <div className="settings-divider"/>
            <button className="settings-item disabled" disabled>부가기능 설치하기</button>
          </div>
        </>}
      </div>
      <div className="avatar">윤</div>
    </header>

    <aside className="sidebar">
      <button className="create-btn" onClick={()=>openNew()}><Plus size={20}/> 일정 만들기</button>
      <MiniCalendar cursor={cursor} setCursor={setCursor} today={today}/>
      <div className="side-section">
        <button className="side-title" onClick={()=>setCalendarListOpen(v=>!v)}>
          내 캘린더 <ChevronDown size={16} className={calendarListOpen?'':'chevron-collapsed'}/>
        </button>
        {calendarListOpen && <>
          {calendars.map(c=><div className="calendar-row" key={c.id}>
            <label className="check-row">
              <span className="dot" style={{background:c.color}}></span><span>{c.name}</span>
              <input type="checkbox" checked={visibleCalendars[c.id] !== false} onChange={()=>toggleCalendar(c.id)}/>
            </label>
            <button className="calendar-menu" title="캘린더 관리" onClick={()=>setCalendarModal({open:true,calendar:c})}>⋮</button>
          </div>)}
          <button className="add-calendar-btn" onClick={()=>setCalendarModal({open:true})}><Plus size={15}/> 캘린더 추가</button>
        </>}
      </div>
      <div className="side-info"><CalendarDays size={17}/><div><b>MODUI 업무 캘린더</b><p>프로젝트 · 회의 · 마감일을 한 곳에서 관리하세요.</p></div></div>
    </aside>

    <main className="calendar-wrap">
      <div className="toolbar">
        <div className="view-switch">
          {(['month','week','day'] as View[]).map(v=><button key={v} className={view===v?'active':''} onClick={()=>setView(v)}>{v==='month'?'월':v==='week'?'주':'일'}</button>)}
        </div>
        <div className="filter-wrap">
          <button className={`more-btn ${filterOpen?'filter-active':''}`} onClick={()=>setFilterOpen(v=>!v)}>
            일정 필터{hiddenCount>0 && <span className="filter-count">{hiddenCount}</span>} <ChevronDown size={16}/>
          </button>
          {filterOpen && <div className="filter-menu">
            <div className="filter-menu-title"><b>캘린더 필터</b><button onClick={()=>setVisibleCalendars(Object.fromEntries(calendars.map(c=>[c.id,true])))}>모두 표시</button></div>
            {calendars.map(c=><label className="filter-row" key={c.id}>
              <span className="dot" style={{background:c.color}}></span><span>{c.name}</span>
              <input type="checkbox" checked={visibleCalendars[c.id] !== false} onChange={()=>toggleCalendar(c.id)}/>
            </label>)}
            <div className="filter-footer">{allCalendarsVisible ? '모든 캘린더 표시 중' : `${hiddenCount}개 캘린더 숨김`}</div>
          </div>}
        </div>
      </div>
      {view==='month' && <MonthView cursor={cursor} events={visibleEvents} today={today} onAdd={openNew} onSelect={e=>{setSelected(e);setModal({open:true,date:e.date})}}/>}
      {view==='week' && <WeekView cursor={cursor} events={visibleEvents} today={today} onAdd={openNew} onSelect={e=>{setSelected(e);setModal({open:true,date:e.date})}}/>}
      {view==='day' && <DayView cursor={cursor} events={visibleEvents} onAdd={openNew} onSelect={e=>{setSelected(e);setModal({open:true,date:e.date})}}/>}
    </main>

    {aiOpen && <AiPanel
      messages={aiMessages}
      suggestions={AI_SUGGESTIONS}
      input={aiInput}
      loading={aiLoading}
      onInputChange={setAiInput}
      onSend={sendAiMessage}
      onClose={()=>setAiOpen(false)}
    />}

    {calendarModal.open && <CalendarModal calendar={calendarModal.calendar} onClose={()=>setCalendarModal({open:false})} onSave={saveCalendar} onDelete={(id)=>{deleteCalendar(id);setCalendarModal({open:false})}}/>}
    {modal.open && <EventModal event={selected} date={modal.date} calendars={calendars} onClose={()=>{setModal({open:false,date:modal.date});setSelected(null)}} onSave={saveEvent} onDelete={deleteEvent}/>}
    {trashOpen && <TrashModal items={trash} eventItems={trashedEvents} onClose={()=>setTrashOpen(false)} onRestore={restoreCalendar} onPermanentlyDelete={permanentlyDeleteCalendar} onRestoreEvent={restoreTrashedEvent} onPermanentlyDeleteEvent={permanentlyDeleteTrashedEvent} onEmpty={emptyTrash}/>}
  </div>
}

function MiniCalendar({cursor,setCursor,today}:{cursor:Date,setCursor:(d:Date)=>void,today:Date}) {
  const y=cursor.getFullYear(), m=cursor.getMonth()
  const first=new Date(y,m,1), start=new Date(y,m,1-first.getDay())
  return <div className="mini">
    <div className="mini-head"><b>{y}년 {monthNames[m]}</b><div><button onClick={()=>setCursor(new Date(y,m-1,1))}><ChevronLeft size={15}/></button><button onClick={()=>setCursor(new Date(y,m+1,1))}><ChevronRight size={15}/></button></div></div>
    <div className="mini-grid">{weekNames.map(x=><span className="mini-week" key={x}>{x}</span>)}{Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return <button key={i} className={`${d.getMonth()!==m?'muted':''} ${sameDay(d,cursor)?'sel':''} ${sameDay(d,today)?'today':''}`} onClick={()=>setCursor(d)}>{d.getDate()}</button>})}</div>
  </div>
}

function MonthView({cursor,events,today,onAdd,onSelect}:{cursor:Date,events:EventItem[],today:Date,onAdd:(d:string)=>void,onSelect:(e:EventItem)=>void}) {
  const y=cursor.getFullYear(),m=cursor.getMonth(), first=new Date(y,m,1), start=new Date(y,m,1-first.getDay())
  return <div className="month-grid">
    {weekNames.map((w,i)=><div className={`weekday ${i===0?'sun':''}`} key={w}>{w}</div>)}
    {Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const dayEvents=events.filter(e=>e.date===fmtDate(d));return <div className={`day-cell ${d.getMonth()!==m?'other':''} ${sameDay(d,today)?'current':''}`} key={i} onDoubleClick={()=>onAdd(fmtDate(d))}>
      <div className="date-num">{d.getDate()}</div>
      <div className="events">{dayEvents.slice(0,4).map(e=><button className="event-pill" style={{'--event-color':e.color} as React.CSSProperties} key={e.id} onClick={()=>onSelect(e)}><span>{e.start}</span> {e.title}</button>)}</div>
      {dayEvents.length>4 && <span className="more">+{dayEvents.length-4}개 더보기</span>}
    </div>})}
  </div>
}

function WeekView({cursor,events,today,onAdd,onSelect}:{cursor:Date,events:EventItem[],today:Date,onAdd:(d:string)=>void,onSelect:(e:EventItem)=>void}) {
  const sunday=new Date(cursor); sunday.setDate(cursor.getDate()-cursor.getDay())
  const hours=Array.from({length:14},(_,i)=>i+8)
  return <div className="week-view">
    <div className="week-head"><div></div>{Array.from({length:7},(_,i)=>{const d=new Date(sunday);d.setDate(sunday.getDate()+i);return <div className={sameDay(d,today)?'week-today':''} key={i}><small>{weekNames[i]}</small><b>{d.getDate()}</b></div>})}</div>
    <div className="week-body">{hours.map(h=><React.Fragment key={h}><div className="hour">{pad(h)}:00</div>{Array.from({length:7},(_,i)=>{const d=new Date(sunday);d.setDate(sunday.getDate()+i);const es=events.filter(e=>e.date===fmtDate(d)&&Number(e.start.split(':')[0])===h);return <div className="slot" key={i} onDoubleClick={()=>onAdd(fmtDate(d))}>{es.map(e=><button key={e.id} className="week-event" style={{background:e.color}} onClick={()=>onSelect(e)}>{e.title}<small>{e.start}–{e.end}</small></button>)}</div>})}</React.Fragment>)}</div>
  </div>
}

function DayView({cursor,events,onAdd,onSelect}:{cursor:Date,events:EventItem[],onAdd:(d:string)=>void,onSelect:(e:EventItem)=>void}) {
  const es=events.filter(e=>e.date===fmtDate(cursor)), hours=Array.from({length:14},(_,i)=>i+8)
  return <div className="day-view"><div className="day-title">{weekNames[cursor.getDay()]}요일 · {cursor.getMonth()+1}월 {cursor.getDate()}일</div>{hours.map(h=><div className="day-row" key={h}><span>{pad(h)}:00</span><div onDoubleClick={()=>onAdd(fmtDate(cursor))}>{es.filter(e=>Number(e.start.split(':')[0])===h).map(e=><button key={e.id} className="day-event" style={{borderLeftColor:e.color}} onClick={()=>onSelect(e)}><b>{e.title}</b><small>{e.start} – {e.end} · {e.calendarName}</small></button>)}</div></div>)}</div>
}

function AiPanel({messages,suggestions,input,loading,onInputChange,onSend,onClose}:{messages:AiMessage[],suggestions:AiSuggestion[],input:string,loading:boolean,onInputChange:(value:string)=>void,onSend:(prompt:string)=>void,onClose:()=>void}) {
  const hasConversation = messages.some(m => m.role === 'user')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  return <aside className="ai-panel" aria-label="MODUI Calendar AI">
    <div className="ai-panel-head">
      <div className="ai-title-wrap"><span className="ai-icon"><Sparkles size={17}/></span><div><b>MODUI Calendar AI</b><small>내 일정과 대화하기</small></div></div>
      <button className="ai-close" onClick={onClose} title="AI 닫기"><X size={19}/></button>
    </div>

    <div className="ai-content">
      {!hasConversation && <div className="ai-intro">
        <div className="ai-intro-icon"><Bot size={23}/></div>
        <b>무엇을 도와드릴까요?</b>
        <p>현재 캘린더의 일정 정보를 바탕으로 요약, 충돌 확인, 빈 시간 추천 등을 도와드려요.</p>
        <div className="ai-suggestions">
          {suggestions.map(s => <button key={s.label} onClick={()=>onSend(s.prompt)} disabled={loading}><Sparkles size={14}/><span>{s.label}</span></button>)}
        </div>
      </div>}

      <div className="ai-messages">
        {messages.map(message => <div key={message.id} className={`ai-message-row ${message.role}`}>
          <span className="ai-message-avatar">{message.role === 'assistant' ? <Bot size={16}/> : <UserRound size={16}/>}</span>
          <div className="ai-message-bubble">{message.content}</div>
        </div>)}
        {loading && <div className="ai-message-row assistant">
          <span className="ai-message-avatar"><Bot size={16}/></span>
          <div className="ai-message-bubble ai-thinking"><LoaderCircle size={16}/> 캘린더를 확인하고 있어요…</div>
        </div>}
        <div ref={bottomRef}/>
      </div>
    </div>

    <form className="ai-compose" onSubmit={e=>{e.preventDefault();onSend(input)}}>
      <textarea value={input} onChange={e=>onInputChange(e.target.value)} onKeyDown={e=>{
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(input) }
      }} placeholder="예: 다음 주에 회의 잡기 좋은 시간을 찾아줘" rows={2}/>
      <button type="submit" className="ai-send" disabled={!input.trim() || loading} title="보내기"><Send size={17}/></button>
      <div className="ai-compose-note">Enter 전송 · Shift+Enter 줄바꿈</div>
    </form>
  </aside>
}

function EventModal({event,date,calendars,onClose,onSave,onDelete}:{event:EventItem|null,date:string,calendars:CalendarInfo[],onClose:()=>void,onSave:(e:EventItem)=>void,onDelete:(id:number)=>void}) {
  const [title,setTitle]=useState(event?.title||'')
  const [d,setD]=useState(event?.date||date)
  const [start,setStart]=useState(event?.start||'09:00')
  const [end,setEnd]=useState(event?.end||'10:00')
  const [calendarName,setCalendarName]=useState(event?.calendarName||calendars[0]?.name||'')
  const [color,setColor]=useState(event?.color||colors[0])
  const [description,setDescription]=useState(event?.description||'')
  // 알림: null이면 "알림 없음", 숫자면 시작 시각 몇 분 전에 울릴지
  const [reminderMinutes,setReminderMinutes]=useState<number|null>(
    event ? (event.reminderMinutes ?? null) : 10
  )
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal">
    <div className="modal-top"><span>{event?'일정 수정':'새 일정'}</span><button onClick={onClose}><X/></button></div>
    <input autoFocus className="title-input" placeholder="일정 제목 추가" value={title} onChange={e=>setTitle(e.target.value)}/>
    <div className="field"><CalendarDays/><input type="date" value={d} onChange={e=>setD(e.target.value)}/></div>
    <div className="field"><Clock3/><input type="time" value={start} onChange={e=>setStart(e.target.value)}/><span>–</span><input type="time" value={end} onChange={e=>setEnd(e.target.value)}/></div>
    <div className="field-note">위 시간은 일정이 진행되는 시작~종료 시각입니다. 실제로 알림을 언제 받을지는 아래 "알림"에서 따로 정해요.</div>
    <div className="field">
      <Bell/>
      <select value={reminderMinutes===null?'none':reminderMinutes} onChange={e=>setReminderMinutes(e.target.value==='none'?null:Number(e.target.value))}>
        <option value="none">알림 없음</option>
        {REMINDER_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
    {reminderMinutes!==null && <div className="field-note reminder-note">🔔 <b>{alarmClockLabel(d,start,reminderMinutes)}</b>에 브라우저 알림이 울립니다.</div>}
    <div className="field"><Users/><select value={calendarName} onChange={e=>setCalendarName(e.target.value)}>{calendars.map(c=><option key={c.id}>{c.name}</option>)}</select></div>
    <div className="field color-field"><span className="color-label">색상</span>{colors.map(c=><button type="button" key={c} className={`color-dot ${color===c?'chosen':''}`} style={{background:c}} onClick={()=>setColor(c)}/>)}</div>
    <textarea placeholder="설명 추가" value={description} onChange={e=>setDescription(e.target.value)}/>
    <div className="modal-actions">{event&&<button className="delete" onClick={()=>onDelete(event.id)}><Trash2 size={17}/> 삭제</button>}<div className="right-actions"><button className="cancel" onClick={onClose}>취소</button><button className="save" disabled={!title.trim()} onClick={()=>onSave({id:event?.id||Date.now(),title:title.trim(),date:d,start,end,calendarName,color,description,reminderMinutes})}><Check size={17}/> 저장</button></div></div>
  </div></div>
}

function CalendarModal({calendar,onClose,onSave,onDelete}:{calendar?:CalendarInfo,onClose:()=>void,onSave:(name:string,color:string,id?:number)=>void,onDelete:(id:number)=>void}) {
  const [name,setName] = useState(calendar?.name||'')
  const [color,setColor] = useState(calendar?.color||colors[0])
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal calendar-modal">
      <div className="modal-top"><span>{calendar?'캘린더 수정':'새 캘린더'}</span><button onClick={onClose}><X/></button></div>
      <label className="modal-label">캘린더 이름</label>
      <input autoFocus className="calendar-name-input" placeholder="예: 개발팀 프로젝트" value={name} onChange={e=>setName(e.target.value)}/>
      <div className="calendar-color-title">색상</div>
      <div className="calendar-colors">{colors.map(c=><button key={c} className={`color-dot ${color===c?'chosen':''}`} style={{background:c}} onClick={()=>setColor(c)}/>)}</div>
      <div className="modal-actions">
        {calendar && <button className="delete" onClick={()=>onDelete(calendar.id)}><Trash2 size={17}/> 삭제</button>}
        <div className="right-actions"><button className="cancel" onClick={onClose}>취소</button><button className="save" disabled={!name.trim()} onClick={()=>onSave(name,color,calendar?.id)}><Check size={17}/> 저장</button></div>
      </div>
    </div>
  </div>
}

function TrashModal({
  items,eventItems,onClose,onRestore,onPermanentlyDelete,onRestoreEvent,onPermanentlyDeleteEvent,onEmpty
}:{
  items:TrashedCalendar[]
  eventItems:TrashedEvent[]
  onClose:()=>void
  onRestore:(id:number)=>void
  onPermanentlyDelete:(id:number)=>void
  onRestoreEvent:(trashId:number)=>void
  onPermanentlyDeleteEvent:(trashId:number)=>void
  onEmpty:()=>void
}) {
  const empty = items.length===0 && eventItems.length===0
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal trash-modal">
      <div className="modal-top"><span>휴지통</span><button onClick={onClose}><X/></button></div>
      {empty
        ? <div className="trash-empty"><Inbox size={34}/><p>휴지통이 비어 있습니다</p><small>삭제한 일정과 캘린더가 여기에 표시됩니다.</small></div>
        : <div className="trash-list">
            {eventItems.map(t=><div className="trash-row" key={`event-${t.trashId}`}>
              <span className="dot" style={{background:t.event.color}}></span>
              <div className="trash-row-info">
                <b>{t.event.title}</b>
                <small>일정 · {t.event.date} {t.event.start} · {t.event.calendarName}</small>
              </div>
              <button className="trash-action" title="일정 복원" onClick={()=>onRestoreEvent(t.trashId)}><RotateCcw size={16}/> 복원</button>
              <button className="trash-action danger" title="일정 영구 삭제" onClick={()=>onPermanentlyDeleteEvent(t.trashId)}><Trash2 size={16}/></button>
            </div>)}
            {items.map(t=><div className="trash-row" key={`calendar-${t.id}`}>
              <span className="dot" style={{background:t.color}}></span>
              <div className="trash-row-info">
                <b>{t.name}</b>
                <small>캘린더 · {t.events.length>0 ? `일정 ${t.events.length}개 · ` : ''}{t.deletedAt}에 삭제됨</small>
              </div>
              <button className="trash-action" title="캘린더 복원" onClick={()=>onRestore(t.id)}><RotateCcw size={16}/> 복원</button>
              <button className="trash-action danger" title="캘린더 영구 삭제" onClick={()=>onPermanentlyDelete(t.id)}><Trash2 size={16}/></button>
            </div>)}
          </div>}
      {!empty && <div className="modal-actions"><div/><div className="right-actions"><button className="cancel" onClick={onEmpty}>휴지통 비우기</button><button className="save" onClick={onClose}><Check size={17}/> 완료</button></div></div>}
    </div>
  </div>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
