import { type FormEvent, useState } from "react";
import type { AdminReceiptAbbreviation, AdminReceiptSkipKeyword, ReceiptKeywordMatch } from "../../features/admin/admin.api";
import { SKIP_REASON_LABELS } from "../../features/pantry/receipt-scan.logic";
import type { SaveCatalog } from "../../pages/admin/AdminCatalogPage";
import type { ReceiptSkipReason } from "../../types";
import { Button, Card, Field } from "../ui";
import { type Entry, EntryList } from "./AdminAllergenCatalog";

const MODE_LABEL: Record<ReceiptKeywordMatch, string> = {
  WORD: "có nguyên từ", PREFIX: "dòng bắt đầu bằng", LINE: "cả dòng là từ này", LINE_SUFFIX: "từ đi kèm (sau từ cả dòng)",
};
const REASONS = Object.entries(SKIP_REASON_LABELS) as Array<[ReceiptSkipReason, string]>;

type Props = { abbreviations: AdminReceiptAbbreviation[]; keywords: AdminReceiptSkipKeyword[]; save: SaveCatalog; busy: boolean };

/** Hóa đơn: tên viết tắt trên hóa đơn siêu thị → tên thực phẩm, và từ khóa nhận dòng không phải hàng (thuế, tổng tiền, túi…). */
export function AdminReceiptCatalog({ abbreviations, keywords, save, busy }: Props) {
  const reasons = REASONS.filter(([reason]) => keywords.some((row) => row.reason === reason));
  return (
    <div className="ad-catalog">
      <Abbreviations abbreviations={abbreviations} save={save} busy={busy} />
      <Card as="section" className="ad-catalog__card" aria-label="Từ khóa bỏ dòng hóa đơn">
        <h3 className="ad-catalog__title">Từ khóa bỏ dòng hóa đơn</h3>
        <p className="ad-sub">Dòng khớp từ khóa (so trên chữ bỏ dấu, bỏ số) không được coi là hàng mua. Lý do xét theo thứ tự dưới đây.</p>
        <AddKeyword save={save} busy={busy} />
        {reasons.map(([reason, label]) => {
          const entries: Entry[] = keywords.filter((row) => row.reason === reason)
            .map((row) => ({ id: row.id, name: row.keyword, hiddenAt: row.hiddenAt, detail: MODE_LABEL[row.matchMode] }));
          return <EntryList key={reason} title={label} kind="receipt-skip-keywords" groupLabel={label} entries={entries} save={save} busy={busy} />;
        })}
      </Card>
    </div>
  );
}

function AddKeyword({ save, busy }: { save: SaveCatalog; busy: boolean }) {
  const [reason, setReason] = useState<ReceiptSkipReason>("TOTAL");
  const [keyword, setKeyword] = useState("");
  const [matchMode, setMatchMode] = useState<ReceiptKeywordMatch>("WORD");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await save({ kind: "receipt-skip-keywords", body: { reason, keyword, matchMode } }, `Đã thêm từ khóa “${keyword.trim()}”.`)) setKeyword("");
  };
  return (
    <form className="ad-catalog__form" onSubmit={(event) => void submit(event)}>
      <Field label="Lý do">
        {(control) => (
          <select {...control} value={reason} onChange={(event) => setReason(event.target.value as ReceiptSkipReason)}>
            {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        )}
      </Field>
      <Field
        label="Từ khóa" hint="Lưu dạng bỏ dấu, chữ thường" value={keyword} placeholder="Ví dụ: phí giao hàng" required
        onChange={(event) => setKeyword(event.target.value)}
      />
      <Field label="Cách khớp">
        {(control) => (
          <select {...control} value={matchMode} onChange={(event) => setMatchMode(event.target.value as ReceiptKeywordMatch)}>
            {Object.entries(MODE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        )}
      </Field>
      <Button type="submit" variant="primary" busy={busy}>Thêm từ khóa</Button>
    </form>
  );
}

function Abbreviations({ abbreviations, save, busy }: { abbreviations: AdminReceiptAbbreviation[]; save: SaveCatalog; busy: boolean }) {
  const [abbreviation, setAbbreviation] = useState("");
  const [fullName, setFullName] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await save({ kind: "receipt-abbreviations", body: { abbreviation, fullName } }, `Đã thêm “${abbreviation.trim()}”.`)) {
      setAbbreviation(""); setFullName("");
    }
  };
  const entries: Entry[] = abbreviations.map((row) => ({ id: row.id, name: row.abbreviation, hiddenAt: row.hiddenAt, detail: row.fullName }));
  return (
    <Card as="section" className="ad-catalog__card" aria-label="Viết tắt hóa đơn">
      <h3 className="ad-catalog__title">Thêm viết tắt hóa đơn</h3>
      <form className="ad-catalog__form" onSubmit={(event) => void submit(event)}>
        <Field
          label="Chữ trên hóa đơn" hint="Lưu dạng bỏ dấu, chữ thường" value={abbreviation} placeholder="nam km" required
          onChange={(event) => setAbbreviation(event.target.value)}
        />
        <Field label="Tên thực phẩm" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nấm kim châm" required />
        <Button type="submit" variant="primary" busy={busy}>Thêm viết tắt</Button>
      </form>
      <EntryList title="Viết tắt hóa đơn" kind="receipt-abbreviations" groupLabel="hóa đơn" entries={entries} save={save} busy={busy} />
    </Card>
  );
}
