export type RecipeData = {
  id: string
  title: string
  slug: string
  description: string
  category: string
  difficulty: string
  prepTime: string
  cookTime: string
  servings: number
  featured: boolean
  featuredImage: string
  ingredients: string[]
  instructions: string[]
}

export const recipeData: RecipeData[] = [
  {
    id: '1',
    title: 'Chile Colorado (Mexican Beef Stew)',
    slug: 'chile-colorado-mexican-beef-stew',
    description: 'Chunks of beef chuck and Roasted Garlic & Olives Salsa - roast until tender. Delicious!',
    category: 'Main Course',
    difficulty: 'Medium',
    prepTime: '20 min',
    cookTime: '120 min',
    servings: 4,
    featuredImage: '/images/recipes/clovis-chili.jpeg',
    ingredients: [
      'Chunks of beef chuck',
      '1 jar José Madrid Roasted Garlic & Olives Salsa'
    ],
    instructions: [
      'Cut beef chuck into chunks.',
      'Combine beef with Roasted Garlic & Olives Salsa.',
      'Roast until tender.'
    ],
    featured: true,
  },
  {
    id: '2',
    title: 'Chipotlé White Cheddar Mashed Potatoes',
    slug: 'chipotle-white-cheddar-mashed-potatoes',
    description: 'Creamy mashed potatoes elevated with smoky chipotle salsa and white cheddar cheese.',
    category: 'Side Dish',
    difficulty: 'Easy',
    prepTime: '15 min',
    cookTime: '25 min',
    servings: 6,
    featuredImage: '/images/recipes/White-Cheddar-Mashed-Potatoes.jpg',
    ingredients: [
      '3-1/2 pounds Russet potatoes, peeled, cut into 1-inch pieces',
      '2/3 cup of milk',
      '1 cup of cheddar cheese',
      '4 tablespoons butter (optional)',
      '3 tablespoons José Madrid Chipotlé Salsa'
    ],
    instructions: [
      'Cook potatoes in boiling salted water until very tender. Drain.',
      'Add Cheddar Cheese, Butter, and Milk.',
      'Using an electric mixer, beat until smooth.',
      'Stir in José Madrid Chipotlé Salsa.',
      'Season to taste with salt and pepper. Sprinkle with parsley.'
    ],
    featured: false,
  },
  {
    id: '3',
    title: 'Raspberry Chicken',
    slug: 'raspberry-chicken',
    description: 'Tender baked chicken breasts served with raspberry salsa over rice for a sweet and savory combination.',
    category: 'Main Course',
    difficulty: 'Easy',
    prepTime: '10 min',
    cookTime: '45 min',
    servings: 4,
    featuredImage: '/images/recipes/Rasperry-Chicken.jpg',
    ingredients: [
      '1 12 oz. jar José Madrid Raspberry Salsa',
      '4 skinless chicken breasts',
      '2 cups cooked rice'
    ],
    instructions: [
      'Preheat the oven to 350 degrees.',
      'Place the chicken breasts in a baking dish. Add approximately 1 inch of water.',
      'To tenderize the chicken, poke holes in the chicken breasts.',
      'Bake for 45 minutes.',
      'When chicken is ready, top the cooked rice with raspberry salsa.'
    ],
    featured: true,
  },
  {
    id: '4',
    title: 'José Madrid\'s Stupid Three Bean Southwestern Dip',
    slug: 'jose-madrids-stupid-three-bean-southwestern-dip',
    description: 'A hearty and flavorful three-bean dip perfect for parties, made with black beans, pinto beans, and garbanzo beans.',
    category: 'Appetizer',
    difficulty: 'Easy',
    prepTime: '15 min',
    cookTime: '0 min',
    servings: 8,
    featuredImage: '/images/recipes/Three-Bean-Bean-Dip.webp',
    ingredients: [
      '1 14 oz. can of black beans, drained',
      '1 14 oz. can pinto beans, drained',
      '1 14 oz. can garbanzo beans, drained',
      '3-4 medium sized tomatoes diced',
      '1 large red onion diced',
      '1 16 oz. package of frozen corn kernels, thawed, drained',
      '½ bunch of cilantro finely chopped',
      '1 13 oz. jar José Madrid Salsa (your choice of flavor)'
    ],
    instructions: [
      'Combine all beans, diced tomatoes, red onion, corn, and cilantro in a large bowl.',
      'Add José Madrid Salsa of your choice.',
      'Refrigerate for 2-3 hours or overnight.',
      'Serve with tortilla chips.'
    ],
    featured: false,
  },
  {
    id: '5',
    title: 'Peach Salsa Queso Dip',
    slug: 'peach-salsa-queso-dip',
    description: 'A warm, creamy dip combining peach salsa with cream cheese and spicy sausage.',
    category: 'Appetizer',
    difficulty: 'Easy',
    prepTime: '10 min',
    cookTime: '15 min',
    servings: 6,
    featuredImage: '/images/recipes/peach-salsa.jpg',
    ingredients: [
      '1 12 oz. jar José Madrid Peach Salsa',
      '2 10 oz. packages cream cheese',
      '1 package of spicy sausage'
    ],
    instructions: [
      'Place the cream cheese in a mixing bowl; allow to soften while you fry the sausage.',
      'After you fry the sausage, drain the grease and add the sausage to the cream cheese.',
      'Add José Madrid Peach Salsa and hand mix.',
      'Microwave on high for 2 minutes. Remove, stir, and repeat until cheese is completely melted.',
      'Serve with José Madrid\'s white corn tortilla chips.'
    ],
    featured: false,
  },
  {
    id: '6',
    title: 'Spanish Verdé Potato Omelet',
    slug: 'spanish-verde-potato-omelet',
    description: 'A hearty Spanish-style omelet with potatoes and Spanish Verdé salsa, perfect for breakfast or dinner.',
    category: 'Main Course',
    difficulty: 'Medium',
    prepTime: '15 min',
    cookTime: '15 min',
    servings: 4,
    featuredImage: '/images/recipes/spanish-verde-potato-omelet.jpg',
    ingredients: [
      '1 12 oz. jar of José Madrid Spanish Verdé (Mild, Hot or XX Hot)',
      '6 eggs',
      '1/2 teaspoon salt',
      '1/3 cup milk',
      '1/4 stick butter or olive oil',
      '2 small potatoes, peeled & quartered',
      '3 oz. Feta or Monterey Jack cheese (optional)'
    ],
    instructions: [
      'Sauté the potatoes in butter or olive oil for 8-10 minutes over low to medium heat.',
      'Place eggs, milk and salt in a bowl; whisk thoroughly, then pour over the potatoes.',
      'Cook over low heat, tilting the pan and lifting the cooked edges to allow the uncooked portion to run underneath until the eggs begin to set.',
      'While eggs are still runny, sprinkle with cheese and 6-8 tablespoons of José Madrid Verdé salsa.',
      'Set under preheated broiler for 1 minute. Cut into 4 sections and serve.'
    ],
    featured: true,
  },
  {
    id: '7',
    title: 'José\'s Favorite Clovis Chili',
    slug: 'joses-favorite-clovis-chili',
    description: 'A hearty and flavorful chili featuring José Madrid Clovis salsa, ground beef, and kidney beans.',
    category: 'Main Course',
    difficulty: 'Easy',
    prepTime: '15 min',
    cookTime: '120 min',
    servings: 6,
    featuredImage: '/images/recipes/clovis-chili.jpeg',
    ingredients: [
      '1 12 oz. jar of José Madrid Clovis',
      '1 lb. of coarsely ground beef',
      '1 16 oz. can of tomato sauce',
      '2 16 oz. cans of red kidney beans',
      '1 cup water'
    ],
    instructions: [
      'Cook meat over high heat until meat loses color. Drain the grease.',
      'Combine meat, water, beans, tomato sauce and José Madrid Clovis Salsa in chili pot.',
      'Simmer for 2 hours, stirring occasionally.',
      'Double the recipe and you will be ready for the next day!'
    ],
    featured: false,
  },
  {
    id: '8',
    title: 'Taco Salad',
    slug: 'taco-salad',
    description: 'A delicious layered taco salad featuring Clovis chili, fresh vegetables, and José Madrid salsa.',
    category: 'Main Course',
    difficulty: 'Easy',
    prepTime: '15 min',
    cookTime: '0 min',
    servings: 4,
    featuredImage: '/images/recipes/taco-salad.jpg',
    ingredients: [
      'White Corn Tortilla Chips',
      'Shredded lettuce',
      'José\'s Favorite Clovis Chili recipe',
      'Diced tomatoes',
      'Diced onions',
      'Sour cream',
      'José Madrid\'s Original Mild, Medium, or Hot Red Salsas'
    ],
    instructions: [
      'In a shallow pan, spread the shredded lettuce to create a generous layer.',
      'Top with José Madrid\'s White Corn Tortilla Chips.',
      'Arrange the remaining ingredients on top in this order: Clovis Chili recipe, tomato, onions and sour cream.'
    ],
    featured: false,
  },
  {
    id: '9',
    title: 'Zesty Meatloaf',
    slug: 'zesty-meatloaf',
    description: 'A flavorful meatloaf enhanced with Roasted Garlic & Olive Salsa and traditional seasonings.',
    category: 'Main Course',
    difficulty: 'Easy',
    prepTime: '15 min',
    cookTime: '45 min',
    servings: 6,
    featuredImage: '/images/recipes/Zesty-Tomato-Glazed-Meatloaf.jpg',
    ingredients: [
      '2 lbs. lean ground beef',
      '1/4 cup José Madrid\'s Roasted Garlic & Olive Salsa',
      '1/2 cup oats (May substitute crushed crackers or bread crumbs)',
      '1 tablespoon Worcestershire sauce',
      '2 large eggs'
    ],
    instructions: [
      'Preheat oven to 350 degrees.',
      'In a large mixing bowl, combine ground beef, salsa, oats, Worcestershire sauce, and eggs.',
      'In the center of a 9" x 13" pan, shape the beef mixture into a loaf.',
      'Top with more Roasted Garlic & Olive Salsa.',
      'Bake for 45 minutes or until done.'
    ],
    featured: false,
  },
  {
    id: '10',
    title: 'Tex-Mex Shepherd\'s Pie',
    slug: 'tex-mex-shepherds-pie',
    description: 'A Southwestern twist on the classic shepherd\'s pie with chicken, black beans, and José Madrid salsa.',
    category: 'Main Course',
    difficulty: 'Medium',
    prepTime: '20 min',
    cookTime: '20 min',
    servings: 6,
    featuredImage: '/images/recipes/tex-mex-shepherds-pie.webp',
    ingredients: [
      '8 oz. cooked diced chicken',
      '1 cup José Madrid\'s Salsa',
      '1 cup drained black beans',
      '1 18 oz. package frozen mashed potatoes (thawed)',
      '½ cup (packed) shredded Monterey Pepper Jack Cheese',
      '3 Tablespoons chopped fresh cilantro'
    ],
    instructions: [
      'Preheat oven to 450°.',
      'Combine chicken, Salsa, and beans in a 9-inch-diameter glass pie dish; stir to blend well.',
      'Spoon potatoes atop filling in pie dish, covering completely.',
      'Sprinkle with cheese and half the cilantro.',
      'Bake casserole until filling is bubbling, cheese melts and potatoes are beginning to brown, about 20 minutes.',
      'Sprinkle with remaining cilantro and serve.'
    ],
    featured: true,
  },
  {
    id: '11',
    title: 'Roasted Garlic and Olive Pasta Sauté',
    slug: 'roasted-garlic-and-olive-pasta-saute',
    description: 'A rich and flavorful pasta dish featuring Roasted Garlic and Olive salsa with heavy cream.',
    category: 'Main Course',
    difficulty: 'Easy',
    prepTime: '10 min',
    cookTime: '15 min',
    servings: 4,
    featuredImage: '/images/recipes/roasted-garlic-olive-pasta.jpeg',
    ingredients: [
      '6 oz. José Madrid\'s Roasted Garlic and Olive Salsa',
      '2-3 oz. Heavy Cream',
      'Desired pasta',
      'Parmesan or mozzarella cheese'
    ],
    instructions: [
      'Combine José Madrid\'s Roasted Garlic and Olive Salsa and heavy cream in a heavy saucepan.',
      'On medium to high heat allow them to reduce while desired pasta is cooking in boiling water, about 10-15 minutes.',
      'Once pasta is done, drain, and add to sauté pan.',
      'Toss the pasta with the Roasted Garlic and Olive reduction.',
      'Top with parmesan or mozzarella, and serve.'
    ],
    featured: false,
  },
  {
    id: '12',
    title: 'José Madrid\'s Chipotlé Potato Salad',
    slug: 'jose-madrids-chipotle-potato-salad',
    description: 'A smoky and flavorful potato salad with bacon, broccoli, and chipotle salsa dressing.',
    category: 'Side Dish',
    difficulty: 'Easy',
    prepTime: '20 min',
    cookTime: '25 min',
    servings: 8,
    featuredImage: '/images/recipes/chipotle-potato-salad-recipe.jpg',
    ingredients: [
      '3 lbs cooked, diced and cooled redskin potatoes',
      '12 oz. cooked crisp bacon chopped',
      '1 head of trimmed broccoli spears',
      '½ cup chopped red onion',
      '2 cups (packed) shredded cheddar',
      '½ cup sour cream',
      '½ cup mayo',
      '3 oz. José Madrid\'s Chipotle Salsa'
    ],
    instructions: [
      'Cook and dice potatoes, then let cool.',
      'Cook bacon until crisp and chop.',
      'Combine potatoes, bacon, broccoli, onion, and cheddar cheese in a large bowl.',
      'To make the dressing, mix equal amounts of sour cream and mayo.',
      'Add José Madrid\'s Chipotle Salsa to the sour cream and mayo dressing.',
      'Coat the potato mixture with dressing, chill and serve.'
    ],
    featured: false,
  },
  {
    id: '13',
    title: 'José Madrid\'s Roasted Garlic and Olive Bruschettas',
    slug: 'jose-madrids-roasted-garlic-and-olive-bruschettas',
    description: 'Quick and easy appetizer featuring toasted baguette slices topped with Roasted Garlic and Olive salsa.',
    category: 'Appetizer',
    difficulty: 'Easy',
    prepTime: '10 min',
    cookTime: '10 min',
    servings: 6,
    featuredImage: '/images/recipes/Roasted-Garlic-Bruschetta.jpg',
    ingredients: [
      '1 whole baguette sliced ½ inch thick on the bias',
      'José Madrid\'s Roasted Garlic and Olive Salsa',
      'Goat cheese or shredded mozzarella'
    ],
    instructions: [
      'Toast the sliced bread on a cookie sheet in the oven.',
      'When finished let cool.',
      'Spread toast with José Madrid\'s Roasted Garlic and Olive Salsa.',
      'Top with goat cheese or shredded mozzarella.',
      'Place the toast back in the oven to melt the cheese and serve.'
    ],
    featured: false,
  },
  {
    id: '14',
    title: 'José Madrid\'s Chili Con Queso',
    slug: 'jose-madrids-chili-con-queso',
    description: 'A spicy and creamy cheese dip perfect for parties, made with Spanish Verdé and melted cheddar.',
    category: 'Appetizer',
    difficulty: 'Medium',
    prepTime: '15 min',
    cookTime: '20 min',
    servings: 8,
    featuredImage: '/images/recipes/chili-con-queso.jpg',
    ingredients: [
      '¼ cup plus 2 Tablespoons (3/4 Stick) butter',
      '1 large onion, chopped',
      '¼ cup plus 2 Tablespoons all-purpose flour',
      '1 28 oz. can peeled tomatoes, drained, chopped',
      '4 oz. José Madrid\'s Spanish Verdé',
      '12 oz. shredded Cheddar',
      'José Madrid\'s Original Hot Salsa',
      'José Madrid\'s White Corn Tortilla Chips'
    ],
    instructions: [
      'Sauté chopped onion in butter in heavy saucepan.',
      'Stir in flour. Continue to cook flour until golden brown.',
      'Add José Madrid\'s Verdé Salsa, tomatoes, and cook until mixture thickens.',
      'Add cheddar and stir until melted and bubbling.',
      'Season with José Madrid\'s Original Hot Salsa.',
      'Transfer to chafing dish or fondue pot.',
      'Serve with white corn tortilla chips.'
    ],
    featured: true,
  },
  {
    id: '15',
    title: 'José Madrid\'s Chipotlé Steamed Mussels with Coconut Milk',
    slug: 'jose-madrids-chipotle-steamed-mussels-with-coconut-milk',
    description: 'An elegant seafood dish featuring fresh mussels steamed in coconut milk and chipotle salsa.',
    category: 'Seafood',
    difficulty: 'Medium',
    prepTime: '15 min',
    cookTime: '20 min',
    servings: 4,
    featuredImage: '/images/recipes/chipotle-potato-salad-recipe.jpg',
    ingredients: [
      '2 Tablespoons Vegetable oil',
      '½ cup chopped carrot',
      '½ cup chopped celery',
      '1 14oz. can unsweetened coconut milk',
      '1 cup chicken stock',
      '1 cup dry white wine',
      '4-5 oz. José Madrid\'s Chipotlé Salsa',
      '2 ½ pounds of Mussels scrubbed and debearded'
    ],
    instructions: [
      'Heat oil in heavy large pot over medium heat.',
      'Add carrot and celery and sauté until tender.',
      'Stir in coconut milk, wine, chicken stock; bring to a boil over high heat to reduce to 2 cups, about 15 minutes.',
      'Stir in José Madrid\'s Chipotlé.',
      'Add mussels, cover and cook until mussels open, about 5 minutes.',
      'Transfer mussels to large bowl and serve. (Discard any mussels that do not open.)'
    ],
    featured: false,
  },
  {
    id: '16',
    title: 'José Madrid\'s Southwestern Caesar Salad with Chipotlé Dressing',
    slug: 'jose-madrids-southwestern-caesar-salad-with-chipotle-dressing',
    description: 'A Southwestern twist on classic Caesar salad featuring a smoky chipotle dressing.',
    category: 'Salad',
    difficulty: 'Easy',
    prepTime: '15 min',
    cookTime: '0 min',
    servings: 4,
    featuredImage: '/images/recipes/taco-salad.jpg',
    ingredients: [
      '½ cup mayonnaise',
      '1 ½ tablespoon canned low-salt chicken broth',
      '1 Tablespoon soy sauce',
      '1 Tablespoon fresh lime juice',
      '1 teaspoon brown sugar',
      '2 oz. José Madrid Chipotlé Salsa',
      '1 large head of Romaine Lettuce, cut into bite size pieces',
      '2 medium tomatoes diced',
      '½ cup frozen corn kernels, thawed, drained',
      '4 Tablespoons freshly grated Parmesan cheese'
    ],
    instructions: [
      'Whisk mayonnaise, chicken broth, soy sauce, lime juice, brown sugar and José Madrid\'s Chipotlé Salsa in small bowl to blend completely.',
      'Dressing can be prepared a day ahead of time and held covered in the refrigerator.',
      'Prepare in large serving bowl: romaine lettuce, diced tomatoes, corn, and Parmesan cheese.',
      'Mix with dressing thoroughly add more Parmesan if desired.',
      'Season with salt and pepper to taste and serve!'
    ],
    featured: false,
  }
];
