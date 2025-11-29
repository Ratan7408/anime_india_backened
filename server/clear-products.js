import mongoose from 'mongoose';

// Clear all products from database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anime_india';

async function clearProducts() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import Product model
    const Product = (await import('./models/Product.js')).default;
    
    // Get count before clearing
    const countBefore = await Product.countDocuments();
    console.log(`📦 Products in database before clearing: ${countBefore}`);
    
    if (countBefore === 0) {
      console.log('✅ Database is already empty');
      process.exit(0);
    }
    
    // Clear all products
    const result = await Product.deleteMany({});
    console.log(`🗑️ Cleared ${result.deletedCount} products from database`);
    
    // Verify clearing
    const countAfter = await Product.countDocuments();
    console.log(`📦 Products in database after clearing: ${countAfter}`);
    
    if (countAfter === 0) {
      console.log('✅ Database cleared successfully!');
    } else {
      console.log('⚠️ Some products may still exist');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing products:', error);
    process.exit(1);
  }
}

clearProducts(); 