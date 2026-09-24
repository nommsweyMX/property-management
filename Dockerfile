FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
# A lockfile could not be generated in the offline build environment.
# On first connected build, generate/review a lockfile and switch this to npm ci.
RUN npm install --omit=dev --ignore-scripts
COPY public ./public
COPY server ./server
COPY scripts ./scripts
COPY server.mjs ./
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/.data APP_MODE=live
EXPOSE 3000
CMD ["node", "server.mjs"]
