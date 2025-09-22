using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using LeavePlanner.Api.Data;
using LeavePlanner.Api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace LeavePlanner.Api.Tests;

public class ConflictRulesTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;
    private readonly HttpClient _client;

    public ConflictRulesTests(TestWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private (Employee emp, Employee mate, Project project) GetEmployeesWithSharedProject()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LeavePlannerDbContext>();

        var emp = db.Employees.First(e => e.Role == UserRole.Employee);
        var mate = db.Employees.First(e => e.Id != emp.Id && e.Role == UserRole.Employee);

        var sharedProjectId =
            db.ProjectAssignments.Where(a => a.EmployeeId == emp.Id).Select(a => a.ProjectId)
              .Intersect(db.ProjectAssignments.Where(a => a.EmployeeId == mate.Id).Select(a => a.ProjectId))
              .FirstOrDefault();

        if (sharedProjectId == Guid.Empty)
            throw new InvalidOperationException("Seed muss mind. ein gemeinsames Projekt enthalten.");

        var project = db.Projects.First(p => p.Id == sharedProjectId);
        return (emp, mate, project);
    }

    private void SetHeaderAs(Guid employeeId)
    {
        _client.DefaultRequestHeaders.Remove("X-Employee-Id");
        _client.DefaultRequestHeaders.Add("X-Employee-Id", employeeId.ToString());
    }

    private sealed class CreateOrApproveResponse
    {
        public LeaveDto leave { get; set; } = default!;
        public List<ConflictHintDto>? conflictHints { get; set; }
    }
    private sealed class LeaveDto
    {
        public Guid id { get; set; }
        public Guid employeeId { get; set; }
        public string date { get; set; } = "";
        public int status { get; set; }
    }
    private sealed class ConflictHintDto
    {
        public Guid projectId { get; set; }
        public string projectName { get; set; } = "";
        public List<ConflictEmpDto> employees { get; set; } = new();
    }
    private sealed class ConflictEmpDto
    {
        public Guid employeeId { get; set; }
        public string employeeName { get; set; } = "";
    }

    // Create: Konflikt mit Approved
    [Fact]
    public async Task Create_conflict_against_Approved_of_teammates()
    {
        var (emp, mate, project) = GetEmployeesWithSharedProject();
        var date = project.StartDate;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LeavePlannerDbContext>();
            var approverId = db.Employees.First(e => e.Role == UserRole.Approver).Id;

            db.LeaveRequests.Add(new LeaveRequest
            {
                EmployeeId = mate.Id,
                Date = date,
                Status = LeaveStatus.Approved,
                DecisionByEmployeeId = approverId,
                DecisionAt = DateTimeOffset.UtcNow
            });
            db.SaveChanges();
        }

        SetHeaderAs(emp.Id);
        var res = await _client.PostAsJsonAsync("/api/leaves", new { employeeId = emp.Id, date = $"{date:yyyy-MM-dd}" });

        res.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.Created);

        var dto = await res.Content.ReadFromJsonAsync<CreateOrApproveResponse>();
        dto.Should().NotBeNull();
        dto!.conflictHints.Should().NotBeNull();
        dto.conflictHints!.Any(h => h.projectName == project.Name).Should().BeTrue();
    }

    // Create: Kein Konflikt
    [Fact]
    public async Task Create_no_conflict_when_team_is_available()
    {
        var (emp, _, project) = GetEmployeesWithSharedProject();
        var date = project.StartDate.AddDays(3); // Tag ohne vorbereitete Leaves

        SetHeaderAs(emp.Id);
        var res = await _client.PostAsJsonAsync("/api/leaves", new { employeeId = emp.Id, date = $"{date:yyyy-MM-dd}" });

        res.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.Created);

        var dto = await res.Content.ReadFromJsonAsync<CreateOrApproveResponse>();
        dto.Should().NotBeNull();
        dto!.conflictHints.Should().BeNullOrEmpty();
    }

    // Approve: Requested zählt mit (Approved + Requested)
    [Fact]
    public async Task Approve_considers_Requested_and_Approved_of_teammates()
    {
        var (emp, mate, project) = GetEmployeesWithSharedProject();
        var date = project.StartDate.AddDays(1);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LeavePlannerDbContext>();
            var lr = new LeaveRequest
            {
                EmployeeId = mate.Id,
                Date = date,
                Status = LeaveStatus.Requested
            };
            db.LeaveRequests.Add(lr);
            db.SaveChanges();
        }

        SetHeaderAs(emp.Id);
        var createRes = await _client.PostAsJsonAsync("/api/leaves", new { employeeId = emp.Id, date = $"{date:yyyy-MM-dd}" });
        createRes.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.Created);

        var created = await createRes.Content.ReadFromJsonAsync<CreateOrApproveResponse>();
        created.Should().NotBeNull();
        var leaveId = created!.leave.id;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LeavePlannerDbContext>();
            var approver = db.Employees.First(e => e.Role == UserRole.Approver);
            SetHeaderAs(approver.Id);
        }

        var approveRes = await _client.PostAsync($"/api/leaves/{leaveId}/approve", content: null);
        approveRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var approveDto = await approveRes.Content.ReadFromJsonAsync<CreateOrApproveResponse>();
        approveDto.Should().NotBeNull();
        approveDto!.conflictHints.Should().NotBeNull();
        approveDto.conflictHints!.Any(h => h.projectName == project.Name).Should().BeTrue();
    }

    // Keine Projektzuordnung -> keine Konflikte
    [Fact]
    public async Task Create_no_conflicts_when_employee_has_no_project_assignment()
    {
        Guid newEmpId;
        DateOnly date;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LeavePlannerDbContext>();

            var newEmp = new Employee { Name = "Test NoAssign", Role = UserRole.Employee };
            db.Employees.Add(newEmp);
            db.SaveChanges();
            newEmpId = newEmp.Id;

            var anyProject = db.Projects.First();
            date = anyProject.StartDate.AddDays(10);
        }

        SetHeaderAs(newEmpId);
        var res = await _client.PostAsJsonAsync("/api/leaves", new { employeeId = newEmpId, date = $"{date:yyyy-MM-dd}" });

        res.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.Created);
        var dto = await res.Content.ReadFromJsonAsync<CreateOrApproveResponse>();
        dto.Should().NotBeNull();
        dto!.conflictHints.Should().BeNullOrEmpty();
    }

    // Doppelter Antrag (409)
    [Fact]
    public async Task Create_duplicate_request_same_employee_same_day_returns_409()
    {
        var (emp, _, project) = GetEmployeesWithSharedProject();
        var date = project.StartDate.AddDays(2);

        SetHeaderAs(emp.Id);
        var first = await _client.PostAsJsonAsync("/api/leaves", new { employeeId = emp.Id, date = $"{date:yyyy-MM-dd}" });
        first.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.Created);

        var second = await _client.PostAsJsonAsync("/api/leaves", new { employeeId = emp.Id, date = $"{date:yyyy-MM-dd}" });
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}
