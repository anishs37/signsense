import { MongoClient } from 'mongodb';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
      await client.connect();
      const db = client.db('signsync');
      const usersCollection = db.collection('users');
      
      const existingUser = await usersCollection.findOne({ email });
      
      if (existingUser) {
        return NextResponse.json({
          exists: true,
          userId: existingUser._id.toString(),
          activePlanId: existingUser.activePlanId || null
        });
      }

      return NextResponse.json({ exists: false });
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('[checkUser] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}