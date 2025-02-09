import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

async function generateLessonContent(lessonInfo) {
  const { moduleId, moduleTitle, description, estimatedDuration, currentSubLesson, userProfile } = lessonInfo;

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
  
  const sanitized = sanitizeForJSON(rawContent);
  const parsed = JSON.parse(sanitized);
  return cleanLessonContent(parsed);
}

export async function POST(request) {
  let client;

  try {
    const body = await request.json();
    console.log('[generatePlan] Received request body:', body);

    // Extract user information
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

    // Generate learning plan using OpenAI
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

      The plan should have 3 modules, each with 4 subLessons. Make them relevant to:
      - The user's experience: "${experience}"
      - The user's goals: "${goals}"
      - The user's learning style: "${learningStyle}"

      THIS IS THE MOST IMPORTANT PART. Please keep in mind that for my application I
      only have data on the letters A-Y (not J), the numbers 1-9, and the phrase
      "I love you." Perhaps one way to go about this is have lessons be based on the difficulty
      of showing these signs accurately, but please make sure a lesson does not go out of the scope 
      of this major constraint. For example, no lesson on "common phrases" or whatever, REGARDLESS
      of what the user inputs in preferences. Also, make sure to append a json_path as shown below. The json_path
      will start with either alphabet/, numbers/, or phrases/. If the lesson will be to do, let's say, the
      letter a, the path will be alphabet/a.json (and same for every other letter; just do not give j or z).
      If the lesson is number 1-9, the json_path will be numbers/1.json, for example. And finally, if the
      lesson is the phrase "I love you," it will just be phrases/i love you.json. Make sure you do not
      include ANYTHING related to the lesson outside of this. Otherwise I will be in deep trouble. Also, make
      sure that each lesson is only for one letter/number/phrase. Finally, let me be very clear. These are
      the ONLY folders. This is not an example for you to generat more folders. These are quite literally the
      only folders available. And th eonly files availables are a-y (other than j).json for the letter folder,
      1-9 for the numbres folder, and ONLY ONE PHRASE AVAILABLE called "I love you" for the phrases folder. And
      as one more reminder, make sure the sublessons themselves are correlated to the json path and that each
      lesson is only based on one letter or phrase or number. Make sure the lesson title/description actually
      somewhat matches the json path, and not be something silly. Thanks!

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
                "json_path": "alphabet/a.json"
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

    let parsedPlan;
    try {
      parsedPlan = JSON.parse(rawContent);
    } catch (initialError) {
      const sanitizedContent = rawContent
        .replace(/\\n/g, '')
        .replace(/\\"/g, '"')
        .replace(/'/g, '"')
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3')
        .replace(/,\s*([}\]])/g, '$1');
      
      parsedPlan = JSON.parse(sanitizedContent);
    }

    // MongoDB Setup
    const uri = process.env.MONGODB_URI;
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db('signsync');
    
    const usersCollection = db.collection('users');
    const lessonsCollection = db.collection('lessons');
    let userId;
    
    const now = new Date();

    // Handle user creation/update
    const existingUser = await usersCollection.findOne({ email: body.email });
    if (existingUser) {
      userId = existingUser._id;
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
      const userDocument = {
        email: body.email,
        profile: {
          experience,
          goals,
          learningStyle,
          createdAt: now,
          lastActive: now
        },
        preAssessment: {
          completedAt: now,
          responses: {
            experience,
            goals,
            learningStyle
          }
        }
      };
      const userResult = await usersCollection.insertOne(userDocument);
      userId = userResult.insertedId;
    }

    // Remove existing lessons for this user
    await lessonsCollection.deleteMany({ userEmail: body.email });

    // Create lessons with content
    const lessonPromises = [];
    for (const module of parsedPlan.learningPathway) {
      for (const lesson of module.subLessons) {
        const lessonInfo = {
          moduleId: module.moduleId,
          moduleTitle: module.name,
          description: module.description,
          estimatedDuration: module.estimatedDuration,
          currentSubLesson: lesson,
          userProfile: {
            experience,
            goals,
            learningStyle
          }
        };

        try {
          const lessonContent = await generateLessonContent(lessonInfo);
          
          const lessonDocument = {
            _id: new ObjectId(),
            userEmail: body.email,
            userId: userId,
            moduleId: module.moduleId,
            uniqueLessonId: `${body.email}_${module.moduleId}_${lesson.lessonId}`,
            lessonId: `${module.moduleId}_${lesson.lessonId}`,
            originalLessonId: lesson.lessonId,
            lessonTitle: lesson.lessonTitle,
            description: lesson.description || "",
            json_path: lesson.json_path || "",
            content: lessonContent.lesson,
            status: 'not_started',
            progress: {
              started: false,
              completed: false,
              startedAt: null,
              completedAt: null,
              lastAttempt: null
            },
            createdAt: now,
            lastUpdated: now
          };

          lessonPromises.push(lessonsCollection.insertOne(lessonDocument));
        } catch (error) {
          console.error(`Error generating content for lesson ${lesson.lessonId}:`, error);
        }
      }
    }

    // Wait for all lesson insertions to complete
    const lessonResults = await Promise.all(lessonPromises);

    // Create a map of lessonIds to their MongoDB _ids
    const lessonIdMap = {};
    lessonResults.forEach((result, index) => {
      if (result.insertedId) {
        lessonIdMap[index] = result.insertedId;
      }
    });

    // Create the plan document
    const planDocument = {
      userId: userId,
      userEmail: body.email,
      status: 'active',
      generatedFrom: {
        experience,
        goals,
        learningStyle
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
            const key = `${moduleIndex}_${lessonIndex}`;
            return {
              lessonId: lesson.lessonId,
              mongoId: lessonIdMap[key],
              lessonTitle: lesson.lessonTitle,
              description: lesson.description || "",
              order: lessonIndex + 1,
              status: 'not_started',
              json_path: lesson.json_path || ""
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
  } catch (error) {
    console.error('[generatePlan] Unexpected error:', error);
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