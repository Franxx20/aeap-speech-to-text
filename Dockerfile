FROM node:lts-bookworm
ARG DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package.json package-lock.json /app/

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY lib /app/lib
COPY index.js /app/index.js
COPY LICENSE /app/LICENSE
COPY README.md /app/README.md

EXPOSE 9090/tcp
EXPOSE 9099/tcp

CMD ["node", "./index.js"]
