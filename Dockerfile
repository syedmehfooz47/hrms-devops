# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV VITE_API_URL=/api
RUN npm run build

EXPOSE 80
ENV PORT=80
ENV HOST=0.0.0.0
CMD ["npm", "run", "preview", "--", "--port", "80", "--host", "0.0.0.0"]
