export default function ProfileMonogram({ name }: { name: string }) {
  // ProfessionalProfile has no logo/photo field yet (Phase 3, Task 6) and
  // spec 2.1 forbids inventing one, so the identity header's image slot shows
  // initials derived from a real field.
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden="true"
      data-testid="profile-monogram"
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-container font-title-lg text-title-lg text-on-primary-container"
    >
      {initials}
    </span>
  );
}
