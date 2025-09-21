using LeavePlanner.Api.Data;
using LeavePlanner.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeavePlanner.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmployeesController : ControllerBase
{
    private readonly LeavePlannerDbContext _db;
    public EmployeesController(LeavePlannerDbContext db) => _db = db;

    private async Task<Employee?> GetCurrentEmployeeAsync()
    {
        if (!Request.Headers.TryGetValue("X-Employee-Id", out var values)) return null;
        if (!Guid.TryParse(values.FirstOrDefault(), out var id)) return null;
        return await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id);
    }

    private async Task<bool> IsCallerAdminAsync()
    {
        var me = await GetCurrentEmployeeAsync();
        return me is not null && me.Role == UserRole.Admin;
    }

    private async Task<int> CountAdminsAsync()
        => await _db.Employees.CountAsync(e => e.Role == UserRole.Admin);

    public record EmployeeCreateDto(string Name, string? JobTitle);
    public record EmployeeUpdateDto(string Name, string? JobTitle);
    public record EmployeeRoleDto(UserRole Role);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll()
    {
        var list = await _db.Employees
            .Select(e => new { e.Id, e.Name, e.JobTitle, e.Role })
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<object>> GetById(Guid id)
    {
        var e = await _db.Employees.FindAsync(id);
        return e is null ? NotFound() : Ok(new { e.Id, e.Name, e.JobTitle, e.Role });
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create(EmployeeCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name ist erforderlich.");
        var e = new Employee { Name = dto.Name.Trim(), JobTitle = dto.JobTitle?.Trim() };
        _db.Employees.Add(e);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = e.Id }, new { e.Id, e.Name, e.JobTitle, e.Role });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, EmployeeUpdateDto dto)
    {
        var e = await _db.Employees.FindAsync(id);
        if (e is null) return NotFound();
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name ist erforderlich.");

        e.Name = dto.Name.Trim();
        e.JobTitle = dto.JobTitle?.Trim();
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:guid}/role")]
    public async Task<IActionResult> UpdateRole(Guid id, EmployeeRoleDto dto)
    {
        if (!await IsCallerAdminAsync())
            return Forbid("Rolle 'Admin' erforderlich, um Rollen zu ändern.");

        var e = await _db.Employees.FindAsync(id);
        if (e is null) return NotFound("Mitarbeiter wurde nicht gefunden.");

        if (e.Role == UserRole.Admin && dto.Role != UserRole.Admin)
        {
            var adminCount = await CountAdminsAsync();
            if (adminCount <= 1)
                return Conflict("Der letzte verbleibende Admin kann nicht herabgestuft werden.");
        }

        e.Role = dto.Role;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var e = await _db.Employees.FindAsync(id);
        if (e is null) return NotFound();

        if (e.Role == UserRole.Admin)
        {
            var adminCount = await CountAdminsAsync();
            if (adminCount <= 1)
                return Conflict("Der letzte verbleibende Admin kann nicht gelöscht werden.");
        }

        _db.Employees.Remove(e);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
