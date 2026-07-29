using Microsoft.AspNetCore.Authentication;
using MongoDB.Driver;
using Server.Models;
using Server.Services;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://localhost:5000");

// Add services to the container.
builder.Services.AddControllers();

// Singletons & Services
builder.Services.AddSingleton<MongoDbContext>();
builder.Services.AddSingleton<AlertStore>();
builder.Services.AddSingleton<AuthService>();
builder.Services.AddSingleton<TokenService>();

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

// Configure the HTTP request pipeline.
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
