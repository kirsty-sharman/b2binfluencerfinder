import { Info, Plus } from "lucide-react";
import type { ReactNode } from "react";

export function ActionHelp({ label, children }: { label: string; children: ReactNode }) {
  return <details className="workspace-help"><summary aria-label={label}><Info size={15}/></summary><div>{children}</div></details>;
}
export function WorkspacePanel({ title, description, children, open = false }: { title:string; description?:string; children:ReactNode; open?:boolean }) {
  return <details className="surface workspace-panel" open={open || undefined}><summary><span><strong>{title}</strong>{description && <small>{description}</small>}</span><Plus size={18} aria-hidden="true"/></summary><div className="workspace-panel-body">{children}</div></details>;
}
