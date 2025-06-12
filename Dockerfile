FROM node:20-slim

# Install system dependencies
RUN apt-get update \
    && apt-get install -y \
    bash \
    build-essential \
    ca-certificates \
    curl \
    g++ \
    git \
    make \
    python3 \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install bun
RUN /bin/bash -o pipefail -c 'curl -fsSL https://bun.sh/install | bash'
ENV PATH=/root/.bun/bin:$PATH

# Create necessary directories
RUN mkdir -p /aidev /workspace
WORKDIR /aidev

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --verbose \
    && cd /aidev/node_modules/tree-sitter-typescript \
    && npm rebuild --build-from-source \
    && cd /aidev/node_modules/tree-sitter \
    && npm rebuild --build-from-source \
    && npm rebuild tree-sitter-go --build-from-source

ENTRYPOINT ["bun", "--cwd", "/aidev", "dev"]
