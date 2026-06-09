import { PrismaClient } from '@prisma/client';
import { getErrorMessage } from '@/lib/errors';

const prisma = new PrismaClient();

async function ensureSalsaCategory() {
  try {
    // Check if Salsa category exists
    let salsaCategory = await prisma.category.findFirst({
      where: { name: 'Salsa' },
    });

    if (!salsaCategory) {
      console.log('Creating Salsa category...');
      salsaCategory = await prisma.category.create({
        data: {
          name: 'Salsa',
          slug: 'salsa',
          description: 'All varieties of our delicious handcrafted salsas',
          isActive: true,
          sortOrder: 0,
        },
      });
      console.log('✅ Created Salsa category');
    } else {
      console.log('✅ Salsa category already exists');
    }

    console.log(`Category ID: ${salsaCategory.id}`);
  } catch (error: unknown) {
    console.error('❌ Error:', getErrorMessage(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

ensureSalsaCategory();
