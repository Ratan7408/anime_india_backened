import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  subcategory: {
    type: String,
    required: false,
    trim: true,
  },
  status: {
    type: String,
    enum: ['in-stock', 'out-of-stock', 'coming-soon'],
    default: 'in-stock',
    required: true,
  },
  inStock: {
    type: Boolean,
    default: true,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  images: {
    type: String, // JSON stringified array of image URLs
    default: null,
  },
  imageUrl: {
    type: String,
    default: '',
  },
  tags: {
    type: String, // JSON stringified array of tags
    default: '[]',
  },
  // ✅ NEW: Size and color fields for bulk inventory management
  size: {
    type: String,
    default: null,
    trim: true,
  },
  color: {
    type: String,
    default: null,
    trim: true,
  },
  // ✅ NEW: Available sizes and colors for this product
  availableSizes: {
    type: String, // JSON stringified array of available sizes
    default: '[]',
  },
  availableColors: {
    type: String, // JSON stringified array of available colors
    default: '[]',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update updatedAt on save
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Product = mongoose.model('Product', productSchema);
export default Product; 