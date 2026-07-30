using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AlertsController : ControllerBase
{
    private readonly AlertStore _alertStore;
    private readonly MongoDbContext? _mongoContext;
    private readonly AiService _aiService;

    public AlertsController(AlertStore alertStore, AiService aiService, MongoDbContext? mongoContext = null)
    {
        _alertStore = alertStore;
        _aiService = aiService;
        _mongoContext = mongoContext;
    }

    [HttpGet]
    public ActionResult<IEnumerable<Alert>> GetAlerts([FromQuery] string? severity, [FromQuery] string? status)
    {
        var alerts = _alertStore.GetAllAlerts();

        if (!string.IsNullOrEmpty(severity))
        {
            alerts = alerts.Where(a => a.Severity.Equals(severity, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        if (!string.IsNullOrEmpty(status))
        {
            alerts = alerts.Where(a => a.Status.Equals(status, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return Ok(alerts);
    }

    [HttpGet("{id}")]
    public ActionResult<Alert> GetAlert(string id)
    {
        var alert = _alertStore.GetAlertById(id);
        if (alert == null) return NotFound(new { message = $"Alert z ID '{id}' nie został odnaleziony." });
        return Ok(alert);
    }

    [HttpPost]
    public ActionResult<Alert> CreateAlert([FromBody] Alert alert)
    {
        _alertStore.AddAlert(alert);
        return CreatedAtAction(nameof(GetAlert), new { id = alert.Id }, alert);
    }

    [HttpGet("test-set")]
    public ActionResult<IEnumerable<Alert>> GetTestSet()
    {
        var alerts = _alertStore.GetAllAlerts();
        return Ok(alerts);
    }

    [HttpPatch("{id}/status")]
    public ActionResult UpdateStatus(string id, [FromBody] UpdateStatusRequest request)
    {
        var success = _alertStore.UpdateAlertStatus(id, request.Status);
        if (!success) return NotFound(new { message = $"Alert o ID '{id}' nie istnieje." });
        return Ok(new { message = $"Stan alertu {id} został zmieniony na '{request.Status}'." });
    }

    [HttpPost("session/submit")]
    public ActionResult SubmitSession([FromBody] TestSession session)
    {
        _alertStore.AddTestSession(session);
        return Ok(new { message = "Sesja testowa została zapisana pomyślnie.", sessionId = session.SessionId });
    }

    [HttpGet("session")]
    [Authorize(Roles = "Administrator")]
    public ActionResult<IEnumerable<TestSession>> GetSessions()
    {
        return Ok(_alertStore.GetTestSessions());
    }

    [HttpDelete("session/all")]
    [Authorize(Roles = "Administrator")]
    public ActionResult DeleteAllSessions()
    {
        _alertStore.ClearAllTestSessions();
        return Ok(new { message = "Wszystkie wyniki testów zostały pomyślnie usunięte." });
    }

    [HttpDelete("session/{sessionId}")]
    [Authorize(Roles = "Administrator")]
    public ActionResult DeleteSession(string sessionId)
    {
        bool deleted = _alertStore.DeleteTestSession(sessionId);
        if (!deleted)
        {
            return NotFound(new { message = $"Sesja testowa o ID '{sessionId}' nie została odnaleziona." });
        }
        return Ok(new { message = $"Sesja testowa '{sessionId}' została usunięta." });
    }

    private string GetTestSetFilePath()
    {
        string path = Path.Combine(Directory.GetCurrentDirectory(), "Data", "test_pytania.json");
        if (!System.IO.File.Exists(path))
        {
            string altPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "test_pytania.json");
            if (System.IO.File.Exists(altPath)) return altPath;
        }
        return path;
    }

    private void SaveTestSetToAllFiles(List<Alert> alerts)
    {
        try
        {
            var options = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
            var jsonText = System.Text.Json.JsonSerializer.Serialize(alerts, options);

            string path1 = Path.Combine(Directory.GetCurrentDirectory(), "Data", "test_pytania.json");
            string dir1 = Path.GetDirectoryName(path1)!;
            if (!Directory.Exists(dir1)) Directory.CreateDirectory(dir1);
            System.IO.File.WriteAllText(path1, jsonText);

            string path2 = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "test_pytania.json");
            if (!string.Equals(path1, path2, StringComparison.OrdinalIgnoreCase))
            {
                string dir2 = Path.GetDirectoryName(path2)!;
                if (!Directory.Exists(dir2)) Directory.CreateDirectory(dir2);
                try { System.IO.File.WriteAllText(path2, jsonText); } catch {}
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AlertsController] Błąd zapisu plików json: {ex.Message}");
        }
    }

    [HttpPost("test-set/save-all")]
    [Authorize(Roles = "Administrator")]
    public ActionResult SaveAllTestAlerts([FromBody] List<Alert> alerts)
    {
        try
        {
            _alertStore.SetAlerts(alerts);
            SaveTestSetToAllFiles(alerts);
            return Ok(new { message = $"Pomyślnie zapisano {alerts.Count} pytań w pliku testowym.", alerts });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Błąd zapisu pliku testowego: {ex.Message}" });
        }
    }

    [HttpPost("test-set/item")]
    [Authorize(Roles = "Administrator")]
    public async Task<ActionResult> AddTestAlert([FromBody] Alert newAlert)
    {
        try
        {
            var currentAlerts = _alertStore.GetAllAlerts();
            if (string.IsNullOrWhiteSpace(newAlert.Id))
            {
                newAlert.Id = $"ALT-{(currentAlerts.Count + 1):D3}";
            }

            _alertStore.AddAlert(newAlert);
            currentAlerts = _alertStore.GetAllAlerts();
            SaveTestSetToAllFiles(currentAlerts);

            if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.Alerts != null)
            {
                try
                {
                    var filter = MongoDB.Driver.Builders<Alert>.Filter.Eq(a => a.Id, newAlert.Id);
                    await _mongoContext.Alerts.ReplaceOneAsync(filter, newAlert, new MongoDB.Driver.ReplaceOptions { IsUpsert = true });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AlertsController] Błąd synchronizacji z MongoDB: {ex.Message}");
                }
            }

            return Ok(new { message = $"Pytanie/Alert {newAlert.Id} został pomyślnie dodany.", alert = newAlert });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Błąd podczas dodawania pytania: {ex.Message}" });
        }
    }

    [HttpPut("test-set/item/{id}")]
    [Authorize(Roles = "Administrator")]
    public async Task<ActionResult> UpdateTestAlert(string id, [FromBody] Alert updatedAlert)
    {
        try
        {
            var currentAlerts = _alertStore.GetAllAlerts();
            int idx = currentAlerts.FindIndex(a => a.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
            if (idx == -1) return NotFound(new { message = $"Pytanie o ID '{id}' nie zostało odnalezione w bazie." });

            updatedAlert.Id = id;
            currentAlerts[idx] = updatedAlert;
            _alertStore.SetAlerts(currentAlerts);

            SaveTestSetToAllFiles(currentAlerts);

            if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.Alerts != null)
            {
                try
                {
                    var filter = MongoDB.Driver.Builders<Alert>.Filter.Eq(a => a.Id, id);
                    await _mongoContext.Alerts.ReplaceOneAsync(filter, updatedAlert, new MongoDB.Driver.ReplaceOptions { IsUpsert = true });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AlertsController] Błąd synchronizacji z MongoDB: {ex.Message}");
                }
            }

            return Ok(new { message = $"Pytanie {id} zostało pomyślnie zaktualizowane.", alert = updatedAlert });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Błąd edycji pytania: {ex.Message}" });
        }
    }

    [HttpDelete("test-set/item/{id}")]
    [Authorize(Roles = "Administrator")]
    public async Task<ActionResult> DeleteTestAlert(string id)
    {
        try
        {
            var currentAlerts = _alertStore.GetAllAlerts();
            int removed = currentAlerts.RemoveAll(a => a.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) return NotFound(new { message = $"Pytanie o ID '{id}' nie zostało odnalezione." });

            _alertStore.SetAlerts(currentAlerts);
            SaveTestSetToAllFiles(currentAlerts);

            if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.Alerts != null)
            {
                try
                {
                    var filter = MongoDB.Driver.Builders<Alert>.Filter.Eq(a => a.Id, id);
                    await _mongoContext.Alerts.DeleteOneAsync(filter);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AlertsController] Błąd usuwania z MongoDB: {ex.Message}");
                }
            }

            return Ok(new { message = $"Pytanie {id} zostało usunięte z bazy pytań testowych." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Błąd usuwania pytania: {ex.Message}" });
        }
    }

    [HttpDelete("test-set/all")]
    [Authorize(Roles = "Administrator")]
    public async Task<ActionResult> DeleteAllTestAlerts()
    {
        try
        {
            _alertStore.SetAlerts(new List<Alert>());
            SaveTestSetToAllFiles(new List<Alert>());

            if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.Alerts != null)
            {
                try
                {
                    await _mongoContext.Alerts.DeleteManyAsync(MongoDB.Driver.Builders<Alert>.Filter.Empty);
                    Console.WriteLine("[MongoDB Atlas] Usunięto WSZYSTKIE pytania testowe z bazy danych.");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[MongoDB Atlas] Błąd czyszczenia bazy: {ex.Message}");
                }
            }

            return Ok(new { message = "Wszystkie pytania testowe zostały pomyślnie usunięte z bazy pytań testowych oraz MongoDB Atlas." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Błąd podczas masowego usuwania pytań: {ex.Message}" });
        }
    }

    [HttpPost("import-attack-samples")]
    [Authorize(Roles = "Administrator")]
    public async Task<ActionResult> ImportAttackSamples()
    {
        try
        {
            string samplesPath = AttackSampleImporter.FindAttackSamplesFilePath();
            if (string.IsNullOrEmpty(samplesPath) || !System.IO.File.Exists(samplesPath))
            {
                return NotFound(new { message = "Nie odnaleziono pliku próbek 'próbki_ataków_zbiorcze.json' w katalogach projektu." });
            }

            string testSetPath = GetTestSetFilePath();
            List<Alert> existingAlerts = new();
            if (System.IO.File.Exists(testSetPath))
            {
                var jsonText = await System.IO.File.ReadAllTextAsync(testSetPath);
                var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                existingAlerts = System.Text.Json.JsonSerializer.Deserialize<List<Alert>>(jsonText, options) ?? new();
            }

            int startIndex = existingAlerts.Count + 1;
            var sampleAlerts = AttackSampleImporter.ConvertSamplesToAlerts(samplesPath, startIndex);

            if (sampleAlerts.Count == 0)
            {
                return BadRequest(new { message = "Brak poprawnych próbek w pliku 'próbki_ataków_zbiorcze.json' do zaimportowania." });
            }

            // Dołącz lub zaktualizuj pytania
            var mergedMap = existingAlerts.ToDictionary(a => a.Id, a => a);
            foreach (var s in sampleAlerts)
            {
                mergedMap[s.Id] = s;
            }

            var updatedAlerts = mergedMap.Values.ToList();

            // Zapis do test_pytania.json w obu lokalizacjach
            SaveTestSetToAllFiles(updatedAlerts);

            // Zapis w AlertStore w pamięci
            _alertStore.SetAlerts(updatedAlerts);

            // Zapis w MongoDB Atlas
            if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.Alerts != null)
            {
                try
                {
                    var bulkOps = updatedAlerts.Select(a => new MongoDB.Driver.ReplaceOneModel<Alert>(
                        MongoDB.Driver.Builders<Alert>.Filter.Eq(x => x.Id, a.Id), a) { IsUpsert = true }).ToList();
                    await _mongoContext.Alerts.BulkWriteAsync(bulkOps);
                    Console.WriteLine($"[MongoDB Atlas] Zaimportowano {sampleAlerts.Count} próbek ataków z próbki_ataków_zbiorcze.json!");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[MongoDB Atlas] Błąd zapisu próbek: {ex.Message}");
                }
            }

            return Ok(new
            {
                message = $"Pomyślnie zaimportowano i znormalizowano {sampleAlerts.Count} próbek z pliku 'próbki_ataków_zbiorcze.json' do bazy pytań testowych! Łączna liczba pytań: {updatedAlerts.Count}.",
                importedCount = sampleAlerts.Count,
                totalCount = updatedAlerts.Count
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Błąd podczas importu próbek ataków: {ex.Message}" });
        }
    }

    [HttpPost("{id}/generate-ai")]
    [Authorize(Roles = "Administrator")]
    public async Task<ActionResult> GenerateAiForAlert(string id)
    {
        var alert = _alertStore.GetAlertById(id);
        if (alert == null) return NotFound(new { message = $"Alert o ID '{id}' nie został odnaleziony." });

        try
        {
            var prompt = "Przeanalizuj automatycznie ten alert SOC. Określ czy to ataki czy fałszywy alarm, podaj uzasadnienie, rekomendowaną akcję reakcji oraz wskaźnik pewności AI w % (np. PEWNOŚĆ AI: 95%).";
            var result = await _aiService.ProcessQueryAsync(id, prompt);

            if (string.IsNullOrWhiteSpace(result.ExtractedText) || result.ExtractedText.Contains("[Błąd"))
            {
                return StatusCode(500, new { message = result.ExtractedText });
            }

            alert.AiAnalysis = result.ExtractedText;

            var currentAlerts = _alertStore.GetAllAlerts();
            int idx = currentAlerts.FindIndex(a => a.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
            if (idx >= 0) currentAlerts[idx] = alert;

            _alertStore.SetAlerts(currentAlerts);
            SaveTestSetToAllFiles(currentAlerts);

            if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.Alerts != null)
            {
                var filter = Builders<Alert>.Filter.Eq(a => a.Id, alert.Id);
                await _mongoContext.Alerts.ReplaceOneAsync(filter, alert, new ReplaceOptions { IsUpsert = true });
            }

            return Ok(new { message = $"Analiza AI dla alertu {id} została wygenerowana i zapisana.", alert });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Wystąpił błąd podczas generowania analizy AI: {ex.Message}" });
        }
    }

    [HttpPost("generate-ai-all")]
    [Authorize(Roles = "Administrator")]
    public async Task<ActionResult> GenerateAiForAllAlerts()
    {
        var currentAlerts = _alertStore.GetAllAlerts();
        if (currentAlerts.Count == 0) return BadRequest(new { message = "Brak pytań w bazie testowej." });

        int updatedCount = 0;
        var prompt = "Przeanalizuj automatycznie ten alert SOC. Określ czy to ataki czy fałszywy alarm, podaj uzasadnienie, rekomendowaną akcję reakcji oraz wskaźnik pewności AI w % (np. PEWNOŚĆ AI: 95%).";

        foreach (var alert in currentAlerts)
        {
            try
            {
                var result = await _aiService.ProcessQueryAsync(alert.Id, prompt);
                if (!string.IsNullOrWhiteSpace(result.ExtractedText) && !result.ExtractedText.Contains("[Błąd"))
                {
                    alert.AiAnalysis = result.ExtractedText;
                    updatedCount++;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AlertsController] Błąd generowania AI dla {alert.Id}: {ex.Message}");
            }
        }

        _alertStore.SetAlerts(currentAlerts);
        SaveTestSetToAllFiles(currentAlerts);

        if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.Alerts != null)
        {
            try
            {
                var bulkOps = currentAlerts.Select(a =>
                    new ReplaceOneModel<Alert>(Builders<Alert>.Filter.Eq(x => x.Id, a.Id), a) { IsUpsert = true }
                ).ToList();
                await _mongoContext.Alerts.BulkWriteAsync(bulkOps);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AlertsController] Błąd zapisu bulk w MongoDB: {ex.Message}");
            }
        }

        return Ok(new { message = $"Wygenerowano i zapisano wstępną analizę AI dla {updatedCount} pytań.", alerts = currentAlerts });
    }
}

public record UpdateStatusRequest(string Status);
