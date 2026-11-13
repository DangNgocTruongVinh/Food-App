import { Search } from "lucide-react";
import { type InputHTMLAttributes, type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  COMBO_DEBOUNCE_MS, comboKey, type ComboOption, type ComboState, highlightParts, rankOptions,
} from "../../features/ui/combobox.logic";
import { cx } from "../../features/ui/ui.logic";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onSelect" | "role">;

export type ComboboxProps = InputProps & {
  value: string;
  onValueChange: (value: string) => void;
  /** Toàn bộ mục có thể gợi ý; component tự lọc, xếp hạng (không dấu, nhiều từ, sai nhẹ) và lấy tối đa 8. */
  options: ComboOption[];
  onPick: (option: ComboOption) => void;
  /** Enter khi không chọn gợi ý nào (giữ hành vi cũ của ô: thêm, tìm…). Không truyền thì Enter giữ mặc định (vd. gửi form). */
  onEnter?: (value: string) => void;
  /** Đang tải gợi ý từ máy chủ. */
  loading?: boolean;
  wrapperClassName?: string;
};

/**
 * Ô nhập có gợi ý tự động (kiểu ô tìm kiếm YouTube): gõ ≥ 1 ký tự → danh sách ngay dưới ô, phần khớp in đậm; ↑↓ + Enter hoặc
 * chuột để chọn, Esc / bấm ra ngoài để đóng. Chuẩn ARIA combobox + listbox (aria-expanded, aria-activedescendant).
 * Hành vi bàn phím, lọc, in đậm: features/ui/combobox.logic.ts (có test).
 */
export function Combobox({
  value, onValueChange, options, onPick, onEnter, loading = false, wrapperClassName, className, id,
  onKeyDown, onFocus, onBlur, ...inputProps
}: ComboboxProps) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const listId = `${inputId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ComboState>({ open: false, active: -1 });
  const [query, setQuery] = useState(value);

  // Lọc sau khi ngừng gõ 150 ms (danh sách dài, hoặc gợi ý từ máy chủ ở nơi gọi).
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value), COMBO_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

  const results = useMemo(() => rankOptions(options, query), [options, query]);
  const pending = loading || query !== value;
  const open = state.open && value.trim().length > 0;
  const active = state.active < results.length ? state.active : -1;
  const optionId = (index: number) => `${listId}-${index}`;

  const pick = (option: ComboOption) => {
    setState({ open: false, active: -1 });
    onPick(option);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    const { state: next, command } = comboKey({ open, active }, event.key, results.length);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") event.preventDefault();
    if (command === "select") {
      event.preventDefault();
      pick(results[active]);
      return;
    }
    if (command === "close") {
      event.preventDefault();
      event.stopPropagation(); // Esc chỉ đóng danh sách, không đóng hộp thoại chứa ô
    }
    if (command === "enter" && onEnter) {
      event.preventDefault();
      onEnter(value);
    }
    setState(next);
  };

  return (
    <div className={cx("ui-combobox", wrapperClassName)}>
      <input
        {...inputProps}
        ref={inputRef}
        id={inputId}
        className={className}
        value={value}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        onChange={(event) => { onValueChange(event.target.value); setState({ open: true, active: -1 }); }}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          onFocus?.(event);
          setState((current) => ({ ...current, open: true }));
          // Điện thoại: đưa ô lên giữa màn hình để bàn phím ảo không che danh sách gợi ý.
          if (window.innerWidth < 600) window.setTimeout(() => inputRef.current?.scrollIntoView?.({ block: "center" }), 250);
        }}
        onBlur={(event) => { onBlur?.(event); setState({ open: false, active: -1 }); }}
      />
      <ul id={listId} role="listbox" className="ui-combobox__list" hidden={!open} aria-label="Gợi ý">
        {open && results.map((option, index) => (
          <li
            key={option.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            className="ui-combobox__option"
            // Giữ focus ở ô nhập (không để blur đóng danh sách trước khi chọn).
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(option)}
          >
            <Search className="ui-combobox__icon" aria-hidden="true" />
            <span className="ui-combobox__label">
              {highlightParts(option.label, value).map((part, partIndex) => (part.match ? <b key={partIndex}>{part.text}</b> : part.text))}
            </span>
            {option.detail && <span className="ui-combobox__detail">{option.detail}</span>}
          </li>
        ))}
        {open && !results.length && (
          <li className="ui-combobox__status" role="presentation">{pending ? "Đang tìm gợi ý..." : "Không có gợi ý"}</li>
        )}
      </ul>
    </div>
  );
}
