using Server.Models;

namespace Server.Services;

public class AlertStore
{
    private readonly List<Alert> _alerts = new();
    private readonly List<TestSession> _sessions = new();

    public AlertStore()
    {
        _alerts.AddRange(SampleAlertGenerator.GenerateInitialAlertSet(6));
    }

    public List<Alert> GetAllAlerts() => _alerts;

    public Alert? GetAlertById(string id) => _alerts.FirstOrDefault(a => a.Id == id);

    public Alert GenerateRandomAlert()
    {
        var alert = SampleAlertGenerator.GenerateRandomAlert();
        _alerts.Insert(0, alert);
        return alert;
    }

    public void AddAlert(Alert alert)
    {
        if (string.IsNullOrEmpty(alert.Id))
        {
            alert.Id = $"ALT-{DateTime.UtcNow:yyyyMMdd}-{_alerts.Count + 1:D4}";
        }
        _alerts.Add(alert);
    }

    public bool UpdateAlertStatus(string id, string newStatus)
    {
        var alert = GetAlertById(id);
        if (alert == null) return false;
        alert.Status = newStatus;
        return true;
    }

    public void AddTestSession(TestSession session)
    {
        _sessions.Add(session);
    }

    public List<TestSession> GetTestSessions() => _sessions;
}
