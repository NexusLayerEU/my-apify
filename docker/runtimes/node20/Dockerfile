FROM node:20-slim
WORKDIR /actor
COPY sdk/myapify.js /usr/local/lib/node_modules/myapify.js
ENV NODE_PATH=/usr/local/lib/node_modules
CMD ["node", "main.js"]
