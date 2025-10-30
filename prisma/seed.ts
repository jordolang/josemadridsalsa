import { PrismaClient, HeatLevel } from '@prisma/client'
import { recipeData } from '../lib/data/recipes'

const prisma = new PrismaClient()

async function main() {
  // Clean up existing data
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.wishlistItem.deleteMany()
  await prisma.review.deleteMany()
  await prisma.fundraiserProduct.deleteMany()
  await prisma.fundraiser.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.address.deleteMany()
  await prisma.wholesaleAccount.deleteMany()
  await prisma.recipe.deleteMany()
  await prisma.user.deleteMany()

  console.log('🗑️  Cleaned existing data')

  // Create categories
  const mildCategory = await prisma.category.create({
    data: {
      name: 'Mild Salsa',
      slug: 'mild-salsa',
      description: 'Perfect for those who enjoy flavor without the heat. Great for kids and mild palates.',
      metaTitle: 'Mild Salsa - Jose Madrid Salsa',
      metaDescription: 'Discover our mild salsa varieties, perfect for those who prefer flavor without the heat.',
      sortOrder: 1,
    },
  })

  const mediumCategory = await prisma.category.create({
    data: {
      name: 'Medium Salsa',
      slug: 'medium-salsa',
      description: 'The perfect balance of flavor and heat. Our most popular choice for everyday enjoyment.',
      metaTitle: 'Medium Salsa - Jose Madrid Salsa',
      metaDescription: 'Try our medium heat salsa - the perfect balance of flavor and spice.',
      sortOrder: 2,
    },
  })

  const hotCategory = await prisma.category.create({
    data: {
      name: 'Hot Salsa',
      slug: 'hot-salsa',
      description: 'For those who love the heat! Bold flavors with a serious kick that builds with each bite.',
      metaTitle: 'Hot Salsa - Jose Madrid Salsa',
      metaDescription: 'Experience our hot salsa varieties for those who love bold flavors and serious heat.',
      sortOrder: 3,
    },
  })

  const fruitCategory = await prisma.category.create({
    data: {
      name: 'Gourmet & Fruit Salsa',
      slug: 'gourmet-fruit-salsa',
      description: 'Unique gourmet salsas featuring fresh fruits and premium ingredients.',
      metaTitle: 'Gourmet & Fruit Salsa - Jose Madrid Salsa',
      metaDescription: 'Explore our gourmet and fruit salsa collection with unique flavors and premium ingredients.',
      sortOrder: 4,
    },
  })

  console.log('✅ Created categories')

  // Create products
  const products = [
    {
      name: 'Jose Madrid Original Mild',
      slug: 'jose-madrid-original-mild',
      description: 'Our signature mild salsa made with fresh tomatoes, onions, and a perfect blend of spices.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Tomatoes', 'Onions', 'Bell Peppers', 'Garlic', 'Vinegar', 'Salt', 'Spices'],
      price: 7.00,
      compareAtPrice: 10.99,
      sku: 'JMS-MILD-001',
      inventory: 100,
      weight: 16.0,
      categoryId: mildCategory.id,
      isFeatured: true,
      images: ['/images/products/mild.webp'],
      featuredImage: '/images/products/mild.webp',
      searchKeywords: ['signature', 'mild', 'original', 'fresh tomatoes'],
    },
    {
      name: 'Clovis Medium Salsa',
      slug: 'clovis-medium-salsa',
      description: 'The Clovis brand introduced Jose Madrid Salsa in 1989. The Clovis Medium salsa originated to serve in Zak\'s Restaurant in Zanesville, Ohio in 1989. It quickly became our flagship salsa, so Clovis Mild and Medium were hence born. The Clovis series of salsas is named after Clovis, New Mexico, the actual birthplace of Jose Madrid.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Tomatoes', 'Onions', 'Garlic', 'Cilantro', 'Lime', 'Spices'],
      price: 7.00,
      sku: 'JMS-MILD-002',
      inventory: 100,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/clovis-medium.webp'],
      featuredImage: '/images/products/clovis-medium.webp',
      searchKeywords: ['clovis', 'flagship', 'heritage', 'classic'],
    },
    {
      name: 'Original Hot',
      slug: 'original-hot',
      description: 'The Clovis brand introduced Jose Madrid Salsa in 1989. The Clovis Medium salsa originated to serve in Zak\'s Restaurant in Zanesville, Ohio in 1989. It quickly became our flagship salsa, so Clovis Mild and Medium were hence born. The Clovis series of salsas is named after Clovis, New Mexico, the actual birthplace of Jose Madrid.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Tomatoes', 'Jalapeño Peppers', 'Habanero', 'Onions', 'Garlic', 'Spices'],
      price: 7.00,
      sku: 'JMS-HOT-001',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/hot.webp'],
      featuredImage: '/images/products/hot.webp',
      searchKeywords: ['original', 'hot', 'spicy', 'heat'],
    },
    {
      name: 'Original X Hot',
      slug: 'original-x-hot',
      description: 'X-Hot is Original Hot only hotter! Add the red Cayenne peppers please!',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Tomatoes', 'Cayenne Peppers', 'Habanero', 'Onions', 'Garlic', 'Spices'],
      price: 7.00,
      sku: 'JMS-HOT-002',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/x-hot.webp'],
      featuredImage: '/images/products/x-hot.webp',
      searchKeywords: ['x-hot', 'cayenne', 'spicy', 'heat lovers'],
    },
    {
      name: 'Black Bean Corn Poblano',
      slug: 'black-bean-corn-poblano',
      description: 'Every one I speak to says this salsa tastes like chili. It is in the top three best selling salsas and is a great condiment.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Black Beans', 'Corn', 'Poblano Peppers', 'Tomatoes', 'Onions', 'Spices'],
      price: 7.00,
      sku: 'JMS-MILD-003',
      inventory: 85,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/black-bean-corn-poblano-salsa.webp'],
      featuredImage: '/images/products/black-bean-corn-poblano-salsa.webp',
      searchKeywords: ['black bean', 'corn', 'poblano', 'bestseller'],
    },
    {
      name: 'Cherry Chocolate Hot',
      slug: 'cherry-chocolate-hot',
      description: 'Yes, we added habanero to give this some heat! Pure cocoa mixed with cherries combine to make your taste buds dance. Try this as a marinade with your favorite roasting meat, you won\'t be disappointed!',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Cherries', 'Cocoa', 'Habanero Peppers', 'Tomatoes', 'Onions', 'Spices'],
      price: 7.00,
      sku: 'JMS-HOT-003',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/cherry-chocolate-hot.webp'],
      featuredImage: '/images/products/cherry-chocolate-hot.webp',
      searchKeywords: ['cherry', 'chocolate', 'hot', 'marinade'],
    },
    {
      name: 'Cherri Mild Salsa',
      slug: 'cherry-mild-salsa',
      description: 'It\'s the Michigan cherries that make Cherry Mild wonderfully sweet and tart. Make a great snack or as a compliment to meats, fish, or vegetables.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Michigan Cherries', 'Tomatoes', 'Onions', 'Cilantro', 'Lime', 'Spices'],
      price: 7.00,
      sku: 'JMS-FRUIT-001',
      inventory: 100,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/cherry-mild.webp'],
      featuredImage: '/images/products/cherry-mild.webp',
      searchKeywords: ['cherry', 'fruit', 'sweet', 'michigan'],
    },
    {
      name: 'Chipotle Con Queso',
      slug: 'chipotle-con-queso-salsa',
      description: 'This cheese based dip is best when slightly warmed in a microwave! Made with slices of real cheddar, smoked chipotle peppers, and chunks of tomatoes.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Cheddar Cheese', 'Chipotle Peppers', 'Tomatoes', 'Onions', 'Spices'],
      price: 7.00,
      sku: 'JMS-MILD-004',
      inventory: 100,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/chipotle-con-queso.webp'],
      featuredImage: '/images/products/chipotle-con-queso.webp',
      searchKeywords: ['queso', 'cheese', 'chipotle', 'dip'],
    },
    {
      name: 'Chipotle Hot',
      slug: 'chipotle-hot-salsa',
      description: 'Smoked jalapenos are diced and mixed with a blend of thick and chunky tomatoes and spices. If you\'ve ever tried smoking your own jalapenos and enjoy savory and spicy, this one\'s for you!',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Smoked Jalapeños', 'Tomatoes', 'Onions', 'Garlic', 'Spices'],
      price: 7.00,
      sku: 'JMS-HOT-004',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/chipotle-hot.webp'],
      featuredImage: '/images/products/chipotle-hot.webp',
      searchKeywords: ['chipotle', 'smoked', 'hot', 'savory'],
    },
    {
      name: 'Garden Cilantro Salsa Mild',
      slug: 'garden-cilantro-mild-salsa',
      description: 'New Mexico chilies blended with fresh cilantro, tomatoes, jalapenos, onions, and a hint of lime. Cilantro lovers your new favorite salsa is here!',
      heatLevel: HeatLevel.MILD,
      ingredients: ['New Mexico Chilies', 'Fresh Cilantro', 'Tomatoes', 'Jalapeños', 'Onions', 'Lime'],
      price: 7.00,
      sku: 'JMS-MILD-005',
      inventory: 100,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/garden-cilantro-salsa-mild.webp'],
      featuredImage: '/images/products/garden-cilantro-salsa-mild.webp',
      searchKeywords: ['garden', 'cilantro', 'mild', 'fresh'],
    },
    {
      name: 'Garden Cilantro Salsa Hot',
      slug: 'garden-cilantro-hot-salsa',
      description: 'New Mexico chilies blended with fresh cilantro, tomatoes, jalapenos, onions, and a hint of lime. Cilantro lovers your new favorite salsa is here!',
      heatLevel: HeatLevel.HOT,
      ingredients: ['New Mexico Chilies', 'Fresh Cilantro', 'Tomatoes', 'Jalapeños', 'Onions', 'Lime'],
      price: 7.00,
      compareAtPrice: 10.99,
      sku: 'JMS-HOT-005',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      isFeatured: true,
      images: ['/images/products/garden-cilantro-salsa-hot.webp'],
      featuredImage: '/images/products/garden-cilantro-salsa-hot.webp',
      searchKeywords: ['garden', 'cilantro', 'hot', 'spicy'],
    },
    {
      name: 'Jamaican Jerk',
      slug: 'jamaican-jerk-salsa',
      description: 'Remember those great times we had in Jamaica? This will bring those memories back! Our recipe for Jamaican Jerk was developed with the aid of a chef from a resort hotel in Jamaica. It\'s a carrot based jerk with 11 spices and two chilies.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Carrots', 'Jamaican Spices', 'Chilies', 'Tomatoes', 'Onions'],
      price: 7.00,
      sku: 'JMS-HOT-006',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/jamaican-jerk.webp'],
      featuredImage: '/images/products/jamaican-jerk.webp',
      searchKeywords: ['jamaican', 'jerk', 'spices', 'caribbean'],
    },
    {
      name: 'Ghost of Clovis',
      slug: 'ghost-of-clovis',
      description: 'The Ghost of Clovis uses the popular Ghost Pepper to give it special flavor. It is known to be very spicy to those who like spicier foods, but it is not as spicy as our Stupid Hot salsa. Try it out!',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Ghost Peppers', 'Tomatoes', 'Onions', 'Garlic', 'Spices'],
      price: 7.00,
      sku: 'JMS-MILD-006',
      inventory: 100,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/ghost-of-clovis.webp'],
      featuredImage: '/images/products/ghost-of-clovis.webp',
      searchKeywords: ['ghost pepper', 'spicy', 'unique'],
    },
    {
      name: 'Mango Mild Salsa',
      slug: 'mango-mild-salsa',
      description: 'Everyone loves the taste of mangoes right? Try chunks of mango with Clovis Medium Spice! Jose Madrid is famous for our slightly sweet fruit salsas.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Fresh Mango', 'Tomatoes', 'Onions', 'Cilantro', 'Lime', 'Spices'],
      price: 7.00,
      sku: 'JMS-FRUIT-002',
      inventory: 100,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/mango-mild.webp'],
      featuredImage: '/images/products/mango-mild.webp',
      searchKeywords: ['mango', 'fruit', 'mild', 'sweet'],
    },
    {
      name: 'Mango Habanero Salsa',
      slug: 'mango-habanero-salsa',
      description: 'A mix of our popular Mango line of salsas combined with our Habaneros. A surprisingly enjoyable blend of sweet with a little more bite than our other fruit salsas.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Fresh Mango', 'Habanero Peppers', 'Tomatoes', 'Onions', 'Cilantro', 'Lime'],
      price: 7.00,
      compareAtPrice: 11.49,
      sku: 'JMS-HOT-007',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      isFeatured: true,
      images: ['/images/products/mango-habanero.webp'],
      featuredImage: '/images/products/mango-habanero.webp',
      searchKeywords: ['mango', 'habanero', 'fruit', 'hot', 'sweet'],
    },
    {
      name: 'Peach Mild',
      slug: 'peach-mild-salsa',
      description: 'Peach was one of our very first mild salsas! Sweetened slightly with honey. Great for any spread that needs just a little bit of kick to it.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Fresh Peaches', 'Honey', 'Tomatoes', 'Onions', 'Cilantro', 'Lime'],
      price: 7.00,
      sku: 'JMS-FRUIT-003',
      inventory: 100,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/peach-mild.webp'],
      featuredImage: '/images/products/peach-mild.webp',
      searchKeywords: ['peach', 'fruit', 'mild', 'honey'],
    },
    {
      name: 'Pineapple Mild Salsa',
      slug: 'pineapple-mild-salsa',
      description: 'This salsa has the great taste of pineapple and it and superb texture. Enjoy the slightly sweet and spicy flavor just as a dip or inspire a new omelet recipe.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Fresh Pineapple', 'Tomatoes', 'Onions', 'Cilantro', 'Lime', 'Spices'],
      price: 7.00,
      sku: 'JMS-FRUIT-004',
      inventory: 100,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/pineapple-mild.webp'],
      featuredImage: '/images/products/pineapple-mild.webp',
      searchKeywords: ['pineapple', 'fruit', 'mild', 'tropical'],
    },
    {
      name: 'Raspberry BBQ Chipotle',
      slug: 'raspberry-bbq-chipotle',
      description: 'We searched all over the US for the quintessential essence of what good BBQ should taste like. Result: There is no clear winner because each region has its own preferences. So we chose the Motor City and spoke to many people and tasted many BBQ\'s to craft Raspberry BBQ Chipotle. Slightly sweet with a rich smoky chipotle flavor and Jose Madrid\'s own special blend of spices.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Raspberries', 'Chipotle Peppers', 'Tomatoes', 'Onions', 'BBQ Spices'],
      price: 7.00,
      sku: 'JMS-HOT-008',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/raspberry-bbq-chipotle.webp'],
      featuredImage: '/images/products/raspberry-bbq-chipotle.webp',
      searchKeywords: ['raspberry', 'bbq', 'chipotle', 'smoky'],
    },
    {
      name: 'Raspberry Mild Salsa',
      slug: 'raspberry-mild-salsa',
      description: 'Jose Madrid is famous for our blend of sweet fruit flavors and a little kick from the heat, and raspberry was the first fruit salsa developed along with the Peach salsa. Raspberry is one of the icons of Jose Madrid Salsa and has won national awards in two countries!',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Fresh Raspberries', 'Tomatoes', 'Onions', 'Cilantro', 'Lime', 'Spices'],
      price: 7.00,
      sku: 'JMS-FRUIT-005',
      inventory: 100,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/raspberry-mild.webp'],
      featuredImage: '/images/products/raspberry-mild.webp',
      searchKeywords: ['raspberry', 'fruit', 'award winner', 'iconic'],
    },
    {
      name: 'Roasted Garlic & Olives',
      slug: 'roasted-garlic-olives',
      description: 'Fresh roasted garlic cloves, green and black olives, chilies, tomatoes and Jose Madrid spices. Make sure to check out our recipe page as Roasted Garlic & Olives is a favorite for use in cooking.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Roasted Garlic', 'Green Olives', 'Black Olives', 'Tomatoes', 'Chilies'],
      price: 7.00,
      sku: 'JMS-MILD-007',
      inventory: 100,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/roasted-garlic-and-olive.webp'],
      featuredImage: '/images/products/roasted-garlic-and-olive.webp',
      searchKeywords: ['garlic', 'olives', 'roasted', 'cooking'],
    },
    {
      name: 'Roasted Pineapple Habanero Hot',
      slug: 'roasted-pineapple-habanero-hot',
      description: 'Made with Verde XX Hot as the base Jose Madrid\'s special spices and fresh, sweet pineapple chunks make this a favorite.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Roasted Pineapple', 'Habanero Peppers', 'Tomatoes', 'Onions', 'Spices'],
      price: 7.00,
      sku: 'JMS-HOT-009',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      isFeatured: true,
      images: ['/images/products/roasted-pineapple-habanero-hot.webp'],
      featuredImage: '/images/products/roasted-pineapple-habanero-hot.webp',
      searchKeywords: ['pineapple', 'habanero', 'hot', 'roasted'],
    },
    {
      name: 'Spanish Verde Mild',
      slug: 'spanish-verde-mild',
      description: 'Spanish Verde features tomatillo tomatoes, a variety that is ripe when it is green. Along with the tomatillos we blend in green chilies, onions, cilantro, lime, and Jose Madrid spices to create a very unique and extremely tasty salsa. Best tomatillo salsa in the US!',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Tomatillos', 'Green Chilies', 'Onions', 'Cilantro', 'Lime', 'Spices'],
      price: 7.00,
      sku: 'JMS-MILD-008',
      inventory: 100,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/spanish-verde-mild.webp'],
      featuredImage: '/images/products/spanish-verde-mild.webp',
      searchKeywords: ['verde', 'tomatillo', 'mild', 'green'],
    },
    {
      name: 'Spanish Verde Hot',
      slug: 'spanish-verde-hot',
      description: 'Verde Hot has the Verde Mild base, but with Serrano peppers to make it Hot. This is the "Salsa King\'s" favorite salsa. Won best green salsa in the US in Fort Worth, Texas in 2004 at the Salsa Shoot Out.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Tomatillos', 'Serrano Peppers', 'Green Chilies', 'Onions', 'Cilantro', 'Lime'],
      price: 7.00,
      sku: 'JMS-HOT-010',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/spanish-verde-hot.webp'],
      featuredImage: '/images/products/spanish-verde-hot.webp',
      searchKeywords: ['verde', 'hot', 'serrano', 'award winner'],
    },
    {
      name: 'Spanish Verde XX Hot',
      slug: 'spanish-verde-xx-hot',
      description: 'This is what I lovingly call our "Stupid Hot" salsa. Jose Madrid has always been about flavor more than heat alone, but some like it hot. Twenty one years ago, we sold in Toronto Canada at beer and wine festivals. Each time, people would say there wasn\'t a salsa hot enough for them. Challenge accepted! You can thank the birth of Stupid Hot Salsa at Jose Madrid to Toronto.',
      heatLevel: HeatLevel.EXTRA_HOT,
      ingredients: ['Tomatillos', 'Super Hot Peppers', 'Serrano Peppers', 'Onions', 'Cilantro', 'Lime'],
      price: 7.00,
      sku: 'JMS-XHOT-001',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/spanish-verde-xx-hot.webp'],
      featuredImage: '/images/products/spanish-verde-xx-hot.webp',
      searchKeywords: ['stupid hot', 'xx hot', 'extreme heat', 'extra hot'],
    },
    {
      name: 'Strawberry Mild',
      slug: 'strawberry-mild',
      description: 'Made with Clovis Mild as a base and added special Jose Madrid spices along with fresh, sweet strawberry chunks.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Fresh Strawberries', 'Tomatoes', 'Onions', 'Cilantro', 'Lime', 'Spices'],
      price: 7.00,
      sku: 'JMS-FRUIT-006',
      inventory: 100,
      weight: 16.0,
      categoryId: fruitCategory.id,
      isFeatured: true,
      images: ['/images/products/raspberry-mild.webp'],
      featuredImage: '/images/products/raspberry-mild.webp',
      searchKeywords: ['strawberry', 'fruit', 'mild', 'sweet'],
    },
    {
      name: 'Cherry Hot',
      slug: 'cherry-hot',
      description: 'Specially Crafted for the UC Health Fundraiser, but it was so good that we decided to keep making it! The tart sweetness of Cherries with the heat of the Habanero Pepper...It\'s a MUST TRY.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Cherries', 'Habanero Peppers', 'Tomatoes', 'Onions', 'Spices'],
      price: 7.00,
      sku: 'JMS-HOT-011',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/cherry-chocolate-hot.webp'],
      featuredImage: '/images/products/cherry-chocolate-hot.webp',
      searchKeywords: ['cherry', 'hot', 'sweet tart', 'habanero'],
    },
    {
      name: 'Green Apple',
      slug: 'green-apple',
      description: 'Perfect condiment for Turkey or Pork. Little sweet, little heat.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Green Apples', 'Tomatoes', 'Onions', 'Cilantro', 'Lime', 'Spices'],
      price: 7.00,
      sku: 'JMS-FRUIT-007',
      inventory: 100,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/ghost-of-clovis.webp'],
      featuredImage: '/images/products/ghost-of-clovis.webp',
      searchKeywords: ['apple', 'fruit', 'condiment', 'turkey', 'pork'],
    },
    {
      name: 'Ghost of Clovis Hot',
      slug: 'ghost-of-clovis-hot',
      description: 'The Ghost of Clovis uses the popular Ghost Pepper to give it special flavor. It is known to be very spicy to those who like spicier foods, but it is not as spicy as our Stupid Hot salsa. Try it out!',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Ghost Peppers', 'Tomatoes', 'Onions', 'Garlic', 'Habanero', 'Spices'],
      price: 7.00,
      sku: 'JMS-HOT-012',
      inventory: 100,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/ghost-of-clovis.webp'],
      featuredImage: '/images/products/ghost-of-clovis.webp',
      searchKeywords: ['ghost pepper', 'hot', 'spicy', 'unique'],
    },
  ]

  for (const productData of products) {
    await prisma.product.create({
      data: productData,
    })
  }

  console.log('✅ Created products')

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@josemadridsalsa.com',
      name: 'Jose Madrid',
      role: 'ADMIN',
      isEmailVerified: true,
      phone: '740-521-4304',
    },
  })

  // Create sample customer
  const customer = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      name: 'John Customer',
      role: 'CUSTOMER',
      isEmailVerified: true,
      phone: '555-123-4567',
    },
  })

  // Create customer address
  await prisma.address.create({
    data: {
      userId: customer.id,
      type: 'BOTH',
      firstName: 'John',
      lastName: 'Customer',
      street: '123 Main Street',
      city: 'Columbus',
      state: 'OH',
      zipCode: '43215',
      country: 'US',
      phone: '555-123-4567',
      isDefault: true,
    },
  })

  console.log('✅ Created users and addresses')

  // Create sample fundraiser
  await prisma.fundraiser.create({
    data: {
      name: 'Spring Band Fundraiser',
      slug: 'spring-band-fundraiser',
      description: 'Help support our school band program by purchasing delicious Jose Madrid Salsa!',
      organizationName: 'Springfield High School Band',
      contactEmail: 'band@springfieldhs.edu',
      contactPhone: '555-987-6543',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-04-30'),
      goal: 5000.00,
      commissionRate: 40.00, // 40% commission
      status: 'ACTIVE',
      isActive: true,
    },
  })

  console.log('✅ Created sample fundraiser')

  // Create sample analytics data
  await prisma.analytics.createMany({
    data: [
      {
        type: 'PAGE_VIEW',
        page: '/',
        sessionId: 'session_001',
        country: 'US',
        region: 'OH',
        city: 'Columbus',
      },
      {
        type: 'PRODUCT_VIEW',
        page: '/salsas/jose-madrid-medium-salsa',
        category: 'product',
        label: 'jose-madrid-medium-salsa',
        sessionId: 'session_001',
        country: 'US',
        region: 'OH',
        city: 'Columbus',
      },
      {
        type: 'ADD_TO_CART',
        page: '/salsas/jose-madrid-medium-salsa',
        category: 'ecommerce',
        action: 'add_to_cart',
        label: 'jose-madrid-medium-salsa',
        value: 1,
        sessionId: 'session_001',
        country: 'US',
        region: 'OH',
        city: 'Columbus',
      },
    ],
  })

  console.log('✅ Created sample analytics')

  // Create recipes
  for (const recipe of recipeData) {
    const { id: _legacyId, ...data } = recipe

    await prisma.recipe.create({
      data,
    })
  }

  console.log('✅ Created recipes')
  console.log('🌱 Database has been seeded successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
