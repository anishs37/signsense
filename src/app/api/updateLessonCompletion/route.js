import { MongoClient, ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { planId, moduleId } = await request.json();

    if (!planId || !moduleId) {
      return NextResponse.json(
        { message: 'PlanId and moduleId are required' },
        { status: 400 }
      );
    }

    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
      await client.connect();
      const db = client.db('signsync');
      const plansCollection = db.collection('plans');

      const plan = await plansCollection.findOne(
        { _id: new ObjectId(planId) }
      );

      if (!plan) {
        return NextResponse.json(
          { message: 'Plan not found' },
          { status: 404 }
        );
      }

      const module = plan.pathway.find(m => m.moduleId === moduleId);
      if (!module) {
        return NextResponse.json(
          { message: 'Module not found' },
          { status: 404 }
        );
      }

      const currentCompleted = module.progress.completedLessons;
      const totalLessons = module.progress.totalLessons;

      if (currentCompleted >= totalLessons) {
        return NextResponse.json({
          success: true,
          message: 'Module already fully completed'
        });
      }

      const result = await plansCollection.updateOne(
        { 
          _id: new ObjectId(planId),
          "pathway.moduleId": moduleId 
        },
        { 
          $inc: { 
            "pathway.$.progress.completedLessons": 1
          },
          $set: {
            "pathway.$.progress.started": true,
            lastUpdated: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json(
          { message: 'Failed to update plan' },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        success: true,
        message: 'Lesson completion count incremented successfully',
        newCompletedCount: currentCompleted + 1,
        totalLessons: totalLessons
      });
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('[updateLessonCompletion] Error:', error);
    return NextResponse.json(
      { message: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}