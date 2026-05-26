FROM python:3.11-slim

ARG TYPST_VERSION=0.13.1

# Dépendances système + Typst CLI
RUN apt-get update && apt-get install -y \
    curl \
    xz-utils \
    fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL \
       "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" \
       | tar -xJf - --strip-components=1 -C /usr/local/bin \
           "typst-x86_64-unknown-linux-musl/typst"

WORKDIR /app

# Installer les dépendances Python en cache layer séparé
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENTRYPOINT ["python", "main.py"]
