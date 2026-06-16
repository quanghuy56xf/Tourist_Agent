"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildCameraConstraints,
  drawVideoToCanvas,
  getPreviewRotationDeg,
  isMobileDevice,
} from "@/lib/cameraOrientation";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  frozen: boolean;
  capturedUrl: string | null;
  /** inline = trong khung viewfinder (Figma); fullscreen = phủ màn hình trên mobile */
  layout?: "inline" | "fullscreen";
}

export default function CameraCapture({
  onCapture,
  frozen,
  capturedUrl,
  layout = "fullscreen",
}: CameraCaptureProps) {
  const { t } = useVisitorLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? isMobileDevice() : false
  );
  const [rotationDeg, setRotationDeg] = useState(0);

  const mobileFullscreen = layout === "fullscreen" && mobile && !frozen;

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
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError(t.scan.cameraNeedsHttps);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t.scan.cameraPermission);
        return;
      }

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
        setError(t.scan.cameraPermission);
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
  }, [frozen, mobile, t.scan.cameraNeedsHttps, t.scan.cameraPermission, updateVideoRotation]);

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
      <div
        className={
          layout === "inline"
            ? "absolute inset-0 flex items-center justify-center p-4"
            : "camera-inline-stage flex items-center justify-center rounded-xl border p-4"
        }
        style={layout === "inline" ? undefined : { borderColor: "var(--border)" }}
      >
        <p className="text-center text-sm text-red-400">{error}</p>
      </div>
    );
  }

  const stageClass =
    layout === "inline" || frozen
      ? "absolute inset-0 overflow-hidden"
      : mobileFullscreen
        ? "camera-fullscreen-overlay"
        : "camera-inline-stage rounded-xl border border-slate-700 relative overflow-hidden";

  const previewClass =
    layout === "inline" || !mobileFullscreen
      ? "absolute inset-0 h-full w-full object-cover"
      : "camera-fullscreen-preview";

  const videoClass =
    layout === "inline" || !mobileFullscreen
      ? "absolute inset-0 h-full w-full object-cover"
      : mobileFullscreen
        ? rotationDeg !== 0
          ? "camera-fullscreen-video camera-fullscreen-video--rotated"
          : "camera-fullscreen-video camera-fullscreen-video--normal"
        : "camera-inline-video";

  return (
    <div className={stageClass}>
      {frozen && capturedUrl ? (
        <img src={capturedUrl} alt={t.scan.capturedAlt} className={previewClass} />
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
          id="camera-capture-btn"
          type="button"
          onClick={handleCapture}
          className="hidden" // Hiding this because we built a custom overlay UI in page.tsx
        >
          {t.scan.hiddenCapture}
        </button>
      )}
    </div>
  );
}
