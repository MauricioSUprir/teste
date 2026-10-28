# Servidor BeautyNow — para VPS/Dokploy ou qualquer host de contêiner.
# docker build -t beautynow-servidor . && docker run -p 4000:4000 --env-file .env beautynow-servidor
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.mjs contas-shopping.mjs produtos-extras.json ./
EXPOSE 4000
CMD ["node", "index.mjs"]
