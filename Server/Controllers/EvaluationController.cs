using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EvaluationController : ControllerBase
{
    private readonly EvaluationService _evaluationService;

    public EvaluationController(EvaluationService evaluationService)
    {
        _evaluationService = evaluationService;
    }

    [HttpPost("run")]
    public async Task<IActionResult> RunEvaluation(
        [FromQuery] int count = 24,
        [FromQuery] string mode = "both",
        [FromQuery] string ollamaModel = "llama3.2",
        [FromQuery] int samplesPerCategory = 2,
        [FromQuery] int iterations = 1,
        [FromQuery] string provider = "openai")
    {
        try
        {
            if (count <= 0) count = 24;
            if (samplesPerCategory <= 0) samplesPerCategory = 2;
            if (iterations <= 0) iterations = 1;
            if (string.IsNullOrWhiteSpace(provider)) provider = "openai";

            var reports = await _evaluationService.RunBenchmarkBatchAsync(count, mode, ollamaModel, samplesPerCategory, iterations, provider);
            var latestReport = reports.LastOrDefault();
            
            var msg = iterations > 1 
                ? $"Pomyślnie przeprowadzono {reports.Count} prób(y) testowych dla modelu '{ollamaModel}' (łącznie {reports.Count * count} pytania)."
                : mode switch
                {
                    "base" => $"Pomyślnie przeprowadzono test Modelu Bazowego (Ollama '{ollamaModel}') dla {latestReport?.TotalRecordsTested} rekordów.",
                    "azure-base" => $"Pomyślnie przeprowadzono test Modelu Bazowego (Azure) dla {latestReport?.TotalRecordsTested} rekordów.",
                    "ft" => $"Pomyślnie przeprowadzono test Modelu Wyfinetuningowanego (Azure OpenAI FT) dla {latestReport?.TotalRecordsTested} rekordów.",
                    _ => $"Pomyślnie przeprowadzono pełny benchmark porównawczy dla {latestReport?.TotalRecordsTested} rekordów."
                };

            return Ok(new
            {
                success = true,
                message = msg,
                report = latestReport,
                reports
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new
            {
                success = false,
                message = ex.Message
            });
        }
    }

    [HttpGet("ollama-models")]
    public async Task<IActionResult> GetOllamaModels()
    {
        var models = await _evaluationService.GetAvailableOllamaModelsAsync();
        return Ok(new
        {
            success = models.Count > 0,
            models,
            isOllamaOnline = models.Count > 0
        });
    }

    [HttpGet("latest")]
    public async Task<IActionResult> GetLatestReport()
    {
        var latest = EvaluationService.GetLatestReport();
        if (latest == null)
        {
            var reports = await _evaluationService.GetHistoricalReportsAsync();
            latest = reports.Count > 0 ? reports[0] : null;
        }

        if (latest == null)
        {
            return Ok(new { success = false, message = "Brak dostępnych raportów ewaluacji.", report = (object?)null });
        }

        return Ok(new { success = true, report = latest });
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistoricalReports()
    {
        var reports = await _evaluationService.GetHistoricalReportsAsync();
        return Ok(new { success = true, reports });
    }

    [HttpDelete("{reportId}")]
    public async Task<IActionResult> DeleteReport(string reportId)
    {
        var success = await _evaluationService.DeleteReportAsync(reportId);
        if (success)
        {
            return Ok(new { success = true, message = $"Usunięto próbę benchmarku ID: {reportId}" });
        }
        return NotFound(new { success = false, message = $"Nie znaleziono raportu o ID: {reportId}" });
    }
}
