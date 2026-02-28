import { createDefaultDiscountCodes } from '../lib/discounts'

async function main() {
  console.log('Seeding default discount codes...')
  const result = await createDefaultDiscountCodes()

  if (result.success) {
    console.log('✅ Successfully created default discount codes')
    console.log('Codes created:', result.codes?.map(c => c.code).join(', '))
  } else {
    console.error('❌ Failed to create discount codes:', result.error)
    process.exit(1)
  }
}

main()
  .catch(error => {
    console.error('Error seeding discount codes:', error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
