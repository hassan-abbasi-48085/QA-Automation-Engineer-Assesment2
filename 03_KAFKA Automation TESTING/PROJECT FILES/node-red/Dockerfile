FROM nodered/node-red:4.0.9

# The base image starts Node-RED with --userDir /data and picks up /data/settings.js.
WORKDIR /data
COPY --chown=node-red:node-red package.json settings.js flows.json ./
COPY --chown=node-red:node-red lib/ ./lib/

# Kafka client used by the producer/consumer function nodes (pinned in package.json).
RUN npm install --no-audit --no-fund --omit=dev && npm cache clean --force

WORKDIR /usr/src/node-red
