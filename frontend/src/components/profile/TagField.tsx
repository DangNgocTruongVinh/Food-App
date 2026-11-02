import { X } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { addTag } from "../../features/profile/profile.logic";
import { cx } from "../../features/ui/ui.logic";
import { Button } from "../ui";

type TagFieldProps = {
  label: string;
  /** Danh từ dùng trong tên nút bỏ: "Bỏ dị ứng Tôm". */
  itemName: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  max: number;
  placeholder?: string;
  hint?: string;
  /** Gợi ý bấm để thêm nhanh (ẩn những mục đã có). */
  suggestions?: string[];
  className?: string;
};

/**
 * Ô nhập dạng thẻ: gõ rồi Enter (hoặc dấu phẩy, hoặc nút "Thêm") để thêm; mỗi thẻ có nút bỏ riêng (44px, có tên đọc).
 * Dùng được hoàn toàn bằng bàn phím. Lỗi (trùng, quá dài, quá số mục) hiện ngay dưới ô.
 */
export function TagField({ label, itemName, tags, onChange, max, placeholder, hint, suggestions = [], className }: TagFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = (raw: string) => {
    const result = addTag(tags, raw, max);
    setError(result.error);
    if (result.tags !== tags) onChange(result.tags);
    if (!result.error) setDraft("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === "Enter" || event.key === ",") && !event.nativeEvent.isComposing) {
      event.preventDefault();
      add(draft);
    }
  };
  const remaining = suggestions.filter((item) => !tags.some((tag) => tag.toLocaleLowerCase("vi") === item.toLocaleLowerCase("vi")));
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("ui-field", "hs-tags", className)}>
      <label className="ui-field__label" htmlFor={`${id}-input`}>{label}</label>
      {tags.length > 0 && (
        <ul className="hs-tags__list" aria-label={`${label} đã thêm`}>
          {tags.map((tag) => (
            <li key={tag} className="hs-tags__item">
              <span>{tag}</span>
              <button type="button" className="hs-tags__remove" aria-label={`Bỏ ${itemName} ${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag))}>
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="hs-tags__entry">
        <input
          id={`${id}-input`}
          className="ui-input"
          value={draft}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => { setDraft(event.target.value); setError(null); }}
          onKeyDown={onKeyDown}
        />
        <Button onClick={() => add(draft)} disabled={!draft.trim()}>Thêm</Button>
      </div>
      {error && <p id={`${id}-error`} className="ui-field__error">{error}</p>}
      {hint && <p id={`${id}-hint`} className="ui-field__hint">{hint}</p>}
      {remaining.length > 0 && (
        <div className="hs-tags__suggestions" role="group" aria-label={`Thêm nhanh ${itemName}`}>
          {remaining.map((item) => (
            <button key={item} type="button" className="hs-tags__suggestion" onClick={() => add(item)}>+ {item}</button>
          ))}
        </div>
      )}
    </div>
  );
}
