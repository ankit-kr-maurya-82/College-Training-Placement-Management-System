import { Empty } from './Feedback.jsx'

export default function DataTable({ columns, rows, rowKey = '_id', emptyMessage = 'No records found.' }) {
  if (!rows?.length) return <Empty>{emptyMessage}</Empty>
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row[rowKey] ?? index}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody>
  </table></div>
}
