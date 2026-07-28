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
        if (_mongoContext.Sessions == null)
        {
            throw new InvalidOperationException("Brak połączenia z kolekcją Sessions w bazie MongoDB Atlas.");
        }

        // Unieważnij poprzednie aktywne sesje użytkownika przy nowym zalogowaniu
        var revokeFilter = Builders<UserSessionModel>.Filter.And(
            Builders<UserSessionModel>.Filter.Eq(s => s.Username, user.Username),
            Builders<UserSessionModel>.Filter.Eq(s => s.IsRevoked, false)
        );
        var revokeUpdate = Builders<UserSessionModel>.Update.Set(s => s.IsRevoked, true);
        await _mongoContext.Sessions.UpdateManyAsync(revokeFilter, revokeUpdate);

        var expiresAt = DateTime.UtcNow.AddHours(1);
        var payload = $"{user.Id}:{user.Username}:{user.Role}:{expiresAt.Ticks}";
        var signature = ComputeHmac(payload);

        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var payloadBase64 = Convert.ToBase64String(payloadBytes);
        var token = $"{payloadBase64}.{signature}";

        var sessionModel = new UserSessionModel
        {
            Token = token,
            UserId = user.Id ?? Guid.NewGuid().ToString(),
            Username = user.Username,
            Role = user.Role,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt,
            IsRevoked = false
        };

        await _mongoContext.Sessions.InsertOneAsync(sessionModel);
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

            if (_mongoContext.Sessions == null) return null;

            var session = await _mongoContext.Sessions.Find(s => s.Token == token).FirstOrDefaultAsync();

            if (session == null || session.IsRevoked)
            {
                return null; // Sesja unieważniona lub nieistniejąca w MongoDB
            }

            return new UserTokenClaims
            {
                SessionId = session.Id ?? "",
                UserId = userId,
                Username = username,
                Role = role
            };
        }
        catch
        {
            return null;
        }
    }

    public async Task<bool> RevokeSessionByTokenAsync(string token)
    {
        if (_mongoContext.Sessions == null) return false;

        var cleanToken = ExtractBearerToken(token);
        if (string.IsNullOrEmpty(cleanToken)) return false;

        var filter = Builders<UserSessionModel>.Filter.Eq(s => s.Token, cleanToken);
        var update = Builders<UserSessionModel>.Update.Set(s => s.IsRevoked, true);
        var result = await _mongoContext.Sessions.UpdateOneAsync(filter, update);
        return result.ModifiedCount > 0;
    }

    /// <summary>
    /// Zwraca aktywne sesje BEZ pola Token — bezpieczne do odsyłania w API.
    /// </summary>
    public async Task<List<SessionInfoDto>> GetActiveSessionsSafeAsync()
    {
        if (_mongoContext.Sessions == null) return new List<SessionInfoDto>();

        var sessions = await _mongoContext.Sessions
            .Find(s => !s.IsRevoked && s.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();

        return sessions.Select(s => new SessionInfoDto
        {
            Id = s.Id ?? "",
            UserId = s.UserId,
            Username = s.Username,
            Role = s.Role,
            CreatedAt = s.CreatedAt,
            ExpiresAt = s.ExpiresAt
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
