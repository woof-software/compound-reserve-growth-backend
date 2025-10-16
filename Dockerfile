FROM node:22.13.1-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN yarn install --immutable
COPY ./ ./
RUN yarn run build
RUN yarn install --immutable --prod

FROM node:22.13.1-alpine AS run
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/src/database/ ./src/database/
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/tsconfig.json ./tsconfig.json

USER node
EXPOSE 3000
CMD ["node", "dist/src/main"]