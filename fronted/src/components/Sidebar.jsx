export default function Sidebar({ items, activeItem, onSelect }) {
  return <nav className="admin-tabs" aria-label="Admin sections" role="tablist">
    {items.map((item) => <button key={item} type="button" role="tab" aria-selected={activeItem === item} className={activeItem === item ? 'active' : ''} onClick={() => onSelect(item)}>{item}</button>)}
  </nav>
}
