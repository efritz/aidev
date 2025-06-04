FROM node:20-slim

# Set pipe fail option to properly handle errors
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install required packages including Python for native module compilation
RUN apt-get update && apt-get install -y \
    git python3 make g++ curl unzip bash \
    build-essential python3 git && \
    rm -rf /var/lib/apt/lists/*

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH=/root/.bun/bin:$PATH

# Create necessary directories
RUN mkdir -p /aidev /workspace
WORKDIR /aidev

# Install dependencies at build time
# We'll copy package.json and bun.lockb during build
COPY . ./

# Install dependencies with more verbose output and rebuild native modules
# Install dependencies and properly rebuild native modules for the current architecture
RUN bun install --verbose \
    && cd node_modules/tree-sitter-typescript \
    && npm rebuild --build-from-source \
    && cd ../tree-sitter \
    && npm rebuild --build-from-source \
    && npm rebuild tree-sitter-go --build-from-source

# We'll mount the source code and workspace at runtime
# This allows us to run the CLI without rebuilding the image for code changes

CMD ["bun", "/aidev/src/cli.ts"]
