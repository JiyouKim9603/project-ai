# Python 3.12 이미지 기반으로 시작
FROM python:3.12

# 컨테이너 안에서 작업할 폴더 설정
WORKDIR /app

# requirements.txt 먼저 복사 (캐싱 최적화)
COPY requirements.txt ./

# 라이브러리 설치
RUN pip install -r requirements.txt

# 나머지 소스코드 복사
COPY . .

# FastAPI 서버 실행 (포트 8000)
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]