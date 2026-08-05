using MongoDB.Driver;
using Server.Models;

namespace Server.Services;

public class MongoDbContext
{
    private readonly IMongoDatabase? _database;

    public bool IsConnectedToMongo { get; private set; }

    public MongoDbContext(IConfiguration configuration)
    {
        LoadEnvFile();

        var connectionString = Environment.GetEnvironmentVariable("MONGODB_URI") 
                               ?? configuration["MongoDB:ConnectionString"];

        var dbName = Environment.GetEnvironmentVariable("MONGODB_DATABASE") 
                     ?? configuration["MongoDB:DatabaseName"] 
                     ?? "SOC_Dashboard_DB";

        if (!string.IsNullOrEmpty(connectionString))
        {
            try
            {
                var client = new MongoClient(connectionString);
                _database = client.GetDatabase(dbName);
                IsConnectedToMongo = true;
                Console.WriteLine($"[MongoDB] Pomyślnie połączono z bazą danych MongoDB Atlas ({dbName}).");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MongoDB BŁĄD] Nie można połączyć z MongoDB Atlas: {ex.Message}");
                IsConnectedToMongo = false;
            }
        }
        else
        {
            Console.WriteLine("[MongoDB BŁĄD] Brak zmiennej MONGODB_URI w pliku .env");
            IsConnectedToMongo = false;
        }
    }

    private void LoadEnvFile()
    {
        var envPath = Path.Combine(Directory.GetCurrentDirectory(), ".env");
        if (!File.Exists(envPath))
        {
            envPath = Path.Combine(Directory.GetCurrentDirectory(), "..", ".env");
        }

        if (File.Exists(envPath))
        {
            foreach (var line in File.ReadAllLines(envPath))
            {
                if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#")) continue;
                var parts = line.Split('=', 2);
                if (parts.Length == 2)
                {
                    Environment.SetEnvironmentVariable(parts[0].Trim(), parts[1].Trim());
                }
            }
        }
    }

    public IMongoCollection<User>? Users => _database?.GetCollection<User>("Users");
    public IMongoCollection<Alert>? Alerts => _database?.GetCollection<Alert>("Alerts");
    public IMongoCollection<EvaluationReport>? EvaluationReports => _database?.GetCollection<EvaluationReport>("EvaluationReports");
}
