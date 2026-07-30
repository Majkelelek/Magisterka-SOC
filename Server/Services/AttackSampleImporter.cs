using System.Text.Json;
using Server.Models;

namespace Server.Services;

public static class AttackSampleImporter
{
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
            return alerts;
        }

        try
        {
            string jsonText = File.ReadAllText(filePath);
            using var doc = JsonDocument.Parse(jsonText);
            var root = doc.RootElement;

            if (root.ValueKind != JsonValueKind.Array)
            {
                return alerts;
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
                        correctAction = "Dismiss / False Positive";
                        mitreTechnique = "N/A - Legitimate Network Activity";
                        break;
                    case "DDOS":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network DDoS na Port {destPort}";
                        severity = "Critical";
                        category = "DDoS Flood Attack";
                        correctAction = "Isolate Host / Block";
                        mitreTechnique = "T1498.001 - Direct Volume Flood";
                        break;
                    case "WEB ATTACK - SQL INJECTION":
                    case "WEB ATTACK – SQL INJECTION":
                    case "SQL INJECTION":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network Web Attack - Sql Injection na Port {destPort}";
                        severity = "Critical";
                        category = "Database Exploit";
                        correctAction = "Escalate / Tier 2";
                        mitreTechnique = "T1190 - SQL Injection Exploit";
                        break;
                    case "WEB ATTACK - BRUTE FORCE":
                    case "WEB ATTACK – BRUTE FORCE":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network Web Attack - Brute Force na Port {destPort}";
                        severity = "High";
                        category = "Web Brute Force Attack";
                        correctAction = "Investigate / Reset Password";
                        mitreTechnique = "T1110.001 - Password Guessing (Web Application)";
                        break;
                    case "WEB ATTACK - XSS":
                    case "WEB ATTACK – XSS":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network Web Attack - XSS na Port {destPort}";
                        severity = "High";
                        category = "Web Vulnerability Exploitation";
                        correctAction = "Escalate / Tier 2";
                        mitreTechnique = "T1059.007 - JavaScript XSS Injection";
                        break;
                    case "SSH-PATATOR":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network SSH-Patator na Port {destPort}";
                        severity = "High";
                        category = "Credential Brute Force";
                        correctAction = "Investigate / Reset Password";
                        mitreTechnique = "T1110.001 - Password Spraying / Brute Force (SSH)";
                        break;
                    case "FTP-PATATOR":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network FTP-Patator na Port {destPort}";
                        severity = "High";
                        category = "Credential Brute Force";
                        correctAction = "Investigate / Reset Password";
                        mitreTechnique = "T1110.001 - Password Spraying / Brute Force (FTP)";
                        break;
                    case "DOS HULK":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network DoS Hulk na Port {destPort}";
                        severity = "Critical";
                        category = "HTTP Flood DoS Attack";
                        correctAction = "Isolate Host / Block";
                        mitreTechnique = "T1498.001 - Direct Volume Flood (HULK DoS)";
                        break;
                    case "DOS SLOWLORIS":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network DoS slowloris na Port {destPort}";
                        severity = "High";
                        category = "Application DoS Attack";
                        correctAction = "Isolate Host / Block";
                        mitreTechnique = "T1499.002 - Service Exhaustion Flood (Slowloris)";
                        break;
                    case "DOS SLOWHTTPTEST":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network DoS Slowhttptest na Port {destPort}";
                        severity = "High";
                        category = "Application DoS Attack";
                        correctAction = "Isolate Host / Block";
                        mitreTechnique = "T1499.002 - Service Exhaustion Flood (Slow HTTP)";
                        break;
                    case "BOT":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network Bot na Port {destPort}";
                        severity = "High";
                        category = "Botnet Command & Control";
                        correctAction = "Isolate Host / Block";
                        mitreTechnique = "T1071.001 - Web Protocols Command and Control (Botnet C2)";
                        break;
                    case "PORTSCAN":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network PortScan na Port {destPort}";
                        severity = "Medium";
                        category = "Network Reconnaissance";
                        correctAction = "Isolate Host / Block";
                        mitreTechnique = "T1046 - Network Service Discovery (Port Scan)";
                        break;
                    case "INFILTRATION":
                        title = $"Zdarzenie #{index:D2}: Wykryto Atak Network Infiltration na Port {destPort}";
                        severity = "Critical";
                        category = "Network Infiltration";
                        correctAction = "Escalate / Tier 2";
                        mitreTechnique = "T1190 - Exploit Public-Facing Application (Infiltration)";
                        break;
                    default:
                        title = $"Zdarzenie #{index:D2}: Wykryto Anomalię Sieciową ({label}) na Port {destPort}";
                        severity = "Medium";
                        category = "Network Anomaly";
                        correctAction = "Escalate / Tier 2";
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
