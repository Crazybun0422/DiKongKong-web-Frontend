export function newMarketVariant(values = {}) {
  return {
    id: 'v_' + crypto.randomUUID().replaceAll('-', ''), name: '', imageUrl: '',
    originalPrice: null, maxFlp: null, costPrice: null, stock: 0, ...values,
  }
}

export function marketVariantsForEdit(product) {
  if (product?.variants?.length) return product.variants.map(v => ({ ...v, imageUrl: v.imageUrl || '' }))
  // Preserve the previously entered single offer when editing an older product.
  return [newMarketVariant(product ? {
    name: '默认套餐', originalPrice: product.originalPrice, maxFlp: product.maxFlp,
    costPrice: product.costPrice, stock: product.stock,
  } : {})]
}
