import { MongoClient } from 'mongodb';
import { NextResponse } from 'next/server';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

export async function POST(request: Request) {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('signsync');
    const usersCollection = db.collection('users');
    
    const userData = await request.json();
    
    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: userData.email });
    if (existingUser) {
      await client.close();
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Insert the new user
    const result = await usersCollection.insertOne(userData);
    
    await client.close();
    
    return NextResponse.json({ 
      _id: result.insertedId,
      ...userData 
    });
    
  } catch (error) {
    console.error('Error in user creation:', error);
    return NextResponse.json(
      { error: 'Error creating user' },
      { status: 500 }
    );
  }
}

// For updating user with active plan ID
export async function PATCH(request: Request) {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('signsync');
    const usersCollection = db.collection('users');
    
    const { userId, activePlanId } = await request.json();
    
    const result = await usersCollection.updateOne(
      { _id: userId },
      { $set: { activePlanId: activePlanId } }
    );
    
    await client.close();
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Error updating user' },
      { status: 500 }
    );
  }
}