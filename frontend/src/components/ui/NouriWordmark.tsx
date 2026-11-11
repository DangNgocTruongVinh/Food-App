/**
 * Logo chữ "nouri." (trang chủ, menu trên và footer của ứng dụng): chữ "o" là chiếc bát (miệng bát là khoảng âm) có chồi hai lá mọc lên.
 * Chữ dùng Be Vietnam Pro đậm (font của trang); bát và lá là SVG, đặt chân bát trùng đường chân chữ. Màu theo `currentColor` (mặc định --home-ink),
 * lá dùng --home-leaf. Chỉ để nhìn: liên kết bao ngoài mang aria-label.
 */
export function NouriWordmark() {
  return (
    <span className="ui-wordmark" aria-hidden="true">
      n
      <svg className="ui-wordmark__bowl" viewBox="0 0 70 104" focusable="false">
        <path className="ui-wordmark__leaf" d="M35 50C35 43 36 37 37 30" fill="none" strokeWidth="3.2" strokeLinecap="round" />
        <path className="ui-wordmark__leaf" d="M35 43C26 44 18 39 15 29C25 28 32 33 35 43Z" />
        <path className="ui-wordmark__leaf" d="M37 32C37 19 46 10 59 9C59 22 50 31 37 32Z" />
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M2 54A33 6 0 0 1 68 54C68 84 53 104 35 104C17 104 2 84 2 54ZM9 55A26 3.8 0 1 0 61 55A26 3.8 0 1 0 9 55Z"
        />
      </svg>
      uri<span className="ui-wordmark__dot">.</span>
    </span>
  );
}
