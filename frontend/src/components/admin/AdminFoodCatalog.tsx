import { type FormEvent, useState } from "react";
import type { AdminFoodCategory, FoodTextMatch } from "../../features/admin/admin.api";
import { storageLabel } from "../../features/pantry/pantry.logic";
import type { SaveCatalog } from "../../pages/admin/AdminCatalogPage";
import type { StorageLocation } from "../../types";
import { Button, Card, Field } from "../ui";
import { type Entry, EntryList } from "./AdminAllergenCatalog";

const STORAGES = Object.entries(storageLabel) as Array<[StorageLocation, string]>;
const MATCH_LABEL: Record<FoodTextMatch, string> = {
  PREFIX: "tên bắt đầu bằng", PREFIX_WORD: "tên bắt đầu bằng nguyên từ", CONTAINS_WORD: "tên có nguyên từ",
};
/** Ô trống = không đặt hạn. */
const daysValue = (text: string) => (text.trim() ? Number(text) : null);
const daysText = (days: number | null) => (days === null ? "không đặt hạn" : `${days} ngày`);

function StorageSelect({ value, onChange }: { value: StorageLocation; onChange: (value: StorageLocation) => void }) {
  return (
    <Field label="Nơi bảo quản">
      {(control) => (
        <select {...control} value={value} onChange={(event) => onChange(event.target.value as StorageLocation)}>
          {STORAGES.map(([storage, label]) => <option key={storage} value={storage}>{label}</option>)}
        </select>
      )}
    </Field>
  );
}

function DaysField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field
      label="Hạn dùng (ngày)" type="number" min={1} max={3650} value={value} hint="Trống = không đặt hạn"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

type FoodProps = { categories: AdminFoodCategory[]; save: SaveCatalog; busy: boolean };

/**
 * Nhóm thực phẩm (Kho, đi chợ): từ đầu tên → nhóm, hạn dùng ước tính khi "Đã mua"/quét hóa đơn theo nơi bảo quản mặc định của nhóm,
 * và hạn riêng theo loại (đậu khô, đồ khô, bánh mì…).
 */
export function AdminFoodCatalog({ categories, save, busy }: FoodProps) {
  const [name, setName] = useState("");
  const [storage, setStorage] = useState<StorageLocation>("REFRIGERATOR");
  const [days, setDays] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = { name, defaultStorage: storage, defaultShelfLifeDays: daysValue(days) };
    if (await save({ kind: "food-categories", body }, `Đã thêm nhóm ${name.trim()}.`)) { setName(""); setDays(""); }
  };
  return (
    <div className="ad-catalog">
      <Card as="section" className="ad-catalog__card" aria-label="Thêm nhóm thực phẩm">
        <h3 className="ad-catalog__title">Thêm nhóm thực phẩm</h3>
        <form className="ad-catalog__form" onSubmit={(event) => void submit(event)}>
          <Field label="Tên nhóm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Đồ uống" required />
          <StorageSelect value={storage} onChange={setStorage} />
          <DaysField value={days} onChange={setDays} />
          <Button type="submit" variant="primary" busy={busy}>Thêm nhóm</Button>
        </form>
      </Card>
      {categories.map((category) => <CategoryCard key={category.id} category={category} save={save} busy={busy} />)}
    </div>
  );
}

function CategoryCard({ category, save, busy }: { category: AdminFoodCategory; save: SaveCatalog; busy: boolean }) {
  const [name, setName] = useState(category.name);
  const [storage, setStorage] = useState(category.defaultStorage);
  const [days, setDays] = useState(category.defaultShelfLifeDays?.toString() ?? "");
  const changed = name.trim() !== category.name || storage !== category.defaultStorage || daysValue(days) !== category.defaultShelfLifeDays;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = { name, defaultStorage: storage, defaultShelfLifeDays: daysValue(days) };
    void save({ kind: "food-categories", id: category.id, body }, `Đã lưu nhóm ${name.trim()}.`);
  };
  const toggle = () => save({ kind: "food-categories", id: category.id, body: { hidden: !category.hiddenAt } },
    `Đã ${category.hiddenAt ? "hiện lại" : "ẩn"} nhóm ${category.name}.`);
  const terms: Entry[] = category.terms.map((term) => ({ id: term.id, name: term.prefix, hiddenAt: term.hiddenAt, detail: `ưu tiên ${term.priority}` }));
  const rules: Entry[] = category.shelfLifeRules.map((rule) => ({
    id: rule.id, name: rule.pattern, hiddenAt: rule.hiddenAt,
    detail: `${MATCH_LABEL[rule.matchMode]}: ${daysText(rule.shelfLifeDays)}, ${storageLabel[rule.storage]}`,
  }));
  return (
    <Card as="section" className="ad-catalog__card" aria-label={`Nhóm ${category.name}`}>
      <header className="ad-catalog__head">
        <div>
          <h3 className="ad-catalog__title">{category.name}</h3>
          <span className="ad-sub">
            {category.isFallback ? "Nhóm mặc định (khi không nhận ra nhóm) · " : ""}
            {storageLabel[category.defaultStorage]}, {daysText(category.defaultShelfLifeDays)}
          </span>
        </div>
        {category.hiddenAt && <span className="ad-status ad-status--hidden">Đang ẩn</span>}
        {!category.isFallback && (
          <Button variant="secondary" busy={busy} onClick={() => void toggle()} aria-label={`${category.hiddenAt ? "Hiện lại" : "Ẩn"} nhóm ${category.name}`}>
            {category.hiddenAt ? "Hiện lại" : "Ẩn nhóm"}
          </Button>
        )}
      </header>
      <form className="ad-catalog__form" onSubmit={submit}>
        <Field
          label="Tên nhóm" hint="Đổi tên thì Kho và danh sách đi chợ đổi theo" value={name} required
          onChange={(event) => setName(event.target.value)}
        />
        <StorageSelect value={storage} onChange={setStorage} />
        <DaysField value={days} onChange={setDays} />
        <Button type="submit" busy={busy} disabled={!changed} aria-label={`Lưu nhóm ${category.name}`}>Lưu</Button>
      </form>
      {!category.isFallback && (
        <>
          <EntryList title="Từ đầu tên thuộc nhóm" kind="food-category-terms" groupLabel={category.name} entries={terms} save={save} busy={busy} />
          <AddTerm categoryId={category.id} save={save} busy={busy} />
        </>
      )}
      <EntryList title="Hạn riêng theo loại" kind="food-shelf-life-rules" groupLabel={category.name} entries={rules} save={save} busy={busy} />
      <AddShelfLifeRule categoryId={category.id} save={save} busy={busy} />
    </Card>
  );
}

function AddTerm({ categoryId, save, busy }: { categoryId: string; save: SaveCatalog; busy: boolean }) {
  const [prefix, setPrefix] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await save({ kind: "food-category-terms", body: { categoryId, prefix } }, `Đã thêm từ đầu tên “${prefix.trim()}”.`)) setPrefix("");
  };
  return (
    <form className="ad-catalog__form" onSubmit={(event) => void submit(event)}>
      <Field
        label="Từ đầu tên mới" hint="Tên thực phẩm bắt đầu bằng chữ này thì thuộc nhóm" value={prefix} placeholder="Ví dụ: rong biển" required
        onChange={(event) => setPrefix(event.target.value)}
      />
      <Button type="submit" busy={busy}>Thêm từ đầu tên</Button>
    </form>
  );
}

function AddShelfLifeRule({ categoryId, save, busy }: { categoryId: string; save: SaveCatalog; busy: boolean }) {
  const [pattern, setPattern] = useState("");
  const [matchMode, setMatchMode] = useState<FoodTextMatch>("PREFIX");
  const [days, setDays] = useState("");
  const [storage, setStorage] = useState<StorageLocation>("DRY_STORAGE");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = { categoryId, pattern, matchMode, shelfLifeDays: daysValue(days), storage };
    if (await save({ kind: "food-shelf-life-rules", body }, `Đã thêm hạn riêng cho “${pattern.trim()}”.`)) { setPattern(""); setDays(""); }
  };
  return (
    <form className="ad-catalog__form" onSubmit={(event) => void submit(event)}>
      <Field label="Loại (mẫu tên)" value={pattern} placeholder="Ví dụ: đậu đen" required onChange={(event) => setPattern(event.target.value)} />
      <Field label="Cách khớp">
        {(control) => (
          <select {...control} value={matchMode} onChange={(event) => setMatchMode(event.target.value as FoodTextMatch)}>
            {Object.entries(MATCH_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        )}
      </Field>
      <DaysField value={days} onChange={setDays} />
      <StorageSelect value={storage} onChange={setStorage} />
      <Button type="submit" busy={busy}>Thêm hạn riêng</Button>
    </form>
  );
}
