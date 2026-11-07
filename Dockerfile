FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
ENV PORT=8712
EXPOSE 8712
CMD ["node", "server/index.mjs"]
