FROM node:20-slim
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY backend/migrations ./migrations
EXPOSE 4280
CMD ["node", "src/index.js"]
