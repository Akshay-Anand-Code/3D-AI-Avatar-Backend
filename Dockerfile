FROM node:18-slim

WORKDIR /app

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN yarn install

COPY . .

# Make sure the Rhubarb binary is executable
RUN chmod +x ./bin/rhubarb

# Create audios directory
RUN mkdir -p audios

EXPOSE 3000
CMD ["yarn", "start"] 