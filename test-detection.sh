#!/usr/bin/env bash
set -euo pipefail

echo "==> 1. Subindo stack"
docker compose up -d --build ml-inference detection-service

echo "==> 2. Aguardando health"
for i in {1..30}; do
  if curl -fsS http://localhost:8090/health >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "==> 3. Health check ml-inference"
docker compose exec -T ml-inference curl -fsS http://localhost:5000/health | jq .

echo "==> 4. Health check detection-service"
curl -fsS http://localhost:8090/health | jq .

echo "==> 5. Caso benigno"
curl -fsS -X POST http://localhost:8090/analyze \
  -H 'Content-Type: application/json' \
  -d '{"payload":"the quick brown fox jumps over the lazy dog","source":"file","mime":"text/plain"}' | jq .

echo "==> 6. Caso webshell (regra R-WEBSHELL deve disparar)"
curl -fsS -X POST http://localhost:8090/analyze \
  -H 'Content-Type: application/json' \
  -d '{"payload":"<?php system($_GET[\"cmd\"]); ?>","source":"file","mime":"application/x-php"}' | jq .

echo "==> 7. Caso binário (vai chamar ML)"
curl -fsS -X POST http://localhost:8090/analyze \
  -H 'Content-Type: application/json' \
  -d '{"payload":"4d5a90000300000004000000ffff","source":"process","mime":"application/x-dosexec","size":16}' | jq .

echo "✔ smoke test OK"
