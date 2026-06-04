"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SILENCE_TIMEOUT_MS = 2800;

type SpeechSupport = "checking" | "supported" | "unsupported";

type BrowserSpeechRecognitionAlternative = {
  transcript: string;
};

type BrowserSpeechRecognitionResult = {
  0: BrowserSpeechRecognitionAlternative;
  isFinal: boolean;
};

type BrowserSpeechRecognitionResultList = {
  length: number;
  [index: number]: BrowserSpeechRecognitionResult;
};

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  abort: () => void;
  start: () => void;
  stop: () => void;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as SpeechWindow;

  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

function mergeTranscript(baseText: string, transcript: string) {
  return [baseText.trim(), transcript.trim()].filter(Boolean).join(" ");
}

export function useSpeechInput({
  onChange,
  value
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const [support, setSupport] = useState<SpeechSupport>("checking");
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    setSupport(getSpeechRecognitionConstructor() ? "supported" : "unsupported");

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      recognitionRef.current?.abort();
    };
  }, []);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    recognitionRef.current?.stop();
    setIsListening(false);
    setStatus("Voice input stopped.");
  }, []);

  const scheduleSilenceStop = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    silenceTimerRef.current = setTimeout(() => {
      recognitionRef.current?.stop();
      setIsListening(false);
      setStatus("Voice input stopped after silence.");
    }, SILENCE_TIMEOUT_MS);
  }, []);

  const startListening = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();

    if (!Recognition) {
      setSupport("unsupported");
      setStatus("Voice input is not supported in this browser.");
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new Recognition();

    baseTextRef.current = valueRef.current;
    finalTranscriptRef.current = "";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";

        if (result.isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      onChange(
        mergeTranscript(
          baseTextRef.current,
          `${finalTranscriptRef.current} ${interimTranscript}`
        )
      );
      setStatus("Listening...");
      scheduleSilenceStop();
    };

    recognition.onerror = (event) => {
      const message =
        event.error === "not-allowed"
          ? "Microphone permission was denied."
          : "Voice input stopped. Try again when ready.";

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      setIsListening(false);
      setStatus(message);
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);
      setStatus("Listening...");
      scheduleSilenceStop();
    } catch {
      setIsListening(false);
      setStatus("Voice input is already starting.");
    }
  }, [onChange, scheduleSilenceStop]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }

    startListening();
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported: support === "supported",
    status:
      support === "unsupported"
        ? "Voice input is not supported in this browser."
        : status,
    toggleListening
  };
}
