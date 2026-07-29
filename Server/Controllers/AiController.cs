using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AiController : ControllerBase
{
    [HttpPost("query")]
    public async Task<IActionResult> ProcessAiQuery([FromBody] AiQueryRequest request)
    {
        var username = User.Identity?.Name ?? "Operator";
        await Task.Delay(100);

        return Ok(new AiQueryResponse(
            ResponseText: $"[API AI Backend] Zapytanie od operatora '{username}' do alertu '{request.AlertId}' odebrane pomyślnie. Podłącz klucz/endpoint prawdziwego modelu LLM w AiController.cs, aby uzyskać autentyczną analizę.",
            Timestamp: DateTime.UtcNow
        ));
    }
}

public record AiQueryRequest(string AlertId, string Prompt);
public record AiQueryResponse(string ResponseText, DateTime Timestamp);
