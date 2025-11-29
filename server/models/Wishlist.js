import mongoose from 'mongoose';

const wishlistItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  imageUrl: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    default: '',
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [wishlistItemSchema],
  itemCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Calculate item count before saving
wishlistSchema.pre('save', function(next) {
  this.itemCount = this.items.length;
  next();
});

// Index is automatically created by unique: true on userId field

export default mongoose.model('Wishlist', wishlistSchema); 