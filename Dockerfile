FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY dist/ ./dist/

EXPOSE 9464

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "const http=require('http');const req=http.get('http://127.0.0.1:9464/healthz',(r)=>{let d='';r.on('data',(c)=>d+=c);r.on('end',()=>{try{process.exit(JSON.parse(d).status==='ok'?0:1)}catch{process.exit(1)}});r.on('error',()=>process.exit(1))});req.on('error',()=>process.exit(1));req.setTimeout(3000,()=>{req.destroy();process.exit(1)})"]

CMD ["node", "dist/index.js"]
