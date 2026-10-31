import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../features/theme/useTheme";
import { IconButton } from "./Button";

/** Nút chế độ tối: aria-pressed = đang bật chế độ tối; lựa chọn được nhớ trong localStorage. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return <IconButton className={className} label="Chế độ tối" pressed={dark} icon={dark ? <Moon /> : <Sun />} onClick={toggle} />;
}
