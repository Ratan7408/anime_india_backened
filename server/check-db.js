import mongoose from 'mongoose';

// Check MongoDB connection and product data
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anime_india';

async function checkDatabase() {
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
      console.log(`   ID: ${product._id}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Subcategory: ${product.subcategory || 'N/A'}`);
      console.log(`   Status: ${product.status || 'N/A'}`);
      console.log(`   InStock: ${product.inStock}`);
      console.log(`   Featured: ${product.featured}`);
      console.log(`   Created: ${product.createdAt}`);
      console.log(`   Updated: ${product.updatedAt}`);
    });

    // Check for duplicate names
    const productNames = allProducts.map(p => p.name);
    const duplicateNames = productNames.filter((name, index) => productNames.indexOf(name) !== index);
    
    if (duplicateNames.length > 0) {
      console.log('\n⚠️ Duplicate product names found:');
      duplicateNames.forEach(name => {
        const duplicates = allProducts.filter(p => p.name === name);
        console.log(`   "${name}" appears ${duplicates.length} times:`);
        duplicates.forEach(dup => {
          console.log(`     - ID: ${dup._id}, Status: ${dup.status}, InStock: ${dup.inStock}`);
        });
      });
    }

    // Check status distribution
    const statusCounts = {};
    allProducts.forEach(product => {
      const status = product.status || 'no-status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('\n📊 Status distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} products`);
    });

    // Check categories
    const categories = await Product.distinct('category');
    console.log(`\n📂 Available categories: ${categories.join(', ')}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  }
}

checkDatabase(); 