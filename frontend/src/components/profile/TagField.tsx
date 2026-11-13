import { X } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { addTag } from "../../features/profile/profile.logic";
import type { RestrictionAdd } from "../../features/profile/restrictions.logic";
import type { ComboOption } from "../../features/ui/combobox.logic";
import { cx } from "../../features/ui/ui.logic";
import { Button, Combobox } from "../ui";

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
  /** Gợi ý tự động khi gõ (Combobox). */
  options?: ComboOption[];
  /** Cách thêm riêng (dị ứng: gộp theo nhóm, nhắc mục chưa nhận ra); mặc định addTag. */
  adder?: (tags: string[], raw: string, max: number) => Partial<RestrictionAdd> & { tags: string[]; error: string | null };
  /** Dòng tóm tắt dưới ô (vd. "Sẽ tránh: …"). */
  summary?: string | null;
  className?: string;
};

/**
 * Ô nhập dạng thẻ: gõ rồi Enter (hoặc dấu phẩy, hoặc nút "Thêm") để thêm; mỗi thẻ có nút bỏ riêng (44px, có tên đọc).
 * Dùng được hoàn toàn bằng bàn phím. Lỗi (trùng, quá dài, quá số mục) hiện ngay dưới ô.
 */
export function TagField(props: TagFieldProps) {
  const { label, itemName, tags, onChange, max, placeholder, hint, suggestions = [], options, adder = addTag, summary, className } = props;
  const id = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tag: string; suggestion: string | null } | null>(null);
  const add = (raw: string, current = tags) => {
    const result: ReturnType<NonNullable<TagFieldProps["adder"]>> = adder(current, raw, max);
    setError(result.error);
    const added = result.tags.length > current.length ? result.tags[result.tags.length - 1] : null;
    setNotice(result.notice && added ? { text: result.notice, tag: added, suggestion: result.suggestion ?? null } : null);
    if (result.tags !== current) onChange(result.tags);
    if (!result.error) setDraft("");
  };
  // "Có phải bạn muốn: Trứng?": thay mục chưa nhận ra bằng nhóm gợi ý.
  const acceptSuggestion = () => {
    if (!notice?.suggestion) return;
    add(notice.suggestion, tags.filter((tag) => tag !== notice.tag));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === "Enter" || event.key === ",") && !event.nativeEvent.isComposing) {
      event.preventDefault();
      add(draft);
    }
  };
  const remaining = suggestions.filter((item) => !tags.some((tag) => tag.toLocaleLowerCase("vi") === item.toLocaleLowerCase("vi")));
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`, summary && `${id}-summary`].filter(Boolean).join(" ") || undefined;
  const inputProps = {
    id: `${id}-input`, className: "ui-input", placeholder, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined,
  } as const;

  return (
    <div className={cx("ui-field", "hs-tags", className)}>
      <label className="ui-field__label" htmlFor={`${id}-input`}>{label}</label>
      {tags.length > 0 && (
        <ul className="hs-tags__list" aria-label={`${label} đã thêm`}>
          {tags.map((tag) => (
            <li key={tag} className="hs-tags__item">
              <span>{tag}</span>
              <button
                type="button"
                className="hs-tags__remove"
                aria-label={`Bỏ ${itemName} ${tag}`}
                onClick={() => onChange(tags.filter((item) => item !== tag))}
              >
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="hs-tags__entry">
        {options ? (
          <Combobox
            {...inputProps}
            wrapperClassName="hs-tags__combobox"
            value={draft}
            onValueChange={(value) => { setDraft(value); setError(null); }}
            options={options}
            onPick={(option) => add(option.label)}
            onEnter={(value) => add(value)}
            onKeyDown={(event) => { if (event.key === "," && !event.nativeEvent.isComposing) { event.preventDefault(); add(draft); } }}
          />
        ) : (
          <input
            {...inputProps}
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setError(null); }}
            onKeyDown={onKeyDown}
          />
        )}
        <Button onClick={() => add(draft)} disabled={!draft.trim()}>Thêm</Button>
      </div>
      {error && <p id={`${id}-error`} className="ui-field__error">{error}</p>}
      {notice && (
        <p className="ui-field__hint hs-tags__notice" role="status">
          {notice.text}
          {notice.suggestion && (
            <>
              {" "}
              <button type="button" className="hs-tags__suggest" onClick={acceptSuggestion}>Có phải bạn muốn: {notice.suggestion}?</button>
            </>
          )}
        </p>
      )}
      {summary && <p id={`${id}-summary`} className="ui-field__hint hs-tags__summary">{summary}</p>}
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
