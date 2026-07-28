using System.Security.Cryptography;
using System.Text;
using MongoDB.Driver;
using Server.Models;

namespace Server.Services;

public class AuthService
{
    private readonly MongoDbContext _mongoContext;

    public AuthService(MongoDbContext mongoContext)
    {
        _mongoContext = mongoContext;
    }

    public async Task<long> GetUsersCountAsync()
    {
        if (_mongoContext.Users != null)
        {
            return await _mongoContext.Users.CountDocumentsAsync(_ => true);
        }
        return 0;
    }

    public async Task<List<User>> GetAllUsersAsync()
    {
        if (_mongoContext.Users != null)
        {
            return await _mongoContext.Users.Find(_ => true).ToListAsync();
        }
        return new List<User>();
    }

    public async Task<User?> RegisterAsync(string username, string password, string role, string requestorUsername)
    {
        if (string.IsNullOrEmpty(requestorUsername))
        {
            throw new InvalidOperationException("Tylko zalogowany Administrator może rejestrować nowych użytkowników.");
        }

        var requestor = await GetUserByUsernameAsync(requestorUsername);
        if (requestor == null || requestor.Role != "Administrator")
        {
            throw new InvalidOperationException("Brak uprawnień Administratora do rejestrowania kont.");
        }

        var existingUser = await GetUserByUsernameAsync(username);
        if (existingUser != null) return null; // Użytkownik o podanym loginie już istnieje w MongoDB

        var assignedRole = role == "Administrator" ? "Administrator" : "Użytkownik";
        var passwordHash = HashPassword(password);

        var newUser = new User
        {
            Username = username,
            Email = "",
            PasswordHash = passwordHash,
            Role = assignedRole,
            CreatedAt = DateTime.UtcNow
        };

        if (_mongoContext.Users == null)
        {
            throw new InvalidOperationException("Brak połączenia z bazą danych MongoDB Atlas.");
        }

        await _mongoContext.Users.InsertOneAsync(newUser);
        return newUser;
    }

    public async Task<User?> AuthenticateAsync(string username, string password)
    {
        var user = await GetUserByUsernameAsync(username);
        if (user == null) return null;

        var inputHash = HashPassword(password);
        if (user.PasswordHash == inputHash || user.PasswordHash == password)
        {
            return user;
        }

        return null;
    }

    public async Task<User?> GetUserByUsernameAsync(string username)
    {
        if (_mongoContext.Users != null)
        {
            var filter = Builders<User>.Filter.Regex(
                u => u.Username,
                new MongoDB.Bson.BsonRegularExpression($"^{System.Text.RegularExpressions.Regex.Escape(username)}$", "i")
            );
            return await _mongoContext.Users.Find(filter).FirstOrDefaultAsync();
        }
        return null;
    }

    public async Task<bool> ChangePasswordAsync(string userId, string newPassword, string requestorUsername)
    {
        if (_mongoContext.Users == null) return false;

        var requestor = await GetUserByUsernameAsync(requestorUsername);
        if (requestor == null || requestor.Role != "Administrator")
        {
            throw new InvalidOperationException("Brak uprawnień. Tylko zalogowany Administrator może zmieniać hasła użytkowników.");
        }

        var newHash = HashPassword(newPassword);

        FilterDefinition<User> filter;
        if (MongoDB.Bson.ObjectId.TryParse(userId, out var objectId))
        {
            filter = Builders<User>.Filter.Eq("_id", objectId);
        }
        else
        {
            filter = Builders<User>.Filter.Eq(u => u.Id, userId);
        }

        var update = Builders<User>.Update.Set(u => u.PasswordHash, newHash);
        var result = await _mongoContext.Users.UpdateOneAsync(filter, update);

        if (result.MatchedCount == 0)
        {
            var fallbackFilter = Builders<User>.Filter.Eq(u => u.Id, userId);
            result = await _mongoContext.Users.UpdateOneAsync(fallbackFilter, update);
        }

        return result.MatchedCount > 0;
    }

    private static string HashPassword(string password)
    {
        var salt = Environment.GetEnvironmentVariable("PASSWORD_SALT") 
                   ?? throw new InvalidOperationException("Brak wymaganej zmiennej środowiskowej PASSWORD_SALT w pliku .env");

        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(password + salt);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }
}
