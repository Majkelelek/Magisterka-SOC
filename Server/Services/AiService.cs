using System.Text;
using System.Text.Json;
using Server.Models;

namespace Server.Services;

public class AiService
{
    private static readonly SemaphoreSlim _rateLimiter = new(1, 1);
    private static DateTime _lastRequestTime = DateTime.MinValue;
    private static readonly TimeSpan MinRequestInterval = TimeSpan.FromMilliseconds(600);

    private readonly HttpClient _httpClient;
    private readonly AlertStore _alertStore;

    public AiService(AlertStore alertStore)
    {
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        _alertStore = alertStore;
    }

    public async Task<string> ProcessQueryAsync(string alertId, string prompt)
    {
        EnvLoader.Load();

        var endpoint = Environment.GetEnvironmentVariable("AZURE_AI_ENDPOINT")
                       ?? Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT")
                       ?? Environment.GetEnvironmentVariable("AI_ENDPOINT")
                       ?? "https://magisterkasoc.services.ai.azure.com/openai/v1/responses";

        var apiKey = Environment.GetEnvironmentVariable("AZURE_AI_KEY")
                     ?? Environment.GetEnvironmentVariable("AZURE_OPENAI_KEY")
                     ?? Environment.GetEnvironmentVariable("AI_API_KEY")
                     ?? Environment.GetEnvironmentVariable("AI_KEY");

        // Jeśli klucz API nie został wprowadzony lub ma domyślną wartość zastępczą
        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Equals("your_azure_ai_key_here", StringComparison.OrdinalIgnoreCase))
        {
            return $"[AI Backend] Punkt końcowy Azure AI '{endpoint}' jest podłączony i zabezpieczony.\n\nAby uzyskać autentyczną odpowiedź przetrenowanego modelu (fine-tuned), dodaj swój klucz do pliku .env:\nAZURE_AI_KEY=twój_prawdziwy_klucz_api";
        }

        // Zabezpieczenie przed przeciążeniem (Throttling & Concurrency Rate-Limiting)
        await _rateLimiter.WaitAsync();
        try
        {
            var elapsed = DateTime.UtcNow - _lastRequestTime;
            if (elapsed < MinRequestInterval)
            {
                await Task.Delay(MinRequestInterval - elapsed);
            }
            _lastRequestTime = DateTime.UtcNow;

            var modelName = Environment.GetEnvironmentVariable("AZURE_AI_MODEL")
                         ?? Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT")
                         ?? Environment.GetEnvironmentVariable("AZURE_MODEL_NAME")
                         ?? "gpt-4o-mini-2024-07-18-SOC_1";

            var alertContext = GetAlertContext(alertId);

            var systemMessage = "Jesteś zaawansowanym dostrojonym (fine-tuned) asystentem SOC Sentinel. Analizujesz alerty bezpieczeństwa i udzielasz zwięzłych, trafnych i profesjonalnych odpowiedzi dla analityka bezpieczeństwa. W swojej analizie podaj ocenę ryzyka, rekomendowaną akcję oraz procentowy wskaźnik pewności oceny na końcu odpowiedzi w formacie: PEWNOŚĆ AI: XX% (np. PEWNOŚĆ AI: 95%).";
            var combinedInput = $"{systemMessage}\n\n{alertContext}\n\n[PYTANIE OPERATORA SOC]\n{prompt}";

            Console.WriteLine($"\n==================== [PROMPT WYSYŁANY DO AI] ====================");
            Console.WriteLine($"ENDPOINT: {endpoint}");
            Console.WriteLine($"MODEL: {modelName}");
            Console.WriteLine($"ALERT ID: {alertId}");
            Console.WriteLine($"TREŚĆ WYSŁANA DO MODELU:\n{combinedInput}");
            Console.WriteLine($"=================================================================\n");

            var requestBody = new Dictionary<string, object>
            {
                ["model"] = modelName,
                ["input"] = combinedInput
            };

            var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Content = jsonContent;

            // Obie formy nagłówków uwierzytelniających dla pełnej kompatybilności z Azure OpenAI i usługami AI
            request.Headers.TryAddWithoutValidation("api-key", apiKey);
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {apiKey}");

            var response = await _httpClient.SendAsync(request);

            if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            {
                return "[Błąd AI Rate Limit (429)] Przekroczono dopuszczalny limit żądań do modelu AI w jednostce czasu. Odczekaj chwilę i ponów zapytanie.";
            }

            if (!response.IsSuccessStatusCode)
            {
                var errText = await response.Content.ReadAsStringAsync();
                return $"[Błąd punktu końcowego AI ({response.StatusCode})] Nie udało się uzyskać odpowiedzi z modelu. Szczegóły: {errText}";
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            var extractedAnswer = ExtractAnswerFromJson(responseJson);

            return string.IsNullOrWhiteSpace(extractedAnswer)
                ? "[AI Backend] Otrzymano pustą odpowiedź od modelu AI."
                : extractedAnswer;
        }
        catch (TaskCanceledException)
        {
            return "[Błąd AI Limit Czasu] Przekroczono czas oczekiwania (timeout) na odpowiedź z punktu końcowego Azure AI.";
        }
        catch (Exception ex)
        {
            return $"[Błąd Usługi AI] Wystąpił wyjątek podczas komunikacji z punktem końcowym Azure AI: {ex.Message}";
        }
        finally
        {
            _rateLimiter.Release();
        }
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
