import mongoose from 'mongoose';

// Test MongoDB connection and product filtering
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anime_india';

async function testDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import Product model
    const Product = (await import('./models/Product.js')).default;
    
    // Get all products
    const allProducts = await Product.find({}).lean();
    console.log(`📦 Total products in database: ${allProducts.length}`);
    
    // Show product details
    allProducts.forEach((product, index) => {
      console.log(`\n📋 Product ${index + 1}:`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Subcategory: ${product.subcategory || 'N/A'}`);
      console.log(`   Status: ${product.status || 'N/A'}`);
      console.log(`   InStock: ${product.inStock}`);
      console.log(`   Featured: ${product.featured}`);
    });

    // Test filtering logic
    console.log('\n🔍 Testing filtering logic...');
    
    const availableProducts = allProducts.filter(product => {
      // Same logic as frontend
      const isAvailable = product.status 
        ? product.status === 'in-stock'
        : product.inStock === true;
      
      return isAvailable;
    });
    
    console.log(`✅ Available products: ${availableProducts.length}`);
    console.log(`❌ Unavailable products: ${allProducts.length - availableProducts.length}`);
    
    // Show unavailable products
    const unavailableProducts = allProducts.filter(product => {
      const isAvailable = product.status 
        ? product.status === 'in-stock'
        : product.inStock === true;
      
      return !isAvailable;
    });
    
    if (unavailableProducts.length > 0) {
      console.log('\n❌ Unavailable products:');
      unavailableProducts.forEach(product => {
        console.log(`   - ${product.name} (${product.category}) - Status: ${product.status || 'N/A'}, InStock: ${product.inStock}`);
      });
    }

    // Test categories
    const categories = await Product.distinct('category');
    console.log(`\n📂 Available categories: ${categories.join(', ')}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing database:', error);
    process.exit(1);
  }
}

testDatabase(); 