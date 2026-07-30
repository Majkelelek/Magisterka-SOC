using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AiController : ControllerBase
{
    private readonly AiService _aiService;

    public AiController(AiService aiService)
    {
        _aiService = aiService;
    }

    [HttpPost("query")]
    public async Task<IActionResult> ProcessAiQuery([FromBody] AiQueryRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Prompt))
        {
            return BadRequest(new { message = "Treść zapytania (prompt) nie może być pusta." });
        }

        var result = await _aiService.ProcessQueryAsync(request.AlertId ?? string.Empty, request.Prompt);

        return Ok(new AiQueryResponse(
            ResponseText: result.ExtractedText,
            RawResponse: result.RawJson,
            Timestamp: DateTime.UtcNow
        ));
    }
}

public record AiQueryRequest(string AlertId, string Prompt);
public record AiQueryResponse(string ResponseText, string RawResponse, DateTime Timestamp);
