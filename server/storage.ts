import Product from './models/Product.js';

// Remove all interface/type references to Product
// Remove call to this.initializeSampleProducts()

export interface IStorage {
  // User methods
  getUser(id: number): Promise<any | undefined>;
  getUserByUsername(username: string): Promise<any | undefined>;
  createUser(user: any): Promise<any>;
  // Contact submission methods
  createContactSubmission(submission: any): Promise<any>;
  getContactSubmissions(): Promise<any[]>;
  getContactSubmission(id: number): Promise<any | undefined>;
  markContactSubmissionAsRead(id: number): Promise<any | undefined>;
  // Product methods
  getProducts(filters?: { category?: string; featured?: boolean; inStock?: boolean }): Promise<any[]>;
  getProduct(id: any): Promise<any | undefined>;
  createProduct(productData: any): Promise<any>;
  updateProduct(id: any, updates: any): Promise<any | undefined>;
  deleteProduct(id: any): Promise<boolean>;
  getCategories(): Promise<string[]>;
  getFeaturedProducts(): Promise<any[]>;
  // ✅ NEW: Bulk operations
  bulkUpdateProductStatus(criteria: {
    color?: string;
    size?: string;
    category?: string;
    subcategory?: string;
    status: string;
    inStock: boolean;
  }): Promise<{ updatedCount: number; matchedCount: number }>;

  // ✅ NEW: Bulk restore product sizes (mark as in-stock)
  bulkRestoreProductSizes(criteria: {
    color?: string;
    size?: string;
    category?: string;
    subcategory?: string;
  }): Promise<{ updatedCount: number; matchedCount: number }>;
}

export class MongoStorage implements IStorage {
  constructor() {}

  // User methods (dummy/in-memory for now)
  async getUser(id: number): Promise<any | undefined> { return undefined; }
  async getUserByUsername(username: string): Promise<any | undefined> { return undefined; }
  async createUser(user: any): Promise<any> { return user; }

  // Contact submission methods (dummy/in-memory for now)
  async createContactSubmission(submission: any): Promise<any> { return submission; }
  async getContactSubmissions(): Promise<any[]> { return []; }
  async getContactSubmission(id: number): Promise<any | undefined> { return undefined; }
  async markContactSubmissionAsRead(id: number): Promise<any | undefined> { return undefined; }

  // Product methods (MongoDB only)
  async getProducts(filters?: { category?: string; featured?: boolean; inStock?: boolean }): Promise<any[]> {
    const query: any = {};
    if (filters) {
      if (filters.category) query.category = filters.category;
      if (filters.featured !== undefined) query.featured = filters.featured;
      if (filters.inStock !== undefined) query.inStock = filters.inStock;
    }
    const products = await Product.find(query).lean();
    return products;
  }

  async getProduct(id: any): Promise<any | undefined> {
    const product = await Product.findById(id).lean();
    return product || undefined;
  }

  async createProduct(productData: any): Promise<any> {
    const product = new Product(productData);
    await product.save();
    return product.toObject();
  }

  async updateProduct(id: any, updates: any): Promise<any | undefined> {
    console.log('🗄️ Storage: Updating product with ID:', id);
    console.log('🗄️ Storage: Update data received:', JSON.stringify(updates, null, 2));
    
    // ✅ FIXED: Get the existing product first to preserve all fields
    const existingProduct = await Product.findById(id).lean();
    if (!existingProduct) {
      console.log('❌ Storage: Product not found for update');
      return undefined;
    }
    
    console.log('🗄️ Storage: Existing product data:', JSON.stringify(existingProduct, null, 2));
    
    // ✅ FIXED: Merge updates with existing data, ensuring no fields are lost
    const mergedUpdates = {
      ...existingProduct,
      ...updates,
      updatedAt: new Date() // Always update the timestamp
    };
    
    console.log('🗄️ Storage: Merged update data:', JSON.stringify(mergedUpdates, null, 2));
    
    // Use findOneAndUpdate to ensure all fields are preserved
    const product = await Product.findByIdAndUpdate(
      id, 
      mergedUpdates, 
      { 
        new: true, 
        runValidators: true, // Run schema validation
        context: 'query' 
      }
    ).lean();
    
    console.log('🗄️ Storage: Updated product result:', JSON.stringify(product, null, 2));
    
    return product || undefined;
  }

  async deleteProduct(id: any): Promise<boolean> {
    const result = await Product.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async getCategories(): Promise<string[]> {
    const categories = await Product.distinct('category');
    return categories;
  }

  async getFeaturedProducts(): Promise<any[]> {
    const products = await Product.find({ featured: true }).lean();
    return products;
  }

  // ✅ FIXED: Bulk update product status based on criteria with size-specific inventory
  async bulkUpdateProductStatus(criteria: {
    color?: string;
    size?: string;
    category?: string;
    subcategory?: string;
    status: string;
    inStock: boolean;
  }): Promise<{ updatedCount: number; matchedCount: number }> {
    console.log('🗄️ Storage: Bulk updating products with criteria:', criteria);
    
    // Build the query to find products to update
    const query: any = {};
    
    if (criteria.color) {
      query.$or = [
        { color: criteria.color },
        { availableColors: { $regex: criteria.color, $options: 'i' } }
      ];
    }
    
    if (criteria.size) {
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          {
            $or: [
              { size: criteria.size },
              { availableSizes: { $regex: criteria.size, $options: 'i' } }
            ]
          }
        ];
        delete query.$or;
      } else {
        query.$or = [
          { size: criteria.size },
          { availableSizes: { $regex: criteria.size, $options: 'i' } }
        ];
      }
    }
    
    if (criteria.category) {
      query.category = criteria.category;
    }
    
    if (criteria.subcategory) {
      query.subcategory = criteria.subcategory;
    }
    
    console.log('🗄️ Storage: Query to find products:', JSON.stringify(query, null, 2));
    
    // ✅ FIXED: Handle size-specific inventory updates
    if (criteria.size && criteria.status === 'out-of-stock') {
      // For size-specific out-of-stock, update availableSizes array
      const products = await Product.find(query);
      let updatedCount = 0;
      
      for (const product of products) {
        let availableSizes: string[] = [];
        
        // Parse existing availableSizes
        if (product.availableSizes) {
          try {
            if (typeof product.availableSizes === 'string') {
              availableSizes = JSON.parse(product.availableSizes);
            } else if (Array.isArray(product.availableSizes)) {
              availableSizes = product.availableSizes;
            }
          } catch (e) {
            console.warn('Error parsing availableSizes for product:', product._id);
            continue;
          }
        }
        
        // Remove the specific size from availableSizes
        const originalLength = availableSizes.length;
        availableSizes = availableSizes.filter(size => size !== criteria.size);
        
        // Only update if the size was actually removed
        if (availableSizes.length < originalLength) {
          const updateData: any = {
            availableSizes: JSON.stringify(availableSizes),
            updatedAt: new Date()
          };
          
          // If no sizes left, mark product as out of stock
          if (availableSizes.length === 0) {
            updateData.inStock = false;
            updateData.status = 'out-of-stock';
          } else {
            // If sizes remain, ensure product is in stock
            updateData.inStock = true;
            updateData.status = 'in-stock';
          }
          
          await Product.findByIdAndUpdate(product._id, updateData);
          updatedCount++;
          
          console.log(`🗄️ Storage: Updated product ${product._id}:`, {
            removedSize: criteria.size,
            remainingSizes: availableSizes,
            newStatus: updateData.status
          });
        }
      }
      
      console.log('🗄️ Storage: Size-specific bulk update result:', {
        matchedCount: products.length,
        updatedCount: updatedCount
      });
      
      return {
        updatedCount: updatedCount,
        matchedCount: products.length
      };
    } else {
      // For general out-of-stock (no specific size), update entire product
      const updateData = {
        status: criteria.status,
        inStock: criteria.inStock,
        updatedAt: new Date()
      };
      
      const result = await Product.updateMany(query, updateData);
      
      console.log('🗄️ Storage: General bulk update result:', {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      });
      
      return {
        updatedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      };
    }
  }

  // ✅ NEW: Bulk restore product sizes (mark as in-stock)
  async bulkRestoreProductSizes(criteria: {
    color?: string;
    size?: string;
    category?: string;
    subcategory?: string;
  }): Promise<{ updatedCount: number; matchedCount: number }> {
    console.log('🗄️ Storage: Bulk restoring product sizes with criteria:', criteria);
    
    // Build the query to find products to update
    const query: any = {};
    
    if (criteria.color) {
      query.$or = [
        { color: criteria.color },
        { availableColors: { $regex: criteria.color, $options: 'i' } }
      ];
    }
    
    if (criteria.size) {
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          {
            $or: [
              { size: criteria.size },
              { availableSizes: { $regex: criteria.size, $options: 'i' } }
            ]
          }
        ];
        delete query.$or;
      } else {
        query.$or = [
          { size: criteria.size },
          { availableSizes: { $regex: criteria.size, $options: 'i' } }
        ];
      }
    }
    
    if (criteria.category) {
      query.category = criteria.category;
    }
    
    if (criteria.subcategory) {
      query.subcategory = criteria.subcategory;
    }
    
    console.log('🗄️ Storage: Query to find products for restoration:', JSON.stringify(query, null, 2));
    
    // For size-specific restoration, add size back to availableSizes
    if (criteria.size) {
      const products = await Product.find(query);
      let updatedCount = 0;
      
      for (const product of products) {
        let availableSizes: string[] = [];
        
        // Parse existing availableSizes
        if (product.availableSizes) {
          try {
            if (typeof product.availableSizes === 'string') {
              availableSizes = JSON.parse(product.availableSizes);
            } else if (Array.isArray(product.availableSizes)) {
              availableSizes = product.availableSizes;
            }
          } catch (e) {
            console.warn('Error parsing availableSizes for product:', product._id);
            continue;
          }
        }
        
        // Add the specific size back to availableSizes if not already present
        if (!availableSizes.includes(criteria.size!)) {
          availableSizes.push(criteria.size!);
          availableSizes.sort(); // Keep sizes in order
          
          const updateData = {
            availableSizes: JSON.stringify(availableSizes),
            inStock: true,
            status: 'in-stock',
            updatedAt: new Date()
          };
          
          await Product.findByIdAndUpdate(product._id, updateData);
          updatedCount++;
          
          console.log(`🗄️ Storage: Restored size for product ${product._id}:`, {
            restoredSize: criteria.size,
            allAvailableSizes: availableSizes
          });
        }
      }
      
      console.log('🗄️ Storage: Size restoration result:', {
        matchedCount: products.length,
        updatedCount: updatedCount
      });
      
      return {
        updatedCount: updatedCount,
        matchedCount: products.length
      };
    } else {
      // For general restoration (no specific size), mark entire product as in stock
      const updateData = {
        status: 'in-stock',
        inStock: true,
        updatedAt: new Date()
      };
      
      const result = await Product.updateMany(query, updateData);
      
      console.log('🗄️ Storage: General restoration result:', {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      });
      
      return {
        updatedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      };
    }
  }
}

export const storage = new MongoStorage();