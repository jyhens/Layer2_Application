using LeavePlanner.Api.Data;
using LeavePlanner.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeavePlanner.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly LeavePlannerDbContext _db;
    public NotificationsController(LeavePlannerDbContext db) => _db = db;

    public record NotificationDto(
        Guid Id,
        Guid UserId,
        Guid LeaveRequestId,
        NotificationKind Kind,
        DateOnly Date,
        Guid? ActorId,
        string? ActorName,
        string? Comment,
        DateTimeOffset CreatedAt,
        bool IsRead
    );

    private static NotificationDto Map(Notification n) =>
        new NotificationDto(n.Id, n.UserId, n.LeaveRequestId, n.Kind, n.Date,
                            n.ActorId, n.ActorName, n.Comment, n.CreatedAt, n.IsRead);

    private async Task<Employee?> GetCallerAsync()
    {
        if (!Request.Headers.TryGetValue("X-Employee-Id", out var vals)) return null;

        return Guid.TryParse(vals.FirstOrDefault(), out var id)
            ? await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id)
            : null;
    }

    // GET /api/notifications?userId=...&onlyUnread=true
    [HttpGet]
    [Produces("application/json")]
    public async Task<ActionResult<IEnumerable<NotificationDto>>> List(
        [FromQuery] Guid? userId,
        [FromQuery] bool onlyUnread = false)
    {
        var me = await GetCallerAsync();
        if (me is null) return Unauthorized("Bitte Header 'X-Employee-Id' angeben.");

        var effectiveUserId =
            (userId is null || userId == Guid.Empty || userId == me.Id)
                ? me.Id
                : (me.Role == UserRole.Admin ? userId.Value : Guid.Empty);

        if (effectiveUserId == Guid.Empty)
            return Forbid("Nur Admins dürfen Benachrichtigungen anderer Nutzer abfragen.");

        IQueryable<Notification> q = _db.Notifications.AsNoTracking()
            .Where(n => n.UserId == effectiveUserId);

        if (onlyUnread)
            q = q.Where(n => !n.IsRead);

        var items = q.AsEnumerable().ToList();

        var ordered = items
            .OrderByDescending(n => n.CreatedAt)
            .Take(200)
            .Select(Map)
            .ToList();

        return Ok(ordered);
    }

    public record MarkReadRequest(Guid[] Ids);

    [HttpPost("mark-read")]
    public async Task<IActionResult> MarkRead([FromBody] MarkReadRequest body)
    {
        if (body.Ids is null || body.Ids.Length == 0) return BadRequest("Ids dürfen nicht leer sein.");

        var me = await GetCallerAsync();
        if (me is null) return Unauthorized("Bitte Header 'X-Employee-Id' angeben.");

        var items = await _db.Notifications.Where(n => body.Ids.Contains(n.Id)).ToListAsync();
        if (items.Count == 0) return NoContent();

        if (me.Role != UserRole.Admin && items.Any(n => n.UserId != me.Id))
            return Forbid("Du kannst nur deine eigenen Benachrichtigungen als gelesen markieren.");

        foreach (var n in items) n.IsRead = true;
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
