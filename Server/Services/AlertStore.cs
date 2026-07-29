using MongoDB.Driver;
using Server.Models;

namespace Server.Services;

public class AlertStore
{
    private readonly List<Alert> _alerts = new();
    private readonly List<TestSession> _sessions = new();
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

    public void AddTestSession(TestSession session)
    {
        if (string.IsNullOrWhiteSpace(session.SessionId))
        {
            session.SessionId = Guid.NewGuid().ToString();
        }

        lock (_sessions)
        {
            // Usuwamy istniejący wpis dla tej samej sesji (pod tym samym ID lub pod tą samą kombinacją operatora, trybu i czasu rozpoczęcia)
            _sessions.RemoveAll(s => s.SessionId == session.SessionId || 
                (s.OperatorName == session.OperatorName && s.Mode == session.Mode && Math.Abs((s.StartTime - session.StartTime).TotalMinutes) < 1.5));

            _sessions.Add(session);
        }

        if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.TestSessions != null)
        {
            try
            {
                var filter = Builders<TestSession>.Filter.Eq(s => s.SessionId, session.SessionId);
                _mongoContext.TestSessions.ReplaceOne(filter, session, new ReplaceOptions { IsUpsert = true });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AlertStore] Błąd zapisu sesji w MongoDB: {ex.Message}");
            }
        }
    }

    public List<TestSession> GetTestSessions()
    {
        List<TestSession> allSessions = new();

        if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.TestSessions != null)
        {
            try
            {
                var mongoList = _mongoContext.TestSessions.Find(_ => true).ToList();
                if (mongoList.Count > 0)
                {
                    allSessions.AddRange(mongoList);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AlertStore] Błąd pobierania sesji z MongoDB: {ex.Message}");
            }
        }

        lock (_sessions)
        {
            foreach (var s in _sessions)
            {
                if (!allSessions.Any(existing => existing.SessionId == s.SessionId))
                {
                    allSessions.Add(s);
                }
            }
        }

        // Kondensacja: Grupowanie po SessionId lub kombinacji (OperatorName + Mode + StartTime z dokładnością do minuty)
        // I wybieranie dla każdego podejścia wpisu o największej liczbie obsłużonych alertów (AlertsHandledCount)
        var condensedSessions = allSessions
            .GroupBy(s => !string.IsNullOrEmpty(s.SessionId) 
                ? s.SessionId 
                : $"{s.OperatorName}_{s.Mode}_{s.StartTime:yyyyMMddHHmm}")
            .Select(g => g.OrderByDescending(x => x.AlertsHandledCount).ThenByDescending(x => x.Decisions.Count).First())
            .OrderByDescending(s => s.StartTime)
            .ToList();

        return condensedSessions;
    }

    public bool DeleteTestSession(string sessionId)
    {
        bool removedInMemory = false;
        lock (_sessions)
        {
            int removedCount = _sessions.RemoveAll(s => s.SessionId == sessionId || 
                $"{s.OperatorName}_{s.Mode}_{s.StartTime:yyyyMMddHHmm}" == sessionId);
            removedInMemory = removedCount > 0;
        }

        if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.TestSessions != null)
        {
            try
            {
                var filter = Builders<TestSession>.Filter.Or(
                    Builders<TestSession>.Filter.Eq(s => s.SessionId, sessionId),
                    Builders<TestSession>.Filter.Regex(s => s.SessionId, new MongoDB.Bson.BsonRegularExpression(sessionId, "i"))
                );
                var deleteResult = _mongoContext.TestSessions.DeleteMany(filter);
                return deleteResult.DeletedCount > 0 || removedInMemory;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AlertStore] Błąd usuwania sesji z MongoDB: {ex.Message}");
            }
        }

        return removedInMemory;
    }

    public void ClearAllTestSessions()
    {
        lock (_sessions)
        {
            _sessions.Clear();
        }

        if (_mongoContext?.IsConnectedToMongo == true && _mongoContext.TestSessions != null)
        {
            try
            {
                _mongoContext.TestSessions.DeleteMany(_ => true);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AlertStore] Błąd czyszczenia wszystkich sesji w MongoDB: {ex.Message}");
            }
        }
    }
}
