# ============================================================================
# Dockerfile — Sistem Informasi SPMI (Next.js 16 + Prisma + MySQL)
# Multi-stage build: deps → build → runner (image akhir ~200MB)
# ============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install dependencies
# ---------------------------------------------------------------------------
FROM node:22-slim AS deps

WORKDIR /app

# Copy hanya manifest (untuk caching layer Docker)
COPY package.json package-lock.json* ./

# Install dependencies (termasuk devDependencies untuk build)
RUN npm ci

# Copy Prisma schema untuk generate client
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# ---------------------------------------------------------------------------
# Stage 2: Build aplikasi
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder

WORKDIR /app

ENV NODE_ENV=production
# Next.js meratapi env ini saat build; nilai final di-set runtime.
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build aplikasi (output: standalone)
# DATABASE_URL diperlukan saat build untuk Prisma generate; gunakan dummy.
ENV DATABASE_URL="mysql://placeholder:placeholder@localhost:3306/lpm_spmi"
RUN npx next build

# ---------------------------------------------------------------------------
# Stage 3: Runner (image akhir — minimal)
# ---------------------------------------------------------------------------
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

# Buat user non-root untuk keamanan
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy output standalone dari build
COPY --from=builder /app/public ./public

# .next/standalone berisi server.js + node_modules minimal
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma Client (sudah ada di standalone node_modules, tapi pastikan)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Buat folder uploads (file bukti/dokumen)
RUN mkdir -p /app/public/uploads/bukti /app/public/uploads/penetapan /app/public/uploads/evaluasi /app/public/uploads/branding \
 && chown -R nextjs:nodejs /app/public/uploads

USER nextjs

EXPOSE 3002

# Healthcheck sederhana
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
