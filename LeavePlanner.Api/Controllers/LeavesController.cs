using LeavePlanner.Api.Data;
using LeavePlanner.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeavePlanner.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeavesController : ControllerBase
{
    private readonly LeavePlannerDbContext _db;
    public LeavesController(LeavePlannerDbContext db) => _db = db;

    public record LeaveCreateDto(Guid EmployeeId, DateOnly Date);
    public record LeaveDto(
        Guid Id, Guid EmployeeId, DateOnly Date, LeaveStatus Status,
        Guid? DecisionByEmployeeId, DateTimeOffset? DecisionAt, string? DecisionComment);
    public record ConflictEmployee(Guid EmployeeId, string EmployeeName);
    public record ConflictHint(Guid ProjectId, string ProjectName, List<ConflictEmployee> Employees);
    public record LeaveWithConflictsDto(LeaveDto Leave, List<ConflictHint> ConflictHints);

    private async Task<Employee?> GetCurrentEmployeeAsync()
    {
        if (!Request.Headers.TryGetValue("X-Employee-Id", out var vals)) return null;

        return Guid.TryParse(vals.FirstOrDefault(), out var id)
            ? await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id)
            : null;
    }

    private async Task AddNotificationAsync(Guid userId, LeaveRequest leave, NotificationKind kind, Employee? actor, string? comment = null)
    {
        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            LeaveRequestId = leave.Id,
            Kind = kind,
            Date = leave.Date,
            ActorId = actor?.Id,
            ActorName = actor?.Name,
            Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
            IsRead = false
        });
        await _db.SaveChangesAsync();
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LeaveDto>>> GetAll([FromQuery] Guid? employeeId, [FromQuery] DateOnly? date)
    {
        var q = _db.LeaveRequests.AsNoTracking();

        if (employeeId is not null && employeeId != Guid.Empty)
            q = q.Where(l => l.EmployeeId == employeeId);

        if (date is not null)
            q = q.Where(l => l.Date == date);

        var list = await q
            .OrderBy(l => l.Date)
            .Select(l => new LeaveDto(
                l.Id, l.EmployeeId, l.Date, l.Status, l.DecisionByEmployeeId, l.DecisionAt, l.DecisionComment))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<LeaveDto>> GetById(Guid id)
    {
        var l = await _db.LeaveRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (l is null) return NotFound("Urlaubseintrag wurde nicht gefunden.");

        return Ok(new LeaveDto(l.Id, l.EmployeeId, l.Date, l.Status, l.DecisionByEmployeeId, l.DecisionAt, l.DecisionComment));
    }

    [HttpPost]
    public async Task<ActionResult<LeaveWithConflictsDto>> Create(LeaveCreateDto dto)
    {
        if (dto.EmployeeId == Guid.Empty) return BadRequest("EmployeeId ist erforderlich.");
        if (!await _db.Employees.AsNoTracking().AnyAsync(e => e.Id == dto.EmployeeId))
            return BadRequest("Mitarbeiter existiert nicht.");

        var duplicate = await _db.LeaveRequests.AsNoTracking()
            .AnyAsync(l => l.EmployeeId == dto.EmployeeId && l.Date == dto.Date);
        if (duplicate) return Conflict("Für diesen Mitarbeiter und dieses Datum existiert bereits ein Urlaubsantrag.");

        var entity = new LeaveRequest
        {
            EmployeeId = dto.EmployeeId,
            Date = dto.Date,
            Status = LeaveStatus.Requested
        };

        _db.LeaveRequests.Add(entity);
        await _db.SaveChangesAsync();

        var conflictHints = await ComputeConflictHints(dto.EmployeeId, dto.Date, includeRequested: false);

        await AddNotificationAsync(entity.EmployeeId, entity, NotificationKind.Submitted, actor: null);

        var result = new LeaveWithConflictsDto(
            new LeaveDto(entity.Id, entity.EmployeeId, entity.Date, entity.Status,
                         entity.DecisionByEmployeeId, entity.DecisionAt, entity.DecisionComment),
            conflictHints);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, result);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<LeaveWithConflictsDto>> Approve(Guid id)
    {
        var me = await GetCurrentEmployeeAsync();
        if (me is null) return Unauthorized("Bitte Header 'X-Employee-Id' angeben.");
        if (me.Role != UserRole.Approver && me.Role != UserRole.Admin)
            return Forbid("Rolle 'Approver' oder 'Admin' erforderlich.");

        var entity = await _db.LeaveRequests.FirstOrDefaultAsync(x => x.Id == id);
        if (entity is null) return NotFound("Urlaubseintrag wurde nicht gefunden.");
        if (entity.EmployeeId == me.Id) return Forbid("Du kannst deinen eigenen Urlaub nicht genehmigen.");
        if (entity.Status == LeaveStatus.Approved) return Conflict("Urlaub ist bereits genehmigt.");
        if (entity.Status == LeaveStatus.Rejected) return Conflict("Abgelehnte Urlaube können nicht genehmigt werden.");

        var conflictHints = await ComputeConflictHints(entity.EmployeeId, entity.Date, includeRequested: true);

        entity.Status = LeaveStatus.Approved;
        entity.DecisionByEmployeeId = me.Id;
        entity.DecisionAt = DateTimeOffset.UtcNow;
        entity.DecisionComment = null;
        await _db.SaveChangesAsync();

        await AddNotificationAsync(entity.EmployeeId, entity, NotificationKind.Approved, me);

        var result = new LeaveWithConflictsDto(
            new LeaveDto(entity.Id, entity.EmployeeId, entity.Date, entity.Status,
                         entity.DecisionByEmployeeId, entity.DecisionAt, entity.DecisionComment),
            conflictHints);

        return Ok(result);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<LeaveDto>> Reject(Guid id, [FromBody] string? comment = null)
    {
        var me = await GetCurrentEmployeeAsync();
        if (me is null) return Unauthorized("Bitte Header 'X-Employee-Id' angeben.");
        if (me.Role != UserRole.Approver && me.Role != UserRole.Admin)
            return Forbid("Rolle 'Approver' oder 'Admin' erforderlich.");

        var entity = await _db.LeaveRequests.FirstOrDefaultAsync(x => x.Id == id);
        if (entity is null) return NotFound("Urlaubseintrag wurde nicht gefunden.");
        if (entity.EmployeeId == me.Id) return Forbid("Du kannst deinen eigenen Urlaub nicht ablehnen.");
        if (entity.Status == LeaveStatus.Rejected) return Conflict("Urlaub ist bereits abgelehnt.");
        if (entity.Status == LeaveStatus.Approved) return Conflict("Genehmigte Urlaube können nicht abgelehnt werden.");

        entity.Status = LeaveStatus.Rejected;
        entity.DecisionByEmployeeId = me.Id;
        entity.DecisionAt = DateTimeOffset.UtcNow;
        entity.DecisionComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        await _db.SaveChangesAsync();

        await AddNotificationAsync(entity.EmployeeId, entity, NotificationKind.Rejected, me, entity.DecisionComment);

        return Ok(new LeaveDto(entity.Id, entity.EmployeeId, entity.Date, entity.Status,
                               entity.DecisionByEmployeeId, entity.DecisionAt, entity.DecisionComment));
    }

    private async Task<List<ConflictHint>> ComputeConflictHints(Guid requesterEmployeeId, DateOnly date, bool includeRequested)
    {
        var activeProjectIds = await _db.ProjectAssignments.AsNoTracking()
            .Where(pa => pa.EmployeeId == requesterEmployeeId
                         && pa.Project != null
                         && pa.Project.StartDate <= date
                         && (pa.Project.EndDate == null || pa.Project.EndDate >= date))
            .Select(pa => pa.ProjectId)
            .Distinct()
            .ToListAsync();

        if (activeProjectIds.Count == 0) return new List<ConflictHint>();

        var teamAssignments = await _db.ProjectAssignments.AsNoTracking()
            .Where(pa => activeProjectIds.Contains(pa.ProjectId) && pa.EmployeeId != requesterEmployeeId)
            .Select(pa => new
            {
                pa.ProjectId,
                ProjectName = pa.Project!.Name,
                pa.EmployeeId,
                EmployeeName = pa.Employee!.Name
            })
            .ToListAsync();

        if (teamAssignments.Count == 0) return new List<ConflictHint>();

        var teamEmployeeIds = teamAssignments.Select(t => t.EmployeeId).Distinct().ToList();

        var statuses = includeRequested
            ? new[] { LeaveStatus.Approved, LeaveStatus.Requested }
            : new[] { LeaveStatus.Approved };

        var conflictingEmployeeIds = await _db.LeaveRequests.AsNoTracking()
            .Where(l => l.Date == date && statuses.Contains(l.Status) && teamEmployeeIds.Contains(l.EmployeeId))
            .Select(l => l.EmployeeId)
            .Distinct()
            .ToListAsync();

        if (conflictingEmployeeIds.Count == 0) return new List<ConflictHint>();

        var relevant = teamAssignments.Where(t => conflictingEmployeeIds.Contains(t.EmployeeId)).ToList();

        return relevant
            .GroupBy(t => new { t.ProjectId, t.ProjectName })
            .Select(g => new ConflictHint(
                g.Key.ProjectId,
                g.Key.ProjectName,
                g.GroupBy(x => new { x.EmployeeId, x.EmployeeName })
                 .Select(x => new ConflictEmployee(x.Key.EmployeeId, x.Key.EmployeeName))
                 .ToList()))
            .ToList();
    }
}
