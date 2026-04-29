FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV HTTP_MODE=true
ENV PORT=3000

CMD ["node", "dist/index.js"]
