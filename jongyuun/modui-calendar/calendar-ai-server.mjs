const MAX_BODY_BYTES = 1_500_000

const readJsonBody = (req) => new Promise((resolve, reject) => {
  let size = 0
  let raw = ''

  req.setEncoding('utf8')

  req.on('data', chunk => {
    size += Buffer.byteLength(chunk)
    if (size > MAX_BODY_BYTES) {
      reject(new Error('요청 데이터가 너무 큽니다.'))
      req.destroy()
      return
    }
    raw += chunk
  })

  req.on('end', () => {
    try {
      resolve(raw ? JSON.parse(raw) : {})
    } catch {
      reject(new Error('잘못된 JSON 요청입니다.'))
    }
  })

  req.on('error', reject)
})

const compactTranscript = (messages = []) => messages
  .slice(-14)
  .filter(message =>
    (message?.role === 'user' || message?.role === 'assistant') &&
    typeof message?.content === 'string'
  )
  .map(message => `${message.role === 'user' ? '사용자' : 'AI'}: ${message.content.slice(0, 5000)}`)
  .join('\n\n')

const getOpenAiErrorMessage = (error) => {
  const causeCode = error?.cause?.code
  if (
    causeCode === 'ECONNREFUSED' ||
    causeCode === 'ENOTFOUND' ||
    causeCode === 'ETIMEDOUT' ||
    String(error?.message || '').includes('fetch failed')
  ) {
    return 'OpenAI API에 연결할 수 없습니다. VPS의 인터넷/DNS 연결을 확인해주세요.'
  }

  return error instanceof Error ? error.message : 'AI 처리 중 오류가 발생했습니다.'
}

const extractOpenAiOutputText = data => {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim()

  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (item?.type !== 'message') continue
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content?.text === 'string' && content.text.trim()) {
        return content.text.trim()
      }
    }
  }

  return ''
}

const getOpenAiApiError = (status, data = {}) => {
  const code = String(data?.error?.code || '')
  const message = typeof data?.error?.message === 'string' ? data.error.message : ''

  if (status === 401) return 'OpenAI API 키가 올바르지 않습니다. `.env`의 OPENAI_API_KEY를 확인해주세요.'
  if (status === 403) return '이 API 키에는 요청한 OpenAI 모델을 사용할 권한이 없습니다.'
  if (status === 429 && /insufficient_quota|billing|quota/i.test(`${code} ${message}`)) {
    return 'OpenAI API 크레딧 또는 결제 한도가 부족합니다. OpenAI Platform의 Billing/Usage를 확인해주세요.'
  }
  if (status === 429) return 'OpenAI API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.'
  if (status >= 500) return 'OpenAI API 서버에서 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'

  return message || `OpenAI API 오류 (${status})`
}

// 요청 종류를 LLM 호출 전에 좁혀서 잘못된 캘린더 변경을 막습니다.
// 특히 알림 변경과 전체 삭제는 일정 시간 수정/단일 삭제와 완전히 다른 작업으로 분리합니다.
export const classifyCalendarRequestMode = (text, messages = []) => {
  const value = normalizeText(text).toLowerCase()

  const hasBulkWord = /(?:전부|모두|전체|싹\s*다|몽땅|모조리|다\s*(?:삭제|지워|제거|없애|복구|복원))/.test(value)
  const hasRestoreVerb = /(?:복구해|복구해줘|복원해|복원해줘|되돌려|되돌려줘|다시\s*살려|살려줘|휴지통.*꺼내|꺼내줘|원상복구)/.test(value)
  if (hasRestoreVerb && hasBulkWord) return 'restore_all'
  if (hasRestoreVerb) return 'restore'

  const hasDeleteVerb = /(?:삭제해|삭제해줘|지워|지워줘|제거해|제거해줘|없애|없애줘)/.test(value)
  if (hasDeleteVerb && hasBulkWord) return 'delete_all'

  if (hasDeleteVerb) return 'mutation'

  const hasReminderInstruction = /(?:알림|알려줘|알려\s*줘|정시|(?:\d+|한|두|세|네)\s*(?:분|시간|일)\s*전)/.test(value)
  const hasExplicitCreate = /(?:일정\s*)?(?:추가|등록|생성)\s*(?:해|해줘|해주세요|하고|해주고|시켜|시켜줘|부탁)/.test(value)
    || /(?:만들어|만들어줘|만들어주세요)/.test(value)
    || /(?:일정|회의|미팅|약속|예약).{0,18}(?:잡아줘|잡아 주세요|잡아주세요|예약해|예약해줘|예약해주세요)/.test(value)
  const hasScheduleMove = /(?:옮겨|이동해|이동해줘|미뤄|미뤄줘|당겨|당겨줘|앞당겨|늦춰)/.test(value)
    || /(?:날짜|시작\s*시간|종료\s*시간).{0,14}(?:수정|변경|바꿔)/.test(value)
    || /\b(?:오전|오후)\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?\s*(?:로|에)\b/.test(value)
    || /\b\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?\s*(?:로|에)\b/.test(value)

  // "1시간 전 알림으로 잡아줘", "알림 10분 전으로 바꿔줘" 같은 문장은
  // 일정 시작/종료 시각이 아니라 reminder만 바꿉니다.
  if (hasReminderInstruction && !hasExplicitCreate && !hasScheduleMove) {
    return 'reminder_only'
  }

  const explicitMutationPatterns = [
    /(?:일정\s*)?(?:추가|등록|생성)\s*(?:해|해줘|해주세요|하고|해주고|시켜|시켜줘|부탁)/,
    /(?:만들어|만들어줘|만들어주세요)/,
    /(?:일정|회의|미팅|약속|예약).{0,18}(?:잡아줘|잡아 주세요|잡아주세요|예약해|예약해줘|예약해주세요)/,
    /(?:옮겨|이동해|이동해줘|수정해|수정해줘|변경해|변경해줘|바꿔|바꿔줘|미뤄|미뤄줘|당겨|당겨줘|앞당겨|늦춰)/,
  ]

  if (explicitMutationPatterns.some(pattern => pattern.test(value))) return 'mutation'

  if (/^(응|네|예|그래|좋아|진행해줘|해줘|확인)$/i.test(value)) {
    const previousAssistant = [...messages]
      .reverse()
      .find(message => message?.role === 'assistant' && typeof message?.content === 'string')
    const previous = normalizeText(previousAssistant?.content).toLowerCase()
    if (/(추가할까요|수정할까요|변경할까요|옮길까요|삭제할까요|알림.*설정할까요)/.test(previous)) {
      return 'mutation'
    }
  }

  return 'read_only'
}

const calendarAiSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    actions: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['create_event', 'create_event_range', 'update_event', 'delete_event', 'set_reminder', 'delete_all_events', 'restore_event', 'restore_all_events', 'restore_last_deleted'],
          },
          eventId: { type: ['integer', 'null'] },
          trashId: { type: ['integer', 'null'] },
          batchId: { type: ['integer', 'null'] },
          title: { type: ['string', 'null'] },
          date: { type: ['string', 'null'] },
          rangeEndDate: { type: ['string', 'null'] },
          recurrenceMode: {
            type: 'string',
            enum: ['none', 'daily', 'weekdays'],
          },
          start: { type: ['string', 'null'] },
          end: { type: ['string', 'null'] },
          calendarName: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          reminderMode: {
            type: 'string',
            enum: ['keep', 'none', 'set'],
          },
          reminderMinutes: {
            type: ['integer', 'null'],
            minimum: 0,
            maximum: 10080,
          },
        },
        required: [
          'type',
          'eventId',
          'trashId',
          'batchId',
          'title',
          'date',
          'rangeEndDate',
          'recurrenceMode',
          'start',
          'end',
          'calendarName',
          'description',
          'reminderMode',
          'reminderMinutes',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['reply', 'actions'],
  additionalProperties: false,
}

const normalizeText = value => String(value ?? '').trim().replace(/\s+/g, ' ')
const normalizeLookup = value => normalizeText(value).toLowerCase().replace(/\s+/g, '')
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
const isTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)

const formatDateParts = (year, month, day) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const validCalendarDate = (year, month, day) => {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export const detectKoreanDateRange = (text, calendar = {}) => {
  const value = normalizeText(text)
  const cursor = isDate(calendar?.cursorDate)
    ? calendar.cursorDate
    : (isDate(calendar?.today) ? calendar.today : null)

  if (!cursor) return null

  const [cursorYear, cursorMonth] = cursor.split('-').map(Number)

  // 예: "17일부터 23일까지", "8월 17일부터 8월 23일까지", "8월 17일부터 23일까지"
  const match = value.match(/(?:(\d{1,2})월\s*)?(\d{1,2})일\s*부터\s*(?:(\d{1,2})월\s*)?(\d{1,2})일\s*까지/)
  if (!match) return null

  const startMonth = match[1] ? Number(match[1]) : cursorMonth
  const startDay = Number(match[2])
  let endMonth = match[3] ? Number(match[3]) : startMonth
  const endDay = Number(match[4])

  let startYear = cursorYear
  let endYear = cursorYear

  // 12월→1월처럼 연도를 넘는 범위도 처리합니다.
  if (endMonth < startMonth) endYear += 1

  if (!validCalendarDate(startYear, startMonth, startDay) || !validCalendarDate(endYear, endMonth, endDay)) {
    return null
  }

  const startDate = formatDateParts(startYear, startMonth, startDay)
  const endDate = formatDateParts(endYear, endMonth, endDay)
  if (endDate < startDate) return null

  return {
    startDate,
    endDate,
    recurrenceMode: /(?:평일|주중)/.test(value) ? 'weekdays' : 'daily',
  }
}

const pad2 = value => String(value).padStart(2, '0')
const addMinutesToClock = (clock, minutes) => {
  if (!isTime(clock)) return null
  const [hour, minute] = clock.split(':').map(Number)
  const total = hour * 60 + minute + minutes
  const normalized = ((total % 1440) + 1440) % 1440
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`
}

const exactCalendarName = (candidate, calendars) => {
  const key = normalizeLookup(candidate)
  if (!key) return null
  const match = calendars.find(item => normalizeLookup(item?.name) === key)
  return typeof match?.name === 'string' ? match.name : null
}

export const parseReminderInstruction = text => {
  const value = normalizeText(text).toLowerCase()
  const candidates = []

  const pushMatches = (regex, convert) => {
    for (const match of value.matchAll(regex)) {
      const result = convert(match)
      if (result) candidates.push({ index: match.index ?? -1, ...result })
    }
  }

  pushMatches(/(?:알림\s*(?:없음|없이|끄|꺼|해제)|알려주지\s*마|알림\s*빼)/g, () => ({ mode: 'none', minutes: null }))
  pushMatches(/(?:정시|시작\s*시간에|시작할\s*때)/g, () => ({ mode: 'set', minutes: 0 }))

  pushMatches(/(\d{1,5})\s*분\s*전/g, match => {
    const minutes = Number(match[1])
    return minutes >= 0 && minutes <= 10080 ? { mode: 'set', minutes } : null
  })

  const hourWordMap = { 한: 1, 두: 2, 세: 3, 네: 4 }
  pushMatches(/(\d{1,3}|한|두|세|네)\s*시간\s*전/g, match => {
    const hours = /^\d+$/.test(match[1]) ? Number(match[1]) : hourWordMap[match[1]]
    const minutes = hours * 60
    return minutes >= 0 && minutes <= 10080 ? { mode: 'set', minutes } : null
  })

  const dayWordMap = { 하루: 1, 이틀: 2, 사흘: 3 }
  pushMatches(/(\d{1,2}|하루|이틀|사흘)\s*(?:일\s*)?전/g, match => {
    const days = /^\d+$/.test(match[1]) ? Number(match[1]) : dayWordMap[match[1]]
    const minutes = days * 1440
    return minutes >= 0 && minutes <= 10080 ? { mode: 'set', minutes } : null
  })

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.index - b.index)
  const latest = candidates[candidates.length - 1]
  return { mode: latest.mode, minutes: latest.minutes }
}

const mentionedCalendarName = (text, calendars) => {
  const value = normalizeLookup(text)
  const matches = calendars.filter(item => {
    const key = normalizeLookup(item?.name)
    return key && value.includes(key)
  })
  return matches.length === 1 && typeof matches[0]?.name === 'string' ? matches[0].name : null
}

const resolveTrashedEvent = (text, trashedEvents = []) => {
  const value = normalizeLookup(text)
  const titleMatches = trashedEvents.filter(item => {
    const titleKey = normalizeLookup(item?.event?.title)
    return titleKey && value.includes(titleKey)
  })
  if (titleMatches.length === 0) return null
  return titleMatches
    .slice()
    .sort((a,b) => String(b?.deletedAt || '').localeCompare(String(a?.deletedAt || '')))[0]
}

const latestTrashBatchId = (trashedEvents = []) => {
  const latest = trashedEvents
    .slice()
    .sort((a,b) => String(b?.deletedAt || '').localeCompare(String(a?.deletedAt || '')))[0]
  return Number.isInteger(latest?.batchId) ? latest.batchId : null
}

export const resolveContextEventId = (text, messages = [], events = []) => {
  const findMatches = rawText => {
    const value = normalizeLookup(rawText)
    if (!value) return []
    return events.filter(event => {
      const titleKey = normalizeLookup(event?.title)
      return titleKey && value.includes(titleKey)
    })
  }

  const directMatches = findMatches(text)
  if (directMatches.length === 1 && Number.isInteger(directMatches[0]?.id)) return directMatches[0].id

  // 바로 직전 대화에서 언급된 실제 일정명을 역순으로 찾습니다.
  const prior = Array.isArray(messages) ? messages.slice(0, -1).reverse() : []
  for (const message of prior.slice(0, 6)) {
    if (typeof message?.content !== 'string') continue
    const matches = findMatches(message.content)
    if (matches.length === 1 && Number.isInteger(matches[0]?.id)) return matches[0].id
  }

  if (events.length === 1 && Number.isInteger(events[0]?.id)) return events[0].id
  return null
}

const makeAction = (type, overrides = {}) => ({
  type,
  eventId: null,
  trashId: null,
  batchId: null,
  title: null,
  date: null,
  rangeEndDate: null,
  recurrenceMode: 'none',
  start: null,
  end: null,
  calendarName: null,
  description: null,
  reminderMode: 'keep',
  reminderMinutes: null,
  ...overrides,
})

const resolveExistingEventId = (action, events) => {
  if (Number.isInteger(action.eventId) && events.some(event => event?.id === action.eventId)) {
    return action.eventId
  }

  const titleKey = normalizeLookup(action.title)
  if (!titleKey) return null

  let candidates = events.filter(event => normalizeLookup(event?.title) === titleKey)
  if (isDate(action.date)) candidates = candidates.filter(event => event?.date === action.date)
  if (isTime(action.start)) candidates = candidates.filter(event => event?.start === action.start)
  return candidates.length === 1 && Number.isInteger(candidates[0]?.id) ? candidates[0].id : null
}

const normalizeAiResult = (value, calendar, allowActions = true) => {
  const calendars = Array.isArray(calendar?.calendars) ? calendar.calendars : []
  const events = Array.isArray(calendar?.events) ? calendar.events : []
  const allowedTypes = new Set(['create_event', 'create_event_range', 'update_event', 'delete_event', 'set_reminder', 'delete_all_events', 'restore_event', 'restore_all_events', 'restore_last_deleted'])
  const allowedReminderModes = new Set(['keep', 'none', 'set'])
  const rawActions = allowActions && Array.isArray(value?.actions) ? value.actions.slice(0, 10) : []

  const actions = []
  let rejectedAction = false

  for (const raw of rawActions) {
    if (!raw || !allowedTypes.has(raw.type)) {
      rejectedAction = true
      continue
    }

    const type = raw.type
    const title = typeof raw.title === 'string' ? normalizeText(raw.title) || null : null
    const date = isDate(raw.date) ? raw.date : null
    const rangeEndDate = isDate(raw.rangeEndDate) ? raw.rangeEndDate : null
    const recurrenceMode = ['none', 'daily', 'weekdays'].includes(raw.recurrenceMode) ? raw.recurrenceMode : 'none'
    const start = isTime(raw.start) ? raw.start : null
    let end = isTime(raw.end) ? raw.end : null
    const description = typeof raw.description === 'string' ? raw.description.trim() : null
    let calendarName = exactCalendarName(raw.calendarName, calendars)
    let reminderMode = allowedReminderModes.has(raw.reminderMode)
      ? raw.reminderMode
      : ((type === 'create_event' || type === 'create_event_range') ? 'none' : 'keep')
    let reminderMinutes = Number.isInteger(raw.reminderMinutes) && raw.reminderMinutes >= 0 && raw.reminderMinutes <= 10080
      ? raw.reminderMinutes
      : null

    if (type === 'create_event_range') {
      if (reminderMode === 'keep') reminderMode = 'none'
      if (reminderMode !== 'set') reminderMinutes = null
      if (reminderMode === 'set' && reminderMinutes === null) {
        rejectedAction = true
        continue
      }
      if (!calendarName && calendars.length === 1 && typeof calendars[0]?.name === 'string') {
        calendarName = calendars[0].name
      }
      if (!title || !date || !rangeEndDate || !start || !calendarName || rangeEndDate < date) {
        rejectedAction = true
        continue
      }
      if (!end || end === start) end = addMinutesToClock(start, 60)

      actions.push({
        type,
        eventId: null,
        trashId: null,
        batchId: null,
        title,
        date,
        rangeEndDate,
        recurrenceMode: recurrenceMode === 'none' ? 'daily' : recurrenceMode,
        start,
        end,
        calendarName,
        description,
        reminderMode,
        reminderMinutes,
      })
      continue
    }

    if (type === 'create_event') {
      if (reminderMode === 'keep') reminderMode = 'none'
      if (reminderMode !== 'set') reminderMinutes = null
      if (reminderMode === 'set' && reminderMinutes === null) {
        rejectedAction = true
        continue
      }
      if (!calendarName && calendars.length === 1 && typeof calendars[0]?.name === 'string') {
        calendarName = calendars[0].name
      }
      if (!title || !date || !start || !calendarName) {
        rejectedAction = true
        continue
      }
      if (!end || end === start) end = addMinutesToClock(start, 60)

      actions.push({
        type,
        eventId: null,
        title,
        date,
        rangeEndDate: null,
        recurrenceMode: 'none',
        start,
        end,
        calendarName,
        description,
        reminderMode,
        reminderMinutes,
      })
      continue
    }

    if (type === 'delete_all_events') {
      if (raw.calendarName && !calendarName) {
        rejectedAction = true
        continue
      }
      actions.push(makeAction('delete_all_events', { calendarName }))
      continue
    }

    if (type === 'restore_all_events' || type === 'restore_last_deleted' || type === 'restore_event') {
      actions.push(makeAction(type, {
        trashId: Number.isInteger(raw.trashId) ? raw.trashId : null,
        batchId: Number.isInteger(raw.batchId) ? raw.batchId : null,
        title,
        date,
        calendarName,
      }))
      continue
    }

    const eventId = resolveExistingEventId({ ...raw, title, date, start }, events)
    if (!eventId) {
      rejectedAction = true
      continue
    }

    if (type === 'set_reminder') {
      if (reminderMode === 'keep') reminderMode = 'set'
      if (reminderMode !== 'set') reminderMinutes = null
      if (reminderMode === 'set' && reminderMinutes === null) {
        rejectedAction = true
        continue
      }
      actions.push(makeAction('set_reminder', {
        eventId,
        reminderMode,
        reminderMinutes,
      }))
      continue
    }

    if (reminderMode !== 'set') reminderMinutes = null
    if (reminderMode === 'set' && reminderMinutes === null) {
      rejectedAction = true
      continue
    }

    actions.push({
      type,
      eventId,
      title,
      date,
      start,
      end,
      calendarName,
      description,
      reminderMode,
      reminderMinutes,
    })
  }

  let reply = typeof value?.reply === 'string' && value.reply.trim()
    ? value.reply.trim()
    : '요청을 확인했습니다.'

  if (rawActions.length > 0 && actions.length === 0 && rejectedAction) {
    reply = '일정을 바로 변경하기에는 대상이나 날짜·시간·캘린더 정보가 충분히 확실하지 않아요. 어떤 일정을 어떻게 변경할지 조금 더 구체적으로 알려주세요.'
  }

  return { reply, actions }
}

export async function handleCalendarAi(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'POST 요청만 지원합니다.' }))
    return
  }

  try {
    const body = await readJsonBody(req)
    const messages = Array.isArray(body?.messages) ? body.messages : []
    const calendar = body?.calendar && typeof body.calendar === 'object' ? body.calendar : {}

    const latestUser = [...messages].reverse().find(message =>
      message?.role === 'user' && typeof message?.content === 'string'
    )

    if (!latestUser?.content?.trim()) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: '질문을 입력해주세요.' }))
      return
    }

    const requestMode = classifyCalendarRequestMode(latestUser.content, messages)
    const currentEvents = Array.isArray(calendar?.events) ? calendar.events : []
    const currentCalendars = Array.isArray(calendar?.calendars) ? calendar.calendars : []
    const currentTrashedEvents = Array.isArray(calendar?.trashedEvents) ? calendar.trashedEvents : []

    // 복구 요청은 휴지통 데이터만 대상으로 서버가 직접 처리합니다.
    // "복구해줘"는 가장 최근 삭제 묶음, "전부 복구해줘"는 휴지통의 모든 일정을 복구합니다.
    if (requestMode === 'restore_all') {
      const calendarName = mentionedCalendarName(latestUser.content, currentCalendars)
      const targets = calendarName
        ? currentTrashedEvents.filter(item => normalizeLookup(item?.event?.calendarName) === normalizeLookup(calendarName))
        : currentTrashedEvents

      if (targets.length === 0) {
        res.statusCode = 200
        res.end(JSON.stringify({
          reply: calendarName ? `휴지통에 “${calendarName}” 캘린더 일정이 없어요.` : '휴지통에 복구할 일정이 없어요.',
          actions: [],
        }))
        return
      }

      res.statusCode = 200
      res.end(JSON.stringify({
        reply: calendarName ? `휴지통의 “${calendarName}” 일정을 모두 복구할게요.` : '휴지통의 모든 일정을 복구할게요.',
        actions: [makeAction('restore_all_events', { calendarName })],
      }))
      return
    }

    if (requestMode === 'restore') {
      if (currentTrashedEvents.length === 0) {
        res.statusCode = 200
        res.end(JSON.stringify({
          reply: '휴지통에 복구할 일정이 없어요.',
          actions: [],
        }))
        return
      }

      const named = resolveTrashedEvent(latestUser.content, currentTrashedEvents)
      if (named) {
        res.statusCode = 200
        res.end(JSON.stringify({
          reply: `휴지통에서 “${named.event?.title || '일정'}”을 복구할게요.`,
          actions: [makeAction('restore_event', {
            trashId: Number.isInteger(named.trashId) ? named.trashId : null,
            eventId: Number.isInteger(named?.event?.id) ? named.event.id : null,
            title: typeof named?.event?.title === 'string' ? named.event.title : null,
            date: typeof named?.event?.date === 'string' ? named.event.date : null,
            calendarName: typeof named?.event?.calendarName === 'string' ? named.event.calendarName : null,
          })],
        }))
        return
      }

      const batchId = latestTrashBatchId(currentTrashedEvents)
      if (!batchId) {
        res.statusCode = 200
        res.end(JSON.stringify({
          reply: '복구할 최근 삭제 기록을 찾지 못했어요. 휴지통에서 직접 복원하거나 일정 제목을 말해주세요.',
          actions: [],
        }))
        return
      }

      res.statusCode = 200
      res.end(JSON.stringify({
        reply: '방금 삭제한 일정들을 휴지통에서 복구할게요.',
        actions: [makeAction('restore_last_deleted', { batchId })],
      }))
      return
    }

    // 전체 삭제는 LLM이 단일 일정을 고르는 실수를 하지 못하도록 서버가 직접 확정합니다.
    if (requestMode === 'delete_all') {
      const calendarName = mentionedCalendarName(latestUser.content, currentCalendars)
      const targetCount = calendarName
        ? currentEvents.filter(event => normalizeLookup(event?.calendarName) === normalizeLookup(calendarName)).length
        : currentEvents.length

      if (targetCount === 0) {
        res.statusCode = 200
        res.end(JSON.stringify({
          reply: calendarName ? `“${calendarName}” 캘린더에 휴지통으로 옮길 일정이 없어요.` : '휴지통으로 옮길 일정이 없어요.',
          actions: [],
        }))
        return
      }

      res.statusCode = 200
      res.end(JSON.stringify({
        reply: calendarName ? `“${calendarName}” 캘린더의 일정을 모두 휴지통으로 이동할게요.` : '캘린더의 모든 일정을 휴지통으로 이동할게요.',
        actions: [makeAction('delete_all_events', { calendarName })],
      }))
      return
    }

    // 알림만 바꾸는 문장은 LLM이 start/end를 건드리지 못하게 서버에서 별도 액션으로 처리합니다.
    if (requestMode === 'reminder_only') {
      const reminder = parseReminderInstruction(latestUser.content)
      const eventId = resolveContextEventId(latestUser.content, messages, currentEvents)

      if (!reminder) {
        res.statusCode = 200
        res.end(JSON.stringify({
          reply: '알림을 몇 분/몇 시간 전에 받을지 알려주세요. 예: “10분 전에 알려줘”, “1시간 전에 알려줘”.',
          actions: [],
        }))
        return
      }

      if (!eventId) {
        res.statusCode = 200
        res.end(JSON.stringify({
          reply: '어느 일정의 알림을 바꿀지 하나로 특정하지 못했어요. 일정 제목을 같이 말해주세요. 예: “운동 일정 알림을 10분 전으로 바꿔줘”.',
          actions: [],
        }))
        return
      }

      res.statusCode = 200
      res.end(JSON.stringify({
        reply: '일정 시간은 그대로 두고 알림 설정만 변경할게요.',
        actions: [makeAction('set_reminder', {
          eventId,
          reminderMode: reminder.mode,
          reminderMinutes: reminder.minutes,
        })],
      }))
      return
    }

    const allowActions = requestMode === 'mutation'

    const openAiApiKey = String(process.env.OPENAI_API_KEY || '').trim()
    const openAiModel = String(process.env.OPENAI_MODEL || 'gpt-5.6-luna').trim()
    const reasoningEffort = String(process.env.OPENAI_REASONING_EFFORT || 'low').trim()
    const maxOutputTokens = Math.min(8000, Math.max(500, Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 2000) || 2000))

    if (!openAiApiKey) {
      res.statusCode = 500
      res.end(JSON.stringify({
        error: 'OPENAI_API_KEY가 설정되지 않았습니다. 프로젝트의 `.env` 파일에 API 키를 입력한 뒤 서버를 다시 시작해주세요.',
      }))
      return
    }

    const systemPrompt = [
      '당신은 MODUI Calendar의 자연어 일정 비서입니다.',
      '사용자의 문장을 단순 문자열로 자르지 말고 의미를 이해해서 일정 작업 필드로 분리하세요.',
      '기본 응답 언어는 한국어입니다.',
      '제공된 calendar와 최근 대화만 근거로 판단하고 없는 사실이나 일정을 만들지 마세요.',
      '',
      '[서버 요청 모드 - 최우선 규칙]',
      `- 현재 requestMode는 "${requestMode}"입니다. 이 판정을 최우선으로 따르세요.`,
      '- requestMode="read_only"이면 절대로 어떤 변경 action도 만들지 말고 actions=[]를 반환하세요.',
      '- read_only에서는 일정을 변경하기 위한 날짜·시간·캘린더를 되묻지 말고, 현재 캘린더 데이터를 분석해서 사용자가 요청한 추천/조회/요약에 바로 답하세요.',
      '- "추천해줘", "찾아줘", "요약해줘", "알려줘", "빈 시간", "좋은 시간", "가능한 시간"은 실제 저장을 명시하지 않았다면 읽기 요청입니다.',
      '- 특히 "추가 회의를 잡기 좋은 빈 시간을 추천해줘"의 "추가 회의"는 새 회의를 실제 등록하라는 명령이 아닙니다. 빈 시간을 추천하는 read_only 요청입니다.',
      '- requestMode="mutation"일 때만 명시된 일정 추가/수정/단일 삭제를 actions로 반환할 수 있습니다.',
      '- 사용자가 "17일부터 23일까지", "이번 주 매일", "평일마다"처럼 여러 날짜에 반복 생성을 요청하면 create_event 한 건으로 축소하지 말고 create_event_range를 사용하세요.',
      '- reminder_only, delete_all, restore, restore_all은 서버가 LLM 호출 전에 별도 처리하므로 이 프롬프트까지 오지 않습니다.',
      '',
      '[추천/조회 규칙]',
      '- 빈 시간 추천은 calendar.events의 실제 일정을 기준으로 계산하세요.',
      '- 사용자가 업무 시간 범위를 말하지 않았다면 09:00~18:00 안에서 30분 이상 비는 구간을 찾고, 집중 업무에는 가능하면 60분 이상 연속 구간을 우선 추천하세요.',
      '- 추천 결과에는 왜 그 시간이 좋은지 기존 일정과의 간격을 짧게 설명하세요.',
      '- 추천만 요청받았다면 어떤 일정도 새로 만들었다고 말하지 마세요.',
      '',
      '[가장 중요한 제목 규칙]',
      '- title에는 일정의 핵심 주제만 넣으세요.',
      '- 날짜, 시간, 캘린더명, "일정", "추가해줘/수정해줘/삭제해줘", 알림 지시, 존댓말/조사 같은 명령 문구를 title에 절대 섞지 마세요.',
      '- 예: "19일 개인일정 캘린더에 9시 운동 추가해줘 알림은 5분전에 오게 켜주고" → title은 정확히 "운동"입니다.',
      '- 예: "내일 오후 2시에 치과 예약 잡고 한 시간 전에 알려줘" → title은 "치과 예약"입니다.',
      '',
      '[날짜/시간 규칙]',
      '- calendar.today는 실제 오늘 날짜입니다. 오늘/내일/모레/이번 주/다음 주는 이를 기준으로 해석하세요.',
      '- "19일"처럼 월이 생략된 날짜는 calendar.cursorDate가 속한 연/월을 우선 사용하세요.',
      '- date는 YYYY-MM-DD, start/end는 24시간 HH:MM 형식입니다.',
      '- 새 일정에서 종료 시간을 말하지 않았다면 end는 start의 1시간 뒤로 설정하세요.',
      '- 범위 반복 일정은 date=첫 날짜, rangeEndDate=마지막 날짜를 사용하세요. "매일"/날짜 범위는 recurrenceMode="daily", "평일마다"는 recurrenceMode="weekdays"입니다.',
      '',
      '[캘린더 규칙]',
      '- calendarName은 calendar.calendars에 실제로 존재하는 이름 중 하나를 사용하세요.',
      '- 사용자가 특정 캘린더를 말하면 그 캘린더를 사용하세요. "개인일정"과 "개인 일정"처럼 띄어쓰기 차이는 같은 의미로 이해하세요.',
      '- 캘린더를 말하지 않았다면 일정의 의미와 기존 캘린더 이름을 보고 가장 자연스러운 하나를 선택하세요. 개인 운동/병원/약속/공부 등은 보통 "개인 일정"이 자연스럽습니다.',
      '',
      '[알림 규칙]',
      '- 알림 지시는 제목과 완전히 별개입니다.',
      '- "5분 전에 알려줘/알림 켜줘" → reminderMode="set", reminderMinutes=5.',
      '- "한 시간 전에 알려줘" → reminderMode="set", reminderMinutes=60.',
      '- "정시에 알려줘" → reminderMode="set", reminderMinutes=0.',
      '- "알림 없이/알림 꺼줘" → reminderMode="none", reminderMinutes=null.',
      '- 새 일정에서 알림 언급이 없으면 reminderMode="none", reminderMinutes=null.',
      '- 기존 일정 수정에서 알림을 언급하지 않으면 reminderMode="keep", reminderMinutes=null.',
      '',
      '[작업 규칙]',
      '- 명확한 단일 일정 추가 요청은 create_event를 반환하세요.',
      '- 여러 날짜 범위에 같은 일정을 반복 추가하는 요청은 create_event_range를 반환하세요. 날짜 범위가 명시되면 첫날 한 건만 create_event로 만들면 안 됩니다.',
      '- 기존 일정 수정/이동/시간 변경 요청은 update_event를 반환하고 calendar.events에서 정확한 eventId를 선택하세요.',
      '- 알림만 변경하는 요청은 set_reminder 작업이며 일정의 start/end/date/title을 절대 변경하면 안 됩니다.',
      '- 단일 일정 삭제 요청은 delete_event를 반환하고 정확한 eventId를 선택하세요. 앱은 실제 삭제 대신 휴지통으로 이동합니다.',
      '- "전부/모두/전체/싹 다" 삭제는 delete_all_events이며 단일 delete_event로 축소하면 안 됩니다. 앱은 대상 일정을 휴지통으로 이동합니다.',
      '- 복구/복원 요청은 서버가 휴지통 데이터를 기준으로 직접 처리합니다.',
      '- 요약, 빈 시간 추천, 일정 조회 같은 읽기 요청은 actions=[]입니다.',
      '- 수정/삭제 대상이 둘 이상이라 특정할 수 없으면 actions=[]로 두고 reply에서 후보를 짧게 물어보세요.',
      '- 필수 날짜나 시간이 정말 알 수 없으면 임의 실행하지 말고 actions=[]로 두고 필요한 정보만 질문하세요.',
      '- "응", "개인 일정", "5분 전" 같은 짧은 후속 답변은 최근 대화에서 AI가 직전에 물은 질문에 대한 답일 수 있으므로 대화 문맥을 이어서 판단하세요.',
      '',
      '[완료 표현 규칙]',
      '- 당신은 데이터를 직접 저장하지 않습니다. actions가 있어도 reply에서 "추가했습니다/수정했습니다/삭제했습니다"라고 완료를 선언하지 마세요.',
      '- 실제 성공 여부는 앱이 action 실행 후 별도 메시지로 표시합니다.',
      '',
      '[정확한 예시]',
      '사용자: "19일 개인일정 캘린더에 9시 운동 추가해줘 알림은 5분전에 오게 켜주고"',
      '→ create_event, title="운동", 해당 19일 date, start="09:00", end="10:00", calendarName="개인 일정", reminderMode="set", reminderMinutes=5.',
      '사용자: "17일부터 23일까지 9시에 운동 일정 추가해줘"',
      '→ create_event_range, title="운동", date=해당 월 17일, rangeEndDate=해당 월 23일, recurrenceMode="daily", start="09:00", end="10:00". 17~23일 총 7개 일정이 생성되어야 합니다.',
      '사용자: "17일부터 23일까지 평일마다 오전 9시에 운동 추가해줘"',
      '→ create_event_range, date=17일, rangeEndDate=23일, recurrenceMode="weekdays", start="09:00".',
      '사용자: "내일 2시에 치과 예약 잡고 한시간 전에 알려줘"',
      '→ create_event, title="치과 예약", start="14:00", end="15:00", reminderMode="set", reminderMinutes=60.',
      '사용자: "디자인 리뷰를 3시로 옮겨줘"',
      '→ calendar.events에서 디자인 리뷰의 eventId를 찾아 update_event. 기존 소요 시간은 유지하도록 end도 자연스럽게 계산하세요.',
      '사용자: "운동 일정 알림 10분 전으로 바꿔줘"',
      '→ set_reminder, 정확한 운동 일정 eventId, reminderMode="set", reminderMinutes=10. start/end/date/title은 건드리지 않습니다.',
      '사용자: "캘린더에 있는 일정들 싹 다 삭제해줘"',
      '→ delete_all_events. 특정 캘린더명이 없으면 전체 캘린더의 모든 event를 대상으로 합니다.',
      '',
      '반드시 제공된 JSON Schema에 맞는 JSON만 출력하세요.',
    ].join('\n')

    const userPrompt = [
      `캘린더 데이터(JSON):\n${JSON.stringify(calendar)}`,
      `최근 대화:\n${compactTranscript(messages)}`,
      `현재 사용자 요청:\n${latestUser.content.trim()}`,
      `출력 JSON Schema:\n${JSON.stringify(calendarAiSchema)}`,
    ].join('\n\n')

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: openAiModel,
        instructions: systemPrompt,
        input: userPrompt,
        store: false,
        reasoning: { effort: reasoningEffort },
        max_output_tokens: maxOutputTokens,
        text: {
          format: {
            type: 'json_schema',
            name: 'calendar_ai_result',
            strict: true,
            schema: calendarAiSchema,
          },
        },
      }),
    })

    const data = await openAiResponse.json().catch(() => ({}))

    if (!openAiResponse.ok) {
      const apiMessage = getOpenAiApiError(openAiResponse.status, data)
      res.statusCode = openAiResponse.status >= 500 ? 502 : openAiResponse.status
      res.end(JSON.stringify({ error: apiMessage }))
      return
    }

    const rawReply = extractOpenAiOutputText(data)
    if (!rawReply) {
      const refusal = (Array.isArray(data?.output) ? data.output : [])
        .flatMap(item => Array.isArray(item?.content) ? item.content : [])
        .find(content => content?.type === 'refusal' && typeof content?.refusal === 'string')

      res.statusCode = 502
      res.end(JSON.stringify({
        error: refusal?.refusal || 'OpenAI 응답에서 일정 작업 결과를 찾지 못했습니다.',
      }))
      return
    }

    let parsed
    try {
      parsed = JSON.parse(rawReply)
    } catch {
      res.statusCode = 502
      res.end(JSON.stringify({
        error: 'OpenAI 응답을 일정 작업 JSON으로 해석하지 못했습니다. 같은 요청을 다시 시도해주세요.',
      }))
      return
    }

    const result = normalizeAiResult(parsed, calendar, allowActions)

    // 사용자가 명시적으로 날짜 범위를 말했는데 모델이 첫날 한 건만 create_event로 축소한 경우를 방지합니다.
    // 예: "17일부터 23일까지 9시에 운동 일정 추가해줘" → 17~23일 전체 반복 생성.
    const explicitDateRange = requestMode === 'mutation'
      ? detectKoreanDateRange(latestUser.content, calendar)
      : null

    if (explicitDateRange && Array.isArray(result.actions) && result.actions.length > 0) {
      result.actions = result.actions.map(action => {
        if (action?.type !== 'create_event' && action?.type !== 'create_event_range') return action
        return {
          ...action,
          type: 'create_event_range',
          date: explicitDateRange.startDate,
          rangeEndDate: explicitDateRange.endDate,
          recurrenceMode: explicitDateRange.recurrenceMode,
        }
      })
    }

    res.statusCode = 200
    res.end(JSON.stringify(result))
  } catch (error) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: getOpenAiErrorMessage(error) }))
  }
}
