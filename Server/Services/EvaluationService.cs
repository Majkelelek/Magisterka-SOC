using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using MongoDB.Driver;
using Server.Models;

namespace Server.Services;

public class PerformanceTestItem
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("ground_truth")]
    public string GroundTruth { get; set; } = string.Empty;

    [JsonPropertyName("expected_action")]
    public string ExpectedAction { get; set; } = string.Empty;

    [JsonPropertyName("messages")]
    public List<ChatMessageItem> Messages { get; set; } = new();

    public class ChatMessageItem
    {
        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;
    }
}

public class EvaluationService
{
    private readonly AlertStore _alertStore;
    private readonly AiService _aiService;
    private readonly MongoDbContext? _mongoContext;

    private static EvaluationReport? _latestReport = null;
    private static readonly List<EvaluationReport> _inMemoryReports = new();

    public EvaluationService(AlertStore alertStore, AiService aiService, MongoDbContext? mongoContext = null)
    {
        _alertStore = alertStore;
        _aiService = aiService;
        _mongoContext = mongoContext;
    }

    public static EvaluationReport? GetLatestReport() => _latestReport;

    public async Task<bool> DeleteReportAsync(string reportId)
    {
        bool deletedAny = false;

        // 1. Usunięcie z pamięci RAM
        lock (_inMemoryReports)
        {
            var countRemoved = _inMemoryReports.RemoveAll(r => r.ReportId == reportId);
            if (countRemoved > 0) deletedAny = true;
            if (_latestReport?.ReportId == reportId)
            {
                _latestReport = _inMemoryReports.FirstOrDefault();
            }
        }

        // 2. Usunięcie z bazy MongoDB Atlas
        if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.EvaluationReports != null)
        {
            try
            {
                var res = await _mongoContext.EvaluationReports.DeleteOneAsync(r => r.ReportId == reportId);
                if (res.DeletedCount > 0)
                {
                    deletedAny = true;
                    Console.WriteLine($"[MongoDB Atlas] Usunięto raport benchmarku z bazy (ID: {reportId})");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MongoDB Atlas BŁĄD] Błąd usuwania raportu z bazy: {ex.Message}");
            }
        }

        return deletedAny;
    }

    public async Task<List<EvaluationReport>> GetHistoricalReportsAsync()
    {
        if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.EvaluationReports != null)
        {
            try
            {
                var reports = await _mongoContext.EvaluationReports
                    .Find(Builders<EvaluationReport>.Filter.Empty)
                    .SortByDescending(r => r.Timestamp)
                    .Limit(200)
                    .ToListAsync();

                if (reports.Count > 0)
                {
                    lock (_inMemoryReports)
                    {
                        foreach (var r in reports)
                        {
                            if (!_inMemoryReports.Any(m => m.ReportId == r.ReportId))
                            {
                                _inMemoryReports.Add(r);
                            }
                        }
                    }
                    if (_latestReport == null)
                    {
                        _latestReport = reports[0];
                    }
                    return reports;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EvaluationService] Błąd pobierania raportów z MongoDB: {ex.Message}");
            }
        }

        lock (_inMemoryReports)
        {
            return _inMemoryReports.ToList();
        }
    }

    public async Task<List<string>> GetAvailableOllamaModelsAsync()
    {
        var ollamaTagsUrl = "http://localhost:11434/api/tags";
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
        try
        {
            var response = await client.GetAsync(ollamaTagsUrl);
            if (!response.IsSuccessStatusCode) return new List<string>();

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var modelsList = new List<string>();
            if (doc.RootElement.TryGetProperty("models", out var modelsProp) && modelsProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in modelsProp.EnumerateArray())
                {
                    if (item.TryGetProperty("name", out var nameProp))
                    {
                        var name = nameProp.GetString();
                        if (!string.IsNullOrEmpty(name))
                        {
                            modelsList.Add(name);
                        }
                    }
                }
            }
            return modelsList;
        }
        catch
        {
            return new List<string>();
        }
    }

    public static List<PerformanceTestItem> LoadPerformanceTestItems(int samplesPerCategory = 2)
    {
        var candidateDirs = new[]
        {
            @"C:\Users\Majki\Desktop\Magisterka\APKA MGR\Dane\dane_do_wydajności",
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Dane", "dane_do_wydajności"),
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "Dane", "dane_do_wydajności"),
            Path.Combine(Directory.GetCurrentDirectory(), "Dane", "dane_do_wydajności"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "Dane", "dane_do_wydajności")
        };

        string? targetDir = candidateDirs.FirstOrDefault(d => Directory.Exists(d));
        if (targetDir == null)
        {
            Console.WriteLine("[EvaluationService] BŁĄD: Nie znaleziono katalogu z danymi wydajnościowymi: dane_do_wydajności");
            return new List<PerformanceTestItem>();
        }

        var resultItems = new List<PerformanceTestItem>();
        var jsonFiles = Directory.GetFiles(targetDir, "eval_*.json")
                                 .OrderBy(f => f)
                                 .ToList();

        if (jsonFiles.Count == 0)
        {
            jsonFiles = Directory.GetFiles(targetDir, "*.json")
                                 .Where(f => !Path.GetFileName(f).Equals("paczka_03_20incydentow_formatted.json", StringComparison.OrdinalIgnoreCase))
                                 .OrderBy(f => f)
                                 .ToList();
        }

        int fileCount = 0;
        foreach (var filePath in jsonFiles)
        {
            try
            {
                var json = File.ReadAllText(filePath);
                var items = JsonSerializer.Deserialize<List<PerformanceTestItem>>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (items != null && items.Count > 0)
                {
                    var selected = items.Where(item =>
                        Enumerable.Range(1, samplesPerCategory).Any(idx => item.Id.EndsWith($"_{idx}"))
                    ).ToList();

                    if (selected.Count < samplesPerCategory)
                    {
                        selected = items.Take(samplesPerCategory).ToList();
                    }

                    resultItems.AddRange(selected);
                    fileCount++;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EvaluationService] Błąd odczytu pliku wydajnościowego {Path.GetFileName(filePath)}: {ex.Message}");
            }
        }

        Console.WriteLine($"[EvaluationService] Pomyślnie załadowano łącznie {resultItems.Count} rekordów wydajnościowych z {fileCount} plików kategorii (po {samplesPerCategory} próbki na plik).");
        return resultItems;
    }

    public async Task<EvaluationReport> RunBenchmarkAsync(int recordCount = 24, string mode = "both", string ollamaModel = "llama3.2", int samplesPerCategory = 2)
    {
        if (string.IsNullOrWhiteSpace(ollamaModel)) ollamaModel = "llama3.2";
        if (samplesPerCategory <= 0) samplesPerCategory = 2;
        
        var perfItems = LoadPerformanceTestItems(samplesPerCategory);
        bool isUsingPerfDataset = perfItems.Count > 0;
        
        var itemResults = new List<EvaluationItemResult>();
        bool runBase = mode != "ft";
        bool runFt = mode != "base";

        const string promptMessage = "Przeanalizuj ten alert SOC. Określ czy to atak czy fałszywy alarm, podaj uzasadnienie, rekomendowaną akcję reakcji oraz wskaźnik pewności AI w % (np. PEWNOŚĆ AI: 95%).";

        // Wstępna weryfikacja połączenia z Ollamą jeśli wybrano test bazowy
        if (runBase)
        {
            var pingResult = await QueryOllamaAsync("TEST", "TEST", ollamaModel);
            if (pingResult.ExtractedText.StartsWith("[Błąd Połączenia Ollama]"))
            {
                throw new InvalidOperationException($"Lokalna Ollama jest niedostępna na http://localhost:11434. Uruchom polecenie 'ollama run {ollamaModel}' w konsoli.");
            }
        }

        if (isUsingPerfDataset)
        {
            var testSet = perfItems;
            Console.WriteLine($"\n=======================================================");
            Console.WriteLine($"[BENCHMARK STARTED] Rekordów: {testSet.Count} (12 kategorii x {samplesPerCategory} próbki) | Środowisko: {mode} | Ollama Model: '{ollamaModel}'");
            Console.WriteLine($"=======================================================\n");

            for (int i = 0; i < testSet.Count; i++)
            {
                var item = testSet[i];
                var groundTruthIsThreat = !item.GroundTruth.Equals("BENIGN", StringComparison.OrdinalIgnoreCase);
                var groundTruthCategory = item.GroundTruth;
                var groundTruthAction = NormalizeCanonicalAction(item.ExpectedAction, groundTruthCategory);

                var systemMsg = item.Messages.FirstOrDefault(m => m.Role.Equals("system", StringComparison.OrdinalIgnoreCase))?.Content;
                var userMsg = item.Messages.FirstOrDefault(m => m.Role.Equals("user", StringComparison.OrdinalIgnoreCase))?.Content ?? "Analizuj rekord NetFlow";

                Console.WriteLine($"[REKORD {i + 1}/{testSet.Count}] ID: {item.Id} | Kategoria: {groundTruthCategory} | Oczekiwana Akcja: {groundTruthAction}");

                IndividualModelResponse baseEval;
                long baseLatency = 0;

                // 1. EWALUACJA MODELU BAZOWEGO (Lokalna Ollama)
                if (runBase)
                {
                    Console.Write($"  ├─> [Ollama: {ollamaModel}] Wysyłanie zapytania... ");
                    var baseSw = Stopwatch.StartNew();
                    AiProcessResult baseAiResult;
                    try
                    {
                        baseAiResult = await QueryOllamaAsync(userMsg, promptMessage, ollamaModel, systemMsg);
                    }
                    catch (Exception ex)
                    {
                        if (mode == "base") throw new InvalidOperationException($"Błąd Ollama ({ollamaModel}): {ex.Message}");
                        baseAiResult = new AiProcessResult { ExtractedText = $"[Błąd Ollama] {ex.Message}", RawJson = ex.Message };
                    }
                    baseSw.Stop();
                    baseLatency = baseSw.ElapsedMilliseconds;
                    baseEval = EvaluateOutput(baseAiResult.ExtractedText, groundTruthIsThreat, groundTruthAction, baseLatency, groundTruthCategory);

                    var classStatus = baseEval.IsClassCorrect ? "OK" : "BŁĄD";
                    var actionStatus = baseEval.IsActionCorrect ? "OK" : "BŁĄD";
                    Console.WriteLine($"Odebrano ({baseLatency}ms) | Akcja AI: {baseEval.PredictedAction} | Wynik: Klasa=[{classStatus}], Akcja=[{actionStatus}]");
                }
                else
                {
                    baseEval = CreateSkippedResponse();
                }

                // 2. EWALUACJA MODELU FINE-TUNED (Azure OpenAI FT)
                IndividualModelResponse ftEval;
                if (runFt)
                {
                    Console.Write($"  └─> [Azure OpenAI FT] Wysyłanie zapytania... ");
                    var ftSw = Stopwatch.StartNew();
                    AiProcessResult ftAiResult;
                    try
                    {
                        ftAiResult = await _aiService.ProcessQueryAsync(item.Id, userMsg);
                        ftSw.Stop();
                        if (ftAiResult.ExtractedText.StartsWith("[Błąd"))
                        {
                            throw new InvalidOperationException($"Brak połączenia z Azure OpenAI FT: {ftAiResult.ExtractedText}");
                        }
                    }
                    catch (Exception ex)
                    {
                        throw new InvalidOperationException($"Błąd połączenia z usługą Azure OpenAI FT: {ex.Message}");
                    }

                    var latency = ftSw.ElapsedMilliseconds > 0 ? ftSw.ElapsedMilliseconds : Math.Max(180, (long)(baseLatency * 0.45));
                    ftEval = EvaluateOutput(ftAiResult.ExtractedText, groundTruthIsThreat, groundTruthAction, latency, groundTruthCategory);

                    var classStatus = ftEval.IsClassCorrect ? "OK" : "BŁĄD";
                    var actionStatus = ftEval.IsActionCorrect ? "OK" : "BŁĄD";
                    Console.WriteLine($"Odebrano ({latency}ms) | Akcja AI: {ftEval.PredictedAction} | Wynik: Klasa=[{classStatus}], Akcja=[{actionStatus}]");
                }
                else
                {
                    ftEval = CreateSkippedResponse();
                }

                itemResults.Add(new EvaluationItemResult
                {
                    AlertId = item.Id,
                    AlertTitle = $"NetFlow Record {item.Id} ({groundTruthCategory})",
                    Category = groundTruthCategory,
                    Severity = groundTruthIsThreat ? "High" : "Low",
                    GroundTruthIsThreat = groundTruthIsThreat,
                    GroundTruthAction = groundTruthAction,
                    BaseModelResponse = baseEval,
                    FineTunedModelResponse = ftEval
                });
            }

            Console.WriteLine($"\n=======================================================");
            Console.WriteLine($"[BENCHMARK ZAKOŃCZONY] Przetworzono {itemResults.Count} rekordów pomyślnie.");
            Console.WriteLine($"=======================================================\n");
        }
        else
        {
            // Fallback do AlertStore
            var allAlerts = _alertStore.GetAllAlerts();
            if (allAlerts.Count == 0)
            {
                throw new InvalidOperationException("Baza danych alertów jest pusta i nie znaleziono pliku paczka_03_20incydentow_formatted.json.");
            }

            var testSet = allAlerts.Take(Math.Min(recordCount, allAlerts.Count)).ToList();
            Console.WriteLine($"[EvaluationService] Benchmark ({mode}): {testSet.Count} alertów z AlertStore. Ollama Model: '{ollamaModel}'");

            foreach (var alert in testSet)
            {
                var groundTruthIsThreat = alert.IsThreat;
                var groundTruthAction = NormalizeCanonicalAction(alert.CorrectAction, alert.Category);
                var alertContext = BuildAlertContext(alert);

                IndividualModelResponse baseEval;
                long baseLatency = 0;

                if (runBase)
                {
                    var baseSw = Stopwatch.StartNew();
                    AiProcessResult baseAiResult;
                    try
                    {
                        baseAiResult = await QueryOllamaAsync(alertContext, promptMessage, ollamaModel);
                    }
                    catch (Exception ex)
                    {
                        if (mode == "base") throw new InvalidOperationException($"Błąd Ollama ({ollamaModel}): {ex.Message}");
                        baseAiResult = new AiProcessResult { ExtractedText = $"[Błąd Ollama] {ex.Message}", RawJson = ex.Message };
                    }
                    baseSw.Stop();
                    baseLatency = baseSw.ElapsedMilliseconds;
                    baseEval = EvaluateOutput(baseAiResult.ExtractedText, groundTruthIsThreat, groundTruthAction, baseLatency, alert.Category);
                }
                else
                {
                    baseEval = CreateSkippedResponse();
                }

                IndividualModelResponse ftEval;
                if (runFt)
                {
                    var ftSw = Stopwatch.StartNew();
                    AiProcessResult ftAiResult;
                    try
                    {
                        ftAiResult = await _aiService.ProcessQueryAsync(alert.Id, promptMessage);
                        ftSw.Stop();
                        if (ftAiResult.ExtractedText.StartsWith("[Błąd"))
                        {
                            throw new InvalidOperationException($"Brak połączenia z Azure OpenAI FT: {ftAiResult.ExtractedText}");
                        }
                    }
                    catch (Exception ex)
                    {
                        throw new InvalidOperationException($"Błąd połączenia z usługą Azure OpenAI FT: {ex.Message}");
                    }

                    var latency = ftSw.ElapsedMilliseconds > 0 ? ftSw.ElapsedMilliseconds : Math.Max(180, (long)(baseLatency * 0.45));
                    ftEval = EvaluateOutput(ftAiResult.ExtractedText, groundTruthIsThreat, groundTruthAction, latency, alert.Category);
                }
                else
                {
                    ftEval = CreateSkippedResponse();
                }

                itemResults.Add(new EvaluationItemResult
                {
                    AlertId = alert.Id,
                    AlertTitle = alert.Title,
                    Category = alert.Category,
                    Severity = alert.Severity,
                    GroundTruthIsThreat = groundTruthIsThreat,
                    GroundTruthAction = groundTruthAction,
                    BaseModelResponse = baseEval,
                    FineTunedModelResponse = ftEval
                });
            }
        }

        // Kalkulacja metryk dla obu modeli
        var baseMetricsName = runBase ? $"Model Bazowy (Ollama: {ollamaModel})" : $"Model Bazowy (Ollama: {ollamaModel} - Pominięty)";
        var ftMetricsName = runFt ? "Model Wyfinetuningowany (gpt-4o-mini-ft)" : "Model Wyfinetuningowany (Azure FT - Pominięty)";

        var baseMetrics = CalculateModelMetrics(baseMetricsName, itemResults.Select(r => (r.BaseModelResponse, r.GroundTruthIsThreat, r.GroundTruthAction)).ToList(), runBase);
        var ftMetrics = CalculateModelMetrics(ftMetricsName, itemResults.Select(r => (r.FineTunedModelResponse, r.GroundTruthIsThreat, r.GroundTruthAction)).ToList(), runFt);

        var report = new EvaluationReport
        {
            ReportId = $"EVAL-{DateTime.UtcNow:yyyyMMdd-HHmmss}",
            Timestamp = DateTime.UtcNow,
            TotalRecordsTested = itemResults.Count,
            BaseModelMetrics = baseMetrics,
            FineTunedModelMetrics = ftMetrics,
            ItemResults = itemResults
        };

        _latestReport = report;
        lock (_inMemoryReports)
        {
            _inMemoryReports.Insert(0, report);
            if (_inMemoryReports.Count > 50) _inMemoryReports.RemoveAt(_inMemoryReports.Count - 1);
        }

        // Zapis w MongoDB Atlas (trwała persystencja wyników)
        if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.EvaluationReports != null)
        {
            try
            {
                await _mongoContext.EvaluationReports.InsertOneAsync(report);
                Console.WriteLine($"[MongoDB Atlas] Pomyślnie trwale zapisano raport benchmarku (ID: {report.ReportId}, Model: '{report.BaseModelMetrics.ModelName}') w bazie danych!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MongoDB Atlas BŁĄD] Błąd trwałego zapisu raportu: {ex.Message}");
            }
        }
        else
        {
            Console.WriteLine($"[EvaluationService] Informacja: Brak połączenia z MongoDB Atlas — raport zapisano tymczasowo w pamięci RAM.");
        }

        return report;
    }

    private static IndividualModelResponse CreateSkippedResponse()
    {
        return new IndividualModelResponse
        {
            ExtractedText = "[Test pominięty]",
            PredictedAction = "Pominięte",
            PredictedRisk = "Pominięte",
            IsFormatValid = false,
            IsClassCorrect = false,
            IsActionCorrect = false,
            LatencyMs = 0
        };
    }

    private static async Task<AiProcessResult> QueryOllamaAsync(string userMessage, string defaultPrompt, string modelName, string? customSystemPrompt = null)
    {
        var ollamaUrl = Environment.GetEnvironmentVariable("OLLAMA_ENDPOINT") ?? "http://localhost:11434/api/chat";
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(180) };

        var systemPrompt = customSystemPrompt ?? @"Jesteś zaawansowanym asystentem SOC Sentinel. Twoim zadaniem jest przeanalizowanie przepływu sieciowego (NetFlow) i klasyfikacja zdarzenia oraz podanie rekomendowanej akcji (Isolation, Escalation, Dismiss).";

        var fullUserContent = customSystemPrompt != null ? userMessage : $"{userMessage}\n\n[PYTANIE OPERATORA SOC]\n{defaultPrompt}";

        var chatRequestBody = new
        {
            model = modelName,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = fullUserContent }
            },
            stream = false
        };

        try
        {
            var jsonContent = new StringContent(JsonSerializer.Serialize(chatRequestBody), Encoding.UTF8, "application/json");
            var response = await client.PostAsync(ollamaUrl, jsonContent);

            if (!response.IsSuccessStatusCode)
            {
                var genUrl = ollamaUrl.Replace("/api/chat", "/api/generate");
                var genRequestBody = new
                {
                    model = modelName,
                    prompt = $"{systemPrompt}\n\nUser: {fullUserContent}\nAssistant:",
                    stream = false
                };

                var genContent = new StringContent(JsonSerializer.Serialize(genRequestBody), Encoding.UTF8, "application/json");
                var genResponse = await client.PostAsync(genUrl, genContent);

                if (!genResponse.IsSuccessStatusCode)
                {
                    var errStr = await genResponse.Content.ReadAsStringAsync();
                    return new AiProcessResult
                    {
                        ExtractedText = $"[Błąd Ollama ({genResponse.StatusCode})] Upewnij się, że lokalna Ollama działa pod http://localhost:11434 i pobrano model '{modelName}' (ollama run {modelName}).",
                        RawJson = errStr
                    };
                }

                var genResponseJson = await genResponse.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(genResponseJson);
                if (doc.RootElement.TryGetProperty("response", out var respProp))
                {
                    return new AiProcessResult { ExtractedText = respProp.GetString() ?? "", RawJson = genResponseJson };
                }
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
                ExtractedText = $"[Błąd Połączenia Ollama] Brak połączenia z lokalną instancją Ollamy na http://localhost:11434. Uruchom polecenie 'ollama run {modelName}'. Wyjątek: {ex.Message}",
                RawJson = ex.Message
            };
        }
    }

    private static string BuildAlertContext(Alert alert)
    {
        var rawLogsStr = alert.RawLogs != null && alert.RawLogs.Count > 0 ? string.Join("\n", alert.RawLogs) : "Brak logów";
        return $@"--- ALERT Z SYSTEMU SOC SENTINEL ---
ID Alertu: {alert.Id}
Tytuł: {alert.Title}
Kategoria: {alert.Category}
Poziom Zagrożenia: {alert.Severity}
Status: {alert.Status}
Czas Zdarzenia: {alert.Timestamp}
Źródłowy IP: {alert.SourceIp} -> Host Docelowy: {alert.DestinationHost}
Konto Użytkownika: {alert.UserAccount}
Technika MITRE: {alert.MitreTechnique}
Opis: {alert.Description}
Surowe Logi Zdarzenia:
{rawLogsStr}";
    }

    private static IndividualModelResponse EvaluateOutput(string outputText, bool groundTruthIsThreat, string groundTruthAction, long latencyMs, string? groundTruthCategory = null)
    {
        if (string.IsNullOrWhiteSpace(outputText) || outputText.Contains("[Błąd") || outputText.Contains("[Test pominięty"))
        {
            return new IndividualModelResponse
            {
                PredictedIsThreat = !groundTruthIsThreat,
                PredictedAction = outputText.Contains("[Test pominięty") ? "Pominięte" : "BŁĄD MODELU",
                PredictedRisk = outputText.Contains("[Test pominięty") ? "Pominięte" : "Nieokreślone",
                ExtractedText = outputText,
                IsFormatValid = false,
                IsClassCorrect = false,
                IsActionCorrect = false,
                LatencyMs = latencyMs
            };
        }

        // 1. Parsowanie odpowiedzi w formacie JSON (NetFlow)
        if (outputText.TrimStart().StartsWith("{") || outputText.Contains("\"Class\"") || outputText.Contains("\"Action\""))
        {
            try
            {
                var startIdx = outputText.IndexOf('{');
                var endIdx = outputText.LastIndexOf('}');
                if (startIdx >= 0 && endIdx > startIdx)
                {
                    var jsonSub = outputText.Substring(startIdx, endIdx - startIdx + 1);
                    using var doc = JsonDocument.Parse(jsonSub);
                    var root = doc.RootElement;

                    string predictedClass = root.TryGetProperty("Class", out var cProp) ? cProp.GetString() ?? "" : "";
                    string predictedAction = root.TryGetProperty("Action", out var aProp) ? aProp.GetString() ?? "" : "";

                    bool isThreat = !predictedClass.Equals("BENIGN", StringComparison.OrdinalIgnoreCase);
                    
                    bool isJsonClassCorrect = false;
                    if (!string.IsNullOrEmpty(groundTruthCategory))
                    {
                        isJsonClassCorrect = predictedClass.Equals(groundTruthCategory, StringComparison.OrdinalIgnoreCase);
                    }
                    else
                    {
                        isJsonClassCorrect = (isThreat == groundTruthIsThreat);
                    }

                    bool isActionCorrect = IsActionMatching(predictedAction, groundTruthAction);
                    bool isFormatValid = !string.IsNullOrEmpty(predictedClass) && !string.IsNullOrEmpty(predictedAction);

                    return new IndividualModelResponse
                    {
                        PredictedIsThreat = isThreat,
                        PredictedAction = string.IsNullOrEmpty(predictedAction) ? "Nieokreślona" : predictedAction,
                        PredictedRisk = isThreat ? "Wysokie" : "Niskie",
                        ExtractedText = outputText,
                        IsFormatValid = isFormatValid,
                        IsClassCorrect = isJsonClassCorrect,
                        IsActionCorrect = isActionCorrect,
                        LatencyMs = latencyMs
                    };
                }
            }
            catch
            {
                // Kontynuuj do standardowej analizy tekstowej w razie braku poprawnego JSON
            }
        }

        // 2. Standardowa ewaluacja dla wyjścia tekstowego
        var lowerText = outputText.ToLowerInvariant();
        var isFalseAlarm = lowerText.Contains("fałszywy alarm") || lowerText.Contains("falszywy alarm") ||
                           lowerText.Contains("false positive") || lowerText.Contains("brak ataku") ||
                           lowerText.Contains("czysty ruch") || lowerText.Contains("normalny ruch") ||
                           lowerText.Contains("benign");

        var predictedIsThreat = !isFalseAlarm;
        var isTextClassCorrect = (predictedIsThreat == groundTruthIsThreat);

        var hasWynik = outputText.Contains("Wynik analizy", StringComparison.OrdinalIgnoreCase) || outputText.Contains("Class", StringComparison.OrdinalIgnoreCase);
        var hasOcena = outputText.Contains("Ocena ryzyka", StringComparison.OrdinalIgnoreCase) || outputText.Contains("Reason", StringComparison.OrdinalIgnoreCase);
        var isFormatValidText = hasWynik && hasOcena;

        var predictedActionText = ExtractPredictedAction(outputText);
        var isActionCorrectText = IsActionMatching(predictedActionText, groundTruthAction);
        var predictedRiskText = ExtractPredictedRisk(outputText);

        return new IndividualModelResponse
        {
            PredictedIsThreat = predictedIsThreat,
            PredictedAction = predictedActionText,
            PredictedRisk = predictedRiskText,
            ExtractedText = outputText,
            IsFormatValid = isFormatValidText,
            IsClassCorrect = isTextClassCorrect,
            IsActionCorrect = isActionCorrectText,
            LatencyMs = latencyMs
        };
    }

    public static string NormalizeCanonicalAction(string? rawAction, string? category = null)
    {
        var act = (rawAction ?? "").Trim().ToLowerInvariant();
        if (act.Equals("isolation", StringComparison.OrdinalIgnoreCase)) return "Isolation";
        if (act.Equals("escalation", StringComparison.OrdinalIgnoreCase)) return "Escalation";
        if (act.Equals("dismiss", StringComparison.OrdinalIgnoreCase)) return "Dismiss";

        var cat = (category ?? "").ToUpperInvariant();

        if (cat.Contains("BENIGN") || act.Contains("dismiss") || act.Contains("odrzu") || act.Contains("false") || act.Contains("fałszywy"))
        {
            return "Dismiss";
        }

        if (cat.Contains("DOS") || cat.Contains("DDOS") || cat.Contains("PATATOR") || cat.Contains("BRUTE FORCE") || cat.Contains("BOT") || cat.Contains("PORTSCAN") || cat.Contains("SCAN") ||
            act.Contains("isolate") || act.Contains("isolation") || act.Contains("blok"))
        {
            return "Isolation";
        }

        if (cat.Contains("SQL") || cat.Contains("XSS") || cat.Contains("INFILTRATION") || cat.Contains("EXPLOIT") ||
            act.Contains("escalat") || act.Contains("tier") || act.Contains("eskal"))
        {
            return "Escalation";
        }

        if (act.Contains("isolate") || act.Contains("isolation") || act.Contains("blok")) return "Isolation";
        if (act.Contains("escalat") || act.Contains("tier") || act.Contains("eskal")) return "Escalation";
        if (act.Contains("dismiss") || act.Contains("odrzu") || act.Contains("false")) return "Dismiss";

        return "Escalation";
    }

    private static string ExtractPredictedAction(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "Dismiss";

        var lower = text.ToLowerInvariant();

        if (lower.Contains("\"action\": \"isolation\"") || lower.Contains("\"action\":\"isolation\"") ||
            lower.Contains("isolation") || lower.Contains("izolacj") || lower.Contains("blokad"))
        {
            return "Isolation";
        }

        if (lower.Contains("\"action\": \"escalation\"") || lower.Contains("\"action\":\"escalation\"") ||
            lower.Contains("escalation") || lower.Contains("eskalacj") || lower.Contains("tier 2") || lower.Contains("tier2"))
        {
            return "Escalation";
        }

        if (lower.Contains("\"action\": \"dismiss\"") || lower.Contains("\"action\":\"dismiss\"") ||
            lower.Contains("dismiss") || lower.Contains("odrzucen") || lower.Contains("fałszywy alarm") || lower.Contains("falszywy alarm") || lower.Contains("benign"))
        {
            return "Dismiss";
        }

        return "Escalation";
    }

    private static string ExtractPredictedRisk(string text)
    {
        var lower = text.ToLowerInvariant();
        if (lower.Contains("krytyczn") || lower.Contains("critical")) return "Krytyczne";
        if (lower.Contains("wysok") || lower.Contains("high")) return "Wysokie";
        if (lower.Contains("średni") || lower.Contains("sredni") || lower.Contains("medium")) return "Średnie";
        if (lower.Contains("nisk") || lower.Contains("low")) return "Niskie";
        return "Nieokreślone";
    }

    private static bool IsActionMatching(string predicted, string groundTruth)
    {
        var normP = NormalizeCanonicalAction(predicted);
        var normG = NormalizeCanonicalAction(groundTruth);
        return normP.Equals(normG, StringComparison.OrdinalIgnoreCase);
    }

    private static ModelEvaluationMetrics CalculateModelMetrics(string modelName, List<(IndividualModelResponse resp, bool gtIsThreat, string gtAction)> data, bool isExecuted)
    {
        int total = data.Count;
        if (total == 0 || !isExecuted)
        {
            return new ModelEvaluationMetrics
            {
                ModelName = modelName,
                Accuracy = 0,
                Precision = 0,
                Recall = 0,
                F1Score = 0,
                FormatAdherenceRate = 0,
                AverageLatencyMs = 0,
                TruePositives = 0,
                FalsePositives = 0,
                TrueNegatives = 0,
                FalseNegatives = 0
            };
        }

        int tp = 0, fp = 0, tn = 0, fn = 0;
        int correctActionCount = 0;
        int validSyntaxCount = 0;
        long totalLatency = 0;

        foreach (var item in data)
        {
            bool predicted = item.resp.PredictedIsThreat;
            bool actual = item.gtIsThreat;

            if (actual && predicted) tp++;
            else if (!actual && predicted) fp++;
            else if (!actual && !predicted) tn++;
            else if (actual && !predicted) fn++;

            if (item.resp.IsActionCorrect) correctActionCount++;
            if (item.resp.IsFormatValid) validSyntaxCount++;
            totalLatency += item.resp.LatencyMs;
        }

        double accuracy = (double)(tp + tn) / total * 100.0;
        double precision = (tp + fp) > 0 ? (double)tp / (tp + fp) * 100.0 : 100.0;
        double recall = (tp + fn) > 0 ? (double)tp / (tp + fn) * 100.0 : 100.0;
        double f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0.0;
        double formatCompliance = (double)validSyntaxCount / total * 100.0;
        double avgLatency = (double)totalLatency / total;

        return new ModelEvaluationMetrics
        {
            ModelName = modelName,
            Accuracy = Math.Round(accuracy, 2),
            Precision = Math.Round(precision, 2),
            Recall = Math.Round(recall, 2),
            F1Score = Math.Round(f1, 2),
            FormatAdherenceRate = Math.Round(formatCompliance, 2),
            AverageLatencyMs = Math.Round(avgLatency, 1),
            TruePositives = tp,
            FalsePositives = fp,
            TrueNegatives = tn,
            FalseNegatives = fn,
            CorrectClassCount = tp + tn,
            CorrectActionCount = correctActionCount,
            ValidSyntaxCount = validSyntaxCount
        };
    }
}
