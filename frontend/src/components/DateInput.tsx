import { CalendarDays } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isoDateToDisplay, maskDateInput, parseDisplayDate, resolveDateDraft, type DateDraftStatus } from "../utils/date";

type DateInputProps = {
  /** Giá trị dạng yyyy-MM-dd, hoặc "" khi trống. */
  value: string;
  /** value: yyyy-MM-dd khi hợp lệ, "" khi trống hoặc nhập sai; status phân biệt hai trường hợp "" đó. */
  onChange: (value: string, status: DateDraftStatus) => void;
  required?: boolean;
  "aria-label"?: string;
};

const invalidMessage = "Nhập ngày theo dạng dd/mm/yyyy.";

// Ô ngày luôn hiển thị dd/mm/yyyy, không phụ thuộc locale trình duyệt như input type="date".
export default function DateInput({ value, onChange, required, "aria-label": ariaLabel }: DateInputProps) {
  const textRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => isoDateToDisplay(value));
  const invalid = resolveDateDraft(draft).status === "invalid";

  // Đồng bộ khi giá trị đổi từ bên ngoài (mở form sửa, chọn từ lịch), nhưng không ghi đè lúc người dùng đang gõ dở.
  useEffect(() => {
    setDraft((current) => (value === (parseDisplayDate(current) ?? "") ? current : isoDateToDisplay(value)));
  }, [value]);

  useEffect(() => {
    textRef.current?.setCustomValidity(invalid ? invalidMessage : "");
  }, [invalid]);

  const changeText = (raw: string) => {
    const next = maskDateInput(raw);
    setDraft(next);
    const { value: nextValue, status } = resolveDateDraft(next);
    onChange(nextValue, status);
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  };

  return <span className="date-input">
    <input
      ref={textRef}
      className="date-input-text"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/yyyy"
      maxLength={10}
      required={required}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      title={invalid ? invalidMessage : undefined}
      value={draft}
      onChange={(event) => changeText(event.target.value)}
      onBlur={() => { const iso = parseDisplayDate(draft); if (iso) setDraft(isoDateToDisplay(iso)); }}
    />
    <button type="button" className="date-input-picker" onClick={openPicker} aria-label="Chọn ngày từ lịch" title="Chọn ngày từ lịch"><CalendarDays /></button>
    <input
      ref={pickerRef}
      className="date-input-native"
      type="date"
      tabIndex={-1}
      aria-hidden="true"
      value={value}
      onChange={(event) => onChange(event.target.value, event.target.value ? "valid" : "empty")}
    />
  </span>;
}
