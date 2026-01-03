import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/rbac'
import { validateDiscountCode } from '@/lib/discounts'

const ValidateDiscountSchema = z.object({
  code: z.string().min(1),
  cartTotal: z.number().positive(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const payload = await request.json()
    const parsed = ValidateDiscountSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { code, cartTotal } = parsed.data

    const result = await validateDiscountCode(code, cartTotal, user?.id)

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 200 })
    }

    return NextResponse.json({
      valid: true,
      discountAmount: result.discountAmount,
      discountCode: result.discountCode,
    })
  } catch (error) {
    console.error('Discount validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate discount code' },
      { status: 500 }
    )
  }
}
