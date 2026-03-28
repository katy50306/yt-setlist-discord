FROM node:24-alpine

RUN apk add --no-cache tzdata

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY src/ ./src/

RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000

CMD ["node", "src/index.js"]
