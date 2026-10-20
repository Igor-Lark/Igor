"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Обзор"],
  ["/tasks", "Задачи"],
  ["/directions", "Направления"],
  ["/pages", "Страницы"],
  ["/research", "Исследования"],
  ["/content", "Контент и SEO"],
  ["/ads", "Реклама"],
  ["/creatives", "Креативы"],
  ["/sources", "Источники"],
  ["/history", "История"],
  ["/knowledge", "База знаний"],
  ["/settings", "Настройки"],
];

export function Nav() {
  const pathname = usePathname();
  return (
    <aside className="nav">
      <strong>Boat Content Factory</strong>
      {LINKS.map(([href, label]) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? "active" : undefined}>
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
