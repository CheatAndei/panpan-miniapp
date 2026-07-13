FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/data /app/uploads /app/private-uploads

EXPOSE 3000
CMD ["node", "server.js"]
