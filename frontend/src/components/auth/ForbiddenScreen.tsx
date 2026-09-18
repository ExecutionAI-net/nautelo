import Link from "next/link";

export default function ForbiddenScreen({ reason }: { reason?: string }) {
  return (
    <section
      role="alert"
      className="mx-auto flex max-w-md flex-col items-start gap-space-md p-space-lg"
    >
      <h1 className="font-headline-md text-headline-md text-primary">
        Access denied
      </h1>
      <p className="font-body-md text-on-surface-variant">
        {reason ??
          "Your account does not have permission to open this page. If you believe this is a mistake, contact the account administrator."}
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary"
      >
        Back to NAUTA
      </Link>
    </section>
  );
}
