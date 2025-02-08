import os
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Body, Form
from fastapi.responses import JSONResponse, Response
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
import cv2
import json
from pydantic import BaseModel, Json, ValidationError
from pymongo import MongoClient
import logging
import sys
import httpx
import datetime
import random
import base64
import modal
import mediapipe as mp
import time
import numpy as np

logger = logging.getLogger('signsync-api')
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler(sys.stdout))
logger.info("Starting server initialization...")

image = (modal.Image.debian_slim()
    .apt_install([
        "python3-opencv",
        "libgl1",
        "libglib2.0-0",
        "ffmpeg"
    ])
    .pip_install([
        "fastapi[standard]",
        "pymongo[srv]",
        "opencv-python-headless",
        "httpx",
        "pydantic",
        "python-multipart",
        "numpy==1.23.5",
        "mediapipe @ https://github.com/cansik/mediapipe-extended/releases/download/v0.9.1/mediapipe_extended-0.9.1-cp38-cp38-linux_x86_64.whl"
    ])
)


app = modal.App(name="signsync-api", image=image)
web_app = FastAPI()

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://anishs37--signsync-api-fastapi-app.modal.run"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Initialize MediaPipe Hands
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=True,
    max_num_hands=1,
    min_detection_confidence=0.8,
    min_tracking_confidence=0.5
)

@web_app.post("/detect_hands")
async def detect_hands(image: UploadFile):
    try:
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image format")
            
        frame_height, frame_width, _ = frame.shape
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = hands.process(rgb_frame)  
        hand_poses = []

        if result.multi_hand_landmarks:
            for hand_landmarks, hand_handedness in zip(result.multi_hand_landmarks, result.multi_handedness):
                landmarks = []
                landmarks3D = []
                
                for landmark in hand_landmarks.landmark:
                    landmarks.append({
                        'x': float(landmark.x),
                        'y': float(landmark.y)
                    })
                    landmarks3D.append({
                        'x': float(landmark.x),
                        'y': float(landmark.y),
                        'z': float(landmark.z)
                    })
                
                hand_pose = {
                    "score": float(hand_handedness.classification[0].score),
                    "handedness": hand_handedness.classification[0].label,
                    "keypoints": landmarks,
                    "keypoints3D": landmarks3D,
                    "image_size": {
                        "width": frame_width,
                        "height": frame_height
                    }
                }
                hand_poses.append(hand_pose)
            
            return {"status": "success", "hand_poses": hand_poses}
        else: return {"status": "no_hands_detected", "hand_poses": []}
            
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@web_app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        status = {
            "status": "healthy",
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
        logger.info(f"Health check status: {status}")
        return status
    except Exception as e:

        
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        return {"status": "unhealthy", "error": str(e)}

@app.function(
    keep_warm=1
)
@modal.asgi_app()
def fastapi_app():
    return web_app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(web_app, host="127.0.0.1", port=8000)