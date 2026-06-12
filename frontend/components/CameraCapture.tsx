"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildCameraConstraints,
  drawVideoToCanvas,
  getPreviewRotationDeg,
  isMobileDevice,
} from "@/lib/cameraOrientation";

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  frozen: boolean;
  capturedUrl: string | null;
}

export default function CameraCapture({
  onCapture,
  frozen,
  capturedUrl,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? isMobileDevice() : false
  );
  const [rotationDeg, setRotationDeg] = useState(0);

  const mobileFullscreen = mobile && !frozen;

  const syncDevice = useCallback(() => {
    setMobile(isMobileDevice());
  }, []);

  const updateVideoRotation = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    setRotationDeg(
      getPreviewRotationDeg(video.videoWidth, video.videoHeight)
    );
  }, []);

  useEffect(() => {
    syncDevice();
    window.addEventListener("resize", syncDevice);
    window.addEventListener("orientationchange", syncDevice);
    return () => {
      window.removeEventListener("resize", syncDevice);
      window.removeEventListener("orientationchange", syncDevice);
    };
  }, [syncDevice]);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          buildCameraConstraints(mobile)
        );
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            updateVideoRotation();
          };
        }
      } catch {
        setError("Không thể truy cập camera. Vui lòng cấp quyền.");
      }
    }

    if (!frozen) {
      startCamera();
    }

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [frozen, mobile, updateVideoRotation]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = drawVideoToCanvas(video, rotationDeg);
    if (!canvas) return;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.9
    );
  };

  if (error) {
    return (
      <div className="camera-inline-stage rounded-xl border border-slate-700 flex items-center justify-center p-4">
        <p className="text-red-400 text-sm text-center">{error}</p>
      </div>
    );
  }

  const stageClass = mobileFullscreen
    ? "camera-fullscreen-overlay"
    : "camera-inline-stage rounded-xl border border-slate-700 relative overflow-hidden";

  const previewClass = mobileFullscreen
    ? "camera-fullscreen-preview"
    : "camera-inline-preview";

  const videoClass = mobileFullscreen
    ? rotationDeg !== 0
      ? "camera-fullscreen-video camera-fullscreen-video--rotated"
      : "camera-fullscreen-video camera-fullscreen-video--normal"
    : "camera-inline-video";

  return (
    <div className={stageClass}>
      {frozen && capturedUrl ? (
        <img src={capturedUrl} alt="Captured" className={previewClass} />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={updateVideoRotation}
          className={videoClass}
        />
      )}
      {!frozen && (
        <button
          type="button"
          onClick={handleCapture}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 px-10 py-4 bg-blue-600 hover:bg-blue-700 rounded-full font-bold text-lg shadow-lg transition-colors"
        >
          Quét vật thể
        </button>
      )}
    </div>
  );
}
