FROM node:22-alpine AS deps
WORKDIR /workspace

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
RUN npm ci --workspace=sistema-licencas-v2

FROM deps AS build
COPY . .
RUN npm run api:build

FROM node:22-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/prisma ./apps/api/prisma

WORKDIR /workspace/apps/api
RUN npx prisma generate

EXPOSE 3001
CMD ["node", "dist/src/main.js"]