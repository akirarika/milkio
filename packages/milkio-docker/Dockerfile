FROM debian:12.4-slim

WORKDIR /opt/src/app

ENV BUN_VERSION="1.0.22"
ENV CO_VERSION="2.3.0"
ENV NODE_VERSION="20.11.0"
ENV NVM_DIR="/root/.nvm"
ENV PATH="/root/.bun/bin:/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

RUN apt update \
  && apt install -y git curl unzip \
  && curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" \
  && . /root/.bashrc \
  && bun install --global "co-linux-x64@${CO_VERSION}" \
  && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash \
  && . "$NVM_DIR/nvm.sh" \
  && nvm install ${NODE_VERSION} \
  && nvm use v${NODE_VERSION} \
  && nvm alias default v${NODE_VERSION} \
  && bun --version && node --version && npm --version \
  && apt clean
