export type AudioPreparationState = "idle" | "loading" | "ready" | "error";
export type PlaybackSessionState = "idle" | "running" | "paused" | "finished";
export type AudioPlayTrigger = "autoplay" | "resume" | "replay";

export type AudioSourceTarget = {
  src: string;
  getAttribute: (name: string) => string | null;
  pause: () => void;
  load: () => void;
};

export type AudioControlState = {
  disabled: boolean;
  action: "wait" | "stop" | "play" | "unavailable";
  label: "preparing" | "stop" | "resume" | "replay" | "error";
};

export function getAudioControlState(
  audioState: AudioPreparationState,
  sessionState: PlaybackSessionState,
  isAudioPlaying = sessionState === "running"
): AudioControlState {
  if (audioState === "loading" || audioState === "idle") {
    return { disabled: true, action: "wait", label: "preparing" };
  }
  if (audioState === "error") {
    return { disabled: true, action: "unavailable", label: "error" };
  }
  if (isAudioPlaying) {
    return { disabled: false, action: "stop", label: "stop" };
  }
  if (sessionState === "finished") {
    return { disabled: false, action: "play", label: "replay" };
  }
  return { disabled: false, action: "play", label: "resume" };
}

export function shouldRestartAudio(trigger: AudioPlayTrigger): boolean {
  return trigger !== "resume";
}

export function shouldRetryAudioPlay(
  readyState: number,
  hasMediaError: boolean
): boolean {
  return !hasMediaError && readyState < 3;
}

export function syncAudioSource(
  audio: AudioSourceTarget,
  requestedUrl: string
): boolean {
  if (audio.getAttribute("src") === requestedUrl) return false;
  audio.pause();
  audio.src = requestedUrl;
  audio.load();
  return true;
}
