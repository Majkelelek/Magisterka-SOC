using Microsoft.AspNetCore.Mvc;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly TokenService _tokenService;

    public AiController(TokenService tokenService)
    {
        _tokenService = tokenService;
    }

    [HttpPost("query")]
    public async Task<IActionResult> ProcessAiQuery([FromBody] AiQueryRequest request)
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        var claims = await _tokenService.ValidateTokenAsync(authHeader);

        if (claims == null)
        {
            return Unauthorized(new { message = "Dostęp zabroniony. Sesja nieaktywna lub wygasła." });
        }

        await Task.Delay(100);

        return Ok(new AiQueryResponse(
            ResponseText: $"[API AI Backend] Zapytanie od operatora '{claims.Username}' do alertu '{request.AlertId}' odebrane pomyślnie. Podłącz klucz/endpoint prawdziwego modelu LLM w AiController.cs, aby uzyskać autentyczną analizę.",
            Timestamp: DateTime.UtcNow
        ));
    }
}

public record AiQueryRequest(string AlertId, string Prompt);
public record AiQueryResponse(string ResponseText, DateTime Timestamp);
