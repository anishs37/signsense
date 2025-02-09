import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get('planId');

  if (!planId) {
    return NextResponse.json(
      { message: 'Plan ID is required' },
      { status: 400 }
    );
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('signsync');

    const trophy = await db.collection('trophies').findOne({
      planId: new ObjectId(planId)
    });

    if (!trophy) {
      return NextResponse.json(
        { message: 'No trophy found for this plan' },
        { status: 404 }
      );
    }

    // Get the plan details for additional context
    const plan = await db.collection('plans').findOne({
      _id: new ObjectId(planId)
    });

    return NextResponse.json({
      description: trophy.description,
      modelUrls: trophy.modelUrls,
      textureUrls: trophy.textureUrls,
      createdAt: trophy.createdAt,
      planTitle: plan?.pathway?.[0]?.name?.replace(/^Module\s*\d*\s*[:.-]\s*/i, '').trim() || 'ASL Learning Journey'
    });

  } catch (error) {
    console.error('[getTrophy] Error:', error);
    return NextResponse.json(
      { message: 'Server error: ' + error.message },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}