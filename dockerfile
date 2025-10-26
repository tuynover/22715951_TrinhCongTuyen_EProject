# Multi-stage Dockerfile cho Node.js (chỉnh lại nếu dự án khác)

FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Nếu có bước build (ví dụ React/TS), npm run build sẽ tạo output trong /dist hoặc tương tự
RUN npm run build --if-present

FROM node:18
WORKDIR /app
ENV NODE_ENV=test
# Chỉ copy những gì cần thiết để giảm kích thước image
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
# Nếu dự án có build output ở /dist, giữ; nếu không, copy source theo nhu cầu
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

EXPOSE 3003
USER node
CMD ["npm", "start"]