use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Sentinel Quantum XDR API",
        version = "4.0.0",
        description = "Enterprise XDR/SIEM Security Platform"
    )
)]
pub struct ApiDoc;
