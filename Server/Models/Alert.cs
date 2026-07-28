namespace Server.Models;

public class Alert
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Severity { get; set; } = "Low"; // Critical, High, Medium, Low
    public string Category { get; set; } = "General";
    public string Status { get; set; } = "New"; // New, In Progress, Resolved, Escalated, Dismissed
    public DateTime Timestamp { get; set; }
    public string SourceIp { get; set; } = string.Empty;
    public string DestinationHost { get; set; } = string.Empty;
    public string UserAccount { get; set; } = string.Empty;
    public string MitreTechnique { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> RawLogs { get; set; } = new();

    // AI Enrichment fields
    public string AiSummary { get; set; } = string.Empty;
    public int AiConfidenceScore { get; set; }
    public string AiRiskAnalysis { get; set; } = string.Empty;
    public List<string> AiRecommendedActions { get; set; } = new();
}
