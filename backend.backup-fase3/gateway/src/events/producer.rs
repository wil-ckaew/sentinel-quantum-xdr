use anyhow::Result;
use lapin::{
    options::{
        BasicPublishOptions,
        ExchangeDeclareOptions,
    },
    types::FieldTable,
    BasicProperties,
    Channel,
    Connection,
    ConnectionProperties,
};

#[derive(Clone)]
pub struct RabbitProducer {
    channel: Channel,
}

impl RabbitProducer {

    pub async fn connect(
        url: &str,
    ) -> Result<Self> {

        let connection = Connection::connect(
            url,
            ConnectionProperties::default(),
        )
        .await?;

        let channel = connection
            .create_channel()
            .await?;

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

        Ok(Self {
            channel,
        })
    }

    pub async fn publish(
        &self,
        routing_key: &str,
        payload: String,
    ) -> Result<()> {

        self.channel
            .basic_publish(
                "sentinel.events",
                routing_key,
                BasicPublishOptions::default(),
                payload.as_bytes(),
                BasicProperties::default()
                    .with_content_type(
                        "application/json".into()
                    )
                    .with_delivery_mode(2),
            )
            .await?
            .await?;

        Ok(())
    }
}
