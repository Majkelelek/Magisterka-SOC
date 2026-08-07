using Microsoft.AspNetCore.Authentication;
using MongoDB.Driver;
using Server.Models;
using Server.Services;

EnvLoader.Load();

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://localhost:5000");

// Add services to the container.
builder.Services.AddControllers();

// Singletons & Services
builder.Services.AddSingleton<MongoDbContext>();
builder.Services.AddSingleton<AlertStore>();
builder.Services.AddSingleton<AuthService>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<AiService>();
builder.Services.AddSingleton<EvaluationService>();

// Obsługa atrybutu [Authorize] i [Authorize(Roles = "...")] w ASP.NET Core
builder.Services.AddAuthentication("MongoSession")
    .AddScheme<AuthenticationSchemeOptions, MongoSessionAuthenticationHandler>("MongoSession", null);

// CORS — ograniczone wyłącznie do zaufanych domen frontendowych
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins(
                    "http://localhost:5173",
                    "http://localhost:5174"
                )
                .AllowAnyMethod()
                .AllowAnyHeader();
        });
});

var app = builder.Build();

// Inicjalizacja pytań testowych przy starcie (bez nadpisywania istniejących w MongoDB Atlas)
try
{
    var alertStore = app.Services.GetRequiredService<AlertStore>();
    var mongoCtx = app.Services.GetRequiredService<MongoDbContext>();

    Func<List<Alert>> loadFromFile = () =>
    {
        string testSetPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "test_pytania.json");
        if (!File.Exists(testSetPath))
        {
            testSetPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "test_pytania.json");
        }

        if (File.Exists(testSetPath))
        {
            var jsonText = File.ReadAllText(testSetPath);
            var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            return System.Text.Json.JsonSerializer.Deserialize<List<Alert>>(jsonText, options) ?? new();
        }
        return new List<Alert>();
    };

    if (mongoCtx.IsConnectedToMongo && mongoCtx.Alerts != null)
    {
        long existingCount = mongoCtx.Alerts.CountDocuments(Builders<Alert>.Filter.Empty);
        if (existingCount > 0)
        {
            var mongoAlerts = mongoCtx.Alerts.Find(Builders<Alert>.Filter.Empty).ToList();
            alertStore.SetAlerts(mongoAlerts);
            Console.WriteLine($"[MongoDB Atlas] Pomyślnie wczytano {mongoAlerts.Count} pytań z bazy danych.");
        }
        else
        {
            List<Alert> fileAlerts = loadFromFile();
            if (fileAlerts.Count > 0)
            {
                alertStore.SetAlerts(fileAlerts);
                var bulkOps = fileAlerts.Select(a => new ReplaceOneModel<Alert>(
                    Builders<Alert>.Filter.Eq(x => x.Id, a.Id), a) { IsUpsert = true }).ToList();
                mongoCtx.Alerts.BulkWrite(bulkOps);
                Console.WriteLine($"[MongoDB Atlas] Baza pytań była pusta. Zainicjowano {fileAlerts.Count} pytań z pliku.");
            }
        }

        if (mongoCtx.Users != null)
        {
            try
            {
                mongoCtx.Users.Database.DropCollection("Sessions");
            }
            catch { }
        }
    }
    else
    {
        List<Alert> fileAlerts = loadFromFile();
        if (fileAlerts.Count > 0)
        {
            alertStore.SetAlerts(fileAlerts);
            Console.WriteLine($"[AlertStore] Tryb bez MongoDB: Wczytano {fileAlerts.Count} pytań z pliku lokalnego.");
        }
    }
}
catch (Exception ex)
{
    Console.WriteLine($"[Inicjalizacja Startowa BŁĄD] {ex.Message}");
}

// Configure the HTTP request pipeline.
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
