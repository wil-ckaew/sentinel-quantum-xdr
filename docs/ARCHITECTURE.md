# Arquitetura — Sentinel Quantum XDR

## Visão de alto nível

    ┌────────────────────────────────────────────────────────────────────┐
    │                          CLIENTES                                  │
    │   Endpoints (agente)  ·  Rede (sensor)  ·  Cloud (webhook)         │
    └───────────────────────────┬────────────────────────────────────────┘
                                │
                                │  POST /api/events
                                ▼
    ┌────────────────────────────────────────────────────────────────────┐
    │                       GATEWAY (Rust / Axum)                        │
    │                                                                    │
    │   ┌──────────────────┐    ┌──────────────────┐                     │
    │   │ events::handler  │───▶│ detection::      │                     │
    │   │                  │    │  classify_hybrid │                     │
    │   └────────┬─────────┘    └────────┬─────────┘                     │
    │            │                       │                               │
    │            │              ┌────────┴──────────┐                    │
    │            │              │                   │                    │
    │            │      local_rules          DetectionClient             │
    │            │      (microsseg)         (retry + breaker)            │
    │            │              │                   │                    │
    │            │              └────────┬──────────┘                    │
    │            │                       │                               │
    │            │                       ▼                               │
    │            │            ┌────────────────────┐                     │
    │            │            │ detection-service  │                     │
    │            │            │  (Rust)            │                     │
    │            │            │  • regras YARA-like│                     │
    │            │            │  • cliente ML      │                     │
    │            │            └─────────┬──────────┘                     │
    │            │                      │                                │
    │            │                      ▼                                │
    │            │            ┌────────────────────┐                     │
    │            │            │ ml-inference       │                     │
    │            │            │  (Python/FastAPI)  │                     │
    │            │            │  • ONNX runtime    │                     │
    │            │            │  • heurística      │                     │
    │            │            └────────────────────┘                     │
    │            │                                                       │
    │            ▼                                                       │
    │   ┌──────────────────────┐                                         │
    │   │ events::collector    │                                         │
    │   │  • INSERT event      │                                         │
    │   │  • threat intel      │                                         │
    │   │  • correlação 10min  │                                         │
    │   │  • incidente         │                                         │
    │   │  • SOAR              │                                         │
    │   └──────────┬───────────┘                                         │
    │              │                                                     │
    │              ├──▶ Postgres (eventos, incidentes, assets, audit)    │
    │              │                                                     │
    │              └──▶ RabbitMQ (3 exchanges)                           │
    │                                                                    │
    │   ┌──────────────────────┐                                         │
    │   │ services::metrics    │───▶ Prometheus                          │
    │   └──────────────────────┘                                         │
    └────────────────────────────────────────────────────────────────────┘

## Componentes

### Gateway (Rust / Axum 0.8)

Responsável por:
- Receber eventos via `POST /api/events`
- Rodar regras locais (síncronas, sem I/O)
- Fallback para `detection-service` (assíncrono, com resiliência)
- Persistir eventos, criar incidentes
- Executar SOAR automático (`ISOLATE_HOST`, `DISABLE_ACCOUNT`)
- Publicar em 3 canais RabbitMQ
- Expor métricas Prometheus em `/metrics`

Endpoints principais:

| Método | Path | Descrição |
|---|---|---|
| GET  | `/health` | Liveness |
| GET  | `/health/detailed` | Readiness (Postgres, Redis, Rabbit, detection-service) |
| GET  | `/metrics` | Prometheus |
| POST | `/api/events` | Ingestão + detecção + resposta |
| GET  | `/api/events` | Lista eventos recentes |
| POST | `/api/assets` | Cadastra asset |
| POST | `/api/incidents` | Cria incidente manual |
| POST | `/api/soar/action` | Dispara playbook |
| POST | `/api/threat-intel` | Cria indicador IOC |

### detection-service (Rust)

Micro-serviço **stateless** dedicado a detecção.

- Regras determinísticas rápidas (webshell, shell execution, persistência, MIME executável)
- Cliente HTTP para `ml-inference` (chamado só quando regras locais são inconclusivas)
- Combina score: `0.3 * local + 0.7 * ml`
- API: `POST /analyze`, `GET /health`

### ml-inference (Python / FastAPI)

Inferência ML isolada.

- Carrega modelo ONNX uma vez no startup
- Se `model.onnx` não existe, cai em heurística determinística baseada em entropia de histograma de bytes
- API: `POST /analyze`, `GET /health`, `GET /model`

### Postgres

Schema principal:
- `tenants` — multi-tenancy
- `users` — RBAC
- `assets` — inventário (hostname, OS, status, criticality, risk_score)
- `security_events` — eventos brutos
- `incidents` — incidentes criados por detecção
- `incident_events` — associação incident ↔ event
- `threat_indicators` — IOCs
- `audit_logs` — ações SOAR e administrativas

### RabbitMQ

3 exchanges tipo `topic`:

| Exchange | Routing keys | Consumidor |
|---|---|---|
| `sentinel.events` | `security.events` | Legado, ingestão crua |
| `sentinel.detection` | `detection.result` | Dashboards, analytics |
| `sentinel.detection` | `detection.alert` | SOAR externo, webhooks |

### Prometheus

Métricas expostas pelo gateway:

sentinel_events_total counter
sentinel_detections_total counter
sentinel_detections_by_verdict{verdict} counter
sentinel_detection_fallbacks_total counter
text


## Fluxo de detecção híbrida

    POST /api/events
      │
      ▼
    [1] métrica: EVENTS_TOTAL++
      │
      ▼
    [2] DetectionClient.analyze() ──── se confidence local >= 80
      │                                │
      │                                └──▶ LocalRules (fim)
      │
      ▼
    [3] circuit breaker aberto? ─── sim ──▶ LocalFallback (fim)
      │
      não
      │
      ▼
    [4] POST http://detection-service:8090/analyze
      │
      ├── sucesso ──▶ DetectionService (score combinado)
      │
      └── 3 falhas ──▶ LocalFallback + breaker abre 30s

## Decisões de design

| Decisão | Motivo |
|---|---|
| Regras locais primeiro, ML depois | Latência: regra local é microssegundos; ML é rede + CPU |
| Curto-circuito por `confidence >= 80` | Evita chamada de rede quando desnecessário |
| detection-service stateless | Escala horizontal trivial; sem estado a sincronizar |
| ml-inference separado do detection-service | ML evolui em Python; regras em Rust |
| Fallback heurístico no ml-inference | Serviço sobe sem modelo treinado |
| `incident.metadata` guarda MITRE | Sem migration para colunas derivadas |
| Circuit breaker em memória | Simples; distribuído é fase 4 |
| Publisher confirms no RabbitMQ | Garante entrega; sem perda silenciosa |
| Auto-registro de asset no SOAR | Fecha o ciclo para hosts desconhecidos |

## Fases

| Fase | Escopo | Status |
|---|---|---|
| 1 | Enxerto detection-service + ml-inference | ✅ |
| 2 | Pipeline híbrido end-to-end | ✅ |
| 3A | Retry + circuit breaker | ✅ |
| 3B | Reload event após processed | ✅ |
| 3C | SOAR auto-registra unknown host | ✅ |
| 3D | Modelo ONNX real | 🚧 |
| 4 | mTLS, retreino, breaker distribuído | 📋 |
