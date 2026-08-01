import type { Product, Promotion } from "@/types";

export const promotions: Promotion[] = [
  { id: "morning-coffee", eyebrow: "Morning special", title: "Vietnamese Milk Coffee", description: "Bold Vietnamese coffee with creamy condensed milk. Available every day from 7 AM to 9 AM.", priceText: "Only $4.99", image: "" },
  { id: "combo", eyebrow: "Combo deal", title: "Coffee & Bánh Mì", description: "A satisfying Vietnamese coffee and fresh bánh mì pairing.", priceText: "$10.99", image: "" },
  { id: "ube", eyebrow: "New arrival", title: "Ube Coffee", description: "Sweet ube cream layered with bold Vietnamese coffee.", priceText: "$5.49", image: "" },
];

export const products: Product[] = [
  { id: "1", name: "Vietnamese Milk Coffee", description: "Bold coffee with condensed milk.", price: 4.99, category: "Vietnamese Coffee", image: "", emoji: "☕", badges: ["best-seller", "featured"] , allowIce: true, allowSugar: true, allowToppings: false, toppings: [] },
  { id: "2", name: "Brown Marble Milk Tea", description: "Brown sugar milk tea with boba.", price: 5.49, category: "Milk Tea", image: "", emoji: "🧋", badges: ["best-seller", "must-try"] , allowIce: true, allowSugar: true, allowToppings: false, toppings: [] },
  { id: "3", name: "Ube Coffee", description: "Vietnamese coffee with sweet ube cream.", price: 5.49, category: "Vietnamese Coffee", image: "", emoji: "🟣", badges: ["best-seller", "must-try", "new"] , allowIce: true, allowSugar: true, allowToppings: false, toppings: [] },
  { id: "4", name: "Coconut Mung Bean Frap", description: "Creamy coconut and mung bean blend.", price: 5.99, category: "Smoothies", image: "", emoji: "🥥", badges: ["best-seller"] , allowIce: true, allowSugar: true, allowToppings: false, toppings: [] },
  { id: "5", name: "Matcha Frap", description: "Smooth matcha blended until creamy.", price: 5.49, category: "Smoothies", image: "", emoji: "🍵", badges: ["must-try"] , allowIce: true, allowSugar: true, allowToppings: false, toppings: [] },
  { id: "6", name: "Oolong Milk Tea", description: "Fragrant oolong tea with creamy milk.", price: 5.95, category: "Milk Tea", image: "", emoji: "🧋", badges: [] , allowIce: true, allowSugar: true, allowToppings: false, toppings: [] },
  { id: "7", name: "Grilled Pork Bánh Mì", description: "Grilled pork, crisp vegetables and fresh bread.", price: 8.95, category: "Bánh Mì", image: "", emoji: "🥖", badges: ["best-seller", "must-try"] , allowIce: false, allowSugar: false, allowToppings: false },
  { id: "8", name: "Soy Garlic Wings", description: "Crispy wings with a glossy soy garlic glaze.", price: 10.95, category: "Chicken & More", image: "", emoji: "🍗", badges: ["featured"] , allowIce: false, allowSugar: false, allowToppings: false },
  { id: "9", name: "Strawberry Matcha Latte", description: "Fresh strawberry layered with smooth matcha.", price: 6.49, category: "Milk Tea", image: "", emoji: "🍓", badges: ["new"] , allowIce: true, allowSugar: true, allowToppings: false, toppings: [] },
  { id: "10", name: "Avocado Smoothie", description: "Fresh avocado, rich and silky.", price: 6.75, category: "Smoothies", image: "", emoji: "🥑", badges: [] , allowIce: true, allowSugar: true, allowToppings: false, toppings: [] },
  { id: "11", name: "Shrimp Katsu Sandwich", description: "Crispy shrimp katsu with house sauce.", price: 9.95, category: "Bánh Mì", image: "", emoji: "🥪", badges: ["must-try"] , allowIce: false, allowSugar: false, allowToppings: false },
  { id: "12", name: "Spicy K Wings", description: "Crispy wings in a bold Korean-style glaze.", price: 10.95, category: "Chicken & More", image: "", emoji: "🔥", badges: ["new"] , allowIce: false, allowSugar: false, allowToppings: false },
];

export const menuCategories = ["All", "Vietnamese Coffee", "Milk Tea", "Smoothies", "Bánh Mì", "Chicken & More"];
