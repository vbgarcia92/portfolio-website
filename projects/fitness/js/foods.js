// Protein reference table.
//
// `per100g` is grams of protein per 100 g (or 100 ml for liquids). `unitLabel`
// and `unitGrams` describe one natural serving, so "1 banana" or "1 scoop" can
// be entered without weighing anything.
//
// These are approximations from standard nutrition references and vary by brand
// and preparation — cooked weights are used where a food is normally cooked.
// Adjust any value that matters to you, or log it as a custom item.

const FOODS = [
  // Protein sources
  { id: 'chicken_breast', name: 'Chicken breast (cooked)', per100g: 31,   unitLabel: 'fillet', unitGrams: 120 },
  { id: 'beef_lean',      name: 'Beef, lean (cooked)',     per100g: 26,   unitLabel: 'steak',  unitGrams: 150 },
  { id: 'tilapia',        name: 'Tilapia (cooked)',        per100g: 26 },
  { id: 'salmon',         name: 'Salmon (cooked)',         per100g: 25 },
  { id: 'tuna_canned',    name: 'Tuna, canned in water',   per100g: 25,   unitLabel: 'can',    unitGrams: 120 },
  { id: 'egg',            name: 'Egg, whole',              per100g: 13,   unitLabel: 'egg',    unitGrams: 50 },
  { id: 'egg_white',      name: 'Egg white',               per100g: 11,   unitLabel: 'white',  unitGrams: 33 },
  { id: 'tofu',           name: 'Tofu',                    per100g: 8 },

  // Dairy
  { id: 'whey',           name: 'Whey protein powder',     per100g: 80,   unitLabel: 'scoop',  unitGrams: 30 },
  { id: 'milk_whole',     name: 'Milk, whole',             per100g: 3.2,  unitLabel: 'cup',    unitGrams: 200 },
  { id: 'milk_skim',      name: 'Milk, skim',              per100g: 3.4,  unitLabel: 'cup',    unitGrams: 200 },
  { id: 'greek_yogurt',   name: 'Greek yogurt',            per100g: 10,   unitLabel: 'pot',    unitGrams: 170 },
  { id: 'cottage_cheese', name: 'Cottage cheese',          per100g: 11 },
  { id: 'cheese_mozz',    name: 'Cheese, mozzarella',      per100g: 22,   unitLabel: 'slice',  unitGrams: 20 },

  // Carbs
  { id: 'rice_white',     name: 'White rice (cooked)',     per100g: 2.7,  unitLabel: 'cup',    unitGrams: 158 },
  { id: 'rice_brown',     name: 'Brown rice (cooked)',     per100g: 2.6,  unitLabel: 'cup',    unitGrams: 158 },
  { id: 'beans_black',    name: 'Black beans (cooked)',    per100g: 8.9,  unitLabel: 'ladle',  unitGrams: 100 },
  { id: 'beans_carioca',  name: 'Carioca beans (cooked)',  per100g: 4.8,  unitLabel: 'ladle',  unitGrams: 100 },
  { id: 'lentils',        name: 'Lentils (cooked)',        per100g: 9 },
  { id: 'pasta',          name: 'Pasta (cooked)',          per100g: 5.8 },
  { id: 'bread',          name: 'Bread, white',            per100g: 9,    unitLabel: 'slice',  unitGrams: 25 },
  { id: 'oats',           name: 'Oats (dry)',              per100g: 13.5, unitLabel: 'tbsp',   unitGrams: 15 },
  { id: 'potato',         name: 'Potato (cooked)',         per100g: 2 },
  { id: 'sweet_potato',   name: 'Sweet potato (cooked)',   per100g: 1.6 },
  { id: 'tapioca',        name: 'Tapioca',                 per100g: 0.2 },

  // Fruit, veg, fats, extras
  { id: 'banana',         name: 'Banana',                  per100g: 1.1,  unitLabel: 'banana', unitGrams: 118 },
  { id: 'apple',          name: 'Apple',                   per100g: 0.3,  unitLabel: 'apple',  unitGrams: 180 },
  { id: 'avocado',        name: 'Avocado',                 per100g: 2 },
  { id: 'broccoli',       name: 'Broccoli (cooked)',       per100g: 2.4 },
  { id: 'peanut_butter',  name: 'Peanut butter',           per100g: 25,   unitLabel: 'tbsp',   unitGrams: 16 },
  { id: 'almonds',        name: 'Almonds',                 per100g: 21 },
  { id: 'protein_bar',    name: 'Protein bar',             per100g: 33,   unitLabel: 'bar',    unitGrams: 60 }
];

const FOODS_BY_ID = FOODS.reduce((map, f) => { map[f.id] = f; return map; }, {});
