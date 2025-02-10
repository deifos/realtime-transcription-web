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
      shortcuts: {
        update: (shortcut: string) => Promise<boolean>;
        getCurrent: () => Promise<string>;
      };
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
        console.log(
          "Audio worklet buffer received in main thread:",
          event.data.buffer
        );
        if (
          event.data.buffer &&
          event.data.buffer instanceof Float32Array &&
          event.data.buffer.length > 0
        ) {
          console.log("Sending buffer to worker:", event.data.buffer);
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

  const stopRecording = (): void => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    worker.current?.postMessage({ type: "command", command: "stop" });

    setTimeout(() => {
      if (isTranscribing) {
        worker.current?.postMessage({ type: "command", command: "finalize" });
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (sourceRef.current && workletRef.current) {
        sourceRef.current.disconnect(workletRef.current);
      }
    }, 1000);
  };

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        setIsSpacePressed(true);
        await startRecording();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setIsSpacePressed(false);
        stopRecording();
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
          if (!isRecordingRef.current) {
            setIsSpacePressed(true);
            await startRecording();
          }
        })
      );

      cleanupFns.push(
        window.electron.onShortcutUp(() => {
          if (isRecordingRef.current) {
            setIsSpacePressed(false);
            stopRecording();
          }
        })
      );

      cleanupFns.push(
        window.electron.onOpenSettings(() => {
          setShowSettings(true);
        })
      );
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cleanupFns.forEach((cleanup) => cleanup());
    };
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
