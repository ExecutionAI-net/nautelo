export default function PageBand({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="bg-surface-container-low py-space-xl">
      <div className="mx-auto max-w-[1440px] px-margin-mobile md:px-margin lg:px-margin-desktop">
        <span className="font-label-sm uppercase tracking-widest text-secondary">{eyebrow}</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">{title}</h1>
        {subtitle ? <p className="mt-space-xs max-w-2xl font-body-md text-on-surface-variant">{subtitle}</p> : null}
        {children}
      </div>
    </header>
  );
}
