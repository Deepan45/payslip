# --- deps: install once, reused by both the build and (via prune) runtime stages ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# --- build: compile TypeScript and generate the Prisma client ---
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runtime: production-only node_modules + compiled output ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Payslip PDFs / uploaded logos land here (see PAYSLIP_STORAGE_DIR /
# LOGO_DIR in src) — mount a volume on this path to persist them.
RUN mkdir -p storage/payslips storage/logo

EXPOSE 4000

# Apply any pending migrations, then start the API. `migrate deploy` is the
# non-interactive, production-safe counterpart to `migrate dev`.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
