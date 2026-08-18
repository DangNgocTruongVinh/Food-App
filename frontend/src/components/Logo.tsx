import { Leaf } from "lucide-react";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="logo"><span className="logo-mark"><Leaf size={20} /></span>{!compact && <span>NutriPlan <b>AI</b></span>}</div>;
}
