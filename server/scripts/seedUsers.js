import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/user.js';

dotenv.config();

const seedUsers = async () => {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      console.log('❌ No MongoDB URI provided');
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if users already exist
    const existingUsers = await User.find({});
    if (existingUsers.length > 0) {
      console.log('✅ Users already exist, skipping seed');
      return;
    }

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const adminUser = new User({
      email: 'admin@tshirtapp.com',
      firstName: 'Admin',
      lastName: 'User',
      password: adminPassword,
      role: 'admin',
      isEmailVerified: true,
      isActive: true,
    });

    // Create test user
    const userPassword = await bcrypt.hash('user123', 12);
    const testUser = new User({
      email: 'user@test.com',
      firstName: 'Test',
      lastName: 'User',
      password: userPassword,
      role: 'user',
      isEmailVerified: true,
      isActive: true,
    });

    // Save users
    await adminUser.save();
    await testUser.save();

    console.log('✅ Seed users created successfully');
    console.log('👑 Admin: admin@tshirtapp.com / admin123');
    console.log('👤 User: user@test.com / user123');

  } catch (error) {
    console.error('❌ Error seeding users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the seed function
seedUsers();