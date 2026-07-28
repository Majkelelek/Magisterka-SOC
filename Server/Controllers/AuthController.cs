using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly MongoDbContext _mongoContext;
    private readonly TokenService _tokenService;

    public AuthController(AuthService authService, MongoDbContext mongoContext, TokenService tokenService)
    {
        _authService = authService;
        _mongoContext = mongoContext;
        _tokenService = tokenService;
    }

    /// <summary>
    /// Logowanie operatora — zwraca token sesji zapisany w MongoDB.
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Nazwa użytkownika i hasło są wymagane." });
        }

        var user = await _authService.AuthenticateAsync(request.Username, request.Password);
        if (user == null)
        {
            return Unauthorized(new { message = "Niepoprawny login lub hasło." });
        }

        var token = await _tokenService.CreateSessionAsync(user);

        return Ok(new AuthResponse(
            Token: token,
            User: new UserDto(user.Id ?? "", user.Username, user.Email, user.Role),
            DatabaseMode: _mongoContext.IsConnectedToMongo ? "MongoDB Atlas" : "Brak połączenia"
        ));
    }

    /// <summary>
    /// Wylogowanie — unieważnia aktywną sesję w bazie MongoDB (IsRevoked = true).
    /// </summary>
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrEmpty(authHeader))
        {
            await _tokenService.RevokeSessionByTokenAsync(authHeader);
        }
        return Ok(new { message = "Pomyślnie wylogowano i unieważniono sesję." });
    }

    /// <summary>
    /// Rejestracja nowego konta — wymaga ważnego tokena z rolą Administrator.
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Nazwa użytkownika i hasło są wymagane." });
        }

        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        var claims = await _tokenService.ValidateTokenAsync(authHeader);

        if (claims == null)
        {
            return Unauthorized(new { message = "Dostęp zabroniony. Wymagane zalogowanie jako Administrator." });
        }

        if (claims.Role != "Administrator")
        {
            return StatusCode(403, new { message = "Dostęp zabroniony. Tylko zalogowany Administrator może dodawać nowych użytkowników." });
        }

        try
        {
            var user = await _authService.RegisterAsync(request.Username, request.Password, request.Role ?? "Użytkownik", claims.Username);
            if (user == null)
            {
                return Conflict(new { message = $"Użytkownik o nazwie '{request.Username}' już istnieje." });
            }

            return Ok(new { message = $"Użytkownik '{user.Username}' z rolą '{user.Role}' został zarejestrowany.", username = user.Username, role = user.Role });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Lista zarejestrowanych użytkowników — wymaga roli Administrator.
    /// </summary>
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        var claims = await _tokenService.ValidateTokenAsync(authHeader);

        if (claims == null)
        {
            return Unauthorized(new { message = "Brak autoryzacji." });
        }

        if (claims.Role != "Administrator")
        {
            return StatusCode(403, new { message = "Dostęp do listy użytkowników posiada tylko Administrator." });
        }

        var users = await _authService.GetAllUsersAsync();
        var userDtos = users.Select(u => new UserDto(u.Id ?? "", u.Username, u.Email, u.Role)).ToList();
        return Ok(userDtos);
    }

    /// <summary>
    /// Zmiana hasła wybranego użytkownika — wymaga roli Administrator.
    /// </summary>
    [HttpPut("users/{id}/password")]
    public async Task<IActionResult> ChangeUserPassword(string id, [FromBody] ChangePasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Nowe hasło nie może być puste." });
        }

        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        var claims = await _tokenService.ValidateTokenAsync(authHeader);

        if (claims == null)
        {
            return Unauthorized(new { message = "Brak autoryzacji." });
        }

        if (claims.Role != "Administrator")
        {
            return StatusCode(403, new { message = "Tylko Administrator może zmieniać hasła użytkowników." });
        }

        try
        {
            var success = await _authService.ChangePasswordAsync(id, request.NewPassword, claims.Username);
            if (!success)
            {
                return NotFound(new { message = "Użytkownik nie został odnaleziony w bazie danych." });
            }

            return Ok(new { message = "Hasło użytkownika zostało pomyślnie zmienione." });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Lista aktywnych sesji (BEZ tokenów) — wymaga roli Administrator.
    /// </summary>
    [HttpGet("sessions")]
    public async Task<IActionResult> GetActiveSessions()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        var claims = await _tokenService.ValidateTokenAsync(authHeader);

        if (claims == null || claims.Role != "Administrator")
        {
            return StatusCode(403, new { message = "Tylko Administrator może przeglądać aktywne sesje." });
        }

        var sessions = await _tokenService.GetActiveSessionsSafeAsync();
        return Ok(sessions);
    }

    /// <summary>
    /// Sprawdzenie aktywności sesji — zwraca 200 OK jeśli sesja jest ważna i nieunieważniona, 401 jeśli unieważniona.
    /// </summary>
    [HttpGet("verify")]
    public async Task<IActionResult> VerifySession()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        var claims = await _tokenService.ValidateTokenAsync(authHeader);

        if (claims == null)
        {
            return Unauthorized(new { message = "Sesja wygasła lub została unieważniona przez Administratora." });
        }

        return Ok(new { valid = true, username = claims.Username, role = claims.Role });
    }

    /// <summary>
    /// Status połączenia z bazą danych — minimalny zestaw informacji (bez wrażliwych danych).
    /// </summary>
    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        return Ok(new
        {
            isConnectedToMongoDB = _mongoContext.IsConnectedToMongo,
            databaseProvider = _mongoContext.IsConnectedToMongo ? "MongoDB Atlas" : "Brak połączenia",
            serverTime = DateTime.UtcNow
        });
    }
}

public record LoginRequest(string Username, string Password);
public record RegisterRequest(string Username, string Password, string? Role);
public record ChangePasswordRequest(string NewPassword);
public record UserDto(string Id, string Username, string Email, string Role);
public record AuthResponse(string Token, UserDto User, string DatabaseMode);
