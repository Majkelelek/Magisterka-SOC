using MongoDB.Driver;
using Server.Models;

namespace Server.Services;

public class AlertStore
{
    private readonly List<Alert> _alerts = new();
    private readonly MongoDbContext? _mongoContext;

    public AlertStore(MongoDbContext? mongoContext = null)
    {
        _mongoContext = mongoContext;
        _alerts.AddRange(SampleAlertGenerator.GenerateInitialAlertSet(6));
    }

    public List<Alert> GetAllAlerts()
    {
        lock (_alerts)
        {
            return new List<Alert>(_alerts);
        }
    }

    public Alert? GetAlertById(string id)
    {
        lock (_alerts)
        {
            return _alerts.FirstOrDefault(a => a.Id == id);
        }
    }

    public void SetAlerts(IEnumerable<Alert> alerts)
    {
        lock (_alerts)
        {
            _alerts.Clear();
            _alerts.AddRange(alerts);
        }
    }

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
}
