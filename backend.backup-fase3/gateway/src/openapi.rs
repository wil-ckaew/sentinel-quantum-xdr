pub mod api {
    use utoipa::OpenApi;

    #[derive(OpenApi)]
    #[openapi(
        info(
            title = "Sentinel Quantum XDR",
            version = "4.0.0"
        )
    )]
    pub struct ApiDoc;
}
