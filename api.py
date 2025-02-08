import os
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Body, Form
from fastapi.responses import JSONResponse, Response
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
import cv2
import json
from typing import Dict, List, Annotated
from pydantic import BaseModel, Json, ValidationError
from pymongo import MongoClient
import logging
import sys
import httpx
import datetime
import random
import base64
import modal

logger = logging.getLogger('signsync-api')
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler(sys.stdout))
logger.info("Starting server initialization...")

image = (modal.Image.debian_slim()
    .apt_install([
        "python3-opencv",
        "libgl1",  # Changed from libgl1-mesa-glx to libgl1
        "libglib2.0-0"
    ])
    .pip_install([
        "fastapi[standard]",
        "pymongo[srv]",
        "opencv-python-headless",
        "httpx",
        "pydantic",
        "python-multipart"
    ])
)

app = modal.App(name="signsync-api", image=image)
web_app = FastAPI()

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

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