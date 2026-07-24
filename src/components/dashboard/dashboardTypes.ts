import type { ReactNode } from "react";

export type DashboardCardColor =
  | "orange"
  | "blue"
  | "green"
  | "purple"
  | "pink"
  | "cyan"
  | "red"
  | "yellow";

export interface DashboardCardItem {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  href?: string;
  icon: ReactNode;
  color: DashboardCardColor;
  badge?: string;
  details?: string[];
  backgroundImage?: string;
}

export interface Contributor {
  id: string;
  name: string;
  post: string;
  help: string;
  image: string;
}
