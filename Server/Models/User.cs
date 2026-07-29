using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Server.Models;

public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public string Role { get; set; } = "Użytkownik"; // "Administrator" lub "Użytkownik"

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? CurrentToken { get; set; }

    public int FailedAttempts { get; set; } = 0;

    public DateTime? LockoutEnd { get; set; }
}
