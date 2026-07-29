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

    public AlertsController(AlertStore alertStore, MongoDbContext? mongoContext = null)
    {
        _alertStore = alertStore;
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
    public async Task<ActionResult<IEnumerable<Alert>>> GetTestSet()
    {
        try
        {
            string testSetPath = GetTestSetFilePath();
            List<Alert> fileAlerts = new();

            if (System.IO.File.Exists(testSetPath))
            {
                var jsonText = await System.IO.File.ReadAllTextAsync(testSetPath);
                var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                fileAlerts = System.Text.Json.JsonSerializer.Deserialize<List<Alert>>(jsonText, options) ?? new();
            }

            // Sync with MongoDB Atlas if connected
            if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.Alerts != null)
            {
                try
                {
                    if (fileAlerts.Count > 0)
                    {
                        var bulkOps = fileAlerts.Select(a => new MongoDB.Driver.ReplaceOneModel<Alert>(
                            MongoDB.Driver.Builders<Alert>.Filter.Eq(x => x.Id, a.Id), a) { IsUpsert = true }).ToList();
                        await _mongoContext.Alerts.BulkWriteAsync(bulkOps);
                        Console.WriteLine($"[MongoDB Atlas] Zsynchronizowano {fileAlerts.Count} zdarzeń testowych w bazie danych.");
                    }

                    var mongoAlerts = await _mongoContext.Alerts.Find(MongoDB.Driver.Builders<Alert>.Filter.Empty).ToListAsync();
                    if (mongoAlerts.Count > 0)
                    {
                        return Ok(mongoAlerts.OrderBy(a => a.Id).ToList());
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[MongoDB Atlas] Błąd odczytu/zapisu z bazy: {ex.Message}");
                }
            }

            if (fileAlerts.Count > 0)
            {
                return Ok(fileAlerts);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AlertsController] Błąd odczytu zestawu testowego: {ex.Message}");
        }

        return Ok(_alertStore.GetAllAlerts().Take(30).ToList());
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

    [HttpPost("test-set/save-all")]
    [Authorize(Roles = "Administrator")]
    public async Task<ActionResult> SaveAllTestAlerts([FromBody] List<Alert> alerts)
    {
        try
        {
            string path = GetTestSetFilePath();
            var options = new System.Text.Json.JsonSerializerOptions { WriteIndented = true, PropertyNameCaseInsensitive = true };
            var jsonText = System.Text.Json.JsonSerializer.Serialize(alerts, options);
            await System.IO.File.WriteAllTextAsync(path, jsonText);
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
            string path = GetTestSetFilePath();
            List<Alert> currentAlerts = new();
            if (System.IO.File.Exists(path))
            {
                var jsonText = await System.IO.File.ReadAllTextAsync(path);
                var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                currentAlerts = System.Text.Json.JsonSerializer.Deserialize<List<Alert>>(jsonText, options) ?? new();
            }

            if (string.IsNullOrWhiteSpace(newAlert.Id))
            {
                newAlert.Id = $"ALT-{(currentAlerts.Count + 1):D3}";
            }

            currentAlerts.Add(newAlert);
            var saveOptions = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
            await System.IO.File.WriteAllTextAsync(path, System.Text.Json.JsonSerializer.Serialize(currentAlerts, saveOptions));

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
            string path = GetTestSetFilePath();
            if (!System.IO.File.Exists(path)) return NotFound(new { message = "Plik ze zbiorem pytań testowych nie istnieje." });

            var jsonText = await System.IO.File.ReadAllTextAsync(path);
            var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var currentAlerts = System.Text.Json.JsonSerializer.Deserialize<List<Alert>>(jsonText, options) ?? new();

            int idx = currentAlerts.FindIndex(a => a.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
            if (idx == -1) return NotFound(new { message = $"Pytanie o ID '{id}' nie zostało odnalezione w bazie." });

            updatedAlert.Id = id;
            currentAlerts[idx] = updatedAlert;

            var saveOptions = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
            await System.IO.File.WriteAllTextAsync(path, System.Text.Json.JsonSerializer.Serialize(currentAlerts, saveOptions));

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
            string path = GetTestSetFilePath();
            if (!System.IO.File.Exists(path)) return NotFound(new { message = "Plik ze zbiorem pytań testowych nie istnieje." });

            var jsonText = await System.IO.File.ReadAllTextAsync(path);
            var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var currentAlerts = System.Text.Json.JsonSerializer.Deserialize<List<Alert>>(jsonText, options) ?? new();

            int removed = currentAlerts.RemoveAll(a => a.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) return NotFound(new { message = $"Pytanie o ID '{id}' nie zostało odnalezione." });

            var saveOptions = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
            await System.IO.File.WriteAllTextAsync(path, System.Text.Json.JsonSerializer.Serialize(currentAlerts, saveOptions));

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
}

public record UpdateStatusRequest(string Status);
