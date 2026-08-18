# MODUI Calendar AI - OpenAI API 버전

기존 **Ollama(gemma3)** 연결을 제거하고 **OpenAI Responses API**로 변경한 버전입니다.
캘린더의 일정 생성/수정/삭제/복구/알림/추천 로직은 그대로 유지하고, 자연어 해석 부분만 OpenAI 모델이 담당합니다.

## 기본 설정

비용을 아끼기 위해 기본 모델은 `gpt-5.6-luna`, reasoning effort는 `low`로 설정되어 있습니다.
OpenAI API 키는 브라우저가 아니라 Node/Vite 개발 서버에서만 사용합니다.

`.env` 파일을 열어 본인의 키를 입력하세요.

```env
OPENAI_API_KEY=sk-본인_API_KEY
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=low
OPENAI_MAX_OUTPUT_TOKENS=2000
```

> `.env`는 `.gitignore`에 포함되어 있습니다. API 키를 GitHub에 올리지 마세요.

## VPS에서 적용

프로젝트 폴더에서:

```bash
nano .env
```

API 키를 입력하고 저장한 뒤, 코드가 바뀌었으므로 다시 빌드합니다.

```bash
npm install
npm run build
```

기존 4173 서버가 실행 중이면 종료 후 다시 실행합니다.

```bash
pkill -f "node server.mjs" || true
npm start
```

정상 실행 시:

```text
MODUI Calendar: http://localhost:4173
```

브라우저에서는 VPS의 공인 IP와 4173 포트로 접속합니다.

```text
http://VPS공인IP:4173
```

## OpenAI 연결 테스트

서버에서 API 키가 환경변수에 들어간 상태인지 확인하려면 키 자체를 출력하지 말고 아래처럼 확인하세요.

```bash
node -e "console.log(process.env.OPENAI_API_KEY ? 'key exists' : 'key missing')"
```

`.env`는 `server.mjs`가 시작할 때 읽으므로 `.env`를 수정했다면 `npm start`를 재시작해야 합니다.

캘린더 웹에서 AI에게 다음처럼 테스트할 수 있습니다.

```text
내일 오후 2시에 치과 예약 잡고 한 시간 전에 알려줘
이번 주 일정 사이에서 집중 업무하기 좋은 빈 시간을 추천해줘
운동 일정 알림을 10분 전으로 바꿔줘
```

## 동작 구조

```text
브라우저
  ↓ /api/calendar-ai
Node server.mjs
  ↓ HTTPS
OpenAI Responses API
  ↓ Structured Outputs(JSON Schema)
Node 서버 검증
  ↓
React 일정 반영
```

OpenAI API 키는 Node 서버에서만 사용되고 브라우저 코드에는 전달하지 않습니다.

## 안전 장치

- 추천/조회 요청(`read_only`)은 모델이 실수로 action을 생성해도 서버에서 폐기합니다.
- 실제 일정 추가/수정/삭제는 명시적인 변경 요청일 때만 허용합니다.
- 전체 삭제와 복구, 알림 전용 변경은 서버에서 별도 처리합니다.
- 날짜 범위 반복 생성은 모델이 첫 날짜 한 건으로 축소해도 서버가 `create_event_range`로 보정합니다.
- Structured Outputs(JSON Schema)를 사용해 일정 작업 응답 형식을 제한합니다.
- `OPENAI_MAX_OUTPUT_TOKENS` 기본값을 2000으로 두어 과도한 출력 사용을 제한합니다.
- Responses API 요청은 `store: false`로 전송합니다.

## 비용 조절

더 저렴하게/빠르게 쓰려면 기본값 그대로 사용하세요.

```env
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=low
```

응답 품질을 더 높이고 싶다면 모델 또는 reasoning effort를 변경할 수 있습니다. 변경 후에는 Node 서버를 재시작하세요.

## 주요 자연어 기능

- 일정 생성 및 날짜 범위 반복 생성
- 일정 날짜/시간/제목/캘린더 수정
- 일정 알림 설정/변경/해제
- 일정 삭제 → 휴지통 이동
- 단일/전체 일정 복구
- 캘린더 요약 및 일정 조회
- 일정 충돌 확인
- 빈 시간 추천
- 최근 대화를 이용한 후속 요청 처리
