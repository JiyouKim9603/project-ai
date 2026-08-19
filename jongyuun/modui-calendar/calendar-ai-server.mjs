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
  .map(
    message =>
      `${message.role === 'user' ? '사용자' : 'AI'}: ${message.content.slice(0, 5000)}`
  )
  .join('\n\n')


const getOpenAiErrorMessage = error => {
  const causeCode = error?.cause?.code

  if (
    causeCode === 'ECONNREFUSED' ||
    causeCode === 'ENOTFOUND' ||
    causeCode === 'ETIMEDOUT' ||
    String(error?.message || '').includes('fetch failed')
  ) {
    return 'OpenAI API에 연결할 수 없습니다. VPS의 인터넷/DNS 연결을 확인해주세요.'
  }

  return error instanceof Error
    ? error.message
    : 'AI 처리 중 오류가 발생했습니다.'
}


const extractOpenAiOutputText = data => {
  if (
    typeof data?.output_text === 'string' &&
    data.output_text.trim()
  ) {
    return data.output_text.trim()
  }

  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (item?.type !== 'message') continue

    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (
        content?.type === 'output_text' &&
        typeof content?.text === 'string' &&
        content.text.trim()
      ) {
        return content.text.trim()
      }
    }
  }

  return ''
}


const getOpenAiApiError = (status, data = {}) => {
  const code = String(data?.error?.code || '')
  const message =
    typeof data?.error?.message === 'string'
      ? data.error.message
      : ''

  if (status === 401) {
    return 'OpenAI API 키가 올바르지 않습니다. `.env`의 OPENAI_API_KEY를 확인해주세요.'
  }

  if (status === 403) {
    return '이 API 키에는 요청한 OpenAI 모델을 사용할 권한이 없습니다.'
  }

  if (
    status === 429 &&
    /insufficient_quota|billing|quota/i.test(`${code} ${message}`)
  ) {
    return 'OpenAI API 크레딧 또는 결제 한도가 부족합니다. OpenAI Platform의 Billing/Usage를 확인해주세요.'
  }

  if (status === 429) {
    return 'OpenAI API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.'
  }

  if (status >= 500) {
    return 'OpenAI API 서버에서 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  }

  return message || `OpenAI API 오류 (${status})`
}


const normalizeText = value =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')


const normalizeLookup = value =>
  normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, '')


const isDate = value =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value)


const isTime = value =>
  typeof value === 'string' &&
  /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)


// ======================================================
// 요청 분류
// ======================================================

export const classifyCalendarRequestMode = (
  text,
  messages = []
) => {
  const value =
    normalizeText(text).toLowerCase()


  // ----------------------------------------------------
  // 복구
  // ----------------------------------------------------

  const hasBulkWord =
    /(?:전부|모두|전체|싹\s*다|몽땅|모조리|다\s*(?:삭제|지워|제거|없애|복구|복원))/.test(value)


  const hasRestoreVerb =
    /(?:복구해|복구해줘|복원해|복원해줘|되돌려|되돌려줘|다시\s*살려|살려줘|휴지통.*꺼내|꺼내줘|원상복구)/.test(value)


  if (
    hasRestoreVerb &&
    hasBulkWord
  ) {
    return 'restore_all'
  }


  if (hasRestoreVerb) {
    return 'restore'
  }


  // ----------------------------------------------------
  // 삭제
  // ----------------------------------------------------

  const hasDeleteVerb =
    /(?:삭제해|삭제해줘|지워|지워줘|제거해|제거해줘|없애|없애줘)/.test(value)


  if (
    hasDeleteVerb &&
    hasBulkWord
  ) {
    return 'delete_all'
  }


  if (hasDeleteVerb) {
    return 'mutation'
  }


  // ----------------------------------------------------
  // 알림
  //
  // "알려줘" 단독으로는 알림으로 판단하지 않는다.
  // ----------------------------------------------------

  const hasReminderKeyword =
    /(?:알림|리마인드|리마인더|정시)/.test(value)


  const hasReminderOffset =
    /(?:\d+|한|두|세|네)\s*(?:분|시간|일)\s*전(?:에)?(?:\s*(?:알려|알림))?/.test(value)


  const hasReminderInstruction =
    hasReminderKeyword ||
    hasReminderOffset


  // ----------------------------------------------------
  // 일정 생성
  // ----------------------------------------------------

  const hasExplicitCreate =
    /(?:일정\s*)?(?:추가|등록|생성)\s*(?:해|해줘|해주세요|하고|해주고|시켜|시켜줘|부탁)/.test(value) ||

    /(?:만들어|만들어줘|만들어주세요)/.test(value) ||

    /(?:넣어|넣어줘|넣어주세요)/.test(value) ||

    /(?:일정|회의|미팅|약속|예약).{0,18}(?:잡아줘|잡아 주세요|잡아주세요|예약해|예약해줘|예약해주세요)/.test(value)


  // ----------------------------------------------------
  // 일정 이동/수정
  // ----------------------------------------------------

  const hasScheduleMove =
    /(?:옮겨|이동해|이동해줘|미뤄|미뤄줘|당겨|당겨줘|앞당겨|늦춰)/.test(value) ||

    /(?:날짜|시작\s*시간|종료\s*시간).{0,14}(?:수정|변경|바꿔)/.test(value) ||

    /\b(?:오전|오후)\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?\s*(?:로|에)\b/.test(value) ||

    /\b\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?\s*(?:로|에)\b/.test(value)


  if (
    hasReminderInstruction &&
    !hasExplicitCreate &&
    !hasScheduleMove
  ) {
    return 'reminder_only'
  }


  const explicitMutationPatterns = [
    /(?:일정\s*)?(?:추가|등록|생성)\s*(?:해|해줘|해주세요|하고|해주고|시켜|시켜줘|부탁)/,

    /(?:만들어|만들어줘|만들어주세요)/,

    /(?:넣어|넣어줘|넣어주세요)/,

    /(?:일정|회의|미팅|약속|예약).{0,18}(?:잡아줘|잡아 주세요|잡아주세요|예약해|예약해줘|예약해주세요)/,

    /(?:옮겨|이동해|이동해줘|수정해|수정해줘|변경해|변경해줘|바꿔|바꿔줘|미뤄|미뤄줘|당겨|당겨줘|앞당겨|늦춰)/,
  ]


  if (
    explicitMutationPatterns.some(
      pattern => pattern.test(value)
    )
  ) {
    return 'mutation'
  }


  // ====================================================
  // 후속 대화
  // ====================================================

  const previousAssistant =
    [...messages]
      .reverse()
      .find(
        message =>
          message?.role === 'assistant' &&
          typeof message?.content === 'string'
      )


  const previous =
    normalizeText(
      previousAssistant?.content
    ).toLowerCase()


  const isConfirmation =
    /^(응|네|예|그래|좋아|진행해줘|해줘|확인)$/i.test(value)


  const isTimeAnswer =
    /(?:오전|오후)?\s*(?:[01]?\d|2[0-3])\s*시(?:\s*(?:반|[0-5]?\d\s*분))?/.test(value) ||

    /(?:[01]?\d|2[0-3]):[0-5]\d/.test(value)


  // "추가할까요?" → "응"
  if (
    isConfirmation &&
    /(추가할까요|수정할까요|변경할까요|옮길까요|삭제할까요|알림.*설정할까요)/.test(previous)
  ) {
    return 'mutation'
  }


  // "몇 시에 넣을까요?" → "오후 3시"
  if (
    isTimeAnswer &&
    /(?:몇\s*시에|몇\s*시|시작\s*시간|시간을\s*알려|시간을\s*말해)/.test(previous)
  ) {
    return 'mutation'
  }


  // "어떤 캘린더에 넣을까요?" → "개인 일정"
  if (
    value.length > 0 &&
    /(?:어떤\s*캘린더|어느\s*캘린더|캘린더에\s*넣을까요|캘린더를\s*선택)/.test(previous)
  ) {
    return 'mutation'
  }


  return 'read_only'
}


// ======================================================
// Structured Output Schema
// ======================================================

const calendarAiSchema = {
  type: 'object',

  properties: {
    reply: {
      type: 'string',
    },

    actions: {
      type: 'array',
      maxItems: 10,

      items: {
        type: 'object',

        properties: {
          type: {
            type: 'string',

            enum: [
              'create_event',
              'create_event_range',
              'update_event',
              'delete_event',
              'set_reminder',
              'delete_all_events',
              'restore_event',
              'restore_all_events',
              'restore_last_deleted',
            ],
          },

          eventId: {
            type: [
              'integer',
              'null',
            ],
          },

          trashId: {
            type: [
              'integer',
              'null',
            ],
          },

          batchId: {
            type: [
              'integer',
              'null',
            ],
          },

          title: {
            type: [
              'string',
              'null',
            ],
          },

          date: {
            type: [
              'string',
              'null',
            ],
          },

          rangeEndDate: {
            type: [
              'string',
              'null',
            ],
          },

          recurrenceMode: {
            type: 'string',

            enum: [
              'none',
              'daily',
              'weekdays',
            ],
          },

          start: {
            type: [
              'string',
              'null',
            ],
          },

          end: {
            type: [
              'string',
              'null',
            ],
          },

          calendarName: {
            type: [
              'string',
              'null',
            ],
          },

          description: {
            type: [
              'string',
              'null',
            ],
          },

          reminderMode: {
            type: 'string',

            enum: [
              'keep',
              'none',
              'set',
            ],
          },

          reminderMinutes: {
            type: [
              'integer',
              'null',
            ],

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

  required: [
    'reply',
    'actions',
  ],

  additionalProperties: false,
}


// ======================================================
// 날짜 범위 처리
// ======================================================

const formatDateParts = (
  year,
  month,
  day
) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`


const validCalendarDate = (
  year,
  month,
  day
) => {
  const date =
    new Date(
      year,
      month - 1,
      day
    )

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}


export const detectKoreanDateRange = (
  text,
  calendar = {}
) => {
  const value =
    normalizeText(text)

  const cursor =
    isDate(calendar?.cursorDate)
      ? calendar.cursorDate
      : (
          isDate(calendar?.today)
            ? calendar.today
            : null
        )

  if (!cursor) {
    return null
  }


  const [
    cursorYear,
    cursorMonth,
  ] =
    cursor
      .split('-')
      .map(Number)


  const match =
    value.match(
      /(?:(\d{1,2})월\s*)?(\d{1,2})일\s*부터\s*(?:(\d{1,2})월\s*)?(\d{1,2})일\s*까지/
    )


  if (!match) {
    return null
  }


  const startMonth =
    match[1]
      ? Number(match[1])
      : cursorMonth


  const startDay =
    Number(match[2])


  const endMonth =
    match[3]
      ? Number(match[3])
      : startMonth


  const endDay =
    Number(match[4])


  const startYear =
    cursorYear


  let endYear =
    cursorYear


  if (
    endMonth <
    startMonth
  ) {
    endYear += 1
  }


  if (
    !validCalendarDate(
      startYear,
      startMonth,
      startDay
    ) ||

    !validCalendarDate(
      endYear,
      endMonth,
      endDay
    )
  ) {
    return null
  }


  const startDate =
    formatDateParts(
      startYear,
      startMonth,
      startDay
    )


  const endDate =
    formatDateParts(
      endYear,
      endMonth,
      endDay
    )


  if (
    endDate <
    startDate
  ) {
    return null
  }


  return {
    startDate,

    endDate,

    recurrenceMode:
      /(?:평일|주중)/.test(value)
        ? 'weekdays'
        : 'daily',
  }
}


// ======================================================
// 시간 처리
// ======================================================

const pad2 =
  value =>
    String(value).padStart(2, '0')


const addMinutesToClock = (
  clock,
  minutes
) => {
  if (!isTime(clock)) {
    return null
  }

  const [
    hour,
    minute,
  ] =
    clock
      .split(':')
      .map(Number)


  const total =
    hour * 60 +
    minute +
    minutes


  const normalized =
    (
      (
        total %
        1440
      ) +
      1440
    ) %
    1440


  return (
    `${pad2(
      Math.floor(
        normalized /
        60
      )
    )}:${pad2(
      normalized %
      60
    )}`
  )
}


// ======================================================
// 캘린더명
// ======================================================

const exactCalendarName = (
  candidate,
  calendars
) => {
  const key =
    normalizeLookup(candidate)

  if (!key) {
    return null
  }


  const match =
    calendars.find(
      item =>
        normalizeLookup(
          item?.name
        ) === key
    )


  return (
    typeof match?.name === 'string'
      ? match.name
      : null
  )
}


// ======================================================
// 알림
// ======================================================

export const parseReminderInstruction = text => {
  const value =
    normalizeText(text)
      .toLowerCase()


  const candidates = []


  const pushMatches = (
    regex,
    convert
  ) => {
    for (
      const match
      of value.matchAll(regex)
    ) {
      const result =
        convert(match)

      if (result) {
        candidates.push({
          index:
            match.index ??
            -1,

          ...result,
        })
      }
    }
  }


  pushMatches(
    /(?:알림\s*(?:없음|없이|끄|꺼|해제)|알려주지\s*마|알림\s*빼)/g,

    () => ({
      mode: 'none',
      minutes: null,
    })
  )


  pushMatches(
    /(?:정시|시작\s*시간에|시작할\s*때)/g,

    () => ({
      mode: 'set',
      minutes: 0,
    })
  )


  pushMatches(
    /(\d{1,5})\s*분\s*전/g,

    match => {
      const minutes =
        Number(
          match[1]
        )

      return (
        minutes >= 0 &&
        minutes <= 10080
      )
        ? {
            mode: 'set',
            minutes,
          }
        : null
    }
  )


  const hourWordMap = {
    한: 1,
    두: 2,
    세: 3,
    네: 4,
  }


  pushMatches(
    /(\d{1,3}|한|두|세|네)\s*시간\s*전/g,

    match => {
      const hours =
        /^\d+$/.test(
          match[1]
        )
          ? Number(
              match[1]
            )
          : hourWordMap[
              match[1]
            ]


      const minutes =
        hours *
        60


      return (
        minutes >= 0 &&
        minutes <= 10080
      )
        ? {
            mode: 'set',
            minutes,
          }
        : null
    }
  )


  const dayWordMap = {
    하루: 1,
    이틀: 2,
    사흘: 3,
  }


  pushMatches(
    /(\d{1,2}|하루|이틀|사흘)\s*(?:일\s*)?전/g,

    match => {
      const days =
        /^\d+$/.test(
          match[1]
        )
          ? Number(
              match[1]
            )
          : dayWordMap[
              match[1]
            ]


      const minutes =
        days *
        1440


      return (
        minutes >= 0 &&
        minutes <= 10080
      )
        ? {
            mode: 'set',
            minutes,
          }
        : null
    }
  )


  if (
    candidates.length === 0
  ) {
    return null
  }


  candidates.sort(
    (a, b) =>
      a.index -
      b.index
  )


  const latest =
    candidates[
      candidates.length -
      1
    ]


  return {
    mode:
      latest.mode,

    minutes:
      latest.minutes,
  }
}


// ======================================================
// 캘린더 / 휴지통 검색
// ======================================================

const mentionedCalendarName = (
  text,
  calendars
) => {
  const value =
    normalizeLookup(text)


  const matches =
    calendars.filter(
      item => {
        const key =
          normalizeLookup(
            item?.name
          )

        return (
          key &&
          value.includes(key)
        )
      }
    )


  return (
    matches.length === 1 &&
    typeof matches[0]?.name === 'string'
  )
    ? matches[0].name
    : null
}


const resolveTrashedEvent = (
  text,
  trashedEvents = []
) => {
  const value =
    normalizeLookup(text)


  const titleMatches =
    trashedEvents.filter(
      item => {
        const titleKey =
          normalizeLookup(
            item?.event?.title
          )

        return (
          titleKey &&
          value.includes(
            titleKey
          )
        )
      }
    )


  if (
    titleMatches.length === 0
  ) {
    return null
  }


  return (
    titleMatches
      .slice()
      .sort(
        (a, b) =>
          String(
            b?.deletedAt ||
            ''
          ).localeCompare(
            String(
              a?.deletedAt ||
              ''
            )
          )
      )[0]
  )
}


const latestTrashBatchId = (
  trashedEvents = []
) => {
  const latest =
    trashedEvents
      .slice()
      .sort(
        (a, b) =>
          String(
            b?.deletedAt ||
            ''
          ).localeCompare(
            String(
              a?.deletedAt ||
              ''
            )
          )
      )[0]


  return (
    Number.isInteger(
      latest?.batchId
    )
      ? latest.batchId
      : null
  )
}


// ======================================================
// 기존 일정 검색
// ======================================================

export const resolveContextEventId = (
  text,
  messages = [],
  events = []
) => {

  const findMatches =
    rawText => {
      const value =
        normalizeLookup(
          rawText
        )


      if (!value) {
        return []
      }


      return (
        events.filter(
          event => {
            const titleKey =
              normalizeLookup(
                event?.title
              )

            return (
              titleKey &&
              value.includes(
                titleKey
              )
            )
          }
        )
      )
    }


  const directMatches =
    findMatches(text)


  if (
    directMatches.length === 1 &&
    Number.isInteger(
      directMatches[0]?.id
    )
  ) {
    return (
      directMatches[0].id
    )
  }


  const prior =
    Array.isArray(messages)
      ? messages
          .slice(0, -1)
          .reverse()
      : []


  for (
    const message
    of prior.slice(0, 6)
  ) {
    if (
      typeof message?.content !==
      'string'
    ) {
      continue
    }


    const matches =
      findMatches(
        message.content
      )


    if (
      matches.length === 1 &&
      Number.isInteger(
        matches[0]?.id
      )
    ) {
      return (
        matches[0].id
      )
    }
  }


  if (
    events.length === 1 &&
    Number.isInteger(
      events[0]?.id
    )
  ) {
    return (
      events[0].id
    )
  }


  return null
}


// ======================================================
// Action 기본 구조
// ======================================================

const makeAction = (
  type,
  overrides = {}
) => ({
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


// ======================================================
// 수정 대상 일정 찾기
// ======================================================

const resolveExistingEventId = (
  action,
  events
) => {

  if (
    Number.isInteger(
      action.eventId
    ) &&

    events.some(
      event =>
        event?.id ===
        action.eventId
    )
  ) {
    return action.eventId
  }


  const titleKey =
    normalizeLookup(
      action.title
    )


  if (!titleKey) {
    return null
  }


  let candidates =
    events.filter(
      event =>
        normalizeLookup(
          event?.title
        ) ===
        titleKey
    )


  if (
    isDate(
      action.date
    )
  ) {
    candidates =
      candidates.filter(
        event =>
          event?.date ===
          action.date
      )
  }


  if (
    isTime(
      action.start
    )
  ) {
    candidates =
      candidates.filter(
        event =>
          event?.start ===
          action.start
      )
  }


  return (
    candidates.length === 1 &&
    Number.isInteger(
      candidates[0]?.id
    )
  )
    ? candidates[0].id
    : null
}


// ======================================================
// AI 결과 검증
// ======================================================

const normalizeAiResult = (
  value,
  calendar,
  allowActions = true
) => {

  const calendars =
    Array.isArray(
      calendar?.calendars
    )
      ? calendar.calendars
      : []


  const events =
    Array.isArray(
      calendar?.events
    )
      ? calendar.events
      : []


  const allowedTypes =
    new Set([
      'create_event',
      'create_event_range',
      'update_event',
      'delete_event',
      'set_reminder',
      'delete_all_events',
      'restore_event',
      'restore_all_events',
      'restore_last_deleted',
    ])


  const allowedReminderModes =
    new Set([
      'keep',
      'none',
      'set',
    ])


  const rawActions =
    allowActions &&
    Array.isArray(
      value?.actions
    )
      ? value.actions.slice(
          0,
          10
        )
      : []


  const actions = []

  let rejectedAction =
    false


  for (
    const raw
    of rawActions
  ) {

    if (
      !raw ||
      !allowedTypes.has(
        raw.type
      )
    ) {
      rejectedAction =
        true

      continue
    }


    const type =
      raw.type


    const title =
      typeof raw.title ===
      'string'
        ? normalizeText(
            raw.title
          ) || null
        : null


    const date =
      isDate(
        raw.date
      )
        ? raw.date
        : null


    const rangeEndDate =
      isDate(
        raw.rangeEndDate
      )
        ? raw.rangeEndDate
        : null


    const recurrenceMode =
      [
        'none',
        'daily',
        'weekdays',
      ].includes(
        raw.recurrenceMode
      )
        ? raw.recurrenceMode
        : 'none'


    const start =
      isTime(
        raw.start
      )
        ? raw.start
        : null


    let end =
      isTime(
        raw.end
      )
        ? raw.end
        : null


    const description =
      typeof raw.description ===
      'string'
        ? raw.description.trim()
        : null


    let calendarName =
      exactCalendarName(
        raw.calendarName,
        calendars
      )


    let reminderMode =
      allowedReminderModes.has(
        raw.reminderMode
      )
        ? raw.reminderMode

        : (
            type === 'create_event' ||
            type === 'create_event_range'
          )
            ? 'none'
            : 'keep'


    let reminderMinutes =
      Number.isInteger(
        raw.reminderMinutes
      ) &&

      raw.reminderMinutes >= 0 &&

      raw.reminderMinutes <=
      10080

        ? raw.reminderMinutes
        : null


    // --------------------------------------------------
    // 반복 일정 생성
    // --------------------------------------------------

    if (
      type ===
      'create_event_range'
    ) {

      if (
        reminderMode ===
        'keep'
      ) {
        reminderMode =
          'none'
      }


      if (
        reminderMode !==
        'set'
      ) {
        reminderMinutes =
          null
      }


      if (
        reminderMode ===
        'set' &&
        reminderMinutes ===
        null
      ) {
        rejectedAction =
          true

        continue
      }


      if (
        !calendarName &&
        calendars.length ===
        1 &&
        typeof calendars[0]?.name ===
        'string'
      ) {
        calendarName =
          calendars[0].name
      }


      if (
        !title ||
        !date ||
        !rangeEndDate ||
        !start ||
        !calendarName ||
        rangeEndDate <
        date
      ) {
        rejectedAction =
          true

        continue
      }


      if (
        !end ||
        end === start
      ) {
        end =
          addMinutesToClock(
            start,
            60
          )
      }


      actions.push({
        type,

        eventId: null,

        trashId: null,

        batchId: null,

        title,

        date,

        rangeEndDate,

        recurrenceMode:
          recurrenceMode ===
          'none'
            ? 'daily'
            : recurrenceMode,

        start,

        end,

        calendarName,

        description,

        reminderMode,

        reminderMinutes,
      })

      continue
    }


    // --------------------------------------------------
    // 단일 일정 생성
    // --------------------------------------------------

    if (
      type ===
      'create_event'
    ) {

      if (
        reminderMode ===
        'keep'
      ) {
        reminderMode =
          'none'
      }


      if (
        reminderMode !==
        'set'
      ) {
        reminderMinutes =
          null
      }


      if (
        reminderMode ===
        'set' &&
        reminderMinutes ===
        null
      ) {
        rejectedAction =
          true

        continue
      }


      if (
        !calendarName &&
        calendars.length ===
        1 &&
        typeof calendars[0]?.name ===
        'string'
      ) {
        calendarName =
          calendars[0].name
      }


      if (
        !title ||
        !date ||
        !start ||
        !calendarName
      ) {
        rejectedAction =
          true

        continue
      }


      if (
        !end ||
        end === start
      ) {
        end =
          addMinutesToClock(
            start,
            60
          )
      }


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


    // --------------------------------------------------
    // 전체 삭제
    // --------------------------------------------------

    if (
      type ===
      'delete_all_events'
    ) {

      if (
        raw.calendarName &&
        !calendarName
      ) {
        rejectedAction =
          true

        continue
      }


      actions.push(
        makeAction(
          'delete_all_events',
          {
            calendarName,
          }
        )
      )

      continue
    }


    // --------------------------------------------------
    // 복구
    // --------------------------------------------------

    if (
      type ===
      'restore_all_events' ||

      type ===
      'restore_last_deleted' ||

      type ===
      'restore_event'
    ) {

      actions.push(
        makeAction(
          type,
          {
            trashId:
              Number.isInteger(
                raw.trashId
              )
                ? raw.trashId
                : null,

            batchId:
              Number.isInteger(
                raw.batchId
              )
                ? raw.batchId
                : null,

            title,

            date,

            calendarName,
          }
        )
      )

      continue
    }


    const eventId =
      resolveExistingEventId(
        {
          ...raw,

          title,

          date,

          start,
        },

        events
      )


    if (!eventId) {
      rejectedAction =
        true

      continue
    }


    // --------------------------------------------------
    // 알림
    // --------------------------------------------------

    if (
      type ===
      'set_reminder'
    ) {

      if (
        reminderMode ===
        'keep'
      ) {
        reminderMode =
          'set'
      }


      if (
        reminderMode !==
        'set'
      ) {
        reminderMinutes =
          null
      }


      if (
        reminderMode ===
        'set' &&
        reminderMinutes ===
        null
      ) {
        rejectedAction =
          true

        continue
      }


      actions.push(
        makeAction(
          'set_reminder',
          {
            eventId,

            reminderMode,

            reminderMinutes,
          }
        )
      )

      continue
    }


    if (
      reminderMode !==
      'set'
    ) {
      reminderMinutes =
        null
    }


    if (
      reminderMode ===
      'set' &&
      reminderMinutes ===
      null
    ) {
      rejectedAction =
        true

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


  let reply =
    typeof value?.reply ===
    'string' &&
    value.reply.trim()

      ? value.reply.trim()

      : '요청을 확인했습니다.'


  if (
    rawActions.length > 0 &&
    actions.length === 0 &&
    rejectedAction
  ) {
    reply =
      '일정을 바로 변경하기에는 대상이나 날짜·시간·캘린더 정보가 충분히 확실하지 않아요. 어떤 일정을 어떻게 변경할지 조금 더 구체적으로 알려주세요.'
  }


  return {
    reply,
    actions,
  }
}


// ======================================================
// API
// ======================================================

export async function handleCalendarAi(
  req,
  res
) {
  res.setHeader(
    'Content-Type',
    'application/json; charset=utf-8'
  )


  if (
    req.method !==
    'POST'
  ) {
    res.statusCode =
      405

    res.end(
      JSON.stringify({
        error:
          'POST 요청만 지원합니다.',
      })
    )

    return
  }


  try {

    const body =
      await readJsonBody(req)


    const messages =
      Array.isArray(
        body?.messages
      )
        ? body.messages
        : []


    const calendar =
      body?.calendar &&
      typeof body.calendar ===
      'object'

        ? body.calendar
        : {}


    const latestUser =
      [...messages]
        .reverse()
        .find(
          message =>
            message?.role ===
            'user' &&
            typeof message?.content ===
            'string'
        )


    if (
      !latestUser?.content?.trim()
    ) {
      res.statusCode =
        400

      res.end(
        JSON.stringify({
          error:
            '질문을 입력해주세요.',
        })
      )

      return
    }


    const requestMode =
      classifyCalendarRequestMode(
        latestUser.content,
        messages
      )


    const currentEvents =
      Array.isArray(
        calendar?.events
      )
        ? calendar.events
        : []


    const currentCalendars =
      Array.isArray(
        calendar?.calendars
      )
        ? calendar.calendars
        : []


    const currentTrashedEvents =
      Array.isArray(
        calendar?.trashedEvents
      )
        ? calendar.trashedEvents
        : []


    // ==================================================
    // 새 일정 생성
    //
    // 캘린더 → 시간 순서로 질문
    // ==================================================

    const latestText =
      normalizeText(
        latestUser.content
      ).toLowerCase()


    const isCreateRequest =
      /(?:일정\s*)?(?:추가|등록|생성)\s*(?:해|해줘|해주세요|하고|해주고|시켜|시켜줘|부탁)/.test(latestText) ||

      /(?:만들어|만들어줘|만들어주세요)/.test(latestText) ||

      /(?:넣어|넣어줘|넣어주세요)/.test(latestText) ||

      /(?:일정|회의|미팅|약속|예약).{0,18}(?:잡아줘|잡아 주세요|잡아주세요|예약해|예약해줘|예약해주세요)/.test(latestText)


    const previousAssistantForCreate =
      [...messages]
        .reverse()
        .find(
          message =>
            message?.role === 'assistant' &&
            typeof message?.content === 'string'
        )


    const previousAssistantText =
      normalizeText(
        previousAssistantForCreate?.content
      ).toLowerCase()


    const isCreateFollowUp =
      /(?:어떤\s*캘린더|어느\s*캘린더|캘린더에\s*넣을까요|캘린더를\s*선택|몇\s*시에|몇\s*시|시작\s*시간)/.test(
        previousAssistantText
      )


    // --------------------------------------------------
    // 최근 일정 생성 요청 찾기
    // --------------------------------------------------

    let createStartIndex =
      -1


    for (
      let index =
        messages.length - 1;

      index >= 0;

      index -= 1
    ) {

      const message =
        messages[index]


      if (
        message?.role !==
        'user' ||

        typeof message?.content !==
        'string'
      ) {
        continue
      }


      const text =
        normalizeText(
          message.content
        ).toLowerCase()


      const matchesCreate =
        /(?:일정\s*)?(?:추가|등록|생성)\s*(?:해|해줘|해주세요|하고|해주고|시켜|시켜줘|부탁)/.test(text) ||

        /(?:만들어|만들어줘|만들어주세요)/.test(text) ||

        /(?:넣어|넣어줘|넣어주세요)/.test(text) ||

        /(?:일정|회의|미팅|약속|예약).{0,18}(?:잡아줘|잡아 주세요|잡아주세요|예약해|예약해줘|예약해주세요)/.test(text)


      if (matchesCreate) {
        createStartIndex =
          index

        break
      }
    }


    // --------------------------------------------------
    // 최초 생성 요청부터 현재 답변까지 사용자 문장 합치기
    //
    // 예:
    // 19일에 게임 넣어
    // 개인 일정
    // 오후 3시
    // --------------------------------------------------

    const createContextText =
      messages
        .slice(
          createStartIndex >= 0
            ? createStartIndex
            : Math.max(
                0,
                messages.length - 6
              )
        )
        .filter(
          message =>
            message?.role === 'user' &&
            typeof message?.content === 'string'
        )
        .map(
          message =>
            normalizeText(
              message.content
            )
        )
        .join(' ')


    const createContextLookup =
      normalizeLookup(
        createContextText
      )


    // --------------------------------------------------
    // 캘린더가 이미 선택됐는지 확인
    // --------------------------------------------------

    const selectedCalendar =
      currentCalendars.find(
        calendarItem => {
          const calendarName =
            normalizeLookup(
              calendarItem?.name
            )

          return (
            calendarName &&
            createContextLookup.includes(
              calendarName
            )
          )
        }
      )


    // --------------------------------------------------
    // 시간이 이미 입력됐는지 확인
    // --------------------------------------------------

    const hasExplicitEventTime =
      /(?:오전|오후)?\s*(?:[01]?\d|2[0-3])\s*시(?:\s*(?:반|[0-5]?\d\s*분))?/.test(
        createContextText
      ) ||

      /(?:[01]?\d|2[0-3]):[0-5]\d/.test(
        createContextText
      )


    // --------------------------------------------------
    // 생성 요청 또는 생성 요청의 후속 대화일 때
    // --------------------------------------------------

    if (
      requestMode ===
      'mutation' &&

      (
        isCreateRequest ||
        isCreateFollowUp
      )
    ) {

      // ================================================
      // 1순위: 캘린더 질문
      // ================================================

      if (!selectedCalendar) {

        const calendarNames =
          currentCalendars
            .map(
              item =>
                typeof item?.name ===
                'string'
                  ? item.name.trim()
                  : ''
            )
            .filter(Boolean)


        const options =
          calendarNames.length > 0

            ? ` 현재 캘린더: ${calendarNames.join(', ')}`

            : ''


        res.statusCode =
          200


        res.end(
          JSON.stringify({
            reply:
              `어떤 캘린더에 넣을까요?${options}`,

            actions: [],
          })
        )

        return
      }


      // ================================================
      // 2순위: 시간 질문
      // ================================================

      if (!hasExplicitEventTime) {

        res.statusCode =
          200


        res.end(
          JSON.stringify({
            reply:
              '몇 시에 일정을 추가할까요?',

            actions: [],
          })
        )

        return
      }
    }


    // ==================================================
    // 전체 복구
    // ==================================================

    if (
      requestMode ===
      'restore_all'
    ) {

      const calendarName =
        mentionedCalendarName(
          latestUser.content,
          currentCalendars
        )


      const targets =
        calendarName

          ? currentTrashedEvents.filter(
              item =>
                normalizeLookup(
                  item?.event?.calendarName
                ) ===
                normalizeLookup(
                  calendarName
                )
            )

          : currentTrashedEvents


      if (
        targets.length === 0
      ) {

        res.statusCode =
          200


        res.end(
          JSON.stringify({
            reply:
              calendarName

                ? `휴지통에 “${calendarName}” 캘린더 일정이 없어요.`

                : '휴지통에 복구할 일정이 없어요.',

            actions: [],
          })
        )

        return
      }


      res.statusCode =
        200


      res.end(
        JSON.stringify({
          reply:
            calendarName

              ? `휴지통의 “${calendarName}” 일정을 모두 복구할게요.`

              : '휴지통의 모든 일정을 복구할게요.',

          actions: [
            makeAction(
              'restore_all_events',
              {
                calendarName,
              }
            ),
          ],
        })
      )

      return
    }


    // ==================================================
    // 단일 / 최근 삭제 복구
    // ==================================================

    if (
      requestMode ===
      'restore'
    ) {

      if (
        currentTrashedEvents.length ===
        0
      ) {

        res.statusCode =
          200


        res.end(
          JSON.stringify({
            reply:
              '휴지통에 복구할 일정이 없어요.',

            actions: [],
          })
        )

        return
      }


      const named =
        resolveTrashedEvent(
          latestUser.content,
          currentTrashedEvents
        )


      if (named) {

        res.statusCode =
          200


        res.end(
          JSON.stringify({
            reply:
              `휴지통에서 “${named.event?.title || '일정'}”을 복구할게요.`,

            actions: [
              makeAction(
                'restore_event',
                {
                  trashId:
                    Number.isInteger(
                      named.trashId
                    )
                      ? named.trashId
                      : null,

                  eventId:
                    Number.isInteger(
                      named?.event?.id
                    )
                      ? named.event.id
                      : null,

                  title:
                    typeof named?.event?.title ===
                    'string'
                      ? named.event.title
                      : null,

                  date:
                    typeof named?.event?.date ===
                    'string'
                      ? named.event.date
                      : null,

                  calendarName:
                    typeof named?.event?.calendarName ===
                    'string'
                      ? named.event.calendarName
                      : null,
                }
              ),
            ],
          })
        )

        return
      }


      const batchId =
        latestTrashBatchId(
          currentTrashedEvents
        )


      if (!batchId) {

        res.statusCode =
          200


        res.end(
          JSON.stringify({
            reply:
              '복구할 최근 삭제 기록을 찾지 못했어요. 휴지통에서 직접 복원하거나 일정 제목을 말해주세요.',

            actions: [],
          })
        )

        return
      }


      res.statusCode =
        200


      res.end(
        JSON.stringify({
          reply:
            '방금 삭제한 일정들을 휴지통에서 복구할게요.',

          actions: [
            makeAction(
              'restore_last_deleted',
              {
                batchId,
              }
            ),
          ],
        })
      )

      return
    }


    // ==================================================
    // 전체 삭제
    // ==================================================

    if (
      requestMode ===
      'delete_all'
    ) {

      const calendarName =
        mentionedCalendarName(
          latestUser.content,
          currentCalendars
        )


      const targetCount =
        calendarName

          ? currentEvents.filter(
              event =>
                normalizeLookup(
                  event?.calendarName
                ) ===
                normalizeLookup(
                  calendarName
                )
            ).length

          : currentEvents.length


      if (
        targetCount === 0
      ) {

        res.statusCode =
          200


        res.end(
          JSON.stringify({
            reply:
              calendarName

                ? `“${calendarName}” 캘린더에 휴지통으로 옮길 일정이 없어요.`

                : '휴지통으로 옮길 일정이 없어요.',

            actions: [],
          })
        )

        return
      }


      res.statusCode =
        200


      res.end(
        JSON.stringify({
          reply:
            calendarName

              ? `“${calendarName}” 캘린더의 일정을 모두 휴지통으로 이동할게요.`

              : '캘린더의 모든 일정을 휴지통으로 이동할게요.',

          actions: [
            makeAction(
              'delete_all_events',
              {
                calendarName,
              }
            ),
          ],
        })
      )

      return
    }


    // ==================================================
    // 알림만 변경
    // ==================================================

    if (
      requestMode ===
      'reminder_only'
    ) {

      const reminder =
        parseReminderInstruction(
          latestUser.content
        )


      const eventId =
        resolveContextEventId(
          latestUser.content,
          messages,
          currentEvents
        )


      if (!reminder) {

        res.statusCode =
          200


        res.end(
          JSON.stringify({
            reply:
              '알림을 몇 분/몇 시간 전에 받을지 알려주세요. 예: “10분 전에 알려줘”, “1시간 전에 알려줘”.',

            actions: [],
          })
        )

        return
      }


      if (!eventId) {

        res.statusCode =
          200


        res.end(
          JSON.stringify({
            reply:
              '어느 일정의 알림을 바꿀지 하나로 특정하지 못했어요. 일정 제목을 같이 말해주세요. 예: “운동 일정 알림을 10분 전으로 바꿔줘”.',

            actions: [],
          })
        )

        return
      }


      res.statusCode =
        200


      res.end(
        JSON.stringify({
          reply:
            '일정 시간은 그대로 두고 알림 설정만 변경할게요.',

          actions: [
            makeAction(
              'set_reminder',
              {
                eventId,

                reminderMode:
                  reminder.mode,

                reminderMinutes:
                  reminder.minutes,
              }
            ),
          ],
        })
      )

      return
    }


    // ==================================================
    // OpenAI 호출
    // ==================================================

    const allowActions =
      requestMode ===
      'mutation'


    const openAiApiKey =
      String(
        process.env.OPENAI_API_KEY ||
        ''
      ).trim()


    const openAiModel =
      String(
        process.env.OPENAI_MODEL ||
        'gpt-4o-mini'
      ).trim()


    const maxOutputTokens =
      Math.min(
        8000,

        Math.max(
          500,

          Number(
            process.env.OPENAI_MAX_OUTPUT_TOKENS ||
            800
          ) ||
          800
        )
      )


    if (!openAiApiKey) {

      res.statusCode =
        500


      res.end(
        JSON.stringify({
          error:
            'OPENAI_API_KEY가 설정되지 않았습니다. 프로젝트의 `.env` 파일에 API 키를 입력한 뒤 서버를 다시 시작해주세요.',
        })
      )

      return
    }


    // ==================================================
    // 시스템 프롬프트
    // ==================================================

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

      '- reminder_only, delete_all, restore, restore_all은 서버가 별도로 처리합니다.',

      '',


      '[후속 대화 규칙]',

      '- 사용자가 일정 생성을 요청한 뒤 서버가 캘린더나 시간을 질문했을 수 있습니다.',

      '- 예: 사용자 "19일에 게임 넣어" → AI "어떤 캘린더에 넣을까요?" → 사용자 "개인 일정" → AI "몇 시에 일정을 추가할까요?" → 사용자 "오후 3시".',

      '- 이런 경우 현재 사용자 문장만 보지 말고 최근 대화 전체를 합쳐서 하나의 일정 생성 요청으로 처리하세요.',

      '- 위 예에서는 title="게임", 날짜=19일, calendarName="개인 일정", start="15:00"입니다.',

      '',


      '[추천/조회 규칙]',

      '- 빈 시간 추천은 calendar.events의 실제 일정을 기준으로 계산하세요.',

      '- 사용자가 업무 시간 범위를 말하지 않았다면 09:00~18:00 안에서 30분 이상 비는 구간을 찾고, 집중 업무에는 가능하면 60분 이상 연속 구간을 우선 추천하세요.',

      '- 추천 결과에는 왜 그 시간이 좋은지 기존 일정과의 간격을 짧게 설명하세요.',

      '- 추천만 요청받았다면 어떤 일정도 새로 만들었다고 말하지 마세요.',

      '',


      '[제목 규칙]',

      '- title에는 일정의 핵심 주제만 넣으세요.',

      '- 날짜, 시간, 캘린더명, "일정", "추가해줘/수정해줘/삭제해줘", 알림 지시 같은 명령 문구를 title에 섞지 마세요.',

      '- "19일 개인 일정 캘린더에 9시 운동 넣어줘" → title은 "운동"입니다.',

      '- "내일 오후 2시에 치과 예약 잡아줘" → title은 "치과 예약"입니다.',

      '',


      '[날짜/시간 규칙]',

      '- calendar.today는 실제 오늘 날짜입니다.',

      '- 오늘/내일/모레/이번 주/다음 주는 calendar.today를 기준으로 해석하세요.',

      '- "19일"처럼 월이 생략된 날짜는 calendar.cursorDate가 속한 연/월을 우선 사용하세요.',

      '- date는 YYYY-MM-DD 형식입니다.',

      '- start/end는 24시간 HH:MM 형식입니다.',

      '- 사용자가 시작 시간을 말하지 않았다면 절대로 임의의 09:00 등을 만들지 마세요.',

      '- 새 일정에서 종료 시간을 말하지 않았다면 end는 start의 1시간 뒤로 설정하세요.',

      '- 범위 반복 일정은 date=첫 날짜, rangeEndDate=마지막 날짜를 사용하세요.',

      '- "매일"은 recurrenceMode="daily", "평일마다"는 recurrenceMode="weekdays"입니다.',

      '',


      '[캘린더 규칙]',

      '- calendarName은 반드시 calendar.calendars에 실제로 존재하는 이름을 사용하세요.',

      '- "개인일정"과 "개인 일정"처럼 띄어쓰기 차이는 같은 캘린더로 이해하세요.',

      '- 서버가 이미 사용자에게 어떤 캘린더인지 질문했다면 최근 대화에서 사용자가 선택한 캘린더를 반드시 사용하세요.',

      '- 사용자가 선택하지 않은 다른 캘린더를 임의로 고르지 마세요.',

      '',


      '[알림 규칙]',

      '- 알림 지시는 제목과 완전히 별개입니다.',

      '- "5분 전에 알려줘" → reminderMode="set", reminderMinutes=5.',

      '- "한 시간 전에 알려줘" → reminderMode="set", reminderMinutes=60.',

      '- "정시에 알려줘" → reminderMode="set", reminderMinutes=0.',

      '- "알림 없이", "알림 꺼줘" → reminderMode="none", reminderMinutes=null.',

      '- 새 일정에서 알림 언급이 없으면 reminderMode="none", reminderMinutes=null.',

      '- 기존 일정 수정에서 알림을 언급하지 않으면 reminderMode="keep", reminderMinutes=null.',

      '',


      '[작업 규칙]',

      '- 명확한 단일 일정 추가 요청은 create_event를 반환하세요.',

      '- 여러 날짜 범위에 같은 일정을 반복 추가하는 요청은 create_event_range를 반환하세요.',

      '- 기존 일정 수정/이동/시간 변경 요청은 update_event를 반환하세요.',

      '- 알림만 변경하는 요청은 set_reminder를 사용하세요.',

      '- 단일 일정 삭제 요청은 delete_event를 반환하세요.',

      '- 요약, 빈 시간 추천, 일정 조회 같은 읽기 요청은 actions=[]입니다.',

      '- 수정/삭제 대상이 둘 이상이라 특정할 수 없으면 actions=[]로 두고 후보를 질문하세요.',

      '- 필수 정보가 정말 부족하면 임의 실행하지 마세요.',

      '',


      '[완료 표현 규칙]',

      '- 당신은 데이터를 직접 저장하지 않습니다.',

      '- actions가 있어도 reply에서 "추가했습니다/수정했습니다/삭제했습니다"라고 완료를 선언하지 마세요.',

      '- 실제 성공 여부는 앱이 action을 실행한 뒤 별도로 표시합니다.',

      '',


      '[예시 1]',

      '사용자: "19일에 게임 넣어"',

      'AI: "어떤 캘린더에 넣을까요?"',

      '사용자: "개인 일정"',

      'AI: "몇 시에 일정을 추가할까요?"',

      '사용자: "오후 3시"',

      '→ create_event, title="게임", 해당 월 19일, start="15:00", end="16:00", calendarName="개인 일정".',

      '',


      '[예시 2]',

      '사용자: "19일 개인 일정 캘린더에 9시 운동 추가해줘 알림은 5분 전에 오게 해줘"',

      '→ create_event, title="운동", start="09:00", end="10:00", calendarName="개인 일정", reminderMode="set", reminderMinutes=5.',

      '',


      '[예시 3]',

      '사용자: "17일부터 23일까지 9시에 운동 일정 추가해줘"',

      '→ create_event_range, title="운동", date=17일, rangeEndDate=23일, recurrenceMode="daily", start="09:00", end="10:00".',

      '',


      '[예시 4]',

      '사용자: "디자인 리뷰를 3시로 옮겨줘"',

      '→ calendar.events에서 디자인 리뷰의 eventId를 찾아 update_event.',

      '',


      '[예시 5]',

      '사용자: "운동 일정 알림 10분 전으로 바꿔줘"',

      '→ set_reminder, 정확한 운동 일정 eventId, reminderMode="set", reminderMinutes=10.',

      '',


      '반드시 제공된 JSON Schema에 맞는 JSON만 출력하세요.',
    ].join('\n')


    // ==================================================
    // 사용자 프롬프트
    // ==================================================

    const userPrompt = [
      `캘린더 데이터(JSON):\n${JSON.stringify(calendar)}`,

      `최근 대화:\n${compactTranscript(messages)}`,

      `현재 사용자 요청:\n${latestUser.content.trim()}`,

      `출력 JSON Schema:\n${JSON.stringify(calendarAiSchema)}`,
    ].join('\n\n')


    // ==================================================
    // Responses API
    // ==================================================

    const openAiResponse =
      await fetch(
        'https://api.openai.com/v1/responses',
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',

            'Authorization':
              `Bearer ${openAiApiKey}`,
          },

          body:
            JSON.stringify({
              model:
                openAiModel,

              instructions:
                systemPrompt,

              input:
                userPrompt,

              store:
                false,

              max_output_tokens:
                maxOutputTokens,

              text: {
                format: {
                  type:
                    'json_schema',

                  name:
                    'calendar_ai_result',

                  strict:
                    true,

                  schema:
                    calendarAiSchema,
                },
              },
            }),
        }
      )


    const data =
      await openAiResponse
        .json()
        .catch(
          () => ({})
        )


    if (
      !openAiResponse.ok
    ) {

      const apiMessage =
        getOpenAiApiError(
          openAiResponse.status,
          data
        )


      res.statusCode =
        openAiResponse.status >= 500
          ? 502
          : openAiResponse.status


      res.end(
        JSON.stringify({
          error:
            apiMessage,
        })
      )

      return
    }


    const rawReply =
      extractOpenAiOutputText(
        data
      )


    if (!rawReply) {

      const refusal =
        (
          Array.isArray(
            data?.output
          )
            ? data.output
            : []
        )
          .flatMap(
            item =>
              Array.isArray(
                item?.content
              )
                ? item.content
                : []
          )
          .find(
            content =>
              content?.type ===
              'refusal' &&

              typeof content?.refusal ===
              'string'
          )


      res.statusCode =
        502


      res.end(
        JSON.stringify({
          error:
            refusal?.refusal ||
            'OpenAI 응답에서 일정 작업 결과를 찾지 못했습니다.',
        })
      )

      return
    }


    let parsed


    try {

      parsed =
        JSON.parse(
          rawReply
        )

    } catch {

      res.statusCode =
        502


      res.end(
        JSON.stringify({
          error:
            'OpenAI 응답을 일정 작업 JSON으로 해석하지 못했습니다. 같은 요청을 다시 시도해주세요.',
        })
      )

      return
    }


    const result =
      normalizeAiResult(
        parsed,
        calendar,
        allowActions
      )


    // ==================================================
    // 날짜 범위 보정
    // ==================================================

    const explicitDateRange =
      requestMode ===
      'mutation'

        ? detectKoreanDateRange(
            createContextText || latestUser.content,
            calendar
          )

        : null


    if (
      explicitDateRange &&

      Array.isArray(
        result.actions
      ) &&

      result.actions.length >
      0
    ) {

      result.actions =
        result.actions.map(
          action => {

            if (
              action?.type !==
              'create_event' &&

              action?.type !==
              'create_event_range'
            ) {
              return action
            }


            return {
              ...action,

              type:
                'create_event_range',

              date:
                explicitDateRange.startDate,

              rangeEndDate:
                explicitDateRange.endDate,

              recurrenceMode:
                explicitDateRange.recurrenceMode,
            }
          }
        )
    }


    res.statusCode =
      200


    res.end(
      JSON.stringify(
        result
      )
    )

  } catch (error) {

    res.statusCode =
      500


    res.end(
      JSON.stringify({
        error:
          getOpenAiErrorMessage(
            error
          ),
      })
    )
  }
}