const paths = {
  preview: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  download: "M12 3v12M7 10l5 5 5-5M4 21h16",
  edit: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
  delete: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z",
  view: "M5 12h14M13 6l6 6-6 6",
  upload: "M12 16V4M12 4l-4 4M12 4l4 4M4 20h16",
  print: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2ZM17 21v-8H7v8M7 3v5h8",
  close: "M18 6 6 18M6 6l12 12",
} as const;

export type ActionIcon = keyof typeof paths;

interface Props {
  icon: ActionIcon;
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}

/** Small icon+label action button — used for row-level and toolbar actions (Preview, Download, Edit, Delete, ...). */
export function ActionButton({ icon, children, onClick, tone = "default", disabled }: Props) {
  return (
    <button type="button" className={`btn-action ${tone === "danger" ? "btn-action-danger" : ""}`} onClick={onClick} disabled={disabled}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[icon]} />
      </svg>
      {children}
    </button>
  );
}
