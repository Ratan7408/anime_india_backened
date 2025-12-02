import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  console.log('💡 Please set MONGODB_URI in your .env file');
  process.exit(1);
}

async function resetDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    console.log('📍 MongoDB URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Found collections:', collections.map(c => c.name).join(', '));

    // Collections to clear (reset to zero)
    const collectionsToClear = [
      'orders',
      'products',
      'purchases',
      'carts',
      'wishlists',
      'notifications'
    ];

    // Collections to keep (don't delete)
    const collectionsToKeep = [
      'users' // Keep users so you don't lose admin accounts
    ];

    console.log('\n🗑️  Clearing collections...');
    
    for (const collectionName of collectionsToClear) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      
      if (count > 0) {
        const result = await collection.deleteMany({});
        console.log(`   ✅ Cleared ${result.deletedCount} documents from "${collectionName}"`);
      } else {
        console.log(`   ⏭️  Collection "${collectionName}" is already empty`);
      }
    }

    console.log('\n✅ Database reset complete!');
    console.log('\n📊 Summary:');
    console.log('   - Orders: 0');
    console.log('   - Products: 0');
    console.log('   - Purchases: 0');
    console.log('   - Carts: 0');
    console.log('   - Wishlists: 0');
    console.log('   - Notifications: 0');
    console.log('   - Users: Kept (admin accounts preserved)');

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error resetting database:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the reset
resetDatabase();

