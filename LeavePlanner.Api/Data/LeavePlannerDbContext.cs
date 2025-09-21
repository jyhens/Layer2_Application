using LeavePlanner.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LeavePlanner.Api.Data;

public class LeavePlannerDbContext : DbContext
{
    public LeavePlannerDbContext(DbContextOptions<LeavePlannerDbContext> options) : base(options) { }

    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectAssignment> ProjectAssignments => Set<ProjectAssignment>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Employee>()
            .HasMany(e => e.ProjectAssignments)
            .WithOne(pa => pa.Employee!)
            .HasForeignKey(pa => pa.EmployeeId);

        modelBuilder.Entity<Project>()
            .HasMany(p => p.ProjectAssignments)
            .WithOne(pa => pa.Project!)
            .HasForeignKey(pa => pa.ProjectId);

        modelBuilder.Entity<Project>()
            .HasOne(p => p.Customer)
            .WithMany()
            .HasForeignKey(p => p.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Project>()
            .ToTable(t => t.HasCheckConstraint(
                "CK_Project_Period",
                "EndDate IS NULL OR EndDate >= StartDate"
            ));

        modelBuilder.Entity<Employee>()
            .HasMany(e => e.LeaveRequests)
            .WithOne(lr => lr.Employee!)
            .HasForeignKey(lr => lr.EmployeeId);

        modelBuilder.Entity<LeaveRequest>()
            .HasIndex(lr => new { lr.EmployeeId, lr.Date })
            .IsUnique();

        modelBuilder.Entity<ProjectAssignment>()
            .HasIndex(pa => new { pa.EmployeeId, pa.ProjectId })
            .IsUnique();

        modelBuilder.Entity<Employee>()
            .Property(e => e.Name)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Customer>()
            .Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Project>()
            .Property(p => p.Name)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Notification>()
            .HasOne(n => n.User)
            .WithMany()
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Notification>()
            .Property(n => n.ActorName)
            .HasMaxLength(200);

        modelBuilder.Entity<Notification>()
            .HasIndex(n => new { n.UserId, n.IsRead });

        modelBuilder.Entity<Notification>()
            .HasIndex(n => n.LeaveRequestId);
    }
}
