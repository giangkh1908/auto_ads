import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod;

/**
 * Connect to the in-memory database
 */
export const connect = async () => {
  try {
    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    
    // Set the URI for the test environment
    process.env.MONGODB_URL = uri;
    
    // Connect to the database
    await mongoose.connect(uri);
    
    console.log('Connected to in-memory MongoDB for testing');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
};

/**
 * Close database connection and stop the in-memory server
 */
export const closeDatabase = async () => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    
    if (mongod) {
      await mongod.stop();
    }
    
    console.log('Closed test database connection');
  } catch (error) {
    console.error('Error closing test database:', error);
    throw error;
  }
};

/**
 * Clear all data from all collections
 */
export const clearDatabase = async () => {
  try {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany();
    }
  } catch (error) {
    console.error('Error clearing test database:', error);
    throw error;
  }
};
