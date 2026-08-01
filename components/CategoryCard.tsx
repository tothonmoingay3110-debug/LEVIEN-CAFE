import Link from "next/link";

type CategoryCardProps = { name: string; icon: string; caption: string };

export function CategoryCard({ name, icon, caption }: CategoryCardProps) {
  return (
    <Link className="categoryCard" href={`/menu?category=${encodeURIComponent(name)}`}>
      <span className="categoryIcon" aria-hidden="true">{icon}</span>
      <span><strong>{name}</strong><small>{caption}</small></span>
      <span className="categoryArrow">→</span>
    </Link>
  );
}
