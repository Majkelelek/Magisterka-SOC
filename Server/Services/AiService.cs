using System.Text;
using System.Text.Json;
using Server.Models;

namespace Server.Services;

public class AiProcessResult
{
    public string ExtractedText { get; set; } = string.Empty;
    public string RawJson { get; set; } = string.Empty;
}

public class AiService
{
    private static readonly SemaphoreSlim _rateLimiter = new(1, 1);
    private static DateTime _lastRequestTime = DateTime.MinValue;
    private static readonly TimeSpan MinRequestInterval = TimeSpan.FromMilliseconds(1500);

    private readonly HttpClient _httpClient;
    private readonly AlertStore _alertStore;

    public AiService(AlertStore alertStore)
    {
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        _alertStore = alertStore;
    }

    public async Task<AiProcessResult> ProcessProviderQueryAsync(string provider, string modelType, string alertId, string prompt, string? customSystemMsg = null, string? ollamaModelName = null)
    {
        EnvLoader.Load();

        var prov = (provider ?? "openai").ToLowerInvariant();
        bool isBase = modelType.Equals("base", StringComparison.OrdinalIgnoreCase) || modelType.Equals("azure-base", StringComparison.OrdinalIgnoreCase);

        var alertContext = GetAlertContext(alertId);
        var systemMessage = customSystemMsg ?? @"Jesteś zaawansowanym asystentem SOC Sentinel. Twoim zadaniem jest przeanalizowanie przepływu sieciowego (NetFlow) i klasyfikacja zdarzenia oraz podanie rekomendowanej akcji (Isolation, Escalation, Dismiss).";
        var userContent = $"{alertContext}\n\n[PYTANIE OPERATORA SOC]\n{prompt}";

        switch (prov)
        {
            case "gemini":
                return await ProcessGeminiQueryAsync(isBase, userContent, systemMessage);
            case "deepseek":
                return await ProcessDeepSeekQueryAsync(isBase, userContent, systemMessage);
            case "anthropic":
            case "claude":
                return await ProcessAnthropicQueryAsync(isBase, userContent, systemMessage);
            case "ollama":
                return await ProcessOllamaQueryAsync(isBase, userContent, systemMessage, ollamaModelName ?? "llama3.2");
            case "openai":
            default:
                return await ProcessAzureOpenAiQueryAsync(isBase, alertId, prompt, userContent, systemMessage);
        }
    }

    private async Task<AiProcessResult> ProcessAzureOpenAiQueryAsync(bool isBaseRequest, string alertId, string prompt, string userContent, string systemMessage)
    {
        var endpoint = isBaseRequest
            ? (Environment.GetEnvironmentVariable("AZURE_BASE_ENDPOINT") ?? Environment.GetEnvironmentVariable("AZURE_AI_ENDPOINT") ?? "https://magisterkasoc.services.ai.azure.com/openai/v1/responses")
            : (Environment.GetEnvironmentVariable("AZURE_AI_ENDPOINT") ?? Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT") ?? Environment.GetEnvironmentVariable("AI_ENDPOINT") ?? "https://magisterkasoc.services.ai.azure.com/openai/v1/responses");

        var apiKey = isBaseRequest
            ? (Environment.GetEnvironmentVariable("AZURE_BASE_KEY") ?? Environment.GetEnvironmentVariable("AZURE_AI_KEY"))
            : (Environment.GetEnvironmentVariable("AZURE_AI_KEY") ?? Environment.GetEnvironmentVariable("AZURE_OPENAI_KEY") ?? Environment.GetEnvironmentVariable("AI_API_KEY") ?? Environment.GetEnvironmentVariable("AI_KEY"));

        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Equals("your_azure_ai_key_here", StringComparison.OrdinalIgnoreCase))
        {
            var msg = $"[Azure OpenAI Backend] Uzupełnij klucz API w pliku .env:\n{(isBaseRequest ? "AZURE_BASE_KEY" : "AZURE_AI_KEY")}=twój_klucz_azure";
            return new AiProcessResult { ExtractedText = msg, RawJson = msg };
        }

        await _rateLimiter.WaitAsync();
        try
        {
            var elapsed = DateTime.UtcNow - _lastRequestTime;
            if (elapsed < MinRequestInterval)
            {
                await Task.Delay(MinRequestInterval - elapsed);
            }
            _lastRequestTime = DateTime.UtcNow;

            var modelName = isBaseRequest 
                        ? (Environment.GetEnvironmentVariable("AZURE_BASE_MODEL") ?? "gpt-4o-mini")
                        : (Environment.GetEnvironmentVariable("AZURE_AI_MODEL") ?? Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT") ?? "gpt-4o-mini-2024-07-18-SOC_1");

            var requestBody = new
            {
                model = modelName,
                temperature = 0.0,
                input = new object[]
                {
                    new { role = "system", content = systemMessage },
                    new { role = "user", content = userContent }
                }
            };

            int maxRetries = 4;
            int delayMs = 1500;

            for (int attempt = 0; attempt <= maxRetries; attempt++)
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
                request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

                request.Headers.TryAddWithoutValidation("api-key", apiKey);
                request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {apiKey}");

                var response = await _httpClient.SendAsync(request);

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests ||
                    response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable)
                {
                    if (attempt < maxRetries)
                    {
                        await Task.Delay(delayMs);
                        delayMs += 1500;
                        continue;
                    }

                    var err = $"[Błąd Azure AI Rate Limit ({response.StatusCode})] Przekroczono limit żądań.";
                    return new AiProcessResult { ExtractedText = err, RawJson = err };
                }

                if (!response.IsSuccessStatusCode)
                {
                    var errText = await response.Content.ReadAsStringAsync();
                    var err = $"[Błąd Azure OpenAI ({response.StatusCode})] Szczegóły: {errText}";
                    return new AiProcessResult { ExtractedText = err, RawJson = errText };
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                var extractedAnswer = ExtractAnswerFromJson(responseJson);

                return new AiProcessResult
                {
                    ExtractedText = string.IsNullOrWhiteSpace(extractedAnswer) ? "[Azure OpenAI] Pusta odpowiedź od modelu." : extractedAnswer,
                    RawJson = responseJson
                };
            }

            return new AiProcessResult { ExtractedText = "[Błąd Azure AI Timeout]", RawJson = "[Timeout]" };
        }
        catch (Exception ex)
        {
            return new AiProcessResult { ExtractedText = $"[Błąd Azure OpenAI API] Wyjątek: {ex.Message}", RawJson = ex.Message };
        }
        finally
        {
            _rateLimiter.Release();
        }
    }

    private async Task<AiProcessResult> ProcessGeminiQueryAsync(bool isBase, string userContent, string systemMessage)
    {
        var apiKey = Environment.GetEnvironmentVariable("GEMINI_AI_KEY") ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Contains("your_"))
        {
            var msg = "[Błąd Google Gemini API] Brak klucza API w konfiguracji. Dodaj swój klucz w pliku .env:\nGEMINI_AI_KEY=twój_klucz_gemini";
            return new AiProcessResult { ExtractedText = msg, RawJson = msg };
        }

        var modelName = isBase
            ? (Environment.GetEnvironmentVariable("GEMINI_BASE_MODEL") ?? "gemini-1.5-flash")
            : (Environment.GetEnvironmentVariable("GEMINI_FT_MODEL") ?? "gemini-1.5-flash-ft");

        var customEndpoint = Environment.GetEnvironmentVariable("GEMINI_AI_ENDPOINT");
        var endpoint = !string.IsNullOrWhiteSpace(customEndpoint)
            ? customEndpoint
            : $"https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent?key={apiKey}";

        var requestBody = new
        {
            contents = new object[]
            {
                new
                {
                    role = "user",
                    parts = new object[]
                    {
                        new { text = $"{systemMessage}\n\n{userContent}" }
                    }
                }
            }
        };

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            var responseJson = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                return new AiProcessResult { ExtractedText = $"[Błąd Google Gemini API ({response.StatusCode})] {responseJson}", RawJson = responseJson };
            }

            using var doc = JsonDocument.Parse(responseJson);
            if (doc.RootElement.TryGetProperty("candidates", out var candidates) && candidates.ValueKind == JsonValueKind.Array && candidates.GetArrayLength() > 0)
            {
                var first = candidates[0];
                if (first.TryGetProperty("content", out var cnt) && cnt.TryGetProperty("parts", out var parts) && parts.ValueKind == JsonValueKind.Array && parts.GetArrayLength() > 0)
                {
                    var text = parts[0].TryGetProperty("text", out var tProp) ? tProp.GetString() ?? "" : "";
                    return new AiProcessResult { ExtractedText = text, RawJson = responseJson };
                }
            }

            return new AiProcessResult { ExtractedText = responseJson, RawJson = responseJson };
        }
        catch (Exception ex)
        {
            return new AiProcessResult { ExtractedText = $"[Wyjątek Gemini API] {ex.Message}", RawJson = ex.Message };
        }
    }

    private async Task<AiProcessResult> ProcessDeepSeekQueryAsync(bool isBase, string userContent, string systemMessage)
    {
        var apiKey = Environment.GetEnvironmentVariable("DEEPSEEK_AI_KEY") ?? Environment.GetEnvironmentVariable("DEEPSEEK_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Contains("your_"))
        {
            var msg = "[Błąd DeepSeek API] Brak klucza API w konfiguracji. Dodaj swój klucz w pliku .env:\nDEEPSEEK_AI_KEY=twój_klucz_deepseek";
            return new AiProcessResult { ExtractedText = msg, RawJson = msg };
        }

        var modelName = isBase
            ? (Environment.GetEnvironmentVariable("DEEPSEEK_BASE_MODEL") ?? "deepseek-chat")
            : (Environment.GetEnvironmentVariable("DEEPSEEK_FT_MODEL") ?? "deepseek-chat-ft");

        var endpoint = Environment.GetEnvironmentVariable("DEEPSEEK_AI_ENDPOINT") ?? Environment.GetEnvironmentVariable("DEEPSEEK_ENDPOINT") ?? "https://api.deepseek.com/chat/completions";

        var requestBody = new
        {
            model = modelName,
            temperature = 0.0,
            messages = new object[]
            {
                new { role = "system", content = systemMessage },
                new { role = "user", content = userContent }
            }
        };

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {apiKey}");

            var response = await _httpClient.SendAsync(request);
            var responseJson = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                return new AiProcessResult { ExtractedText = $"[Błąd DeepSeek API ({response.StatusCode})] {responseJson}", RawJson = responseJson };
            }

            var extracted = ExtractAnswerFromJson(responseJson);
            return new AiProcessResult { ExtractedText = extracted, RawJson = responseJson };
        }
        catch (Exception ex)
        {
            return new AiProcessResult { ExtractedText = $"[Wyjątek DeepSeek API] {ex.Message}", RawJson = ex.Message };
        }
    }

    private async Task<AiProcessResult> ProcessAnthropicQueryAsync(bool isBase, string userContent, string systemMessage)
    {
        var apiKey = Environment.GetEnvironmentVariable("ANTHROPIC_AI_KEY") ?? Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY") ?? Environment.GetEnvironmentVariable("CLAUDE_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Contains("your_"))
        {
            var msg = "[Błąd Anthropic Claude API] Brak klucza API w konfiguracji. Dodaj swój klucz w pliku .env:\nANTHROPIC_AI_KEY=twój_klucz_anthropic";
            return new AiProcessResult { ExtractedText = msg, RawJson = msg };
        }

        var modelName = isBase
            ? (Environment.GetEnvironmentVariable("CLAUDE_BASE_MODEL") ?? "claude-3-5-sonnet-20241022")
            : (Environment.GetEnvironmentVariable("CLAUDE_FT_MODEL") ?? "claude-3-5-sonnet-ft");

        var endpoint = Environment.GetEnvironmentVariable("ANTHROPIC_AI_ENDPOINT") ?? "https://api.anthropic.com/v1/messages";

        var requestBody = new
        {
            model = modelName,
            max_tokens = 1024,
            system = systemMessage,
            messages = new object[]
            {
                new { role = "user", content = userContent }
            }
        };

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            request.Headers.TryAddWithoutValidation("x-api-key", apiKey);
            request.Headers.TryAddWithoutValidation("anthropic-version", "2023-06-01");

            var response = await _httpClient.SendAsync(request);
            var responseJson = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                return new AiProcessResult { ExtractedText = $"[Błąd Anthropic Claude API ({response.StatusCode})] {responseJson}", RawJson = responseJson };
            }

            using var doc = JsonDocument.Parse(responseJson);
            if (doc.RootElement.TryGetProperty("content", out var contentArr) && contentArr.ValueKind == JsonValueKind.Array && contentArr.GetArrayLength() > 0)
            {
                var text = contentArr[0].TryGetProperty("text", out var tProp) ? tProp.GetString() ?? "" : "";
                return new AiProcessResult { ExtractedText = text, RawJson = responseJson };
            }

            return new AiProcessResult { ExtractedText = responseJson, RawJson = responseJson };
        }
        catch (Exception ex)
        {
            return new AiProcessResult { ExtractedText = $"[Wyjątek Anthropic API] {ex.Message}", RawJson = ex.Message };
        }
    }

    private async Task<AiProcessResult> ProcessOllamaQueryAsync(bool isBase, string userContent, string systemMessage, string modelName)
    {
        var targetModel = isBase ? modelName : (modelName.Contains(":") ? modelName : $"{modelName}:ft");
        var ollamaUrl = Environment.GetEnvironmentVariable("OLLAMA_ENDPOINT") ?? "http://localhost:11434/api/chat";

        var chatRequestBody = new
        {
            model = targetModel,
            temperature = 0.0,
            messages = new object[]
            {
                new { role = "system", content = systemMessage },
                new { role = "user", content = userContent }
            },
            stream = false
        };

        try
        {
            var jsonContent = new StringContent(JsonSerializer.Serialize(chatRequestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(ollamaUrl, jsonContent);

            if (!response.IsSuccessStatusCode)
            {
                var errStr = await response.Content.ReadAsStringAsync();
                return new AiProcessResult
                {
                    ExtractedText = $"[Błąd Ollama ({response.StatusCode})] Upewnij się, że lokalna instancja Ollama działa na {ollamaUrl} i pobrano model '{targetModel}'.",
                    RawJson = errStr
                };
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            using var chatDoc = JsonDocument.Parse(responseJson);
            if (chatDoc.RootElement.TryGetProperty("message", out var msgProp) && msgProp.TryGetProperty("content", out var contentProp))
            {
                var content = contentProp.GetString() ?? "";
                return new AiProcessResult { ExtractedText = content, RawJson = responseJson };
            }

            return new AiProcessResult { ExtractedText = responseJson, RawJson = responseJson };
        }
        catch (Exception ex)
        {
            return new AiProcessResult
            {
                ExtractedText = $"[Błąd Połączenia Ollama] Brak połączenia z lokalną Ollamą (http://localhost:11434). Wyjątek: {ex.Message}",
                RawJson = ex.Message
            };
        }
    }

    public async Task<AiProcessResult> ProcessQueryAsync(string alertId, string prompt, string? specificModel = null)
    {
        return await ProcessProviderQueryAsync("openai", specificModel == "gpt-4o-mini" ? "base" : "ft", alertId, prompt);
    }

    private string GetAlertContext(string alertId)
    {
        var alert = FindAlert(alertId);
        if (alert == null) return $"[KONTEKST ALERTU ID: {alertId}] Identyfikator alertu przekazany przez użytkownika.";

        var sb = new StringBuilder();
        sb.AppendLine($"[KONTEKST ALERTU SOC: {alert.Id}]");
        sb.AppendLine($"Tytuł: {alert.Title}");
        sb.AppendLine($"Poziom Threat/Severity: {alert.Severity}");
        sb.AppendLine($"Kategoria: {alert.Category}");
        sb.AppendLine($"IP Źródłowe: {alert.SourceIp}");
        sb.AppendLine($"Host Docelowy: {alert.DestinationHost}");
        sb.AppendLine($"Konto Użytkownika: {alert.UserAccount}");
        if (!string.IsNullOrWhiteSpace(alert.MitreTechnique)) sb.AppendLine($"Technika MITRE: {alert.MitreTechnique}");
        sb.AppendLine($"Opis Incydentu: {alert.Description}");
        if (alert.RawLogs != null && alert.RawLogs.Count > 0)
        {
            sb.AppendLine("Powiązane Logi Zdarzeń:");
            foreach (var log in alert.RawLogs.Take(5)) sb.AppendLine($" - {log}");
        }

        return sb.ToString();
    }

    private Alert? FindAlert(string alertId)
    {
        var alert = _alertStore.GetAlertById(alertId);
        if (alert != null) return alert;

        try
        {
            string path = Path.Combine(Directory.GetCurrentDirectory(), "Data", "test_pytania.json");
            if (!File.Exists(path)) path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "test_pytania.json");

            if (File.Exists(path))
            {
                var text = File.ReadAllText(path);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var fileAlerts = JsonSerializer.Deserialize<List<Alert>>(text, options);
                var match = fileAlerts?.FirstOrDefault(a => a.Id.Equals(alertId, StringComparison.OrdinalIgnoreCase));
                if (match != null) return match;
            }
        }
        catch { }

        return null;
    }

    private string ExtractAnswerFromJson(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // 1. Schema Azure Responses API: output[0].content[0].text
            if (root.TryGetProperty("output", out var outputElem) && outputElem.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in outputElem.EnumerateArray())
                {
                    if (item.TryGetProperty("content", out var contentArr) && contentArr.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var c in contentArr.EnumerateArray())
                        {
                            if (c.TryGetProperty("text", out var textProp))
                            {
                                var txt = textProp.GetString();
                                if (!string.IsNullOrWhiteSpace(txt)) return txt;
                            }
                        }
                    }
                }
            }

            // 2. Schema OpenAI Chat Completions: choices[0].message.content
            if (root.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array && choices.GetArrayLength() > 0)
            {
                var firstChoice = choices[0];
                if (firstChoice.TryGetProperty("message", out var message) && message.TryGetProperty("content", out var content))
                {
                    var result = content.GetString();
                    if (!string.IsNullOrWhiteSpace(result)) return result;
                }
                if (firstChoice.TryGetProperty("text", out var text))
                {
                    var result = text.GetString();
                    if (!string.IsNullOrWhiteSpace(result)) return result;
                }
            }

            // 3. Direct string response or output object
            if (root.TryGetProperty("output", out var output))
            {
                if (output.ValueKind == JsonValueKind.String) return output.GetString()!;
                if (output.ValueKind == JsonValueKind.Object && output.TryGetProperty("text", out var outputText)) return outputText.GetString()!;
            }

            if (root.TryGetProperty("response", out var respStr) && respStr.ValueKind == JsonValueKind.String)
            {
                return respStr.GetString()!;
            }

            if (root.TryGetProperty("content", out var cntStr) && cntStr.ValueKind == JsonValueKind.String)
            {
                return cntStr.GetString()!;
            }
        }
        catch { }

        return json;
    }
}
