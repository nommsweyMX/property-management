FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
# Reviewed lockfile: reproducible install, no third-party lifecycle scripts.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY public ./public
COPY server ./server
COPY scripts ./scripts
COPY server.mjs ./
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/.data APP_MODE=live
EXPOSE 3000
CMD ["node", "server.mjs"]
