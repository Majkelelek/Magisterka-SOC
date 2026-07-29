using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Server.Services;

public class MongoSessionAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly TokenService _tokenService;

    public MongoSessionAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        TokenService tokenService)
        : base(options, logger, encoder)
    {
        _tokenService = tokenService;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader))
        {
            return AuthenticateResult.NoResult();
        }

        var claims = await _tokenService.ValidateTokenAsync(authHeader);
        if (claims == null)
        {
            return AuthenticateResult.Fail("Sesja nieaktywna lub wygasła.");
        }

        var identityClaims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, claims.UserId),
            new Claim(ClaimTypes.Name, claims.Username),
            new Claim(ClaimTypes.Role, claims.Role)
        };

        var identity = new ClaimsIdentity(identityClaims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }
}
