import Link from "next/link";
import { CATEGORY_META } from "@/lib/data/categories";
import { CATEGORY_ICON } from "@/lib/data/categoryIcons";

export default function ExplorePage() {
  return (
    <div className="px-5 pt-6">
      <p className="text-xs font-medium uppercase tracking-wide text-accentDark">Manual marketplace</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink">Explore</h1>
      <p className="mt-1 text-sm text-ink/50">
        Same catalog, providers and checkout the AI concierge uses — browse it yourself any time.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {CATEGORY_META.map((c) => {
          const Icon = CATEGORY_ICON[c.id];
          return (
            <Link
              key={c.id}
              href={`/explore/${c.id}`}
              className="flex flex-col gap-2 rounded-xl2 border border-black/5 bg-white p-4 shadow-sm transition hover:border-accentDark"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accentSoft text-accentDark">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <span className="text-sm font-medium text-ink">{c.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
