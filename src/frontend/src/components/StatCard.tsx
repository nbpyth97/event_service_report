import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

export default function StatCard({
  icon: Icon,
  value,
  label,
  secondary,
  to,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  secondary?: string;
  to?: string;
}) {
  const content = (
    <>
      <div className="stat-card-icon">
        <Icon size={18} aria-hidden="true" />
      </div>
      <span className="stat-card-value">{value}</span>
      <span className="stat-card-label">{label}</span>
      {secondary && <span className="stat-card-secondary">{secondary}</span>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="stat-card stat-card-link">
        {content}
      </Link>
    );
  }

  return <div className="stat-card">{content}</div>;
}
