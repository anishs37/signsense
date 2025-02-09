import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai'
});

export async function POST(request) {
  let client;

  try {
    const body = await request.json();
    console.log('[generateLesson] Received request body:', body);

    const { planId, lessonId, moduleContext, userProfile } = body;

    if (!lessonId) {
      console.error('[generateLesson] Missing lessonId.');
      return NextResponse.json({ message: 'Missing lessonId' }, { status: 400 });
    }

    const uri = process.env.MONGODB_URI;
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db('signsync');
    const plansCollection = db.collection('plans');
    const lessonsCollection = db.collection('lessons');

    let moduleId;
    let moduleTitle;
    let description;
    let estimatedDuration = 'N/A';
    let currentSubLesson = null;

    if (planId) {
      const plan = await plansCollection.findOne({ _id: new ObjectId(planId) });
      if (!plan) {
        console.error(`[generateLesson] No plan found with _id=${planId}`);
        return NextResponse.json({ message: 'Plan not found' }, { status: 404 });
      }

      const moduleEntry = plan.pathway.find((mod) =>
        mod.subLessons.some((sl) => sl.lessonId === lessonId)
      );

      if (!moduleEntry) {
        console.error('[generateLesson] No module found containing lessonId:', lessonId);
        return NextResponse.json({ message: 'Module not found in plan' }, { status: 404 });
      }

      currentSubLesson = moduleEntry.subLessons.find((sl) => sl.lessonId === lessonId);
      if (!currentSubLesson) {
        console.error('[generateLesson] SubLesson not found in the module:', lessonId);
        return NextResponse.json({ message: 'SubLesson not found' }, { status: 404 });
      }

      moduleId = moduleEntry.moduleId;
      moduleTitle = moduleEntry.name;
      description = moduleEntry.description;
      estimatedDuration = moduleEntry.estimatedDuration || 'N/A';
    }
    else if (moduleContext) {
      moduleId = moduleContext.moduleId;
      moduleTitle = moduleContext.name || 'Untitled Module';
      description = moduleContext.description || '';
      estimatedDuration = moduleContext.estimatedDuration || 'N/A';

      if (Array.isArray(moduleContext.subLessons)) {
        currentSubLesson = moduleContext.subLessons.find((sl) => sl.lessonId === lessonId);
      }
      if (!currentSubLesson) {
        console.warn(
          '[generateLesson] SubLesson not found in moduleContext for lessonId:',
          lessonId
        );
      }
    } else {
      console.error('[generateLesson] Missing both planId and moduleContext.');
      return NextResponse.json(
        { message: 'Missing planId or moduleContext to generate lesson' },
        { status: 400 }
      );
    }

    let userDesc = '';
    if (userProfile) {
      userDesc = `
        This user has:
        - Experience: ${userProfile.experience || 'unknown'}
        - Goals: ${userProfile.goals || 'unknown'}
        - Learning Style: ${userProfile.learningStyle || 'unspecified'}
      `;
    }

    const systemPrompt = `
      You are an expert ASL tutor, capable of generating detailed, 
      step-by-step lesson content based on provided context. 
      Always respond with valid JSON only, with no extra text.
    `;

    const userPrompt = `
      The user is currently on module "${moduleId}" titled "${moduleTitle}".
      The lesson ID is "${lessonId}".
      Module description: "${description}"
      Estimated module duration: "${estimatedDuration}".
      Sub-lesson context: ${JSON.stringify(currentSubLesson || {}, null, 2)}
      ${userDesc}

      Please generate a single lesson in JSON with this structure:
      {
        "lesson": {
          "title": "Some Lesson Title",
          "duration": "About how long (e.g. '10-15 minutes')",
          "content": {
            "steps": [
              {
                "title": "Step 1 Title",
                "instruction": "Very in-depth textual explanation (like a textbook or blog)... (at least four paragraphs)",
                "commonMistakes": ["..."],
                "tips": ["..."],
                "cameraActivity": false
              },
              {
                "title": "Step 2 Title",
                "instruction": "Proceed to more complex or interactive material...",
                "commonMistakes": ["..."],
                "tips": ["..."],
                "cameraActivity": true
              }
            ]
          }
        }
      }

      Each step should have:
      - "title"
      - "instruction"
      - "commonMistakes"
      - "tips"
      - "cameraActivity"

      Make sure the lesson escalates in depth: 
        The first step is a thorough reading. 
        Subsequent steps become more advanced or interactive. 
      Include at least one step with "cameraActivity": true at some point in the sequence. 
      Return ONLY that JSON with no extra text or code fencing.
    `;

    console.log('[generateLesson] systemPrompt:', systemPrompt);
    console.log('[generateLesson] userPrompt:', userPrompt);

    const completion = await perplexity.chat.completions.create({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    });

    const rawContent = completion.choices[0].message.content.trim();
    console.log('[generateLesson] Perplexity raw lesson content:', rawContent);

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (error) {
      console.error('[generateLesson] Failed to parse lesson JSON:', error);
      return NextResponse.json(
        {
          message: 'Error parsing the lesson from AI. Please try again.',
          rawContent
        },
        { status: 500 }
      );
    }

    const lessonData = {
      lessonId: lessonId,
      moduleId: moduleId || 'unknown_module',
      title: parsed.lesson?.title || 'Untitled Lesson',
      duration: parsed.lesson?.duration || 'N/A',
      content: {
        steps: Array.isArray(parsed.lesson?.content?.steps)
          ? parsed.lesson.content.steps.map((step, i) => ({
              order: i + 1,
              title: step.title || `Step ${i + 1}`,
              instruction: step.instruction || '',
              commonMistakes: step.commonMistakes || [],
              tips: step.tips || [],
              cameraActivity: typeof step.cameraActivity === 'boolean' ? step.cameraActivity : false
            }))
          : []
      },
      metadata: {
        version: 1,
        lastUpdated: new Date()
      }
    };

    const insertResult = await lessonsCollection.insertOne(lessonData);
    console.log('[generateLesson] Inserted lesson _id:', insertResult.insertedId);

    return NextResponse.json(parsed, { status: 200 });

  } catch (error) {
    console.error('[generateLesson] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Server error: ' + error.message },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}