using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace LeavePlanner.Api.Tests;

public static class HttpTestExtensions
{
    public static void WithEmployeeHeader(this HttpRequestMessage req, string employeeId)
        => req.Headers.TryAddWithoutValidation("X-Employee-Id", employeeId);

    public static async Task<HttpResponseMessage> PostJsonAsync<T>(this HttpClient c, string url, T body)
        => await c.PostAsJsonAsync(url, body);
}
