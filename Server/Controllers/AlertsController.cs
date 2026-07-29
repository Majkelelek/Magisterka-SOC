using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AlertsController : ControllerBase
{
    private readonly AlertStore _alertStore;

    public AlertsController(AlertStore alertStore)
    {
        _alertStore = alertStore;
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
            string testSetPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "test_pytania.json");
            if (!System.IO.File.Exists(testSetPath))
            {
                testSetPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "netflow_test_pytania.json");
            }
            if (!System.IO.File.Exists(testSetPath))
            {
                testSetPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "test_pytania.json");
            }
            if (!System.IO.File.Exists(testSetPath))
            {
                testSetPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "netflow_test_pytania.json");
            }

            if (System.IO.File.Exists(testSetPath))
            {
                var jsonText = await System.IO.File.ReadAllTextAsync(testSetPath);
                var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var alerts = System.Text.Json.JsonSerializer.Deserialize<List<Alert>>(jsonText, options);
                return Ok(alerts ?? new List<Alert>());
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
}

public record UpdateStatusRequest(string Status);
