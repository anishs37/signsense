import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import JSON5 from 'json5';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);

    const { experience, goals, learningStyle } = body;

    if (!experience || !goals || !learningStyle) {
      return NextResponse.json(
        { message: 'Missing assessment data' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return NextResponse.json(
        { message: 'Server configuration error' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
      You are an ASL tutor. A user has the following background:
      Experience: ${experience}
      Goals: ${goals}
      Learning Style: ${learningStyle}

      Create a structured learning plan with 3-5 modules.
      For each module, provide a title, description, and 2-3 sub-lessons.
      
      Important: Respond ONLY with the raw JSON array, no markdown formatting or code blocks.
      Format:
      [
        {
          "moduleTitle": "Module Name",
          "description": "Module Description",
          "subLessons": [
            {"title": "Lesson 1", "description": "Lesson 1 Description"},
            {"title": "Lesson 2", "description": "Lesson 2 Description"}
          ]
        }
      ]
    `;

    console.log('Sending request to OpenAI');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful ASL tutor. Always respond with clean, valid JSON only, no markdown or code blocks.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    console.log('Received response from OpenAI');

    let responseText = completion.choices[0].message.content.trim();

    // Optional: Function to remove trailing commas if needed
    function removeTrailingCommas(jsonString) {
      return jsonString.replace(/,\s*([}\]])/g, '$1');
    }    
    
    // Clean the response text by removing any markdown code block markers and trailing commas
    responseText = removeTrailingCommas(responseText);
    console.log('Cleaned response:', responseText);

    let plan;
    try {
      plan = JSON.parse(responseText);
    } catch (err) {
      console.error('Failed to parse JSON from OpenAI response:', err);
      return NextResponse.json(
        { message: 'Error parsing the plan from AI. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan }, { status: 200 });
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { message: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}