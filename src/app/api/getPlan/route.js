import { MongoClient, ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    
    if (!planId) {
      return NextResponse.json(
        { message: 'Plan ID is required' },
        { status: 400 }
      );
    }
    
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    
    try {
      await client.connect();
      const db = client.db('signsync');
      const plansCollection = db.collection('plans');
      
      const plan = await plansCollection.findOne({ _id: new ObjectId(planId) });
      
      if (!plan) {
        return NextResponse.json(
          { message: 'Plan not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        _id: plan._id,
        userId: plan.userId.toString(),
        displayTitle: plan.pathway?.[0]?.name
          ?.replace(/^Module\s*\d*\s*[:.-]\s*/i, '')
          .trim() || 'Untitled Plan',
        pathway: plan.pathway
      });
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('[getPlan] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}