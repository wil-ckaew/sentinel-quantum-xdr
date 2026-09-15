FROM node:20-alpine
WORKDIR /app
ARG EXPO_PUBLIC_API_URL=http://10.0.2.2:8080
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8081
CMD ["npx", "expo", "start", "--web"]
