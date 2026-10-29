# Build context: thư mục gốc dự án (npm workspaces, lockfile ở gốc).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
# Cài đúng phiên bản trong package-lock.json, chỉ cho workspace backend.
RUN npm ci -w backend
COPY backend/tsconfig.json backend/
COPY backend/prisma backend/prisma
COPY backend/src backend/src
RUN npm exec -w backend -- prisma generate && npm run build -w backend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci -w backend --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/prisma ./backend/prisma
WORKDIR /app/backend
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
