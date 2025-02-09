import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import axios from 'axios';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const meshy = axios.create({
  baseURL: 'https://api.meshy.ai/openapi/v2',
  headers: {
    Authorization: `Bearer ${process.env.MESHY_API_KEY}`
  }
});

function calculatePlanDifficulty(pathway) {
  if (!pathway || pathway.length === 0) return 1;
  
  let total = 0;
  pathway.forEach((module) => {
    total += module.difficulty || 3;
  });
  
  const average = total / pathway.length;
  const scaled = Math.round((average / 5) * 10);
  return Math.min(10, Math.max(1, scaled));
}

export async function POST(request) {
  try {
    const { email, planId } = await request.json();
    
    if (!email || !planId) {
      return NextResponse.json(
        { message: 'Email and planId are required' },
        { status: 400 }
      );
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    try {
      const db = client.db('signsync');
      
      const user = await db.collection('users').findOne({ email });
      if (!user) {
        return NextResponse.json(
          { message: 'User not found' },
          { status: 404 }
        );
      }
      
      const plan = await db.collection('plans').findOne({ 
        _id: new ObjectId(planId),
        userId: user._id
      });
      
      if (!plan) {
        return NextResponse.json(
          { message: 'Plan not found or does not belong to user' },
          { status: 404 }
        );
      }

      const difficultyRating = calculatePlanDifficulty(plan.pathway || []);

      const systemPrompt = `
You are a creative 3D trophy designer. 
You will output JSON with exactly two fields:
1. "name": A catchy, meaningful trophy name (max 50 characters). This title should be unique and not generic, and it should be clearly and cleverly associated with the type of content the user learned.
2. "description": A concise description (max 500 characters) that represents a specific ASL course completion. Do not include the difficulty level in this description.

Consider the user's:
- Experience: ${plan.generatedFrom.experience}
- Goals: ${plan.generatedFrom.goals}
- Learning Style: ${plan.generatedFrom.learningStyle}
- Completed Modules: ${plan.pathway.map(m => m.name).join(', ')}
- Overall Difficulty Rating: ${difficultyRating} (on a scale of 1–10)

**Important**:
- If the rating is 1–3, trophy design should be simpler yet symbolic.
- If the rating is 4–7, aim for balanced impressiveness.
- If the rating is 8–10, the trophy should be grand and highly detailed.

Your JSON response should reflect these details in a single trophy concept that is visually cohesive with the difficulty rating and the user’s learning pathway.
      `.trim();

      const userPrompt = `
Design a 3D trophy to honor the successful completion of this ASL course. 
Incorporate subtle references to each module: ${plan.pathway.map(m => m.name).join(', ')}.
Mirror the difficulty rating (${difficultyRating}) in the level of grandeur and detail.
Return only the JSON object with "name" and "description" fields.
`.trim();

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const trophyInfo = JSON.parse(completion.choices[0].message.content);

      const previewResponse = await meshy.post('/text-to-3d', {
        mode: 'preview',
        prompt: trophyInfo.description,
        art_style: 'sculpture',
        topology: 'quad',
        target_polycount: 100000,
        symmetry_mode: 'on'
      });

      const previewTaskId = previewResponse.data.result;

      let previewTask;
      do {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const taskCheck = await meshy.get(`/text-to-3d/${previewTaskId}`);
        previewTask = taskCheck.data;
      } while (previewTask.status === 'PENDING' || previewTask.status === 'IN_PROGRESS');

      if (previewTask.status !== 'SUCCEEDED') {
        throw new Error('Preview generation failed');
      }

      const refineResponse = await meshy.post('/text-to-3d', {
        mode: 'refine',
        preview_task_id: previewTaskId,
        enable_pbr: true
      });

      const refineTaskId = refineResponse.data.result;

      let refineTask;
      do {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const taskCheck = await meshy.get(`/text-to-3d/${refineTaskId}`);
        refineTask = taskCheck.data;
      } while (refineTask.status === 'PENDING' || refineTask.status === 'IN_PROGRESS');

      if (refineTask.status !== 'SUCCEEDED') {
        throw new Error('Refine generation failed');
      }

      const trophyDocument = {
        userId: user._id,
        planId: new ObjectId(planId),
        name: trophyInfo.name,
        description: trophyInfo.description,
        modelUrls: refineTask.model_urls,
        textureUrls: refineTask.texture_urls,
        createdAt: new Date()
      };

      await db.collection('trophies').insertOne(trophyDocument);

      return NextResponse.json({
        name: trophyInfo.name,
        description: trophyInfo.description,
        modelUrls: refineTask.model_urls,
        textureUrls: refineTask.texture_urls
      });

    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('[generateTrophy] Error:', error);
    return NextResponse.json(
      { message: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}