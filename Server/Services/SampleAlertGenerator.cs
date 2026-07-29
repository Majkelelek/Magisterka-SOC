using System.Text.Json;
using Server.Models;

namespace Server.Services;

public static class SampleAlertGenerator
{
    private static readonly Random _random = new();

    public static Alert GenerateRandomAlert()
    {
        var alert = TryGetAlertFromDataset();
        if (alert != null)
        {
            return alert;
        }

        return FallbackAlert();
    }

    public static List<Alert> GenerateInitialAlertSet(int count = 5)
    {
        var alerts = new List<Alert>();
        for (int i = 0; i < count; i++)
        {
            var alert = GenerateRandomAlert();
            alert.Timestamp = DateTime.UtcNow.AddMinutes(-(i * 15 + _random.Next(1, 5)));
            alerts.Add(alert);
        }
        return alerts;
    }

    private static Alert? TryGetAlertFromDataset()
    {
        try
        {
            string jsonPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "test_pytania.json");
            if (!File.Exists(jsonPath))
            {
                jsonPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "test_pytania.json");
            }

            if (File.Exists(jsonPath))
            {
                var jsonText = File.ReadAllText(jsonPath);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var alerts = JsonSerializer.Deserialize<List<Alert>>(jsonText, options);
                if (alerts != null && alerts.Count > 0)
                {
                    var selected = alerts[_random.Next(alerts.Count)];
                    selected.Id = $"ALT-{_random.Next(100000, 999999)}";
                    selected.Timestamp = DateTime.UtcNow.AddMinutes(-_random.Next(1, 120));
                    return selected;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SampleAlertGenerator] Błąd odczytu zestawu testowego: {ex.Message}");
        }

        return null;
    }

    private static Alert FallbackAlert()
    {
        return new Alert
        {
            Id = $"ALT-{DateTime.UtcNow:yyyyMMdd}-0001",
            Title = "LANL 2017: Wykrycie ataku Kerberoasting (EventID 4769)",
            Severity = "High",
            Category = "Privilege Escalation",
            Status = "New",
            Timestamp = DateTime.UtcNow,
            SourceIp = "10.0.14.88",
            DestinationHost = "Comp883934$",
            UserAccount = "User624729",
            MitreTechnique = "T1558.003 - Steal or Forge Kerberos Tickets",
            Description = "Zdarzenie z bazy LANL 2017.",
            RawLogs = new List<string> { "{\"EventID\": 4769, \"UserName\": \"User624729\"}" }
        };
    }
}
