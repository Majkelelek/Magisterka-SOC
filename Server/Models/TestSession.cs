namespace Server.Models;

public class TestSession
{
    public string SessionId { get; set; } = Guid.NewGuid().ToString();
    public string OperatorName { get; set; } = "Operator_SOC_1";
    public string Mode { get; set; } = "NoAI"; // "NoAI" or "WithAI"
    public DateTime StartTime { get; set; } = DateTime.UtcNow;
    public DateTime? EndTime { get; set; }
    public int AlertsHandledCount { get; set; }
    public double TotalDurationSeconds { get; set; }
    public List<AlertDecision> Decisions { get; set; } = new();
}

public class AlertDecision
{
    public string AlertId { get; set; } = string.Empty;
    public string ActionTaken { get; set; } = string.Empty; // "IsolateHost", "BlockIP", "Escalate", "Dismiss"
    public int DecisionTimeSeconds { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
