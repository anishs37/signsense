import { MongoClient, ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { planId, moduleId, lessonId } = await request.json();
    console.log('[updateLessonCompletion] Received request:', { planId, moduleId, lessonId });

    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
      await client.connect();
      const db = client.db('signsync');
      const plansCollection = db.collection('plans');
      const lessonsCollection = db.collection('lessons');

      // First get the lesson from the lessons collection
      const lesson = await lessonsCollection.findOne({ lessonId, moduleId });
      if (!lesson) {
        console.log('[updateLessonCompletion] Lesson not found');
        return NextResponse.json({ message: 'Lesson not found' }, { status: 404 });
      }

      console.log('[updateLessonCompletion] Found lesson:', {
        title: lesson.title,
        lessonId: lesson.lessonId,
        moduleId: lesson.moduleId
      });

      // Get the plan
      const plan = await plansCollection.findOne({ _id: new ObjectId(planId) });
      if (!plan) {
        console.log('[updateLessonCompletion] Plan not found');
        return NextResponse.json({ message: 'Plan not found' }, { status: 404 });
      }

      // Normalize title for case-insensitive matching
      const lessonTitleNormalized = lesson.title.trim().toLowerCase();
      let foundModuleIndex = -1;
      let foundLessonIndex = -1;

      for (let i = 0; i < plan.pathway.length; i++) {
        const module = plan.pathway[i];

        if (module.moduleId === moduleId) {
          for (let j = 0; j < module.subLessons.length; j++) {
            const subLesson = module.subLessons[j];

            if (subLesson.lessonId === lessonId || subLesson.lessonTitle.trim().toLowerCase() === lessonTitleNormalized) {
              foundModuleIndex = i;
              foundLessonIndex = j;
              break;
            }
          }
        }

        if (foundModuleIndex !== -1) break;
      }

      if (foundModuleIndex === -1 || foundLessonIndex === -1) {
        console.log('[updateLessonCompletion] No matching lesson found in plan');
        return NextResponse.json(
          { message: 'Matching lesson not found in plan' },
          { status: 404 }
        );
      }

      console.log('[updateLessonCompletion] Found matching lesson:', {
        moduleIndex: foundModuleIndex,
        lessonIndex: foundLessonIndex,
        lessonTitle: plan.pathway[foundModuleIndex].subLessons[foundLessonIndex].lessonTitle
      });

      // Update the lesson status in the plan
      const result = await plansCollection.updateOne(
        { _id: new ObjectId(planId) },
        { 
          $set: {
            [`pathway.${foundModuleIndex}.subLessons.${foundLessonIndex}.status`]: "completed",
            [`pathway.${foundModuleIndex}.progress.started`]: true,
            lastUpdated: new Date()
          },
          $inc: { 
            [`pathway.${foundModuleIndex}.progress.completedLessons`]: 1
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
        message: 'Lesson marked as completed successfully'
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