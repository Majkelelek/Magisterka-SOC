using System.Text.Json;
using Server.Models;

namespace Server.Services;

public static class AttackSampleImporter
{
    public static string FindPerformanceDatasetDirectory()
    {
        string[] candidates = new[]
        {
            Path.Combine(Directory.GetCurrentDirectory(), "Dane", "dane_do_wydajności"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "Dane", "dane_do_wydajności"),
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Dane", "dane_do_wydajności"),
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "Dane", "dane_do_wydajności"),
            @"C:\Users\Majki\Desktop\Magisterka\APKA MGR\Dane\dane_do_wydajności"
        };

        foreach (var path in candidates)
        {
            if (Directory.Exists(path))
            {
                return Path.GetFullPath(path);
            }
        }

        return string.Empty;
    }

    public static List<(string FileName, string DisplayName, int Count)> GetAvailableDatasets()
    {
        var result = new List<(string FileName, string DisplayName, int Count)>();
        string dir = FindPerformanceDatasetDirectory();
        if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return result;

        var files = Directory.GetFiles(dir, "eval_*.json").OrderBy(f => f).ToList();
        int totalAllCount = 0;

        foreach (var file in files)
        {
            try
            {
                var text = File.ReadAllText(file);
                using var doc = JsonDocument.Parse(text);
                if (doc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    int count = doc.RootElement.GetArrayLength();
                    totalAllCount += count;
                    string name = Path.GetFileName(file);
                    string category = name.Replace("eval_", "").Replace("_100.json", "").Replace(".json", "").Replace("___", " - ");
                    result.Add((name, $"Zestaw {category} ({count} pytań)", count));
                }
            }
            catch { }
        }

        if (result.Count > 0)
        {
            result.Insert(0, ("eval_ALL.json", $"Wszystkie Zestawy Wydajnościowe (Łącznie {totalAllCount} pytań)", totalAllCount));
        }

        return result;
    }

    public static List<Alert> ConvertPerformanceFilesToAlerts(string datasetFileName = "eval_ALL.json")
    {
        var alerts = new List<Alert>();
        string dir = FindPerformanceDatasetDirectory();
        if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return alerts;

        List<string> filesToProcess = new();
        if (datasetFileName.Equals("eval_ALL.json", StringComparison.OrdinalIgnoreCase) || datasetFileName.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            filesToProcess = Directory.GetFiles(dir, "eval_*.json").OrderBy(f => f).ToList();
        }
        else
        {
            string singleFile = Path.Combine(dir, datasetFileName);
            if (File.Exists(singleFile))
            {
                filesToProcess.Add(singleFile);
            }
            else
            {
                // Try fuzzy match
                var match = Directory.GetFiles(dir, "*").FirstOrDefault(f => Path.GetFileName(f).Equals(datasetFileName, StringComparison.OrdinalIgnoreCase));
                if (match != null) filesToProcess.Add(match);
            }
        }

        int index = 1;
        foreach (var file in filesToProcess)
        {
            try
            {
                string jsonText = File.ReadAllText(file);
                var items = JsonSerializer.Deserialize<List<PerformanceTestItem>>(jsonText, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (items == null) continue;

                foreach (var item in items)
                {
                    var groundTruthCategory = string.IsNullOrWhiteSpace(item.GroundTruth) ? "Unknown" : item.GroundTruth.Trim();
                    bool isThreat = !groundTruthCategory.Equals("BENIGN", StringComparison.OrdinalIgnoreCase);

                    var systemMsg = item.Messages?.FirstOrDefault(m => m.Role.Equals("system", StringComparison.OrdinalIgnoreCase))?.Content ?? "";
                    var userMsg = item.Messages?.FirstOrDefault(m => m.Role.Equals("user", StringComparison.OrdinalIgnoreCase))?.Content ?? "";
                    var assistantMsg = item.Messages?.FirstOrDefault(m => m.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase))?.Content ?? "";

                    string severity = "Medium";
                    if (!isThreat) severity = "Low";
                    else if (groundTruthCategory.ToUpperInvariant().Contains("DDOS") || groundTruthCategory.ToUpperInvariant().Contains("HULK") || groundTruthCategory.ToUpperInvariant().Contains("SQL") || groundTruthCategory.ToUpperInvariant().Contains("INFILTRATION"))
                        severity = "Critical";
                    else
                        severity = "High";

                    string title = isThreat 
                        ? $"Zdarzenie #{index:D3}: Wykryto Incydent sieciowy {groundTruthCategory} ({item.Id})"
                        : $"Zdarzenie #{index:D3}: Rutynowy Przepływ Sieciowy BENIGN ({item.Id})";

                    string correctAction = !string.IsNullOrWhiteSpace(item.ExpectedAction) ? item.ExpectedAction : (isThreat ? "Isolation" : "Dismiss");
                    string mitre = GetMitreForCategory(groundTruthCategory);

                    string desc = !string.IsNullOrWhiteSpace(assistantMsg)
                        ? assistantMsg
                        : $"Rekord z bazy wydajnościowej dla kategorii: {groundTruthCategory}. Oczekiwana akcja: {correctAction}.";

                    var alert = new Alert
                    {
                        Id = string.IsNullOrWhiteSpace(item.Id) ? $"ALT-{index:D3}" : item.Id,
                        Title = title,
                        Severity = severity,
                        Category = groundTruthCategory,
                        Status = "New",
                        Timestamp = DateTime.UtcNow.AddMinutes(-((index * 15) % 1440)),
                        SourceIp = isThreat ? $"185.220.101.{(index % 240) + 10}" : $"192.168.10.{(index % 40) + 5}",
                        DestinationHost = "Web Server 16 Public (192.168.10.50 / Port 80)",
                        UserAccount = isThreat ? $"EXTERNAL_ATTACKER\\node_{index:D2}" : "CORP\\user_analyst",
                        MitreTechnique = mitre,
                        Description = desc,
                        RawLogs = new List<string> { string.IsNullOrWhiteSpace(userMsg) ? "NetFlow Raw Data" : userMsg },
                        IsThreat = isThreat,
                        CorrectAction = correctAction
                    };

                    alerts.Add(alert);
                    index++;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AttackSampleImporter] Błąd przetwarzania {Path.GetFileName(file)}: {ex.Message}");
            }
        }

        return alerts;
    }

    private static string GetMitreForCategory(string category)
    {
        switch (category.ToUpperInvariant())
        {
            case "BENIGN": return "N/A - Legitimate Activity";
            case "DDOS": return "T1498.001 - Direct Volume Flood";
            case "BOT": return "T1071.001 - Web Protocols Command & Control";
            case "DOS GOLDENEYE": return "T1498.001 - Direct Volume Flood (GoldenEye)";
            case "DOS HULK": return "T1498.001 - Direct Volume Flood (HULK DoS)";
            case "DOS SLOWHTTPTEST": return "T1499.002 - Service Exhaustion Flood (Slow HTTP)";
            case "DOS SLOWLORIS": return "T1499.002 - Service Exhaustion Flood (Slowloris)";
            case "FTP-PATATOR": return "T1110.001 - Password Spraying / Brute Force (FTP)";
            case "PORTSCAN": return "T1046 - Network Service Discovery (Port Scan)";
            case "SSH-PATATOR": return "T1110.001 - Password Spraying / Brute Force (SSH)";
            case "WEB ATTACK - BRUTE FORCE":
            case "WEB ATTACK – BRUTE FORCE": return "T1110.001 - Password Guessing (Web)";
            case "WEB ATTACK - XSS":
            case "WEB ATTACK – XSS": return "T1059.007 - JavaScript XSS Injection";
            default: return $"T1059 - {category}";
        }
    }

    public static string FindAttackSamplesFilePath()
    {
        string[] candidates = new[]
        {
            Path.Combine(Directory.GetCurrentDirectory(), "..", "Dane", "próbki_ataków_zbiorcze.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "Dane", "próbki_ataków_zbiorcze.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "Data", "próbki_ataków_zbiorcze.json"),
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "próbki_ataków_zbiorcze.json")
        };

        foreach (var path in candidates)
        {
            if (File.Exists(path))
            {
                return Path.GetFullPath(path);
            }
        }

        return string.Empty;
    }

    public static List<Alert> ConvertSamplesToAlerts(string filePath, int startIdIndex = 1)
    {
        var alerts = new List<Alert>();
        if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
        {
            // Fallback: convert all performance files in Dane/dane_do_wydajności
            return ConvertPerformanceFilesToAlerts("eval_ALL.json");
        }

        try
        {
            string jsonText = File.ReadAllText(filePath);
            using var doc = JsonDocument.Parse(jsonText);
            var root = doc.RootElement;

            if (root.ValueKind != JsonValueKind.Array)
            {
                return ConvertPerformanceFilesToAlerts("eval_ALL.json");
            }

            int index = startIdIndex;
            string[] servers = new[]
            {
                "Web Server 16 Public (192.168.10.50 / 205.174.165.68)",
                "Ubuntu Server 12 Public (192.168.10.51 / 205.174.165.66)",
                "DNS + DC Server (192.168.10.3)"
            };

            string[] benignUsers = new[]
            {
                "CORP\\fin_analyst",
                "CORP\\dev_mac",
                "CORP\\devops_admin",
                "CORP\\sec_analyst"
            };

            int sampleNum = 1;
            foreach (var element in root.EnumerateArray())
            {
                var dict = new Dictionary<string, string>();
                foreach (var prop in element.EnumerateObject())
                {
                    dict[prop.Name.Trim()] = prop.Value.ToString();
                }

                string label = GetOrInferLabel(dict, sampleNum);
                string destPort = dict.TryGetValue("Destination Port", out var dPort) ? dPort.Trim() : "80";
                string flowDuration = dict.TryGetValue("Flow Duration", out var fDur) ? fDur.Trim() : "0";
                string flowPackets = dict.TryGetValue("Flow Packets/s", out var fPkt) ? fPkt.Trim() : "0";
                string flowBytes = dict.TryGetValue("Flow Bytes/s", out var fByt) ? fByt.Trim() : "0";
                string fwdPackets = dict.TryGetValue("Total Fwd Packets", out var fFwd) ? fFwd.Trim() : "1";
                string bwdPackets = dict.TryGetValue("Total Backward Packets", out var fBwd) ? fBwd.Trim() : "1";

                bool isThreat = !label.Equals("BENIGN", StringComparison.OrdinalIgnoreCase);

                string id = $"ALT-{index:D3}";
                string serverHost = servers[(index - 1) % servers.Length] + $" (Port {destPort})";
                string sourceIp = isThreat ? $"185.220.101.{(index % 240) + 10}" : $"192.168.10.{(index % 40) + 5}";
                string userAccount = isThreat ? $"EXTERNAL_ATTACKER\\node_{index:D2}" : benignUsers[index % benignUsers.Length];

                string title;
                string severity;
                string category;
                string correctAction;
                string mitreTechnique;

                switch (label.ToUpperInvariant())
                {
                    case "BENIGN":
                        title = $"Zdarzenie #{index:D2}: Rutynowa Komunikacja Stacji {sourceIp} z Serwerem (Port {destPort})";
                        severity = "Low";
                        category = "Normal Network Traffic";
                        correctAction = "Dismiss";
                        mitreTechnique = "N/A - Legitimate Network Activity";
                        break;
                    case "DDOS":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network DDoS na Port {destPort}";
                        severity = "Critical";
                        category = "DDoS Flood Attack";
                        correctAction = "Isolation";
                        mitreTechnique = "T1498.001 - Direct Volume Flood";
                        break;
                    case "WEB ATTACK - SQL INJECTION":
                    case "WEB ATTACK – SQL INJECTION":
                    case "SQL INJECTION":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network Web Attack - Sql Injection na Port {destPort}";
                        severity = "Critical";
                        category = "Database Exploit";
                        correctAction = "Escalation";
                        mitreTechnique = "T1190 - SQL Injection Exploit";
                        break;
                    case "WEB ATTACK - BRUTE FORCE":
                    case "WEB ATTACK – BRUTE FORCE":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network Web Attack - Brute Force na Port {destPort}";
                        severity = "High";
                        category = "Web Brute Force Attack";
                        correctAction = "Isolation";
                        mitreTechnique = "T1110.001 - Password Guessing (Web Application)";
                        break;
                    case "WEB ATTACK - XSS":
                    case "WEB ATTACK – XSS":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network Web Attack - XSS na Port {destPort}";
                        severity = "High";
                        category = "Web Vulnerability Exploitation";
                        correctAction = "Escalation";
                        mitreTechnique = "T1059.007 - JavaScript XSS Injection";
                        break;
                    case "SSH-PATATOR":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network SSH-Patator na Port {destPort}";
                        severity = "High";
                        category = "Credential Brute Force";
                        correctAction = "Isolation";
                        mitreTechnique = "T1110.001 - Password Spraying / Brute Force (SSH)";
                        break;
                    case "FTP-PATATOR":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network FTP-Patator na Port {destPort}";
                        severity = "High";
                        category = "Credential Brute Force";
                        correctAction = "Isolation";
                        mitreTechnique = "T1110.001 - Password Spraying / Brute Force (FTP)";
                        break;
                    case "DOS HULK":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network DoS Hulk na Port {destPort}";
                        severity = "Critical";
                        category = "HTTP Flood DoS Attack";
                        correctAction = "Isolation";
                        mitreTechnique = "T1498.001 - Direct Volume Flood (HULK DoS)";
                        break;
                    case "DOS SLOWLORIS":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network DoS slowloris na Port {destPort}";
                        severity = "High";
                        category = "Application DoS Attack";
                        correctAction = "Isolation";
                        mitreTechnique = "T1499.002 - Service Exhaustion Flood (Slowloris)";
                        break;
                    case "DOS SLOWHTTPTEST":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network DoS Slowhttptest na Port {destPort}";
                        severity = "High";
                        category = "Application DoS Attack";
                        correctAction = "Isolation";
                        mitreTechnique = "T1499.002 - Service Exhaustion Flood (Slow HTTP)";
                        break;
                    case "BOT":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network Bot na Port {destPort}";
                        severity = "High";
                        category = "Botnet Command & Control";
                        correctAction = "Isolation";
                        mitreTechnique = "T1071.001 - Web Protocols Command and Control (Botnet C2)";
                        break;
                    case "PORTSCAN":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network PortScan na Port {destPort}";
                        severity = "Medium";
                        category = "Network Reconnaissance";
                        correctAction = "Escalation";
                        mitreTechnique = "T1046 - Network Service Discovery (Port Scan)";
                        break;
                    case "INFILTRATION":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network Infiltration na Port {destPort}";
                        severity = "Critical";
                        category = "Network Infiltration";
                        correctAction = "Escalation";
                        mitreTechnique = "T1190 - Exploit Public-Facing Application (Infiltration)";
                        break;
                    default:
                        title = $"Zdarzenie #{index:D2}: Wykryto Anomalię Sieciową ({label}) na Port {destPort}";
                        severity = "Medium";
                        category = "Network Anomaly";
                        correctAction = "Escalation";
                        mitreTechnique = "T1059 - Network Protocol Anomaly";
                        break;
                }

                string description;
                if (isThreat)
                {
                    description = $"Wykryto anomalię sieciową typu {label} wymierzoną w serwer chronionej sieci: {serverHost}. " +
                                  $"Adres źródłowy natarcia: {sourceIp}. Przepływ trwał {flowDuration} µs i wygenerował {flowPackets} pkt/s " +
                                  $"przy natężeniu transferu {flowBytes} B/s. Stosunek pakietów Fwd/Bwd: {fwdPackets} vs {bwdPackets}.";
                }
                else
                {
                    description = $"Zarejestrowano standardowy przepływ sieciowy ze stacji roboczej {sourceIp} do serwera {serverHost}. " +
                                  $"Czas trwania: {flowDuration} µs. Przesłano {fwdPackets} pakietów Fwd i {bwdPackets} Bwd. " +
                                  $"Szybkość: {flowBytes} B/s ({flowPackets} pkt/s).";
                }

                string rawJsonLog = JsonSerializer.Serialize(dict, new JsonSerializerOptions { WriteIndented = true });

                var alert = new Alert
                {
                    Id = id,
                    Title = title,
                    Severity = severity,
                    Category = category,
                    Status = "New",
                    Timestamp = DateTime.UtcNow.AddMinutes(-((index * 15) % 1440)),
                    SourceIp = sourceIp,
                    DestinationHost = serverHost,
                    UserAccount = userAccount,
                    MitreTechnique = mitreTechnique,
                    Description = description,
                    RawLogs = new List<string> { rawJsonLog },
                    IsThreat = isThreat,
                    CorrectAction = correctAction
                };

                alerts.Add(alert);
                index++;
                sampleNum++;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AttackSampleImporter] Błąd konwersji próbek: {ex.Message}");
        }

        return alerts;
    }

    private static string GetOrInferLabel(Dictionary<string, string> dict, int sampleIndex)
    {
        foreach (var key in new[] { "Label", "label", "LABEL", "Class", "Attack", "Attack_Type" })
        {
            if (dict.TryGetValue(key, out var val) && !string.IsNullOrWhiteSpace(val))
            {
                return val.Trim();
            }
        }

        string[] sampleLabels = new[]
        {
            "DDOS",
            "WEB ATTACK - SQL INJECTION",
            "BENIGN",
            "SSH-PATATOR",
            "PORTSCAN",
            "WEB ATTACK - BRUTE FORCE",
            "BENIGN",
            "DOS HULK",
            "WEB ATTACK - XSS",
            "SSH-PATATOR",
            "FTP-PATATOR",
            "BENIGN",
            "DOS SLOWLORIS",
            "INFILTRATION",
            "BOT",
            "WEB ATTACK - SQL INJECTION",
            "BENIGN",
            "DOS SLOWHTTPTEST",
            "WEB ATTACK - BRUTE FORCE",
            "BENIGN"
        };

        int listIdx = (sampleIndex - 1) % sampleLabels.Length;
        return sampleLabels[listIdx];
    }
}
