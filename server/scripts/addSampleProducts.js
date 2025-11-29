import mongoose from 'mongoose';
import Product from '../models/Product.js';

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anime_india';

async function addSampleProducts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Sample products with subcategories
    const sampleProducts = [
      {
        name: "Naruto Uzumaki Regular T-Shirt",
        description: "Classic Naruto design on premium cotton regular fit t-shirt",
        price: "599",
        imageUrl: "/uploads/naruto-regular.jpg",
        category: "T-Shirts",
        subcategory: "Regular T-Shirts",
        status: "in-stock",
        inStock: true,
        featured: true,
        tags: "['naruto', 'anime', 'regular', 'cotton']",
        images: JSON.stringify(["/uploads/naruto-regular.jpg", "/uploads/naruto-regular-back.jpg"])
      },
      {
        name: "Dragon Ball Z Oversized T-Shirt",
        description: "Goku power-up design on comfortable oversized fit t-shirt",
        price: "699",
        imageUrl: "/uploads/goku-oversized.jpg",
        category: "T-Shirts",
        subcategory: "Oversized T-Shirts",
        status: "in-stock",
        inStock: true,
        featured: true,
        tags: "['dragonball', 'goku', 'oversized', 'comfortable']",
        images: JSON.stringify(["/uploads/goku-oversized.jpg", "/uploads/goku-oversized-back.jpg"])
      },
      {
        name: "One Piece Hoodie",
        description: "Luffy straw hat design on warm and cozy hoodie",
        price: "899",
        imageUrl: "/uploads/luffy-hoodie.jpg",
        category: "T-Shirts",
        subcategory: "Hoodies",
        status: "in-stock",
        inStock: true,
        featured: true,
        tags: "['onepiece', 'luffy', 'hoodie', 'warm']",
        images: JSON.stringify(["/uploads/luffy-hoodie.jpg", "/uploads/luffy-hoodie-back.jpg"])
      },
      {
        name: "Attack on Titan Full Sleeve T-Shirt",
        description: "Eren Yeager design on stylish full sleeve t-shirt",
        price: "799",
        imageUrl: "/uploads/eren-fullsleeve.jpg",
        category: "T-Shirts",
        subcategory: "Full Sleeve T-Shirts",
        status: "in-stock",
        inStock: true,
        featured: false,
        tags: "['attackontitan', 'eren', 'fullsleeve', 'stylish']",
        images: JSON.stringify(["/uploads/eren-fullsleeve.jpg", "/uploads/eren-fullsleeve-back.jpg"])
      },
      {
        name: "Anime Phone Cover Collection",
        description: "Premium anime phone cases with stunning artwork",
        price: "399",
        imageUrl: "/uploads/phone-cover.jpg",
        category: "Phone Covers",
        subcategory: "",
        status: "coming-soon",
        inStock: false,
        featured: false,
        tags: "['phone', 'cover', 'anime', 'coming-soon']",
        images: JSON.stringify(["/uploads/phone-cover.jpg"])
      },
      {
        name: "Anime Water Bottle",
        description: "Custom anime water bottles for the ultimate fan experience",
        price: "299",
        imageUrl: "/uploads/water-bottle.jpg",
        category: "Bottles",
        subcategory: "",
        status: "coming-soon",
        inStock: false,
        featured: false,
        tags: "['bottle', 'water', 'anime', 'coming-soon']",
        images: JSON.stringify(["/uploads/water-bottle.jpg"])
      }
    ];

    // Clear existing products
    await Product.deleteMany({});
    console.log('🗑️ Cleared existing products');

    // Add new sample products
    const addedProducts = await Product.insertMany(sampleProducts);
    console.log(`✅ Added ${addedProducts.length} sample products with subcategories`);

    // Display added products
    addedProducts.forEach(product => {
      console.log(`📦 ${product.name} - ${product.category} > ${product.subcategory}`);
    });

    console.log('🎉 Sample products added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding sample products:', error);
    process.exit(1);
  }
}

addSampleProducts(); 