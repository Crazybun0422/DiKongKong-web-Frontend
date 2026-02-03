import { regionData } from 'element-china-area-data'

const normalizeRegion = (node) => {
  const entry = { name: node.label }
  if (Array.isArray(node.children) && node.children.length) {
    entry.children = node.children.map(normalizeRegion)
  }
  return entry
}

export const reportEntryRegions = [
  {
    name: '全国',
    children: regionData.map(normalizeRegion),
  },
]

export default reportEntryRegions
