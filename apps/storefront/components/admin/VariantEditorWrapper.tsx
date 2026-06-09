'use client'

import { useRouter } from 'next/navigation'
import { VariantEditor } from './VariantEditor'

interface ProductVariant {
  id: string
  name: string
  type: string
  price: number | null
  sku: string | null
  inStock: boolean
}

interface VariantEditorWrapperProps {
  productId: string
  variants: ProductVariant[]
}

export function VariantEditorWrapper({
  productId,
  variants,
}: VariantEditorWrapperProps) {
  const router = useRouter()

  const handleUpdate = () => {
    router.refresh()
  }

  return (
    <VariantEditor
      productId={productId}
      variants={variants}
      onUpdate={handleUpdate}
    />
  )
}

export default VariantEditorWrapper
