"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { SAMPLE_RATE } from "@/lib/constants";
import { requestMicrophonePermission } from "./utils/permissions";

type WorkerMessage =
  | { type: "status"; message: string; duration?: string }
  | { type: "output"; message: string; duration?: string }
  | { type: "error"; error: string };

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkerMessage[]>([]);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(true);

  const worker = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  useEffect(() => {
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
        if (event.data.message === "model_loaded") {
          setIsModelLoading(false);
          return;
        }
        if (event.data.message === "Loading models...") {
          return;
        }
        if (event.data.message === "transcription_complete") {
          setIsTranscribing(false);
        }
        setMessages((prev) => [...prev, event.data]);
      }

      if (event.data.type === "output") {
        setMessages((prev) => [...prev, event.data]);
      }
    };

    worker.current.addEventListener("message", onMessage);
    return () => {
      if (worker.current) {
        worker.current.removeEventListener("message", onMessage);
      }
    };
  }, []);

  useEffect(() => {
    const checkPermissions = async () => {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        console.log("Microphone permission not granted");
      }
    };

    checkPermissions();
  }, []);

  const startRecording = async (): Promise<void> => {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    setIsTranscribing(true);

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
        if (worker.current && event.data.buffer instanceof Float32Array) {
          worker.current.postMessage({ buffer: event.data.buffer });
        }
      };

      worker.current?.postMessage({ type: "command", command: "start" });
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      isRecordingRef.current = false;
      setIsTranscribing(false);
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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center flex-grow">
      {error ? (
        <div className="text-center p-2">
          <div className="text-white text-4xl md:text-5xl mb-1 font-semibold">
            An error occurred
          </div>
          <div className="text-red-300 text-xl">{error}</div>
        </div>
      ) : (
        <>
          <div className="text-center flex flex-col items-center justify-center h-full w-full">
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
              {isModelLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-2xl"
                >
                  Loading model...
                </motion.div>
              ) : isSpacePressed ? (
                "Recording..."
              ) : (
                "Press and hold the SPACEBAR to record"
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
