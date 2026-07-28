using System.Text.Json;
using Server.Models;

namespace Server.Services;

public static class SampleAlertGenerator
{
    private static readonly Random _random = new();

    public static Alert GenerateRandomAlert()
    {
        var lanlAlert = TryGetAlertFromLanlFile();
        if (lanlAlert != null)
        {
            return lanlAlert;
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

    private static Alert? TryGetAlertFromLanlFile()
    {
        try
        {
            string lanlPath = Path.Combine(Directory.GetCurrentDirectory(), "Dane", "wls_day-01");
            if (!File.Exists(lanlPath))
            {
                lanlPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "Dane", "wls_day-01");
            }
            if (!File.Exists(lanlPath))
            {
                lanlPath = @"c:\Users\Majki\Desktop\Magisterka\APKA MGR\Dane\wls_day-01";
            }

            if (File.Exists(lanlPath))
            {
                using var fs = new FileStream(lanlPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                long fileLength = fs.Length;
                if (fileLength > 1000)
                {
                    // Losowy skok w 12GB pliku LANL 2017
                    long randomOffset = (long)(_random.NextDouble() * (fileLength - 2000));
                    fs.Seek(randomOffset, SeekOrigin.Begin);

                    using var reader = new StreamReader(fs);
                    reader.ReadLine(); // pomiń pierwszą uciętą linię

                    string? jsonLine = reader.ReadLine();
                    if (!string.IsNullOrWhiteSpace(jsonLine))
                    {
                        using var doc = JsonDocument.Parse(jsonLine);
                        var root = doc.RootElement;

                        int eventId = root.TryGetProperty("EventID", out var evProp) ? evProp.GetInt32() : 4624;
                        string username = root.TryGetProperty("UserName", out var uProp) ? uProp.GetString() ?? "User" : "User";
                        string logHost = root.TryGetProperty("LogHost", out var hProp) ? hProp.GetString() ?? "Comp-LANL" : "Comp-LANL";
                        string domain = root.TryGetProperty("DomainName", out var dProp) ? dProp.GetString() ?? "Domain" : "Domain";
                        string process = root.TryGetProperty("ProcessName", out var pProp) ? pProp.GetString() ?? "" : "";
                        string parentProcess = root.TryGetProperty("ParentProcessName", out var ppProp) ? ppProp.GetString() ?? "" : "";

                        string title = $"LANL 2017: Wykryto zdarzenie EventID {eventId} na hoście {logHost}";
                        string severity = eventId == 4672 ? "High" : (eventId == 4688 && (process.Contains("rundll32") || process.Contains("cmd") || process.Contains("powershell")) ? "Critical" : "Medium");
                        string category = eventId == 4688 ? "Process Execution" : (eventId == 4672 ? "Privilege Escalation" : "Authentication Anomaly");
                        string mitre = eventId == 4688 ? "T1059 - Command and Scripting Interpreter" : (eventId == 4672 ? "T1078 - Valid Accounts" : "T1078.002 - Domain Accounts");

                        return new Alert
                        {
                            Id = $"LANL-{_random.Next(100000, 999999)}",
                            Title = title,
                            Severity = severity,
                            Category = category,
                            Status = "New",
                            Timestamp = DateTime.UtcNow.AddMinutes(-_random.Next(1, 120)),
                            SourceIp = $"10.0.{_random.Next(1, 254)}.{_random.Next(1, 254)}",
                            DestinationHost = logHost,
                            UserAccount = $"{domain}\\{username}",
                            MitreTechnique = mitre,
                            Description = $"Autentyczne zdarzenie odczytane w czasie rzeczywistym z pliku wls_day-01 (Los Alamos National Lab). Wywołanie procesu: '{process}' (Proces nadrzędny: '{parentProcess}').",
                            RawLogs = new List<string> { jsonLine }
                        };
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SampleAlertGenerator] Błąd odczytu z wls_day-01: {ex.Message}");
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
