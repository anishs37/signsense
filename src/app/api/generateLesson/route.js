import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('[generateLesson] Received request body:', body);

    const { lessonId, moduleContext, userProfile } = body;
    if (!lessonId || !moduleContext) {
      console.error('[generateLesson] Missing lessonId or moduleContext.');
      return NextResponse.json(
        { message: 'Missing lesson data' },
        { status: 400 }
      );
    }

    // Pull out fields from moduleContext you might want to show GPT
    const { moduleId, moduleTitle, description, estimatedDuration, subLessons } = moduleContext;

    // If userProfile has fields for experience, goals, learningStyle, you can incorporate them:
    let userDesc = '';
    if (userProfile) {
      userDesc = `
        This user has:
        - Experience: ${userProfile.experience || 'unknown'}
        - Goals: ${userProfile.goals || 'unknown'}
        - Learning Style: ${userProfile.learningStyle || 'unspecified'}
      `;
    }

    // Optionally find the subLesson that matches lessonId
    const currentSubLesson = subLessons?.find(sl => sl.lessonId === lessonId);

    // Construct your GPT prompts
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
                "instruction": "Step 1 instructions for the user",
                "commonMistakes": ["..."],
                "tips": ["..."]
              },
              ...
            ]
          }
        }
      }

      Each step should have:
      - "title"
      - "instruction"
      - "commonMistakes" (array of strings)
      - "tips" (array of strings)

      Return ONLY that JSON object with no extra text or code fencing.
    `;

    console.log('[generateLesson] systemPrompt:', systemPrompt);
    console.log('[generateLesson] userPrompt:', userPrompt);

    // Call GPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // or 'gpt-4' if you have access
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const rawContent = completion.choices[0].message.content.trim();
    console.log('[generateLesson] GPT raw lesson content:', rawContent);

    // Attempt to parse GPT's JSON
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

    // Return the JSON
    return NextResponse.json(parsed, { status: 200 });

  } catch (error) {
    console.error('[generateLesson] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}