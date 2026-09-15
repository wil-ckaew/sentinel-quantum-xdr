FROM rust:1.89-bookworm AS builder

WORKDIR /app

COPY . .

RUN cargo build \
    --release \
    --package gateway

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y \
        ca-certificates \
        libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder \
    /app/target/release/gateway \
    /app/gateway

EXPOSE 8080

ENV RUST_LOG=gateway=info

CMD ["/app/gateway"]
