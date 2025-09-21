using LeavePlanner.Api.Data;
using LeavePlanner.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeavePlanner.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly LeavePlannerDbContext _db;
    public ProjectsController(LeavePlannerDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll()
    {
        var list = await _db.Projects
            .Include(p => p.Customer)
            .Select(p => new
            {
                p.Id,
                p.Name,
                CustomerId = p.CustomerId,
                Customer = p.Customer != null ? new { p.Customer.Id, p.Customer.Name } : null,
                p.StartDate,
                p.EndDate
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<object>> GetById(Guid id)
    {
        var p = await _db.Projects
            .Include(p => p.Customer)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (p is null) return NotFound("Projekt wurde nicht gefunden.");

        return Ok(new
        {
            p.Id,
            p.Name,
            CustomerId = p.CustomerId,
            Customer = p.Customer != null ? new { p.Customer.Id, p.Customer.Name } : null,
            p.StartDate,
            p.EndDate
        });
    }

    public record ProjectCreateDto(string Name, Guid CustomerId, DateOnly StartDate, DateOnly? EndDate);

    [HttpPost]
    public async Task<ActionResult<object>> Create(ProjectCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name ist erforderlich.");

        var existsCustomer = await _db.Customers.AnyAsync(c => c.Id == dto.CustomerId);
        if (!existsCustomer) return BadRequest("Kunde existiert nicht.");

        if (dto.EndDate is not null && dto.EndDate < dto.StartDate)
            return BadRequest("Enddatum muss leer sein oder ≥ Startdatum.");

        var p = new Project
        {
            Name = dto.Name.Trim(),
            CustomerId = dto.CustomerId,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate
        };

        _db.Projects.Add(p);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = p.Id },
            new { p.Id, p.Name, p.CustomerId, p.StartDate, p.EndDate });
    }

    public record ProjectUpdateDto(string Name, Guid CustomerId, DateOnly StartDate, DateOnly? EndDate);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, ProjectUpdateDto dto)
    {
        var p = await _db.Projects.FindAsync(id);
        if (p is null) return NotFound("Projekt wurde nicht gefunden.");

        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name ist erforderlich.");

        var existsCustomer = await _db.Customers.AnyAsync(c => c.Id == dto.CustomerId);
        if (!existsCustomer) return BadRequest("Kunde existiert nicht.");

        if (dto.EndDate is not null && dto.EndDate < dto.StartDate)
            return BadRequest("Enddatum muss leer sein oder ≥ Startdatum.");

        p.Name = dto.Name.Trim();
        p.CustomerId = dto.CustomerId;
        p.StartDate = dto.StartDate;
        p.EndDate = dto.EndDate;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var p = await _db.Projects.FindAsync(id);
        if (p is null) return NotFound("Projekt wurde nicht gefunden.");

        _db.Projects.Remove(p);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    public record AssignDto(Guid EmployeeId);

    [HttpPost("{projectId:guid}/assignments")]
    public async Task<IActionResult> AssignEmployee(Guid projectId, AssignDto dto)
    {
        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound("Projekt wurde nicht gefunden.");

        var employeeExists = await _db.Employees.AnyAsync(e => e.Id == dto.EmployeeId);
        if (!employeeExists) return BadRequest("Mitarbeiter wurde nicht gefunden.");

        var already = await _db.ProjectAssignments
            .AnyAsync(pa => pa.ProjectId == projectId && pa.EmployeeId == dto.EmployeeId);
        if (already) return Conflict("Mitarbeiter ist diesem Projekt bereits zugeordnet.");

        _db.ProjectAssignments.Add(new ProjectAssignment
        {
            ProjectId = projectId,
            EmployeeId = dto.EmployeeId
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{projectId:guid}/assignments")]
    public async Task<ActionResult<IEnumerable<object>>> ListAssignments(Guid projectId)
    {
        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound("Projekt wurde nicht gefunden.");

        var list = await _db.ProjectAssignments
            .Where(pa => pa.ProjectId == projectId)
            .Include(pa => pa.Employee)
            .Select(pa => new
            {
                employeeId = pa.EmployeeId,
                employeeName = pa.Employee!.Name
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpDelete("{projectId:guid}/assignments/{employeeId:guid}")]
    public async Task<IActionResult> UnassignEmployee(Guid projectId, Guid employeeId)
    {
        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound("Projekt wurde nicht gefunden.");

        var assignment = await _db.ProjectAssignments
            .FirstOrDefaultAsync(pa => pa.ProjectId == projectId && pa.EmployeeId == employeeId);

        if (assignment is null) return NotFound("Zuordnung wurde nicht gefunden.");

        _db.ProjectAssignments.Remove(assignment);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
