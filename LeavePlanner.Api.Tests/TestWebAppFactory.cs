// LeavePlanner.Api.Tests/TestWebAppFactory.cs
using System.IO;
using LeavePlanner.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace LeavePlanner.Api.Tests;

public class TestWebAppFactory : WebApplicationFactory<Program>
{
    private string? _tempDbPath;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing"); 

        builder.ConfigureServices(services =>
        {
            var descriptor = services.Single(d => d.ServiceType == typeof(DbContextOptions<LeavePlannerDbContext>));
            services.Remove(descriptor);

            _tempDbPath = Path.Combine(Path.GetTempPath(), $"leaveplanner_test_{Guid.NewGuid():N}.db");
            var cs = $"Data Source={_tempDbPath};Cache=Shared";

            services.AddDbContext<LeavePlannerDbContext>(opt => opt.UseSqlite(cs));

            using var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LeavePlannerDbContext>();

            db.Database.EnsureDeleted();   
            db.Database.EnsureCreated();
            DbSeeder.SeedForTests(db);     
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (_tempDbPath is not null && File.Exists(_tempDbPath))
        {
            try { File.Delete(_tempDbPath); } catch { /* ignore */ }
        }
    }
}
