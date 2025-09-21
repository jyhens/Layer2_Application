using System.Net;
using System.Reflection;
using LeavePlanner.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

const string DevCors = "DevCors";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevCors, policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.AddDbContext<LeavePlannerDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "LeavePlanner API",
        Version = "v1",
        Description = "REST-Schnittstelle für Urlaubsplanung (Demo)."
    });

    c.AddSecurityDefinition("EmployeeId", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Header,
        Name = "X-Employee-Id",
        Description = "Vorhandene Employee-GUID im Header übergeben, um Identität/Rolle zu simulieren."
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "EmployeeId" }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddControllers();

var app = builder.Build();
var startedAtUtc = DateTimeOffset.UtcNow;

if (app.Environment.IsDevelopment())
{
    app.UseCors(DevCors);
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<LeavePlannerDbContext>();
    await db.Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    using var scopeDev = app.Services.CreateScope();
    var devDb = scopeDev.ServiceProvider.GetRequiredService<LeavePlannerDbContext>();
    DbSeeder.Seed(devDb);
}
else
{
    app.UseHttpsRedirection();
    app.UseHsts();
}

app.MapGet("/debug/env", (IHostEnvironment env) =>
    Results.Ok(new { environment = env.EnvironmentName })
).WithOpenApi();

app.MapGet("/health/live", () =>
    Results.Ok(new { live = true, at = DateTimeOffset.UtcNow })
).WithOpenApi();

app.MapGet("/health/db", async (LeavePlannerDbContext db) =>
{
    var connected = await db.Database.CanConnectAsync();
    var pendingMigrations = (await db.Database.GetPendingMigrationsAsync()).Any();
    return Results.Ok(new { connected, pendingMigrations });
}).WithOpenApi();

app.MapGet("/health/ready", async (LeavePlannerDbContext db) =>
{
    var connected = await db.Database.CanConnectAsync();
    var pendingMigrations = (await db.Database.GetPendingMigrationsAsync()).Any();

    if (connected && !pendingMigrations)
        return Results.Ok(new { ready = true });

    return Results.StatusCode((int)HttpStatusCode.ServiceUnavailable);
}).WithOpenApi();

app.MapGet("/health/info", (IHostEnvironment env) =>
{
    var asm = Assembly.GetExecutingAssembly().GetName();
    var now = DateTimeOffset.UtcNow;

    return Results.Ok(new
    {
        name = asm.Name,
        version = asm.Version?.ToString(),
        environment = env.EnvironmentName,
        startedAtUtc,
        nowUtc = now,
        uptimeSeconds = (now - startedAtUtc).TotalSeconds
    });
}).WithOpenApi();

app.MapControllers();

app.Run();
