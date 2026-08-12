# Node.js 18 이미지 기반으로 시작
FROM node:18

# 컨테이너 안에서 작업할 폴더 설정
WORKDIR /app

# package.json 먼저 복사 (캐싱 최적화)
COPY package*.json ./

# 라이브러리 설치
RUN npm install

# 나머지 소스코드 복사
COPY . .

# React 개발 서버 실행 (포트 3000)
EXPOSE 3000
CMD ["npm", "start"]