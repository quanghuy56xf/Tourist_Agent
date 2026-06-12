export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;

  if (window.matchMedia("(max-width: 767px)").matches) return true;

  const touchDevice = window.matchMedia("(pointer: coarse)").matches;
  const phoneUa = /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent);
  return touchDevice && phoneUa && window.innerWidth < 1024;
}

export function isPortraitScreen(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerHeight > window.innerWidth;
}

export function getPreviewRotationDeg(
  videoWidth: number,
  videoHeight: number
): number {
  if (!videoWidth || !videoHeight) return 0;
  if (isPortraitScreen() && videoWidth > videoHeight) return 90;
  return 0;
}

export function drawVideoToCanvas(
  video: HTMLVideoElement,
  rotationDeg: number
): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const rad = (rotationDeg * Math.PI) / 180;

  if (rotationDeg === 90 || rotationDeg === -90) {
    canvas.width = vh;
    canvas.height = vw;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);
  } else {
    canvas.width = vw;
    canvas.height = vh;
    ctx.drawImage(video, 0, 0);
  }

  return canvas;
}

export function buildCameraConstraints(mobile: boolean): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: mobile ? 1920 : 1280, min: 640 },
      height: { ideal: mobile ? 1080 : 720, min: 480 },
      aspectRatio: mobile ? undefined : { ideal: 16 / 9 },
    },
  };
}
