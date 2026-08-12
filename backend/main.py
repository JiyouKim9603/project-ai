# FastAPI 프레임워크 불러오기
from fastapi import FastAPI
# CORS 설정 (React에서 FastAPI로 요청 허용)
from fastapi.middleware.cors import CORSMiddleware

# FastAPI 앱 생성
app = FastAPI()

# CORS 설정
# React(localhost:3000)에서 FastAPI(localhost:8000)로 요청 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 기본 테스트 엔드포인트
# 브라우저에서 localhost:8000 접속하면 이 응답이 옴
@app.get("/")
def read_root():
    return {"message": "프로젝트.ai 백엔드 서버 정상 작동 중"}

# 회의록 AI 엔드포인트 (나중에 구현)
@app.get("/api/meeting")
def meeting():
    return {"message": "회의록 AI 엔드포인트"}

# 산출물 AI 엔드포인트 (나중에 구현)
@app.get("/api/output")
def output():
    return {"message": "산출물 AI 엔드포인트"}