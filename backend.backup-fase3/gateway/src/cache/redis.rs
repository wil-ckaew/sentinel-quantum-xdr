use anyhow::Result;
use redis::{
    aio::MultiplexedConnection,
    AsyncCommands,
    Client,
};

#[derive(Clone)]
pub struct RedisCache {
    client: Client,
}

impl RedisCache {

    pub fn new(
        url: &str,
    ) -> Result<Self> {

        let client = Client::open(url)?;

        Ok(Self {
            client,
        })
    }

    async fn connection(
        &self,
    ) -> Result<MultiplexedConnection> {

        Ok(
            self.client
                .get_multiplexed_async_connection()
                .await?
        )
    }

    pub async fn set(
        &self,
        key: &str,
        value: &str,
        expiration: u64,
    ) -> Result<()> {

        let mut connection =
            self.connection().await?;

        let _: () = connection
            .set_ex(
                key,
                value,
                expiration,
            )
            .await?;

        Ok(())
    }

    pub async fn get(
        &self,
        key: &str,
    ) -> Result<Option<String>> {

        let mut connection =
            self.connection().await?;

        let value =
            connection.get(key).await?;

        Ok(value)
    }

    pub async fn delete(
        &self,
        key: &str,
    ) -> Result<()> {

        let mut connection =
            self.connection().await?;

        let _: () =
            connection.del(key).await?;

        Ok(())
    }
}
