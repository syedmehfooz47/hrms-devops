# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV VITE_API_URL=/api
RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0
CMD ["npm", "run", "preview", "--", "--port", "3000", "--host", "0.0.0.0"]
