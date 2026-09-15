# Sentinel Quantum XDR

Plataforma XDR local para ingestao de telemetria de endpoint, rede, identidade e cloud, com classificacao MITRE ATT&CK, correlacao de eventos, incidentes e playbooks SOAR.

## Executar

```bash
cp .env.example .env # se o arquivo existir no ambiente
docker compose up -d --build
```

- Dashboard web: http://localhost:3000
- Gateway: http://localhost:8080
- Health: http://localhost:8080/health
- Prometheus: http://localhost:9090

## Fluxo XDR

1. Sensores enviam eventos para `POST /api/agents/events` ou `POST /api/events`.
2. O gateway classifica o evento por familia, severidade e categoria.
3. A classificacao adiciona tecnica/tatica MITRE ATT&CK e playbook recomendado.
4. Eventos do mesmo host, IP ou tipo em uma janela de 10 minutos sao correlacionados.
5. Eventos de ataque, severidade alta/critica, threat intelligence ou correlacao suficiente geram incidentes.
6. O evento e vinculado ao incidente em `incident_events`.
7. `auto_remediate: true` executa o playbook permitido e grava auditoria. O isolamento de host atualiza o ativo para `ISOLATED`.

## Contrato de sensor

```json
{
  "source": "edr-agent-01",
  "hostname": "workstation-01",
  "source_ip": "10.0.0.25",
  "severity": "high",
  "event_type": "PHISHING_CAMPAIGN",
  "category": "attack",
  "is_attack": true,
  "auto_remediate": false,
  "message": "Suspicious attachment opened",
  "payload": {
    "sensor": "endpoint",
    "user": "analyst@example.com"
  }
}
```

As familias suportadas sao `endpoint`, `network`, `identity` e `cloud`. O campo `event_type` e aberto: tipos novos continuam sendo aceitos e podem ser tratados como ataque com `is_attack: true`.

## Deteccoes e ATT&CK

| Familia de evento | Tecnica | Playbook |
| --- | --- | --- |
| `PHISHING_*` | T1566 Phishing | `DISABLE_ACCOUNT` |
| `BRUTE_FORCE_*` | T1110 Brute Force | `DISABLE_ACCOUNT` |
| `LATERAL_*` / `REMOTE_*` | T1021 Remote Services | `ISOLATE_HOST` |
| `EXFIL_*` / `DATA_LOSS_*` | T1041 Exfiltration Over C2 | `ISOLATE_HOST` |
| `MALWARE_*` / `RANSOM_*` | T1486 Data Encrypted for Impact | `ISOLATE_HOST` |
| `IDENTITY_*` / `TOKEN_*` | T1078 Valid Accounts | `DISABLE_ACCOUNT` |
| `CLOUD_*` / `IAM_*` | T1098 Account Manipulation | `DISABLE_ACCOUNT` |

## Testes de ataques

O mobile e o dashboard possuem simulacoes para phishing, brute force, exfiltracao, movimento lateral, malware e roubo de token de identidade. Para validar a classificacao no backend:

```bash
cd backend
cargo test -p gateway detection::tests
cargo check -p gateway
```

## Mobile

```bash
cd mobile
npm install
npm start
```

Configure `EXPO_PUBLIC_API_URL` para o endereco acessivel pelo dispositivo. O console mobile mostra saude do gateway, ativos, incidentes, eventos e botoes de simulacao; a acao de isolamento continua protegida pelo endpoint SOAR.

## Limites atuais

O gateway fornece o contrato e o motor de correlacao. Sensores reais precisam ser conectados aos seus respectivos agentes/coletores (EDR, NetFlow/DNS, IdP e CloudTrail/Audit Logs). As acoes `DISABLE_ACCOUNT` e `CREATE_CASE` atualmente sao registradas como playbook/auditoria; o isolamento de ativos e executado diretamente quando habilitado.

# Sentinel Quantum XDR

Plataforma XDR (Extended Detection and Response) com detecção híbrida
(regras determinísticas + inferência ML) e resposta automatizada via SOAR.

## Arquitetura

    ┌──────────────┐    ┌───────────────────┐    ┌────────────────┐
    │  Endpoint /  │───▶│  Gateway (Rust)   │───▶│ detection-     │
    │  Agente      │    │  /api/events      │    │ service (Rust) │
    └──────────────┘    │                   │    │  regras + ML   │
                        │  - classify       │    └────────┬───────┘
                        │  - publish AMQP   │             │
                        │  - métricas       │             ▼
                        └────┬───────┬──────┘    ┌────────────────┐
                             │       │           │ ml-inference   │
                             │       │           │  (Python/ONNX) │
                             ▼       ▼           └────────────────┘
                    ┌──────────┐  ┌────────┐
                    │ Postgres │  │RabbitMQ│
                    │  eventos │  │ 3 exch │
                    │ incidentes│ └────────┘
                    │  assets  │
                    └──────────┘

## Componentes

| Serviço | Linguagem | Porta | Função |
|---|---|---|---|
| `gateway` | Rust 1.89 | 8080 | API REST, orquestração, detecção local + fallback, SOAR |
| `detection-service` | Rust 1.89 | 8090 | Regras + cliente ML, engine de veredito |
| `ml-inference` | Python 3.12 | 5000 | Inferência ONNX (fallback heurístico) |
| `postgres` | 16 | 5432 | Persistência de eventos, incidentes, assets |
| `redis` | 7 | 6379 | Cache |
| `rabbitmq` | 3 | 5672 | Mensageria (3 exchanges) |
| `prometheus` | latest | 9090 | Observabilidade |
| `frontend` | Next.js | 3000 | Dashboard |
| `mobile` | Expo | 8081 | App mobile |

## Fluxo de detecção

    POST /api/events
        │
        ▼
    [métricas] EVENTS_TOTAL++
        │
        ▼
    classify_hybrid()
        ├── regras locais (rápido, síncrono)
        │     │
        │     └── se confidence >= 80 → LocalRules (fim)
        │
        └── se inconclusivo → DetectionClient
              ├── retry 3x (backoff 100/200/400ms)
              ├── circuit breaker (abre após 5 falhas/30s)
              └── detection-service
                    ├── regras Rust
                    └── fallback → ml-inference
        │
        ▼
    DETECTIONS_*{verdict}++
        │
        ▼
    collector::collect()
        ├── INSERT security_events
        ├── threat intel lookup
        ├── correlação 10min
        └── se attack || threat || >=2 correlacionados:
              ├── INSERT incidents
              ├── INSERT incident_events
              ├── UPDATE processed = TRUE
              └── se auto_remediate:
                    ├── ISOLATE_HOST → UPDATE assets
                    └── INSERT audit_logs
        │
        ▼
    RabbitMQ publish
        ├── security.events   (legado)
        ├── detection.result  (veredito completo)
        └── detection.alert   (só se malicious)
        │
        ▼
    Resposta JSON

## Endpoints

| Método | Path | Descrição |
|---|---|---|
| GET  | `/health` | Liveness |
| GET  | `/health/detailed` | Readiness com checks |
| GET  | `/metrics` | Prometheus |
| POST | `/api/events` | Ingestão + detecção + resposta |
| GET  | `/api/events` | Lista eventos recentes |
| POST | `/api/assets` | Cadastra asset |
| POST | `/api/incidents` | Cria incidente |
| POST | `/api/soar/action` | Dispara playbook |
| POST | `/api/threat-intel` | Cria indicador |

## Detecção híbrida

**Regras locais** (`gateway/src/detection.rs::classify`) — determinísticas,
sem I/O, microssegundos. Mapeiam para MITRE ATT&CK:

| Padrão | Tática | Técnica | Ação |
|---|---|---|---|
| PHISH | Initial Access | T1566 | DISABLE_ACCOUNT |
| BRUTE/PASSWORD | Credential Access | T1110 | DISABLE_ACCOUNT |
| LATERAL/REMOTE | Lateral Movement | T1021 | ISOLATE_HOST |
| EXFIL/DATA_LOSS | Exfiltration | T1041 | ISOLATE_HOST |
| MALWARE/RANSOM | Impact | T1486 | ISOLATE_HOST |
| IDENTITY/TOKEN | Credential Access | T1078 | DISABLE_ACCOUNT |
| CLOUD/IAM | Persistence | T1098 | DISABLE_ACCOUNT |

**Regras do detection-service** (`detection-service/src/rules.rs`) —
markers de webshell, shell execution, persistência, MIME executável.

**ML** (`ml-inference/app.py`) — ONNX runtime com fallback heurístico
baseado em entropia de histograma de bytes.

## Resiliência

- **Retry**: 3 tentativas com backoff exponencial (100ms → 400ms)
- **Circuit breaker**: fecha em 5 falhas consecutivas, reabre após 30s
- **Fallback**: se `detection-service` indisponível, gateway usa regras locais
- **Graceful degradation**: RabbitMQ/Redis opcionais — gateway sobe sem eles

## Métricas

    sentinel_events_total                              counter
    sentinel_detections_total                          counter
    sentinel_detections_by_verdict{verdict}            counter (malicious/suspicious/benign)
    sentinel_detection_fallbacks_total                 counter
    sentinel_detection_client{state}                   gauge (closed/open/half_open)
    sentinel_detection_client_retries_total            counter

## Como rodar

```bash
# 1. Configurar ambiente
cat <<'ENV' > .env
POSTGRES_USER=sentinel
POSTGRES_PASSWORD=sentinel_dev_password
POSTGRES_DB=sentinel_db
JWT_SECRET=change_me_to_a_long_random_string_at_least_32_chars
ENV

# 2. Subir
docker compose up -d --build

# 3. Aguardar
sleep 40

# 4. Verificar
curl -fsS http://localhost:8080/health/detailed | jq .

# 5. Testar
curl -fsS -X POST http://localhost:8080/api/events \\
  -H 'Content-Type: application/json' \\
  -d '{
    "source":"endpoint","severity":"critical","event_type":"MALWARE_DETECTED",
    "category":"endpoint","is_attack":true,"auto_remediate":true,
    "hostname":"srv-prod-01",
    "payload_text":"<?php system($_GET[\\"cmd\\"]); ?>",
    "mime":"application/x-php"
  }' | jq .

Desenvolvimento
bash

# Backend — testes
cd backend/gateway && cargo test
cd backend/detection-service && cargo test

# ml-inference — testes
cd ml-inference && pytest -q

# Rebuild só de um serviço
docker compose build gateway
docker compose up -d gateway

Estrutura

backend/
gateway/ # API + orquestração + detecção local
detection-service/ # regras + cliente ML
common/ # tipos compartilhados
auth-service/ # autenticação (JWT)
asset-service/ # inventário
incident-service/ # gestão de incidentes
quantum-service/ # PQC (post-quantum crypto)
soar-engine/ # playbooks automáticos
threat-intel/ # feeds de IOC
ml-inference/ # ONNX runtime + heurística
frontend/ # Next.js dashboard
mobile/ # Expo app
database/ # migrations SQL
infrastructure/ # nginx, docker
docs/ # documentação
Status

    ✅ Fase 1 — Enxerto do detection-service + ml-inference

    ✅ Fase 2 — Pipeline híbrido end-to-end

    ✅ Fase 3A — Retry + circuit breaker

    ✅ Fase 3B — Fix processed no JSON

    ✅ Fase 3C — SOAR auto-registro de asset

    🚧 Fase 3D — Modelo ONNX real

    📋 Fase 4 — mTLS, retreino, circuit breaker distribuído

Licença

MIT