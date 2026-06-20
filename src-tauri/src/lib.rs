use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Greetings from Tauri.", name)
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct KeyValue {
    key: String,
    value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpRequestPayload {
    method: String,
    url: String,
    headers: Vec<KeyValue>,
    body: Option<String>,
    timeout_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpResponsePayload {
    status: u16,
    time_ms: u64,
    size_bytes: usize,
    body: String,
    headers: Vec<KeyValue>,
}

#[tauri::command]
async fn send_http_request(request: HttpRequestPayload) -> Result<HttpResponsePayload, String> {
    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|err| format!("Invalid method: {err}"))?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(request.timeout_ms))
        .build()
        .map_err(|err| format!("Failed to build client: {err}"))?;

    let mut builder = client.request(method, &request.url);
    for header in &request.headers {
        builder = builder.header(&header.key, &header.value);
    }
    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let start = Instant::now();
    let response = builder
        .send()
        .await
        .map_err(|err| format!("Request failed: {err}"))?;

    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .map(|(name, value)| KeyValue {
            key: name.to_string(),
            value: value.to_str().unwrap_or_default().to_string(),
        })
        .collect();
    let body = response
        .text()
        .await
        .map_err(|err| format!("Failed to read response body: {err}"))?;
    let time_ms = start.elapsed().as_millis() as u64;
    let size_bytes = body.len();

    Ok(HttpResponsePayload {
        status,
        time_ms,
        size_bytes,
        body,
        headers,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet, send_http_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_greet_with_name_when_given_one() {
        assert_eq!(greet("World"), "Hello, World! Greetings from Tauri.");
    }

    #[test]
    fn should_greet_with_empty_name_when_name_is_blank() {
        assert_eq!(greet(""), "Hello, ! Greetings from Tauri.");
    }

    #[test]
    fn should_deserialize_the_wire_request_from_the_frontend_camel_case_shape() {
        let json = r#"{
            "method": "POST",
            "url": "https://postman-echo.com/post",
            "headers": [{ "key": "X-Test", "value": "1" }],
            "body": "{\"a\":1}",
            "auth": { "type": "none" },
            "timeoutMs": 5000
        }"#;

        let parsed: HttpRequestPayload = serde_json::from_str(json).unwrap();

        assert_eq!(parsed.method, "POST");
        assert_eq!(parsed.url, "https://postman-echo.com/post");
        assert_eq!(parsed.headers.len(), 1);
        assert_eq!(parsed.headers[0].key, "X-Test");
        assert_eq!(parsed.body.as_deref(), Some("{\"a\":1}"));
        assert_eq!(parsed.timeout_ms, 5000);
    }

    #[test]
    fn should_deserialize_a_null_body_as_none() {
        let json = r#"{
            "method": "GET",
            "url": "https://postman-echo.com/get",
            "headers": [],
            "body": null,
            "timeoutMs": 30000
        }"#;

        let parsed: HttpRequestPayload = serde_json::from_str(json).unwrap();

        assert!(parsed.body.is_none());
    }

    #[test]
    fn should_serialize_the_response_to_the_frontend_camel_case_shape() {
        let payload = HttpResponsePayload {
            status: 200,
            time_ms: 142,
            size_bytes: 18,
            body: "{\"ok\":true}".to_string(),
            headers: vec![KeyValue {
                key: "Content-Type".to_string(),
                value: "application/json".to_string(),
            }],
        };

        let json = serde_json::to_value(&payload).unwrap();

        assert_eq!(json["status"], 200);
        assert_eq!(json["timeMs"], 142);
        assert_eq!(json["sizeBytes"], 18);
        assert_eq!(json["body"], "{\"ok\":true}");
        assert_eq!(json["headers"][0]["key"], "Content-Type");
    }
}
