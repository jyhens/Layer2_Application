using System;
using System.Collections.Generic;

namespace LeavePlanner.Api.Models;

public class Project
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = null!;

    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }

    public List<ProjectAssignment> ProjectAssignments { get; set; } = new();
}
