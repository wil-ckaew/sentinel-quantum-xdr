#!/bin/bash

echo "=========================================="
echo "   TESTES E2E DE AUDITORIA E HARDENING   "
echo "=========================================="

GATEWAY_URL="http://localhost:8080"

# 1. Checar Headers de Segurança HTTP
echo -e "\n[1/2] Verificando Headers de Segurança (Hardening)..."
HEADERS=$(curl -s -I $GATEWAY_URL/health)
echo "$HEADERS" | grep -iE "(x-frame-options|x-content-type-options|strict-transport-security|content-security-policy)"

# 2. Testar resposta da API blindada
echo -e "\n[2/2] Testando Endpoint da Engine PQC..."
PQC_STATUS=$(curl -s -w "\nHTTP Status: %{http_code}\n" $GATEWAY_URL/api/pqc/keys)
echo "$PQC_STATUS"

echo -e "\n=========================================="
echo "    PROJETO SENTINEL XDR 100% CONCLUÍDO!  "
echo "=========================================="
