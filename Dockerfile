# Dockerfile

# Use the official Node.js image.
FROM node:14

# Set the working directory.
WORKDIR /usr/src/app

# Copy package files.
COPY package.json package-lock.json* ./

# Copy the rest of the application files.
COPY . ./

# Install dependencies.
RUN npm install

# Expose the application port.
EXPOSE 3000

# Run the application.
CMD ["node", "index.js"]
