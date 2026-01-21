# syntax=docker/dockerfile:1

# ============================================
# 1단계: 의존성 설치
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# 패키지 매니저 파일 복사
COPY package.json package-lock.json* ./

# 의존성 설치
RUN npm ci --legacy-peer-deps

# ============================================
# 2단계: 빌드
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

# 의존성 복사
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 실행
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================
# 3단계: 프로덕션 이미지
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 보안을 위한 non-root 사용자 생성
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 필요한 파일만 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Cloud Run은 PORT 환경 변수 사용
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
