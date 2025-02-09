import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const completeJSON = (jsonString) => {
  let sanitized = jsonString;
  const stack = [];
  const quoteRe = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'/g;
  const tokenRe = /[{}[\]]/g;
  
  sanitized = sanitized.replace(/,\s*([}\]])/g, '$1');

  let lastBracketIndex = -1;
  let match;
  
  while ((match = tokenRe.exec(sanitized)) !== null) {
    if (match[0] === '{' || match[0] === '[') {
      stack.push(match[0]);
    } else if (match[0] === '}' || match[0] === ']') {
      stack.pop();
    }
    lastBracketIndex = match.index;
  }

  while (stack.length > 0) {
    const type = stack.pop();
    sanitized += type === '{' ? '}' : ']';
  }

  const openQuotes = (sanitized.match(/"/g) || []).length % 2 !== 0;
  if (openQuotes) {
    sanitized = sanitized.replace(/"([^"]*)$/, '$1"');
  }

  if (!sanitized.trim().endsWith('}') && !sanitized.trim().endsWith(']')) {
    if (sanitized.trim().startsWith('{')) {
      sanitized += '}';
    } else if (sanitized.trim().startsWith('[')) {
      sanitized += ']';
    }
  }

  return sanitized;
};

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('[generatePlan] Received request body:', body);

    const experience = body.preAssessment?.responses?.experience;
    const goals = body.preAssessment?.responses?.goals;
    const learningStyle = body.preAssessment?.responses?.learningStyle;
    const email = body.email;

    if (!experience || !goals || !learningStyle || !email) {
      console.error('[generatePlan] Missing user data to create plan.');
      return NextResponse.json(
        { message: 'Missing user data (experience, goals, learningStyle, email)' },
        { status: 400 }
      );
    }

    const systemPrompt = `
      You are an expert ASL tutor. The user has given you:
      - Experience: ${experience}
      - Goals: ${goals}
      - Learning Style: ${learningStyle}

      You must generate a structured ASL learning plan in JSON form.
      Respond with valid JSON only. Ensure all keys are double-quoted.
      No extra text or markdown formatting.
    `;

    const userPrompt = `
      Please create a JSON with a "learningPathway" array, each containing:
      {
        "moduleId": "1",
        "name": "Ex. Introduction to ASL",
        "description": "...",
        "estimatedDuration": "...",
        "subLessons": [
           {
             "lessonId": "101",
             "lessonTitle": "Ex. Fingerspelling Basics",
             "description": "..."
           },
           ...
        ]
      }

      The plan should have 5 modules, each with 4 subLessons. Make them relevant to:
      - The user's experience: "${experience}"
      - The user's goals: "${goals}"
      - The user's learning style: "${learningStyle}"

      Return only valid JSON. Double-check all keys are quoted properly.
      Example:
      {
        "learningPathway": [
          {
            "moduleId": "1",
            "name": "Ex. Intro to ASL",
            "description": "Some text",
            "estimatedDuration": "1 week",
            "subLessons": [
              {
                "lessonId": "101",
                "lessonTitle": "Ex. Fingerspelling Basics",
                "description": "Learn the alphabet"
              }
            ]
          },
          ...
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const rawContent = completion.choices[0].message.content.trim();
    console.log('[generatePlan] GPT raw content:', rawContent);

    let sanitizedContent;
    let parsedPlan;

    try {
      sanitizedContent = rawContent
        .replace(/\\n/g, '')
        .replace(/\\"/g, '"')
        .replace(/'/g, '"')
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3')
        .replace(/,\s*([}\]])/g, '$1');

      sanitizedContent = completeJSON(sanitizedContent);
      parsedPlan = JSON.parse(sanitizedContent);

      if (!parsedPlan.learningPathway || !Array.isArray(parsedPlan.learningPathway)) {
        throw new Error('Invalid learningPathway structure');
      }
    } catch (err) {
      console.error('[generatePlan] JSON parsing error:', err);
      console.error('[generatePlan] Sanitized content:', sanitizedContent);
      return NextResponse.json(
        {
          message: 'Error parsing the AI response. Please try again.',
          rawContent,
          error: err.message
        },
        { status: 500 }
      );
    }

    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
      await client.connect();
      const db = client.db('signsync');
      
      const usersCollection = db.collection('users');
      let userId;
      
      const now = new Date();
      
      // Check if user exists - using body.email now
      const existingUser = await usersCollection.findOne({ email: body.email });
      if (existingUser) {
        userId = existingUser._id;

        // Update existing user
        await usersCollection.updateOne(
          { _id: userId },
          {
            $set: {
              'profile.experience': experience,
              'profile.goals': goals,
              'profile.learningStyle': learningStyle,
              'profile.lastActive': now,
              'preAssessment.completedAt': now,
              'preAssessment.responses': {
                experience,
                goals,
                learningStyle
              }
            }
          }
        );
      } else {
        // Create new user - using body.email here too
        const userDocument = {
          email: body.email,
          profile: {
            experience: experience,
            goals: goals,
            learningStyle: learningStyle,
            createdAt: now,
            lastActive: now
          },
          preAssessment: {
            completedAt: now,
            responses: {
              experience: experience,
              goals: goals,
              learningStyle: learningStyle
            }
          }
        };
        const userResult = await usersCollection.insertOne(userDocument);
        userId = userResult.insertedId;
      }

      // Prepare the plan document
      const planDocument = {
        userId: userId,
        status: 'active',
        generatedFrom: {
          experience: experience,
          goals: goals,
          learningStyle: learningStyle
        },
        createdAt: now,
        lastUpdated: now,
        pathway: parsedPlan.learningPathway.map((module, moduleIndex) => {
          return {
            moduleId: module.moduleId,
            name: module.name,
            description: module.description || "",
            estimatedDuration: module.estimatedDuration || "2 weeks",
            order: moduleIndex + 1,
            progress: {
              started: false,
              completedLessons: 0,
              totalLessons: module.subLessons.length
            },
            subLessons: module.subLessons.map((lesson, lessonIndex) => {
              return {
                lessonId: lesson.lessonId,
                lessonTitle: lesson.lessonTitle,
                description: lesson.description || "",
                order: lessonIndex + 1,
                status: 'not_started'
              };
            })
          };
        })
      };

      // Insert the plan
      const plansCollection = db.collection('plans');
      const result = await plansCollection.insertOne(planDocument);
      
      // Update user with activePlanId
      await usersCollection.updateOne(
        { _id: userId },
        { $set: { activePlanId: result.insertedId } }
      );

      // Add extra info to the response
      parsedPlan._id = result.insertedId;
      parsedPlan.userId = userId;

      return NextResponse.json(parsedPlan, { status: 200 });
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('[generatePlan] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}