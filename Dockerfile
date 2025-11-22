# Use Node.js 20 as the base image (recommended for Supabase)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy server package files and install
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy client package files and install
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy the rest of the application
COPY . .

# Set build-time environment variables for React app
# These are baked into the client build
ARG REACT_APP_SUPABASE_URL
ARG REACT_APP_SUPABASE_ANON_KEY
ENV REACT_APP_SUPABASE_URL=$REACT_APP_SUPABASE_URL
ENV REACT_APP_SUPABASE_ANON_KEY=$REACT_APP_SUPABASE_ANON_KEY

# Build the client with environment variables
RUN npm run build

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "run", "railway:start"]
