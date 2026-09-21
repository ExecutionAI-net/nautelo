import Link from "next/link";

type Tab = "login" | "register" | "recovery";

const TABS: { key: Tab; label: string; href: string }[] = [
  { key: "login", label: "Sign in", href: "/login/" },
  { key: "register", label: "Create account", href: "/register/" },
  { key: "recovery", label: "Forgot password", href: "/forgot-password/" },
];

const POINTS = [
  { title: "Spain and Italy in one place", body: "Private sellers, brokers and nautical professionals across both coasts." },
  { title: "Every listing is reviewed", body: "Our team checks each listing before it goes live." },
  { title: "One account for everything", body: "List boats, follow enquiries and manage your services from a single sign-in." },
];

export default function AuthShell({
  tab,
  heading,
  children,
}: {
  tab: Tab;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <main className="w-full bg-surface">
      <header className="bg-surface-container-low py-space-xl">
        <div className="mx-auto max-w-[1440px] px-margin-mobile md:px-margin lg:px-margin-desktop">
          <span className="font-label-sm uppercase tracking-widest text-secondary">Secure account access</span>
          <p className="mt-1 font-headline-lg text-headline-lg text-primary">Nauta account</p>
          <p className="mt-space-xs max-w-2xl font-body-md text-on-surface-variant">
            One account for private sellers, brokers and nautical professionals.
          </p>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] gap-space-xl px-margin-mobile py-space-xl md:px-margin lg:grid-cols-[5fr_7fr] lg:px-margin-desktop">
        <aside className="hidden flex-col overflow-hidden rounded-xl bg-primary text-on-primary lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src="/design/c4967d98c7.jpg" className="h-64 w-full object-cover opacity-90" />
          <div className="flex flex-col gap-space-md p-space-lg">
            <span className="font-label-sm uppercase tracking-widest opacity-70">Mediterranean boat marketplace</span>
            {POINTS.map((point) => (
              <div key={point.title}>
                <p className="font-title-md text-title-md">{point.title}</p>
                <p className="font-body-sm opacity-70">{point.body}</p>
              </div>
            ))}
          </div>
        </aside>
        <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div className="mb-space-lg flex rounded-lg bg-surface-container p-1 font-label-md">
            {TABS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.key === tab ? "page" : undefined}
                className={`flex-1 rounded-md px-space-sm py-space-xs text-center transition-colors ${
                  item.key === tab ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <h1 className="mb-space-md font-headline-md text-headline-md text-primary">{heading}</h1>
          {children}
        </section>
      </div>
    </main>
  );
}
