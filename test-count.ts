import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const result = await p.user.groupBy({
    by: ['role'],
    _count: true,
  })
  console.log(JSON.stringify(result, null, 2))
}
main()
