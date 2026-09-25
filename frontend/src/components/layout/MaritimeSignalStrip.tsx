/**
 * Purely decorative branding strip under the home page hero: seven signal
 * flags spelling N-A-U-T-E-L-O (the brand name) using the real International
 * Maritime Signal Code alphabet flags, plus a small compass-rose medallion.
 * No data, no links — just flavour that matches the Mediterranean-marketplace
 * positioning.
 */
const FLAGS: { letter: string; render: React.ReactNode }[] = [
  {
    letter: "N",
    render: (
      <div className="w-9 h-7 rounded border border-primary/20 shadow-sm overflow-hidden bg-white grid grid-cols-4 grid-rows-4">
        {[1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1].map((filled, index) => (
          <div key={index} className={filled ? "bg-[#002060]" : "bg-white"} />
        ))}
      </div>
    ),
  },
  {
    letter: "A",
    render: (
      <div className="w-9 h-7 rounded border border-primary/20 shadow-sm overflow-hidden flex relative">
        <div className="w-1/2 h-full bg-white" />
        <div className="w-1/2 h-full bg-[#002060]" style={{ clipPath: "polygon(0 0, 100% 0, 65% 50%, 100% 100%, 0 100%)" }} />
      </div>
    ),
  },
  {
    letter: "U",
    render: (
      <div className="w-9 h-7 rounded border border-primary/20 shadow-sm overflow-hidden grid grid-cols-2 grid-rows-2">
        <div className="bg-[#c8102e]" />
        <div className="bg-white" />
        <div className="bg-white" />
        <div className="bg-[#c8102e]" />
      </div>
    ),
  },
  {
    letter: "T",
    render: (
      <div className="w-9 h-7 rounded border border-primary/20 shadow-sm overflow-hidden flex">
        <div className="w-1/3 h-full bg-[#c8102e]" />
        <div className="w-1/3 h-full bg-white" />
        <div className="w-1/3 h-full bg-[#002060]" />
      </div>
    ),
  },
  {
    letter: "E",
    render: (
      <div className="w-9 h-7 rounded border border-primary/20 shadow-sm overflow-hidden flex flex-col">
        <div className="w-full h-1/2 bg-[#002060]" />
        <div className="w-full h-1/2 bg-[#c8102e]" />
      </div>
    ),
  },
  {
    letter: "L",
    render: (
      <div className="w-9 h-7 rounded border border-primary/20 shadow-sm overflow-hidden grid grid-cols-2 grid-rows-2">
        <div className="bg-[#ffcd00]" />
        <div className="bg-[#1b1c19]" />
        <div className="bg-[#1b1c19]" />
        <div className="bg-[#ffcd00]" />
      </div>
    ),
  },
  {
    letter: "O",
    render: (
      <div className="w-9 h-7 rounded border border-primary/20 shadow-sm overflow-hidden relative bg-[#ffcd00]">
        <div className="absolute inset-0 bg-[#c8102e]" style={{ clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }} />
      </div>
    ),
  },
];

export default function MaritimeSignalStrip({ signalLabel, datumLabel }: { signalLabel: string; datumLabel: string }) {
  return (
    <div className="mt-space-lg hidden w-full bg-surface-container-lowest/80 backdrop-blur-sm rounded-xl border border-outline-variant px-space-lg py-space-sm shadow-sm sm:flex sm:flex-row items-center justify-between gap-space-md">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#c5a059]" />
          <span className="font-label-sm text-xs tracking-widest uppercase text-[#99732f] font-semibold">{signalLabel}</span>
        </div>
        <div className="h-6 w-px bg-outline-variant mx-2 hidden sm:block" />
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          {FLAGS.map(({ letter, render }) => (
            <div key={letter} className="flex flex-col items-center gap-1.5">
              {render}
              <span className="font-label-sm text-xs text-[#5a4314] font-bold tracking-tight">{letter}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant w-full sm:w-auto justify-between sm:justify-end">
        <div className="flex flex-col text-right">
          <span className="font-label-sm text-[11px] text-primary font-semibold tracking-wider">{datumLabel}</span>
          <span className="font-spec-num text-[10px] text-outline">45°27′49″N · 09°11′23″E</span>
        </div>
        <div
          className="relative w-10 h-10 rounded-full flex items-center justify-center p-0.5 shadow-sm"
          style={{ background: "radial-gradient(circle at 35% 30%, #fbf3d5 0%, #e8c872 38%, #c5a059 70%, #99732f 100%)" }}
        >
          <div className="w-full h-full rounded-full bg-gradient-to-br from-primary-container to-primary p-1 flex items-center justify-center relative">
            <svg className="w-full h-full" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="20" cy="20" r="17.5" stroke="#e8c872" strokeWidth="0.7" strokeDasharray="1 1" opacity="0.8" />
              <circle cx="20" cy="20" r="14" stroke="#c5a059" strokeWidth="0.5" opacity="0.6" />
              <polygon points="20,4 22.5,17.5 36,20 22.5,22.5 20,36 17.5,22.5 4,20 17.5,17.5" fill="#e8c872" opacity="0.9" />
              <polygon points="20,4 20,20 22.5,17.5" fill="#ffffff" opacity="0.95" />
              <polygon points="20,36 20,20 17.5,22.5" fill="#99732f" opacity="0.95" />
              <polygon points="4,20 20,20 17.5,17.5" fill="#c5a059" opacity="0.95" />
              <polygon points="36,20 20,20 22.5,22.5" fill="#99732f" opacity="0.95" />
              <polygon
                points="20,9 21.5,18.5 31,20 21.5,21.5 20,31 18.5,21.5 9,20 18.5,18.5"
                fill="#c5a059"
                opacity="0.45"
                transform="rotate(45 20 20)"
              />
              <circle cx="20" cy="20" r="2.5" fill="#e8c872" stroke="#99732f" strokeWidth="0.6" />
              <circle cx="20" cy="20" r="0.9" fill="#ffffff" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
