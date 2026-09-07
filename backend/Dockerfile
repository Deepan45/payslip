# --- deps: install once, reused by both the build and (via prune) runtime stages ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# --- build: compile TypeScript and generate the Prisma client ---
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runtime: production-only node_modules + compiled output ---
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# The authorized-signatory stamp (see SIGNATURE_PATH in pdf.service.ts) is a
# fixed asset checked into git — but it can't be COPY'd straight to
# storage/signature here: docker-compose mounts a persistent volume over
# the whole /app/storage tree, and Compose (like Docker) only auto-populates
# a volume from the image the very first time that volume is created, never
# on a later rebuild. An already-existing volume (as in any real deployment,
# holding generated payslips and an uploaded logo) permanently shadows
# anything newly baked into the image at that same path — rebuilding the
# image endlessly would never make a new storage/* file actually appear.
# Stash it outside the mounted path instead, and have the startup command
# below copy it in (once, non-destructively) on every boot — self-healing
# without touching whatever's already in the volume.
COPY --from=build /app/storage/signature ./seed-assets/signature

# Payslip PDFs / uploaded logos land here (see PAYSLIP_STORAGE_DIR /
# LOGO_DIR in src) — mount a volume on this path to persist them.
RUN mkdir -p storage/payslips storage/logo

EXPOSE 4000

# Copy the seeded signature into the (possibly pre-existing) mounted volume
# if it's not already there, apply any pending migrations, then start the
# API. `-n` never overwrites a file the volume already has. `migrate deploy`
# is the non-interactive, production-safe counterpart to `migrate dev`.
CMD ["sh", "-c", "mkdir -p storage/signature && cp -n seed-assets/signature/* storage/signature/ 2>/dev/null; npx prisma migrate deploy && node dist/index.js"]
