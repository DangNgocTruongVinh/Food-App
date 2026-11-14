import { type FormEvent, useState } from "react";
import type { AdminAllergenGroup, AllergenTermLevel, CatalogKind } from "../../features/admin/admin.api";
import type { SaveCatalog } from "../../pages/admin/AdminCatalogPage";
import { Button, Card, Field, useConfirm } from "../ui";

type Props = { groups: AdminAllergenGroup[]; save: SaveCatalog; busy: boolean };
type Entry = { id: string; name: string; hiddenAt: string | null; detail?: string };

const LEVEL_LABEL: Record<AllergenTermLevel, string> = { CONTAINS: "Chứa", MAY_CONTAIN: "Có thể chứa" };

/** Nhóm dị ứng: thêm nhóm; mỗi nhóm đổi tên, ẩn/hiện, thêm và ẩn/hiện tên gọi khác, nguyên liệu thuộc nhóm. */
export function AdminAllergenCatalog({ groups, save, busy }: Props) {
  return (
    <div className="ad-catalog">
      <NewGroupForm roots={groups.filter((group) => !group.parentId)} save={save} busy={busy} />
      {groups.map((group) => <GroupCard key={group.id} group={group} groups={groups} save={save} busy={busy} />)}
    </div>
  );
}

function NewGroupForm({ roots, save, busy }: { roots: AdminAllergenGroup[]; save: SaveCatalog; busy: boolean }) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [parentId, setParentId] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = { code, label, parentId: parentId || null };
    if (await save({ kind: "allergen-groups", body }, `Đã thêm nhóm ${label.trim()}.`)) { setCode(""); setLabel(""); setParentId(""); }
  };
  return (
    <Card as="section" className="ad-catalog__card" aria-label="Thêm nhóm dị ứng">
      <h3 className="ad-catalog__title">Thêm nhóm dị ứng</h3>
      <form className="ad-catalog__form" onSubmit={(event) => void submit(event)}>
        <Field label="Tên nhóm" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ví dụ: Cần tây" required />
        <Field label="Mã" hint="Viết hoa không dấu" value={code} onChange={(event) => setCode(event.target.value)} placeholder="CELERY" required />
        <Field label="Thuộc nhóm (tùy chọn)">
          {(control) => (
            <select {...control} value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">Nhóm gốc</option>
              {roots.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
            </select>
          )}
        </Field>
        <Button type="submit" variant="primary" busy={busy}>Thêm nhóm</Button>
      </form>
    </Card>
  );
}

function GroupCard({ group, groups, save, busy }: { group: AdminAllergenGroup; groups: AdminAllergenGroup[]; save: SaveCatalog; busy: boolean }) {
  const confirm = useConfirm();
  const [label, setLabel] = useState(group.label);
  const parent = groups.find((item) => item.id === group.parentId);
  const children = groups.filter((item) => item.parentId === group.id);
  const meta = [`Mã ${group.code}`, parent && `thuộc ${parent.label}`, children.length && `gồm ${children.map((child) => child.label).join(", ")}`];

  const toggleGroup = async () => {
    if (!group.hiddenAt && !(await confirm({
      title: `Ẩn nhóm ${group.label}?`,
      description: `Bộ lọc thôi nhận nhóm này: hồ sơ đang chọn “${group.label}” chỉ còn lọc theo đúng chữ đó. Hiện lại được bất cứ lúc nào.`,
      confirmLabel: "Ẩn nhóm", tone: "danger",
    }))) return;
    await save({ kind: "allergen-groups", id: group.id, body: { hidden: !group.hiddenAt } }, `Đã ${group.hiddenAt ? "hiện lại" : "ẩn"} nhóm ${group.label}.`);
  };
  const rename = (event: FormEvent) => {
    event.preventDefault();
    void save({ kind: "allergen-groups", id: group.id, body: { label } }, `Đã đổi tên nhóm thành ${label.trim()}.`);
  };

  const terms: Entry[] = group.terms.map((term) => ({
    id: term.id, name: term.name, hiddenAt: term.hiddenAt,
    detail: [term.level === "MAY_CONTAIN" && "có thể chứa", term.processed && "chế biến/gia vị"].filter(Boolean).join(", "),
  }));
  return (
    <Card as="section" className="ad-catalog__card" aria-label={`Nhóm ${group.label}`}>
      <header className="ad-catalog__head">
        <div>
          <h3 className="ad-catalog__title">{group.label}</h3>
          <span className="ad-sub">{meta.filter(Boolean).join(" · ")}</span>
        </div>
        {group.hiddenAt && <span className="ad-status ad-status--hidden">Đang ẩn</span>}
        <Button variant={group.hiddenAt ? "secondary" : "danger"} busy={busy} onClick={() => void toggleGroup()}
          aria-label={`${group.hiddenAt ? "Hiện lại" : "Ẩn"} nhóm ${group.label}`}>
          {group.hiddenAt ? "Hiện lại" : "Ẩn nhóm"}
        </Button>
      </header>
      <form className="ad-catalog__form" onSubmit={rename}>
        <Field label="Tên nhóm" hint="Tên cũ được giữ làm tên gọi khác" value={label} onChange={(event) => setLabel(event.target.value)} required />
        <Button type="submit" busy={busy} disabled={label.trim() === group.label}>Đổi tên</Button>
      </form>
      <EntryList title="Tên gọi khác" kind="allergen-aliases" groupLabel={group.label} entries={group.aliases} save={save} busy={busy} />
      <AddAlias groupId={group.id} save={save} busy={busy} />
      <EntryList title="Nguyên liệu thuộc nhóm" kind="allergen-terms" groupLabel={group.label} entries={terms} save={save} busy={busy} />
      <AddTerm groupId={group.id} save={save} busy={busy} />
      {group.exclusions.length > 0 && (
        <p className="ad-sub">Ngoại lệ (tên chứa cụm này không thuộc nhóm): {group.exclusions.map((item) => item.phrase).join(", ")}</p>
      )}
    </Card>
  );
}

type EntryListProps = { title: string; kind: CatalogKind; groupLabel: string; entries: Entry[]; save: SaveCatalog; busy: boolean };

function EntryList({ title, kind, groupLabel, entries, save, busy }: EntryListProps) {
  const confirm = useConfirm();
  const toggle = async (entry: Entry) => {
    // Ẩn nguyên liệu làm bộ lọc dị ứng bỏ qua nó: hỏi lại.
    if (kind === "allergen-terms" && !entry.hiddenAt && !(await confirm({
      title: `Ẩn “${entry.name}” khỏi nhóm ${groupLabel}?`,
      description: "Món có nguyên liệu này sẽ không còn bị lọc cho người dị ứng nhóm này.",
      confirmLabel: "Ẩn nguyên liệu", tone: "danger",
    }))) return;
    await save({ kind, id: entry.id, body: { hidden: !entry.hiddenAt } }, `Đã ${entry.hiddenAt ? "hiện lại" : "ẩn"} “${entry.name}”.`);
  };
  return (
    <div className="ad-catalog__group">
      <h4 className="ad-catalog__label">{title} ({entries.filter((entry) => !entry.hiddenAt).length})</h4>
      {entries.length === 0 ? <p className="ad-sub">Chưa có.</p> : (
        <ul className="ad-catalog__items">
          {entries.map((entry) => (
            <li key={entry.id} className="ad-catalog__item" data-hidden={entry.hiddenAt ? "true" : undefined}>
              <span>
                {entry.name}{entry.detail && <span className="ad-sub"> ({entry.detail})</span>}
                {entry.hiddenAt && <span className="ad-sub"> · đang ẩn</span>}
              </span>
              <button type="button" className="ad-catalog__toggle" disabled={busy} onClick={() => void toggle(entry)}
                aria-label={`${entry.hiddenAt ? "Hiện lại" : "Ẩn"} ${entry.name}`}>
                {entry.hiddenAt ? "Hiện" : "Ẩn"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddAlias({ groupId, save, busy }: { groupId: string; save: SaveCatalog; busy: boolean }) {
  const [name, setName] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await save({ kind: "allergen-aliases", body: { groupId, name } }, `Đã thêm tên gọi khác “${name.trim()}”.`)) setName("");
  };
  return (
    <form className="ad-catalog__form" onSubmit={(event) => void submit(event)}>
      <Field label="Tên gọi khác mới" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: hột gà" required />
      <Button type="submit" busy={busy}>Thêm tên gọi khác</Button>
    </form>
  );
}

function AddTerm({ groupId, save, busy }: { groupId: string; save: SaveCatalog; busy: boolean }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<AllergenTermLevel>("CONTAINS");
  const [processed, setProcessed] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await save({ kind: "allergen-terms", body: { groupId, name, level, processed } }, `Đã thêm nguyên liệu “${name.trim()}”.`)) {
      setName(""); setLevel("CONTAINS"); setProcessed(false);
    }
  };
  return (
    <form className="ad-catalog__form" onSubmit={(event) => void submit(event)}>
      <Field label="Nguyên liệu mới" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: bánh flan" required />
      <Field label="Mức">
        {(control) => (
          <select {...control} value={level} onChange={(event) => setLevel(event.target.value as AllergenTermLevel)}>
            {Object.entries(LEVEL_LABEL).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        )}
      </Field>
      <label className="ad-catalog__check">
        <input type="checkbox" checked={processed} onChange={(event) => setProcessed(event.target.checked)} />
        Chế biến/gia vị (Món không thích bỏ qua)
      </label>
      <Button type="submit" busy={busy}>Thêm nguyên liệu</Button>
    </form>
  );
}
