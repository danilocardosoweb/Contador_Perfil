FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Em ambiente industrial local, podemos rodar tsx ou build
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
