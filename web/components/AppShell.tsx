"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Ledger" },
  { href: "/scan", label: "Scan" },
  { href: "/products", label: "Products" },
  { href: "/warehouses", label: "Warehouses" },
  { href: "/purchase-orders", label: "Purchase Orders" },
  { href: "/sales-orders", label: "Sales Orders" },
  { href: "/alerts", label: "Alerts" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-ink">
      <aside className="w-56 shrink-0 border-r border-rule bg-surface flex flex-col">
        <div className="px-5 py-6 border-b border-rule">
          <div className="text-[11px] uppercase tracking-[0.2em] text-paper-dim">Vol. I</div>
          <div className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            Ledger
          </div>
        </div>

        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-5 py-2.5 text-sm border-l-2 transition-colors ${
                  active
                    ? "border-amber text-paper bg-surface-2"
                    : "border-transparent text-paper-dim hover:text-paper hover:bg-surface-2"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="px-5 py-4 border-t border-rule">
            <div className="text-sm text-paper">{user.name}</div>
            <div className="text-xs text-paper-dim uppercase tracking-wide">{user.role}</div>
            <button
              onClick={() => logout()}
              className="mt-3 text-xs text-paper-dim hover:text-red underline underline-offset-2"
            >
              Sign out
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
