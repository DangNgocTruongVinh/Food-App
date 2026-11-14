import { type FormEvent, useState } from "react";
import type { AdminFoodCategory, AdminReceiptAbbreviation } from "../../features/admin/admin.api";
import { storageLabel } from "../../features/pantry/pantry.logic";
import type { SaveCatalog } from "../../pages/admin/AdminCatalogPage";
import type { StorageLocation } from "../../types";
import { Button, Card, Field } from "../ui";

const STORAGES = Object.entries(storageLabel) as Array<[StorageLocation, string]>;
/** Ô trống = không đặt hạn. */
const daysValue = (text: string) => (text.trim() ? Number(text) : null);
const daysText = (days: number | null) => (days === null ? "không đặt hạn" : `${days} ngày`);
const ruleText = (rule: AdminFoodCategory["shelfLifeRules"][number]) => `${rule.pattern}: ${daysText(rule.shelfLifeDays)} (${storageLabel[rule.storage]})`;

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

type FoodProps = { categories: AdminFoodCategory[]; save: SaveCatalog; busy: boolean };

/** Nhóm thực phẩm (Kho, đi chợ) và hạn dùng ước tính khi "Đã mua"/quét hóa đơn: theo nơi bảo quản mặc định của nhóm. */
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
          <Field
            label="Hạn dùng (ngày)" type="number" min={1} max={3650} value={days} hint="Trống = không đặt hạn"
            onChange={(event) => setDays(event.target.value)}
          />
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
        <Field
            label="Hạn dùng (ngày)" type="number" min={1} max={3650} value={days} hint="Trống = không đặt hạn"
            onChange={(event) => setDays(event.target.value)}
          />
        <Button type="submit" busy={busy} disabled={!changed} aria-label={`Lưu nhóm ${category.name}`}>Lưu</Button>
      </form>
      {category.shelfLifeRules.length > 0 && (
        <p className="ad-sub">
          Hạn riêng theo loại: {category.shelfLifeRules.map((rule) => ruleText(rule)).join("; ")}
        </p>
      )}
    </Card>
  );
}

type ReceiptProps = { abbreviations: AdminReceiptAbbreviation[]; save: SaveCatalog; busy: boolean };

/** Tên viết tắt trên hóa đơn siêu thị → tên thực phẩm (so trên chữ đã bỏ dấu). */
export function AdminReceiptCatalog({ abbreviations, save, busy }: ReceiptProps) {
  const [abbreviation, setAbbreviation] = useState("");
  const [fullName, setFullName] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await save({ kind: "receipt-abbreviations", body: { abbreviation, fullName } }, `Đã thêm “${abbreviation.trim()}”.`)) {
      setAbbreviation(""); setFullName("");
    }
  };
  const toggle = (row: AdminReceiptAbbreviation) => save({ kind: "receipt-abbreviations", id: row.id, body: { hidden: !row.hiddenAt } },
    `Đã ${row.hiddenAt ? "hiện lại" : "ẩn"} “${row.abbreviation}”.`);
  return (
    <div className="ad-catalog">
      <Card as="section" className="ad-catalog__card" aria-label="Thêm viết tắt hóa đơn">
        <h3 className="ad-catalog__title">Thêm viết tắt hóa đơn</h3>
        <form className="ad-catalog__form" onSubmit={(event) => void submit(event)}>
          <Field
            label="Chữ trên hóa đơn" hint="Lưu dạng bỏ dấu, chữ thường" value={abbreviation} placeholder="nam km" required
            onChange={(event) => setAbbreviation(event.target.value)}
          />
          <Field label="Tên thực phẩm" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nấm kim châm" required />
          <Button type="submit" variant="primary" busy={busy}>Thêm viết tắt</Button>
        </form>
      </Card>
      <Card as="section" className="ad-catalog__card" aria-label="Danh sách viết tắt hóa đơn">
        <ul className="ad-catalog__items">
          {abbreviations.map((row) => (
            <li key={row.id} className="ad-catalog__item" data-hidden={row.hiddenAt ? "true" : undefined}>
              <span><strong>{row.abbreviation}</strong>: {row.fullName}{row.hiddenAt && <span className="ad-sub"> · đang ẩn</span>}</span>
              <button type="button" className="ad-catalog__toggle" disabled={busy} onClick={() => void toggle(row)}
                aria-label={`${row.hiddenAt ? "Hiện lại" : "Ẩn"} ${row.abbreviation}`}>
                {row.hiddenAt ? "Hiện" : "Ẩn"}
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
