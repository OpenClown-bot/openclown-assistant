FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY dist/ ./dist/

CMD ["node", "dist/src/main.js"]
