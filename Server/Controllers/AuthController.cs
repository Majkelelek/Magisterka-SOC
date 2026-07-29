using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
    [AllowAnonymous]
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
    [AllowAnonymous]
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
    [Authorize(Roles = "Administrator")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Nazwa użytkownika i hasło są wymagane." });
        }

        var adminName = User.Identity?.Name ?? "Administrator";

        try
        {
            var user = await _authService.RegisterAsync(request.Username, request.Password, request.Role ?? "Użytkownik", adminName);
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
    [Authorize(Roles = "Administrator")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _authService.GetAllUsersAsync();
        var userDtos = users.Select(u => new UserDto(u.Id ?? "", u.Username, u.Email, u.Role)).ToList();
        return Ok(userDtos);
    }

    /// <summary>
    /// Zmiana hasła wybranego użytkownika — wymaga roli Administrator.
    /// </summary>
    [HttpPut("users/{id}/password")]
    [Authorize(Roles = "Administrator")]
    public async Task<IActionResult> ChangeUserPassword(string id, [FromBody] ChangePasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Nowe hasło nie może być puste." });
        }

        var adminName = User.Identity?.Name ?? "Administrator";

        try
        {
            var success = await _authService.ChangePasswordAsync(id, request.NewPassword, adminName);
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
    [Authorize(Roles = "Administrator")]
    public async Task<IActionResult> GetActiveSessions()
    {
        var sessions = await _tokenService.GetActiveSessionsSafeAsync();
        return Ok(sessions);
    }

    /// <summary>
    /// Sprawdzenie aktywności sesji — zwraca 200 OK jeśli sesja jest ważna i nieunieważniona.
    /// </summary>
    [HttpGet("verify")]
    [Authorize]
    public IActionResult VerifySession()
    {
        var username = User.Identity?.Name ?? "";
        var role = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role)?.Value ?? "Użytkownik";
        return Ok(new { valid = true, username, role });
    }

    /// <summary>
    /// Status połączenia z bazą danych.
    /// </summary>
    [HttpGet("status")]
    [AllowAnonymous]
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
