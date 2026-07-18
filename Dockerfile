ARG NODE_VERSION=node:22-alpine3.22

# 阶段1: 构建
FROM $NODE_VERSION AS builder
ENV PNPM_HOME=/pnpm-store
ENV PATH="$PNPM_HOME:$PATH"
RUN npm config set registry https://registry.npmmirror.com && npm install -g pnpm && mkdir -p $PNPM_HOME

WORKDIR /app
COPY package.json  ./
RUN pnpm install --store-dir $PNPM_HOME
COPY . .
RUN pnpm run build

# 阶段2: 生产镜像
FROM $NODE_VERSION AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./
ENV NODE_ENV=production \
    PORT=8080
EXPOSE 8080
CMD ["node", "src/main.js"]
