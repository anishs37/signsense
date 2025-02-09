import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

let client: MongoClient | null = null;

export async function getMongoClient() {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client;
}

export async function getCollection(collectionName: string) {
  const client = await getMongoClient();
  return client.db('signsync').collection(collectionName);
}