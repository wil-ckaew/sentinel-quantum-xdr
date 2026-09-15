# Demo — Sentinel Quantum XDR

## Requisitos

- Docker 24+ com Compose v2
- 4GB RAM livres
- Portas livres: 3000, 5000, 5432, 5672, 6379, 8080, 8090, 9090, 15672

## Rodar

```bash
# 1. Clonar
git clone <repo>
cd sentinel-quantum-xdr

# 2. Configurar
cp .env.example .env  # ou criar conforme README

# 3. Demo (build + run + smoke test)
./demo.sh --build
A demo leva ~6 minutos no primeiro build (Rust compila do zero dentro do container). Builds subsequentes são ~30s.
O que a demo mostra
1. Stack subindo
text

✔ Container sentinel-quantum-xdr-postgres-1    Healthy
✔ Container sentinel-quantum-xdr-redis-1       Healthy
✔ Container sentinel-quantum-xdr-rabbitmq-1    Healthy
✔ Container sentinel-ml-inference              Healthy
✔ Container sentinel-detection-service         Started
✔ Container sentinel-quantum-xdr-gateway-1     Started

2. Health detalhado
json

{
  "checks": {
    "detection_service": true,
    "postgres": true,
    "rabbitmq": true,
    "redis": true
  },
  "status": "ok"
}

3. Evento benigno
json

{
  "event_type": "USER_LOGIN",
  "severity": "low",
  "processed": false
}

Sem incidente. Sem SOAR. Sem ruído.
4. Evento suspeito (payload ambíguo)

Payload ambíguo sem markers conhecidos → confidence local < 80 → chama detection-service → ML heurístico.
5. Evento malicioso
json

{
  "event_type": "MALWARE_DETECTED",
  "severity": "critical",
  "processed": true
}

Dispara:

    Regra local R-WEBSHELL (peso 0.9) → confidence 95

    Curto-circuito: ML não é chamado (economia de latência)

    Incidente criado: MALWARE DETECTED detected [T1486]

    SOAR: ISOLATE_HOST → UPDATE assets SET status='ISOLATED'

    Audit log: SOAR_ISOLATE_HOST

6. Estado final
text

Incidentes:
  21:58:17  MALWARE DETECTED detected [T1486]
  21:46:52  MALWARE DETECTED detected [T1486]

Assets isolados:
  srv-compromised-12345  ISOLATED    auto=true
  srv-unknown-99         ISOLATED    auto=true

Audit logs SOAR:
  21:58:17  SOAR_ISOLATE_HOST  srv-compromised-12345  source=LocalRules

7. Métricas Prometheus
text

sentinel_events_total 3
sentinel_detections_total 3
sentinel_detections_by_verdict{verdict="malicious"} 1
sentinel_detections_by_verdict{verdict="suspicious"} 1
sentinel_detections_by_verdict{verdict="benign"} 1
sentinel_detection_fallbacks_total 0

Acessos úteis
URL	Serviço
http://localhost:3000	Dashboard Next.js
http://localhost:8080/health/detailed	Gateway health
http://localhost:8080/metrics	Prometheus metrics
http://localhost:8090/health	detection-service
http://localhost:9090	Prometheus UI
http://localhost:15672	RabbitMQ (sentinel/sentinel)
Testes manuais
bash

# Evento benigno
curl -sS -X POST http://localhost:8080/api/events \
  -H 'Content-Type: application/json' \
  -d '{
    "source":"endpoint","severity":"low","event_type":"USER_LOGIN",
    "category":"identity","payload":{"user":"alice"}
  }' | jq .

# Evento malicioso com SOAR
curl -sS -X POST http://localhost:8080/api/events \
  -H 'Content-Type: application/json' \
  -d '{
    "source":"endpoint","severity":"critical","event_type":"MALWARE_DETECTED",
    "category":"endpoint","is_attack":true,"auto_remediate":true,
    "hostname":"srv-test","payload_text":"<?php system($_GET[\"cmd\"]); ?>",
    "mime":"application/x-php"
  }' | jq .

# Ver resultado
docker compose exec postgres psql -U sentinel -d sentinel_db -c "
  SELECT hostname, status FROM assets WHERE status='ISOLATED';"

Troubleshooting

Container reinicia:
bash

docker compose logs --tail 50 <nome-do-servico>

Gateway retorna 422:
payload é opcional (default {}). Se ainda rejeitar, verifique se a imagem é a correta:
bash

docker inspect sentinel-quantum-xdr-gateway-1 --format '{{.Image}}'
docker images sentinel-quantum-xdr-gateway --format '{{.ID}}'

Se diferentes:
bash

docker compose up -d --force-recreate gateway

detection-service não responde:
bash

docker compose exec gateway curl -fsS http://detection-service:8090/health

ml-inference sem modelo:
Esperado. Sem model.onnx, o serviço usa fallback heurístico. Para plugar modelo real, ver fase 3D no README.
