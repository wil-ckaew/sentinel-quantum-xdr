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