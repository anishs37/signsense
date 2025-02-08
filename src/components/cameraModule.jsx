"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
export default function CameraModule() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [countdown, setCountdown] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);

  // "handData" will be an array => "hand_poses"
  // e.g. [{ score, handedness, keypoints, keypoints3D, image_size }, ...]
  const [handData, setHandData] = useState(null);

  // Start the camera feed on mount
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    }
    startCamera();

    return () => {
      // Stop camera on cleanup
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  // If we get new handData, draw keypoints on the canvas
  useEffect(() => {
    if (capturedImage && handData && canvasRef.current) {
      drawHandPoints();
    }
  }, [handData, capturedImage]);

  // Countdown logic
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else if (countdown === 0) {
      // time to capture
      if (videoRef.current) {
        captureImage();
      }
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Trigger the 5-second countdown
  const handleStartCountdown = () => {
    setCapturedImage(null);
    setHandData(null);
    setCountdown(5);
  };

  // Captures a frame from the video, sets it as capturedImage, and calls backend
  const captureImage = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Match canvas size to video
    const width = videoRef.current.videoWidth;
    const height = videoRef.current.videoHeight;
    canvas.width = width;
    canvas.height = height;

    // Draw frame on canvas
    ctx.drawImage(videoRef.current, 0, 0, width, height);

    // Convert canvas to data URL (Base64)
    const dataUrl = canvas.toDataURL("image/png");
    setCapturedImage(dataUrl);

    // Send to external endpoint
    sendToBackend(dataUrl);
  };

  // Convert dataUrl => Blob => FormData => POST => set handData
  const sendToBackend = async (dataUrl) => {
    try {
      // Convert base64 URL to a Blob
      const blob = await (await fetch(dataUrl)).blob();

      // Prepare multipart/form-data
      const formData = new FormData();
      // "image" must match the name in your external FastAPI endpoint
      formData.append("image", blob, "myimage.png");

      // POST to /detect_hands
      const response = await fetch(
        "https://anishs37--signsync-api-fastapi-app.modal.run/detect_hands",
        {
          method: "POST",
          body: formData, // No manual "Content-Type", the browser sets it
        }
      );
      const json = await response.json();
      console.log("Hand detection result:", json);

      // The server returns: { status: "...", hand_poses: [...] }
      if (json.status === "success" || json.status === "no_hands_detected") {
        setHandData(json.hand_poses || []);
      } else {
        console.warn("Unexpected response:", json);
      }
    } catch (error) {
      console.error("Failed to get hand detection:", error);
    }
  };

  // Draw the captured image + keypoints on the canvas
  const drawHandPoints = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const image = new Image();
    image.src = capturedImage;

    image.onload = () => {
      // Draw the captured image first
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      // "handData" is an array => each has .keypoints
      if (!Array.isArray(handData)) return;

      handData.forEach((hand) => {
        const { keypoints } = hand;
        if (!keypoints) return;

        // The x,y from MediaPipe is 0..1, so multiply by canvas size
        keypoints.forEach((kp) => {
          const x = kp.x * canvas.width;
          const y = kp.y * canvas.height;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = "red";
          ctx.fill();
        });
      });
    };
  };

  return (
    <div className="mt-4 p-4 border rounded-md">
      <h3 className="text-xl font-semibold mb-2">Practice: Detect Your Hand</h3>

      {/* Video Preview and Canvas Overlay */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative">
          {/* Live camera feed */}
          <video
            ref={videoRef}
            style={{ width: "320px", height: "240px", backgroundColor: "#000" }}
          />
          {/* A button to start the countdown */}
          <div className="mt-2">
            <Button onClick={handleStartCountdown}>Start 5s Countdown</Button>
          </div>
          {/* Show a countdown overlay if countdown > 0 */}
          {countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-6xl font-bold text-white">{countdown}</span>
            </div>
          )}
        </div>

        {/* Canvas to draw the final image & points */}
        <canvas
          ref={canvasRef}
          style={{
            width: "320px",
            height: "240px",
            border: "1px solid #999",
            backgroundColor: "#eee",
          }}
        ></canvas>
      </div>
    </div>
  );
}