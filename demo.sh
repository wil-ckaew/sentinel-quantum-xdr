#!/usr/bin/env bash
#
# demo.sh — Demonstração end-to-end do Sentinel Quantum XDR.
#
# Fluxo:
#   1. Sobe a stack (assume que as imagens já existem)
#   2. Aguarda healthchecks
#   3. Manda 3 eventos: benigno, suspeito, malicioso
#   4. Mostra incidentes, assets isolados, audit logs, métricas
#
# Uso: ./demo.sh [--build]
#   --build  força rebuild antes de subir (mais lento)

set -euo pipefail

cd "$(dirname "$0")"

# -----------------------------------------------------------------------------
# Cores
# -----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

hdr()  { printf "\n${BOLD}${BLUE}━━━ %s ━━━${NC}\n" "$1"; }
info() { printf "${CYAN}▸${NC} %s\n" "$1"; }
ok()   { printf "${GREEN}✔${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
err()  { printf "${RED}✘${NC} %s\n" "$1"; }
dim()  { printf "${DIM}%s${NC}\n" "$1"; }

# -----------------------------------------------------------------------------
# Argumentos
# -----------------------------------------------------------------------------
BUILD=0
for arg in "$@"; do
  case "$arg" in
    --build) BUILD=1 ;;
    -h|--help)
      echo "Uso: $0 [--build]"
      echo "  --build  força rebuild das imagens antes de subir"
      exit 0
      ;;
  esac
done

# -----------------------------------------------------------------------------
# Banner
# -----------------------------------------------------------------------------
clear
cat <<'BANNER'
   ╔═══════════════════════════════════════════════════════════════════╗
   ║                                                                   ║
   ║        SENTINEL QUANTUM XDR — Hybrid Detection Pipeline           ║
   ║                                                                   ║
   ║   Regras locais + ML (ONNX) + SOAR + RabbitMQ + Prometheus        ║
   ║                                                                   ║
   ╚═══════════════════════════════════════════════════════════════════╝
BANNER

# -----------------------------------------------------------------------------
# 1. Sobe a stack
# -----------------------------------------------------------------------------
hdr "1/6  Subindo a stack"

if [[ $BUILD -eq 1 ]]; then
  info "Rebuild forçado (pode levar alguns minutos)"
  docker compose build --no-cache gateway detection-service ml-inference 2>&1 | tail -5
fi

docker compose up -d 2>&1 | tail -10

info "Aguardando healthchecks..."
for i in $(seq 1 40); do
  if curl -fsS http://localhost:8080/health/detailed >/dev/null 2>&1; then
    ok "gateway pronto em ${i}s"
    break
  fi
  printf "."
  sleep 1
done

curl -fsS http://localhost:8080/health/detailed | jq -r '
  "  postgres:         \(.checks.postgres)",
  "  redis:            \(.checks.redis)",
  "  rabbitmq:         \(.checks.rabbitmq)",
  "  detection_service:\(.checks.detection_service)"'

# -----------------------------------------------------------------------------
# 2. Evento benigno
# -----------------------------------------------------------------------------
hdr "2/6  Evento BENIGNO — USER_LOGIN"

RESP=$(curl -sS -X POST http://localhost:8080/api/events \
  -H 'Content-Type: application/json' \
  -d '{
    "source":"endpoint",
    "severity":"low",
    "event_type":"USER_LOGIN",
    "category":"identity",
    "hostname":"workstation-alice",
    "payload":{"action":"login","user":"alice"}
  }')

echo "$RESP" | jq '{event_type, severity, processed}'
dim "→ sem detecção, sem incidente, sem SOAR"

# -----------------------------------------------------------------------------
# 3. Evento suspeito
# -----------------------------------------------------------------------------
hdr "3/6  Evento SUSPEITO — payload ambíguo (aciona fallback ML)"

RESP=$(curl -sS -X POST http://localhost:8080/api/events \
  -H 'Content-Type: application/json' \
  -d '{
    "source":"network",
    "severity":"medium",
    "event_type":"UNKNOWN_TRAFFIC",
    "category":"network",
    "hostname":"srv-edge-01",
    "payload_text":"4d5a90000300000004000000ffff",
    "mime":"application/octet-stream",
    "size":16
  }')

echo "$RESP" | jq '{event_type, severity, processed}'
dim "→ confidence local < 80 → detection-service → ml-inference (heurística)"

# -----------------------------------------------------------------------------
# 4. Evento malicioso
# -----------------------------------------------------------------------------
hdr "4/6  Evento MALICIOSO — MALWARE_DETECTED + auto_remediate"

HOST="srv-compromised-$RANDOM"
RESP=$(curl -sS -X POST http://localhost:8080/api/events \
  -H 'Content-Type: application/json' \
  -d "{
    \"source\":\"endpoint\",
    \"severity\":\"critical\",
    \"event_type\":\"MALWARE_DETECTED\",
    \"category\":\"endpoint\",
    \"is_attack\":true,
    \"auto_remediate\":true,
    \"hostname\":\"$HOST\",
    \"payload\":{\"sha256\":\"deadbeefcafebabe\"},
    \"payload_text\":\"<?php system(\$_GET['cmd']); ?>\",
    \"mime\":\"application/x-php\"
  }")

echo "$RESP" | jq '{id, event_type, severity, processed}'
dim "→ regra local T1486 dispara → incidente → SOAR ISOLATE_HOST"

# -----------------------------------------------------------------------------
# 5. Estado do sistema
# -----------------------------------------------------------------------------
hdr "5/6  Estado do sistema"

info "Incidentes criados (últimos 5):"
docker compose exec -T postgres psql -U sentinel -d sentinel_db -t -c "
  SELECT '  ' || to_char(created_at,'HH24:MI:SS') || '  ' || title
  FROM incidents ORDER BY created_at DESC LIMIT 5;"

info "Assets isolados:"
docker compose exec -T postgres psql -U sentinel -d sentinel_db -t -c "
  SELECT '  ' || rpad(hostname, 22) || '  ' || rpad(status, 10) ||
         '  auto=' || COALESCE(metadata->>'auto_registered', 'false')
  FROM assets WHERE status='ISOLATED' ORDER BY updated_at DESC LIMIT 5;"

info "Audit logs do SOAR (últimos 5):"
docker compose exec -T postgres psql -U sentinel -d sentinel_db -t -c "
  SELECT '  ' || to_char(created_at,'HH24:MI:SS') || '  ' ||
         rpad(action, 20) || '  ' || rpad(resource, 20) ||
         '  source=' || COALESCE(metadata->>'detection_source', '?')
  FROM audit_logs ORDER BY created_at DESC LIMIT 5;"

# -----------------------------------------------------------------------------
# 6. Métricas
# -----------------------------------------------------------------------------
hdr "6/6  Métricas Prometheus"

curl -fsS http://localhost:8080/metrics \
  | grep -E "^sentinel_" \
  | sed 's/^/  /'

# -----------------------------------------------------------------------------
# Fim
# -----------------------------------------------------------------------------
printf "\n${BOLD}${GREEN}═══════════════════════════════════════════════════════════════════${NC}\n"
printf "${BOLD}${GREEN}  DEMO CONCLUÍDA${NC}\n"
printf "${BOLD}${GREEN}═══════════════════════════════════════════════════════════════════${NC}\n\n"

cat <<'NEXT'
Próximos passos:
  • Dashboard web:         http://localhost:3000
  • Prometheus:            http://localhost:9090
  • RabbitMQ management:   http://localhost:15672  (sentinel/sentinel)
  • Swagger/OpenAPI:       (se habilitado)

Para parar:
  docker compose down

NEXT
