FROM node:16-alpine

WORKDIR /usr/src/app

COPY . .

# Copy and install dependencies
RUN npm config set registry https://registry.npm.taobao.org
RUN npm ci --omit=dev
RUN npm install pm2 -g

EXPOSE 9201
CMD pm2-runtime app.js
