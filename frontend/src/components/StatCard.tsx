type IconProps = { className?: string };
const icon = (path: string) =>
  function Icon({ className }: IconProps) {
    return (
      <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    );
  };

export const StatIcons = {
  employees: icon("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"),
  clients: icon("M3 21h18M6 21V8l6-4 6 4v13M9 21v-6h6v6M9 12h.01M15 12h.01M9 8h.01M15 8h.01"),
  sheets: icon("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8"),
  advance: icon("M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"),
  trend: icon("M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6"),
  shield: icon("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"),
  wallet: icon("M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a2 2 0 0 0 0 4h4v-4z"),
} as const;

interface Props {
  icon: keyof typeof StatIcons;
  color: "blue" | "aqua" | "violet" | "amber" | "green" | "pink" | "red";
  value: string;
  label: string;
}

export function StatCard({ icon, color, value, label }: Props) {
  const Icon = StatIcons[icon];
  return (
    <div className={`card stat-card stat-card-${color}`}>
      <span className={`stat-icon-wrap stat-icon-${color}`}>
        <Icon />
      </span>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
