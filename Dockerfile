# Use Node.js 20 as the base image (recommended for Supabase)
FROM node:20-alpine

# Force cache bust - Updated: 2025-12-03-17:20
RUN echo "Cache bust: 2025-12-03-17:20:00"

# Install build dependencies for native modules (sharp, etc.)
# These are needed for sharp image processing and other native dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set working directory
WORKDIR /app

# Copy package files for dependency installation (optimized layer caching)
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies (dev deps needed for build)
RUN npm install && \
    cd server && npm install && \
    cd ../client && npm install

# Set build-time environment variables for React app
# These are baked into the client build
ARG REACT_APP_SUPABASE_URL
ARG REACT_APP_SUPABASE_ANON_KEY
ENV REACT_APP_SUPABASE_URL=$REACT_APP_SUPABASE_URL
ENV REACT_APP_SUPABASE_ANON_KEY=$REACT_APP_SUPABASE_ANON_KEY

# Copy the rest of the application
COPY . .

# Build the client with environment variables
RUN npm run build

# Expose port (Railway uses 8080 by default)
EXPOSE 8080

# Start the application
CMD ["npm", "run", "railway:start"]
