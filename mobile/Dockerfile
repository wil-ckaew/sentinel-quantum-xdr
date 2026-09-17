FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

ARG EXPO_PUBLIC_API_URL=http://localhost:8080
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV CI=1
ENV EXPO_NO_TELEMETRY=1

COPY package*.json ./
RUN npm install --prefer-offline --no-audit --no-fund

COPY . .

EXPOSE 8081

CMD ["npx", "expo", "start", "--web", "--port", "8081"]
