// Pre-registration uploads for the broker sign-up form (customer feedback,
// 2026-09-25): a logo and one or more verification documents, uploaded
// straight to storage before the organization exists. `registrationId` is a
// client-minted id that namespaces the temp keys for this one registration
// attempt (accounts.registration_uploads on the backend).
import { apiFetch } from "@/lib/api/client";

interface UploadTarget {
  key: string;
  url: string;
  method: string;
  headers: Record<string, string>;
}

async function uploadDirect(target: UploadTarget, file: File): Promise<void> {
  const response = await fetch(target.url, { method: target.method, headers: target.headers, body: file });
  if (!response.ok) throw new Error("upload_failed");
}

export async function uploadRegistrationLogo(registrationId: string, file: File): Promise<string> {
  const intent = await apiFetch<UploadTarget>("/api/v1/auth/register/organization/uploads/logo/intent/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registration_id: registrationId, mime_type: file.type, size: file.size }),
  });
  await uploadDirect(intent, file);
  const completed = await apiFetch<{ key: string }>("/api/v1/auth/register/organization/uploads/logo/complete/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registration_id: registrationId, key: intent.key, mime_type: file.type }),
  });
  return completed.key;
}

export async function uploadRegistrationDocument(registrationId: string, file: File): Promise<string> {
  const intent = await apiFetch<UploadTarget>("/api/v1/auth/register/organization/uploads/document/intent/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registration_id: registrationId, mime_type: file.type, size: file.size }),
  });
  await uploadDirect(intent, file);
  const completed = await apiFetch<{ key: string }>("/api/v1/auth/register/organization/uploads/document/complete/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registration_id: registrationId, key: intent.key, mime_type: file.type }),
  });
  return completed.key;
}
