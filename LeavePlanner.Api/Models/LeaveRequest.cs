using System;

namespace LeavePlanner.Api.Models;

public class LeaveRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public DateOnly Date { get; set; }
    public LeaveStatus Status { get; set; } = LeaveStatus.Requested;
    
    public Guid? DecisionByEmployeeId { get; set; }      
    public DateTimeOffset? DecisionAt { get; set; }      
    public string? DecisionComment { get; set; }         
}
