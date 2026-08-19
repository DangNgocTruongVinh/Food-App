import { Leaf } from "lucide-react";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo logo-wordmark${compact ? " compact" : ""}`} aria-label="NOURI">
      <span className="logo-symbol" aria-hidden="true"><Leaf /></span>
      <span className="logo-word">NOURI</span>
    </div>
  );
}
