using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeavePlanner.Api.Models;

public enum NotificationKind
{
    Submitted = 0,
    Approved  = 1,
    Rejected  = 2
}

public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public Employee? User { get; set; }

    public Guid LeaveRequestId { get; set; }
    public NotificationKind Kind { get; set; }
    public DateOnly Date { get; set; }

    public Guid? ActorId { get; set; }
    public string? ActorName { get; set; }
    public string? Comment { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsRead { get; set; } = false;
}
