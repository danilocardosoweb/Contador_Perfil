import { useState, useEffect } from "react";
import cv from "@techstark/opencv-js";

export function useOpenCV() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Sometimes it's loaded synchronously, sometimes it requires onRuntimeInitialized
    if (cv.Mat) {
      setIsLoaded(true);
    } else {
      cv.onRuntimeInitialized = () => {
        setIsLoaded(true);
      };
    }
  }, []);

  return isLoaded;
}
