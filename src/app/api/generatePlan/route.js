import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('[generatePlan] Received request body:', body);

    // The pre-assessment page sends { experience, goals, learningStyle }
    const { experience, goals, learningStyle } = body;

    // Validate required fields
    if (!experience || !goals || !learningStyle) {
      console.error('[generatePlan] Missing user data to create plan.');
      return NextResponse.json(
        { message: 'Missing user data (experience, goals, learningStyle)' },
        { status: 400 }
      );
    }

    // Build the system prompt for GPT
    const systemPrompt = `
      You are an expert ASL tutor. The user has given you:
      - Experience: ${experience}
      - Goals: ${goals}
      - Learning Style: ${learningStyle}

      You must generate a structured ASL learning plan in JSON form.
      Respond with JSON only. No extra text.
    `;

    // The user prompt can specify the structure for the "plan"
    const userPrompt = `
      Please create a JSON with a "learningPathway" array, each containing:
      {
        "moduleId": "1",
        "name": "Introduction to ASL",
        "description": "...",
        "estimatedDuration": "...",
        "subLessons": [
           {
             "lessonId": "101",
             "lessonTitle": "Fingerspelling Basics",
             "description": "..."
           },
           ...
        ]
      }

      The plan should have 3-5 modules, each with subLessons. Make them relevant to:
      - The user's experience: "${experience}"
      - The user's goals: "${goals}"
      - The user's learning style: "${learningStyle}"

      Return only JSON. Example:
      {
        "learningPathway": [
          {
            "moduleId": "1",
            "name": "Intro to ASL",
            "description": "Some text",
            "estimatedDuration": "1 week",
            "subLessons": [
              {
                "lessonId": "101",
                "lessonTitle": "Fingerspelling Basics",
                "description": "Learn the alphabet"
              }
            ]
          },
          ...
        ]
      }
    `;

    console.log('[generatePlan] systemPrompt:', systemPrompt);
    console.log('[generatePlan] userPrompt:', userPrompt);

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // or 'gpt-4' if you have it
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const rawContent = completion.choices[0].message.content.trim();
    console.log('[generatePlan] GPT raw content:', rawContent);

    // Attempt to parse the JSON
    let parsedPlan;
    try {
      parsedPlan = JSON.parse(rawContent);
    } catch (err) {
      console.error('[generatePlan] Error parsing GPT content as JSON:', err);
      return NextResponse.json(
        {
          message: 'Error parsing the plan from AI. Please try again.',
          rawContent
        },
        { status: 500 }
      );
    }

    // Return the plan
    return NextResponse.json(parsedPlan, { status: 200 });

  } catch (error) {
    console.error('[generatePlan] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}