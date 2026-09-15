// backend/gateway/src/events/producer.rs
use anyhow::Result;
use lapin::{
    options::{BasicPublishOptions, ConfirmSelectOptions, ExchangeDeclareOptions},
    types::FieldTable,
    BasicProperties, Channel, Connection, ConnectionProperties,
};

#[derive(Clone)]
pub struct RabbitProducer {
    channel: Channel,
}

impl RabbitProducer {
    pub async fn connect(url: &str) -> Result<Self> {
        let connection = Connection::connect(url, ConnectionProperties::default()).await?;

        let channel = connection.create_channel().await?;

        // Exchange principal de eventos
        channel
            .exchange_declare(
                "sentinel.events",
                lapin::ExchangeKind::Topic,
                ExchangeDeclareOptions {
                    durable: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await?;

        // Exchange dedicado a resultados de deteccao (fase 2)
        channel
            .exchange_declare(
                "sentinel.detection",
                lapin::ExchangeKind::Topic,
                ExchangeDeclareOptions {
                    durable: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await?;

        // Habilita publisher confirms — garante que o broker recebeu a mensagem.
        channel.confirm_select(ConfirmSelectOptions::default()).await?;

        Ok(Self { channel })
    }

    /// Publica em `sentinel.events` (canal legado, mantido para compatibilidade).
    pub async fn publish(&self, routing_key: &str, payload: String) -> Result<()> {
        self.publish_on("sentinel.events", routing_key, payload).await
    }

    /// Publica em `sentinel.detection` (canal novo, fase 2).
    pub async fn publish_detection(&self, routing_key: &str, payload: String) -> Result<()> {
        self.publish_on("sentinel.detection", routing_key, payload)
            .await
    }

    /// Publica em um exchange arbitrario com confirmacao.
    pub async fn publish_on(
        &self,
        exchange: &str,
        routing_key: &str,
        payload: String,
    ) -> Result<()> {
        let confirm = self
            .channel
            .basic_publish(
                exchange,
                routing_key,
                BasicPublishOptions::default(),
                payload.as_bytes(),
                BasicProperties::default()
                    .with_content_type("application/json".into())
                    .with_delivery_mode(2), // persistent
            )
            .await?
            .await?; // aguarda confirmacao do broker

        if !confirm.is_ack() {
            anyhow::bail!(
                "broker rejected message on exchange={} routing_key={}",
                exchange,
                routing_key
            );
        }

        Ok(())
    }
}
