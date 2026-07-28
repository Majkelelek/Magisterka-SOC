using Microsoft.AspNetCore.Mvc;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AlertsController : ControllerBase
{
    private readonly AlertStore _alertStore;
    private readonly TokenService _tokenService;

    public AlertsController(AlertStore alertStore, TokenService tokenService)
    {
        _alertStore = alertStore;
        _tokenService = tokenService;
    }

    private async Task<UserTokenClaims?> AuthenticateRequestAsync()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        return await _tokenService.ValidateTokenAsync(authHeader);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Alert>>> GetAlerts([FromQuery] string? severity, [FromQuery] string? status)
    {
        var claims = await AuthenticateRequestAsync();
        if (claims == null) return Unauthorized(new { message = "Dostęp zabroniony. Sesja nieaktywna lub wygasła." });

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
    public async Task<ActionResult<Alert>> GetAlert(string id)
    {
        var claims = await AuthenticateRequestAsync();
        if (claims == null) return Unauthorized(new { message = "Dostęp zabroniony. Sesja nieaktywna lub wygasła." });

        var alert = _alertStore.GetAlertById(id);
        if (alert == null) return NotFound(new { message = $"Alert z ID '{id}' nie został odnaleziony." });
        return Ok(alert);
    }

    [HttpPost]
    public async Task<ActionResult<Alert>> CreateAlert([FromBody] Alert alert)
    {
        var claims = await AuthenticateRequestAsync();
        if (claims == null) return Unauthorized(new { message = "Dostęp zabroniony. Sesja nieaktywna lub wygasła." });

        _alertStore.AddAlert(alert);
        return CreatedAtAction(nameof(GetAlert), new { id = alert.Id }, alert);
    }

    [HttpGet("test-set")]
    public async Task<ActionResult<IEnumerable<Alert>>> GetTestSet()
    {
        var claims = await AuthenticateRequestAsync();
        if (claims == null) return Unauthorized(new { message = "Dostęp zabroniony. Sesja nieaktywna lub wygasła." });

        try
        {
            string testSetPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "wls_test_pytania.json");
            if (!System.IO.File.Exists(testSetPath))
            {
                testSetPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "wls_test_pytania.json");
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
            Console.WriteLine($"[AlertsController] Błąd wls_test_pytania.json: {ex.Message}");
        }

        return Ok(_alertStore.GetAllAlerts().Take(30).ToList());
    }

    [HttpPatch("{id}/status")]
    public async Task<ActionResult> UpdateStatus(string id, [FromBody] UpdateStatusRequest request)
    {
        var claims = await AuthenticateRequestAsync();
        if (claims == null) return Unauthorized(new { message = "Dostęp zabroniony. Sesja nieaktywna lub wygasła." });

        var success = _alertStore.UpdateAlertStatus(id, request.Status);
        if (!success) return NotFound(new { message = $"Alert o ID '{id}' nie istnieje." });
        return Ok(new { message = $"Stan alertu {id} został zmieniony na '{request.Status}'." });
    }

    [HttpPost("session/submit")]
    public async Task<ActionResult> SubmitSession([FromBody] TestSession session)
    {
        var claims = await AuthenticateRequestAsync();
        if (claims == null) return Unauthorized(new { message = "Dostęp zabroniony. Sesja nieaktywna lub wygasła." });

        _alertStore.AddTestSession(session);
        return Ok(new { message = "Sesja testowa została zapisana pomyślnie.", sessionId = session.SessionId });
    }

    [HttpGet("session")]
    public async Task<ActionResult<IEnumerable<TestSession>>> GetSessions()
    {
        var claims = await AuthenticateRequestAsync();
        if (claims == null) return Unauthorized(new { message = "Dostęp zabroniony. Sesja nieaktywna lub wygasła." });

        return Ok(_alertStore.GetTestSessions());
    }
}

public record UpdateStatusRequest(string Status);
