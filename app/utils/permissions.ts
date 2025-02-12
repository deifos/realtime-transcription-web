"use client";

export const requestMicrophonePermission = async () => {
  try {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    // If successful, stop the stream
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    console.error("Error requesting microphone permission:", error);
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      alert(
        "Microphone access was denied. Please enable it in your system settings and restart the application."
      );
    }
    return false;
  }
};
