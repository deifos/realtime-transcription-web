"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { SAMPLE_RATE } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import { SettingsDialog } from "@/components/settings-dialog";

type WorkerMessage =
  | { type: "status"; message: string; duration?: string }
  | { type: "output"; message: string; duration?: string }
  | { type: "error"; error: string };

declare global {
  interface Window {
    electron: {
      onShortcutDown: (callback: () => void) => () => void;
      onShortcutUp: (callback: () => void) => () => void;
      onOpenSettings: (callback: () => void) => () => void;
      onPlaySound: (callback: (sound: string) => void) => () => void;
      shortcuts: {
        update: (shortcut: string) => Promise<boolean>;
        getCurrent: () => Promise<string>;
      };
      notifyTranscriptionComplete: () => void;
      clipboard: {
        writeText: (text: string) => Promise<boolean>;
      };
      onForceCleanup: (callback: () => void) => () => void;
    };
  }
}

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkerMessage[]>([]);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const worker = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const startSoundRef = useRef<HTMLAudioElement | null>(null);
  const stopSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      worker.current = new Worker(
        new URL("./worker_transcriber.js", import.meta.url),
        { type: "module" }
      );

      const onMessage = (event: MessageEvent<WorkerMessage>) => {
        if (event.data.type === "error") {
          console.error("Worker error:", event.data.error);
          setError(event.data.error);
          return;
        }
        if (event.data.type === "status") {
          console.log("Status update:", event.data.message);
          setMessages((prev) => [...prev, event.data]);
          if (event.data.message === "Ready!") {
            setIsReady(true);
          }
          if (event.data.message === "transcription_complete") {
            setIsTranscribing(false);
          }
        } else if (event.data.type === "output") {
          console.log("Transcription received:", event.data.message);
          setMessages((prev) => [...prev, event.data]);
          if (!isRecordingRef.current && window.electron) {
            window.electron.clipboard
              .writeText(event.data.message)
              .then(() => console.log("Text pasted at cursor"))
              .catch((err) => console.error("Failed to paste text:", err));
            window.electron.notifyTranscriptionComplete();
          }
        }
      };

      worker.current.addEventListener("message", onMessage);
      return () => {
        if (worker.current) {
          worker.current.removeEventListener("message", onMessage);
        }
      };
    } catch (error) {
      console.error("Failed to initialize worker:", error);
      setError(
        error instanceof Error ? error.message : "Failed to initialize worker"
      );
    }
  }, []);

  const startRecording = async (): Promise<void> => {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
          sampleRate: SAMPLE_RATE,
        },
      });
      streamRef.current = stream;
      audioContextRef.current = new window.AudioContext({
        sampleRate: SAMPLE_RATE,
      });
      sourceRef.current =
        audioContextRef.current.createMediaStreamSource(stream);
      await audioContextRef.current.audioWorklet.addModule(
        new URL("../lib/processor.js", import.meta.url)
      );
      workletRef.current = new AudioWorkletNode(
        audioContextRef.current,
        "vad-processor"
      );
      sourceRef.current.connect(workletRef.current);
      workletRef.current.port.onmessage = (
        event: MessageEvent<{ buffer: Float32Array }>
      ) => {
        if (
          event.data.buffer &&
          event.data.buffer instanceof Float32Array &&
          event.data.buffer.length > 0
        ) {
          worker.current?.postMessage({ buffer: event.data.buffer });
        } else {
          console.error("Invalid buffer from worklet:", event.data.buffer);
        }
      };
      setIsTranscribing(true);
      worker.current?.postMessage({ type: "command", command: "start" });
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      isRecordingRef.current = false;
    }
  };

  const stopRecording = async (): Promise<void> => {
    if (!isRecordingRef.current) return;
    console.log("=== START RECORDING CLEANUP ===");
    console.log("1. Marking as not recording");

    // First, mark as not recording
    isRecordingRef.current = false;
    setIsTranscribing(false);

    try {
      // 1. Stop the worker first
      console.log("2. Stopping worker");
      if (worker.current) {
        worker.current.postMessage({ type: "command", command: "stop" });
        worker.current.postMessage({ type: "command", command: "finalize" });
        console.log("   Worker commands sent");
      }

      // 2. Stop and cleanup audio tracks
      console.log("3. Cleaning up audio tracks");
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        console.log(`   Found ${tracks.length} tracks to stop`);
        tracks.forEach((track, index) => {
          console.log(
            `   Stopping track ${index + 1}:`,
            track.kind,
            track.label
          );
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
        console.log("   Tracks cleanup complete");
      }

      // 3. Disconnect audio nodes
      console.log("4. Disconnecting audio nodes");
      if (sourceRef.current) {
        if (workletRef.current) {
          console.log("   Disconnecting source from worklet");
          sourceRef.current.disconnect(workletRef.current);
        }
        sourceRef.current = null;
      }

      if (workletRef.current) {
        console.log("   Closing worklet");
        workletRef.current.disconnect();
        workletRef.current.port.close();
        workletRef.current = null;
      }

      // 4. Close audio context last
      console.log("5. Closing audio context");
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        console.log("   Audio context closed");
        audioContextRef.current = null;
      }

      console.log("=== CLEANUP COMPLETE ===");
    } catch (err) {
      console.error("=== ERROR DURING CLEANUP ===", err);
    }
  };

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        setIsSpacePressed(true);
        await startRecording();
      }
    };

    const handleKeyUp = async (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setIsSpacePressed(false);
        await stopRecording();
      }
    };

    // Handle keyboard shortcuts
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Handle global shortcut
    let cleanupFns: (() => void)[] = [];

    if (window.electron) {
      cleanupFns.push(
        window.electron.onShortcutDown(async () => {
          console.log("Shortcut down received, current state:", {
            isRecordingRef: isRecordingRef.current,
          });
          if (!isRecordingRef.current) {
            console.log("Starting recording from shortcut");
            setIsSpacePressed(true);
            await startRecording();
          }
        })
      );

      cleanupFns.push(
        window.electron.onShortcutUp(async () => {
          console.log("Shortcut up received, current state:", {
            isRecordingRef: isRecordingRef.current,
          });
          if (isRecordingRef.current) {
            console.log("Stopping recording from shortcut");
            setIsSpacePressed(false);
            await stopRecording();
            console.log("Recording stopped from shortcut");
          }
        })
      );

      cleanupFns.push(
        window.electron.onOpenSettings(() => {
          setShowSettings(true);
        })
      );
    }

    // Cleanup function to ensure resources are released
    const cleanup = async () => {
      if (isRecordingRef.current) {
        await stopRecording();
      }
      cleanupFns.forEach((cleanup) => cleanup());
    };

    // Add window unload handler
    window.addEventListener("beforeunload", cleanup);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, []);

  // Initialize sound effects
  useEffect(() => {
    startSoundRef.current = new Audio("/sounds/active.wav");
    stopSoundRef.current = new Audio("/sounds/inactive.wav");
  }, []);

  // Handle sound effects
  useEffect(() => {
    if (window.electron) {
      return window.electron.onPlaySound((sound) => {
        switch (sound) {
          case "start":
            startSoundRef.current?.play().catch(console.error);
            break;
          case "stop":
            stopSoundRef.current?.play().catch(console.error);
            break;
        }
      });
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center flex-grow">
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      {error ? (
        <div className="text-center p-2">
          <div className="text-white text-4xl md:text-5xl mb-1 font-semibold">
            An error occurred
          </div>
          <div className="text-red-300 text-xl">{error}</div>
        </div>
      ) : !isReady ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          <p className="text-slate-600 text-lg">Loading AI Model...</p>
        </div>
      ) : (
        <>
          <div className="text-center flex flex-col items-center justify-center h-full w-full ">
            <div className="text-center w-full z-10 text-slate-600 overflow-hidden pb-8">
              {messages.map((msg, index) => {
                const { type } = msg;
                const duration = "duration" in msg ? msg.duration : "";
                const message = "message" in msg ? msg.message : "";
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`mb-1 ${
                      type === "output"
                        ? "text-5xl"
                        : "text-2xl text-slate-700 font-light"
                    }`}
                  >
                    <motion.div
                      initial={{ opacity: 1 }}
                      animate={
                        duration === "until_next" &&
                        index === messages.length - 1
                          ? {}
                          : {
                              opacity: 0,
                              display: "none",
                            }
                      }
                      transition={{
                        delay:
                          duration === "until_next"
                            ? 0
                            : 1 + message.length / 20,
                        duration: 1,
                      }}
                    >
                      {message}
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
            <div className="z-10 text-slate-600">
              {isSpacePressed
                ? "Recording..."
                : "Press and hold the SPACEBAR to record"}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
