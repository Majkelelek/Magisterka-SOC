using System.Security.Cryptography;
using System.Text;
using MongoDB.Driver;
using Server.Models;

namespace Server.Services;

public class UserTokenClaims
{
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

/// <summary>
/// DTO sesji bez wrażliwego pola Token — bezpieczny do odsyłania w API.
/// </summary>
public class SessionInfoDto
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public class TokenService
{
    private readonly MongoDbContext _mongoContext;
    private readonly string _secretKey;

    public TokenService(MongoDbContext mongoContext, IConfiguration configuration)
    {
        _mongoContext = mongoContext;

        // Zmienne środowiskowe ładowane już w MongoDbContext — nie ma potrzeby duplikacji
        _secretKey = Environment.GetEnvironmentVariable("JWT_SECRET") 
                     ?? configuration["JWT_SECRET"] 
                     ?? throw new InvalidOperationException("Brak wymaganej zmiennej środowiskowej JWT_SECRET w pliku .env");
    }

    public async Task<string> CreateSessionAsync(User user)
    {
        if (_mongoContext.Users == null)
        {
            throw new InvalidOperationException("Brak połączenia z bazą danych MongoDB Atlas.");
        }

        var expiresAt = DateTime.UtcNow.AddHours(4);
        var payload = $"{user.Id}:{user.Username}:{user.Role}:{expiresAt.Ticks}";
        var signature = ComputeHmac(payload);

        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var payloadBase64 = Convert.ToBase64String(payloadBytes);
        var token = $"{payloadBase64}.{signature}";

        // Zapis tokena bezpośrednio w obiekcie użytkownika (wersja Sunfire)
        user.CurrentToken = token;
        user.FailedAttempts = 0;
        user.LockoutEnd = null;

        var filter = Builders<User>.Filter.Eq(u => u.Username, user.Username);
        var update = Builders<User>.Update
            .Set(u => u.CurrentToken, token)
            .Set(u => u.FailedAttempts, 0)
            .Set(u => u.LockoutEnd, null);

        await _mongoContext.Users.UpdateOneAsync(filter, update);

        return token;
    }

    public async Task<UserTokenClaims?> ValidateTokenAsync(string? authHeader)
    {
        if (string.IsNullOrWhiteSpace(authHeader)) return null;

        var token = ExtractBearerToken(authHeader);
        if (string.IsNullOrEmpty(token)) return null;

        var parts = token.Split('.');
        if (parts.Length != 2) return null;

        try
        {
            var payloadBase64 = parts[0];
            var signature = parts[1];

            var payloadBytes = Convert.FromBase64String(payloadBase64);
            var payload = Encoding.UTF8.GetString(payloadBytes);

            var expectedSignature = ComputeHmac(payload);
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(signature), 
                    Encoding.UTF8.GetBytes(expectedSignature)))
            {
                return null; // Podpis sfałszowany
            }

            var payloadParts = payload.Split(':');
            if (payloadParts.Length < 4) return null;

            var userId = payloadParts[0];
            var username = payloadParts[1];
            var role = payloadParts[2];
            var expiresTicks = long.Parse(payloadParts[3]);

            if (DateTime.UtcNow.Ticks > expiresTicks) return null; // Token wygasł

            if (_mongoContext.Users == null) return null;

            // Weryfikacja bezpośrednio z polem CurrentToken użytkownika (wersja Sunfire)
            var user = await _mongoContext.Users.Find(u => u.CurrentToken == token).FirstOrDefaultAsync();

            if (user == null || string.IsNullOrEmpty(user.CurrentToken))
            {
                return null; // Sesja unieważniona (logout) lub token wygaszony
            }

            return new UserTokenClaims
            {
                SessionId = user.Id ?? "",
                UserId = user.Id ?? userId,
                Username = user.Username,
                Role = user.Role
            };
        }
        catch
        {
            return null;
        }
    }

    public async Task<bool> RevokeSessionByTokenAsync(string token)
    {
        if (_mongoContext.Users == null) return false;

        var cleanToken = ExtractBearerToken(token);
        if (string.IsNullOrEmpty(cleanToken)) return false;

        // Czyszczenie tokena bezpośrednio w obiekcie użytkownika przy wylogowaniu (wersja Sunfire)
        var filter = Builders<User>.Filter.Eq(u => u.CurrentToken, cleanToken);
        var update = Builders<User>.Update.Set(u => u.CurrentToken, (string?)null);
        var result = await _mongoContext.Users.UpdateOneAsync(filter, update);
        return result.ModifiedCount > 0;
    }

    /// <summary>
    /// Zwraca aktywne sesje na podstawie ułożenia Sunfire (gdzie CurrentToken != null).
    /// </summary>
    public async Task<List<SessionInfoDto>> GetActiveSessionsSafeAsync()
    {
        if (_mongoContext.Users == null) return new List<SessionInfoDto>();

        var activeUsers = await _mongoContext.Users
            .Find(u => u.CurrentToken != null && u.CurrentToken != "")
            .ToListAsync();

        return activeUsers.Select(u => new SessionInfoDto
        {
            Id = u.Id ?? "",
            UserId = u.Id ?? "",
            Username = u.Username,
            Role = u.Role,
            CreatedAt = u.CreatedAt,
            ExpiresAt = DateTime.UtcNow.AddHours(4)
        }).ToList();
    }

    /// <summary>
    /// Wyciąga czysty token z nagłówka "Bearer xyz...". Zwraca sam token bez prefixu.
    /// </summary>
    private static string ExtractBearerToken(string authHeader)
    {
        if (string.IsNullOrWhiteSpace(authHeader)) return string.Empty;

        return authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authHeader.Substring(7).Trim()
            : authHeader.Trim();
    }

    private string ComputeHmac(string data)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToBase64String(hash);
    }
}
