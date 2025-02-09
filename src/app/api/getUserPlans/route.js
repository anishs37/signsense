// src/app/api/getUserPlans/route.js
import { MongoClient, ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

function extractModuleTitle(pathway) {
  if (!pathway || !Array.isArray(pathway) || pathway.length === 0) {
    return 'Untitled Plan';
  }

  const firstModule = pathway[0];
  if (!firstModule || !firstModule.name) {
    return 'Untitled Plan';
  }

  // Clean the module name by removing the "Module X:" prefix
  const cleanTitle = firstModule.name
    .replace(/^Module\s*\d*\s*[:.-]\s*/i, '') // Removes "Module X:" pattern
    .trim();

  return cleanTitle || 'Untitled Plan';
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { message: 'UserId is required' },
        { status: 400 }
      );
    }

    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
      await client.connect();
      const db = client.db('signsync');
      const plansCollection = db.collection('plans');
      
      const userPlans = await plansCollection
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .toArray();

      // Process each plan to add the display title
      const processedPlans = userPlans.map(plan => {
        // Add some debug logging
        console.log('Processing plan:', {
          planId: plan._id,
          firstModuleName: plan.pathway?.[0]?.name,
          extractedTitle: extractModuleTitle(plan.pathway)
        });

        return {
          ...plan,
          displayTitle: extractModuleTitle(plan.pathway)
        };
      });
      
      return NextResponse.json({ plans: processedPlans });
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('[getUserPlans] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}