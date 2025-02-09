import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export async function GET(request) {
  let client;

  try {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');
    if (!lessonId) {
      return NextResponse.json({ found: false, message: 'No lessonId provided' }, { status: 400 });
    }

    const uri = process.env.MONGODB_URI;
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db('signsync');
    const lessonsCollection = db.collection('lessons');

    const existingLesson = await lessonsCollection.findOne({ lessonId });
    if (existingLesson) {
      return NextResponse.json({
        found: true,
        lessonData: existingLesson
      });
    } else {
      return NextResponse.json({ found: false });
    }
  } catch (error) {
    console.error('[checkLesson] Unexpected error:', error);
    return NextResponse.json(
      { found: false, message: 'Server error: ' + error.message },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}