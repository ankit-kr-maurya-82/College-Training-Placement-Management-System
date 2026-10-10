export const money = (value) => value || 'Not specified'
export const companyName = (company) => company?.name || company?.companyName || 'Company'
export const date = (value) => value ? new Date(value).toLocaleDateString() : 'Not specified'
