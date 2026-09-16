# Makefile — treino e verificação do modelo ONNX.
#
# Uso:
#   make train              # treina (5000 amostras por classe)
#   make train-large        # treina (20000 amostras por classe)
#   make verify             # valida o ONNX
#   make deploy             # rebuild + redeploy do container
#   make all                # train + verify + deploy
#   make clean              # remove modelo e métricas

IMAGE_TRAIN := sentinel-ml-train
MODEL       := models/model.onnx
METRICS     := models/metrics.json

.PHONY: help train train-large verify deploy all clean

help:
	@echo "Targets:"
	@echo "  train         treina modelo (5000/classe)"
	@echo "  train-large   treina modelo (20000/classe)"
	@echo "  verify        valida o ONNX exportado"
	@echo "  deploy        rebuild + redeploy do container ml-inference"
	@echo "  all           train + verify + deploy"
	@echo "  clean         remove $(MODEL) e $(METRICS)"

$(IMAGE_TRAIN):
	docker build -f Dockerfile.train -t $(IMAGE_TRAIN) .

train: $(IMAGE_TRAIN)
	@echo "==> Treinando modelo (5000/classe)..."
	docker run --rm \
		-v "$(PWD)/models:/app/models" \
		$(IMAGE_TRAIN) \
		python train.py --samples 5000 --epochs 60 --output models/model.onnx

train-large: $(IMAGE_TRAIN)
	@echo "==> Treinando modelo (20000/classe)..."
	docker run --rm \
		-v "$(PWD)/models:/app/models" \
		$(IMAGE_TRAIN) \
		python train.py --samples 20000 --output models/model.onnx

verify:
	@echo "==> Verificando ONNX..."
	docker run --rm \
		-v "$(PWD)/models:/app/models:ro" \
		-v "$(PWD)/verify.py:/app/verify.py:ro" \
		$(IMAGE_TRAIN) \
		python verify.py models/model.onnx

deploy:
	@echo "==> Rebuild + redeploy do ml-inference..."
	cd .. && docker compose build --no-cache ml-inference && \
	         docker compose up -d --force-recreate ml-inference
	@echo "==> Aguardando healthcheck..."
	@for i in $$(seq 1 30); do \
	  if docker compose -f ../docker-compose.yml exec -T ml-inference \
	     curl -fsS http://localhost:5000/health >/dev/null 2>&1; then \
	    echo "✔ ml-inference pronto"; break; \
	  fi; sleep 1; done

all: train verify deploy

clean:
	rm -f $(MODEL) $(METRICS)
	@echo "✔ limpo"
