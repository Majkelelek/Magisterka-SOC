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

// Automatyczna synchronizacja bazy MongoDB Atlas pytaniami testowymi z pliku przy starcie
try
{
    var alertStore = app.Services.GetRequiredService<AlertStore>();
    var mongoCtx = app.Services.GetRequiredService<MongoDbContext>();

    string testSetPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "test_pytania.json");
    if (!File.Exists(testSetPath))
    {
        testSetPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "test_pytania.json");
    }

    List<Alert> alerts = new();
    if (File.Exists(testSetPath))
    {
        var jsonText = File.ReadAllText(testSetPath);
        var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        alerts = System.Text.Json.JsonSerializer.Deserialize<List<Alert>>(jsonText, options) ?? new();
    }

    if (alerts.Count > 0)
    {
        alertStore.SetAlerts(alerts);
        if (mongoCtx.IsConnectedToMongo && mongoCtx.Alerts != null)
        {
            var bulkOps = alerts.Select(a => new ReplaceOneModel<Alert>(
                Builders<Alert>.Filter.Eq(x => x.Id, a.Id), a) { IsUpsert = true }).ToList();
            mongoCtx.Alerts.BulkWrite(bulkOps);
            Console.WriteLine($"[MongoDB Atlas] AUTOMATYCZNIE ZAPISANO {alerts.Count} PYTAŃ W BAZIE DANYCH MONGODB!");
        }
    }

    if (mongoCtx.IsConnectedToMongo && mongoCtx.Users != null)
    {
        try
        {
            mongoCtx.Users.Database.DropCollection("Sessions");
        }
        catch { }
    }
}
catch (Exception ex)
{
    Console.WriteLine($"[MongoDB Seeder BŁĄD] {ex.Message}");
}

// Configure the HTTP request pipeline.
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
