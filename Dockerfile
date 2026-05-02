FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY dist/ ./dist/

EXPOSE 9464

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "require('./dist/deployment/healthCheck.js').healthCheck().then(ok=>{process.exit(ok?0:1)}).catch(()=>process.exit(1))"]

CMD ["node", "dist/index.js"]
