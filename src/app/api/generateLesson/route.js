import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai'
});

function sanitizeForJSON(str) {
  return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

function cleanText(text) {
  if (!text) return text;
  let cleaned = text.replace(/\[\d+\]/g, '');
  cleaned = cleaned.replace(/\[[A-Za-z]\d+\]/g, '');
  cleaned = cleaned.replace(/\[[^\]]*\d[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ');  
  return cleaned.trim();
}

function cleanLessonContent(content) {
  if (!content) return content;

  if (typeof content === 'string') {
    return cleanText(content);
  }

  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item === 'string') {
        return cleanText(item);
      }
      return cleanLessonContent(item);
    });
  }

  if (typeof content === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(content)) {
      cleaned[key] = cleanLessonContent(value);
    }
    return cleaned;
  }

  return content;
}

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
      Your explanations should be well-structured with clear sections and paragraph breaks.
      Use markdown headers (# for main headers, ## for subheaders) to organize content.
      Always add a line break (it must be $) after each header before starting the paragraph.
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
                "instruction": "Structure your content like this:
                  # Main Topic Header
                  Introduction paragraph giving an overview...

                  ## Key Concept 1
                  Detailed explanation of the first important point...

                  ## Key Concept 2
                  In-depth exploration of the second concept...

                  ## Practice Method
                  Specific instructions for practicing...",
                "commonMistakes": ["..."],
                "tips": ["..."],
                "cameraActivity": false
              },
              {
                "title": "Step 2 Title",
                "instruction": "Use similar markdown structure for progressive steps...",
                "commonMistakes": ["..."],
                "tips": ["..."],
                "cameraActivity": true
              }
            ]
          }
        }
      }

      Each step should have:
      - "title": Clear, concise title
      - "instruction": Well-structured content using markdown headers (#, ##) and clear paragraph breaks
      - "commonMistakes": List of specific mistakes to avoid
      - "tips": Practical tips for success
      - "cameraActivity": Boolean indicating if camera practice is needed

      Instructions should be organized into clear sections with:
      1. A main header (#) introducing the topic
      2. Multiple subheaders (##) breaking down concepts
      3. Clear paragraph breaks between sections
      4. Progressive complexity from theory to practice

      Make sure the lesson escalates in depth: 
        The first step is a thorough reading with clear sections. 
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
      const sanitized = sanitizeForJSON(rawContent);
      parsed = JSON.parse(sanitized);
      parsed = cleanLessonContent(parsed);
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
              cameraActivity:
                typeof step.cameraActivity === 'boolean' ? step.cameraActivity : false
            }))
          : []
      },
      metadata: {
        version: 1,
        lastUpdated: new Date()
      }
    };

    const upsertResult = await lessonsCollection.updateOne(
      { lessonId: lessonId },
      { $set: lessonData },
      { upsert: true }
    );

    if (upsertResult.upsertedId) {
      console.log('[generateLesson] Created a new lesson _id:', upsertResult.upsertedId);
    } else {
      console.log('[generateLesson] Updated existing lesson with lessonId:', lessonId);
    }

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