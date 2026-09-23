import { apiFetch } from "@/lib/api/client";

interface HealthCheckResponse {
  status: string;
  checks: Record<string, string>;
}

export default async function HealthPage() {
  let health: HealthCheckResponse | null = null;
  let error: string | null = null;

  try {
    health = await apiFetch<HealthCheckResponse>("/api/v1/health/", {
      cache: "no-store",
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md w-full rounded-xl border border-outline-variant p-6 shadow-sm bg-surface-container-lowest">
        <h1 className="font-headline-md text-headline-md text-primary mb-4">
          Nautelo backend status
        </h1>
        {error ? (
          <p className="text-error font-body-md">
            Could not reach backend: {error}
          </p>
        ) : (
          <ul className="space-y-2">
            <li className="font-body-md">
              Overall:{" "}
              <span className="font-semibold">{health?.status}</span>
            </li>
            {health &&
              Object.entries(health.checks).map(([key, value]) => (
                <li
                  key={key}
                  className="font-body-sm text-on-surface-variant"
                >
                  {key}: {value}
                </li>
              ))}
          </ul>
        )}
      </div>
    </main>
  );
}
