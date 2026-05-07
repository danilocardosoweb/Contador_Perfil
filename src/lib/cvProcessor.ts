import cv from "@techstark/opencv-js";

export interface ProcessorParams {
  blurSize: number;
  cannyThresh1: number;
  cannyThresh2: number;
  dp: number;
  minDist: number;
  param1: number;
  param2: number;
  minRadius: number;
  maxRadius: number;
  method: "hough" | "contours";
}

export const defaultParams: ProcessorParams = {
  blurSize: 5,
  cannyThresh1: 50,
  cannyThresh2: 150,
  dp: 1.2,
  minDist: 20,
  param1: 50,
  param2: 30,
  minRadius: 10,
  maxRadius: 50,
  method: "hough",
};

export const presets: Record<string, { label: string, params: ProcessorParams }> = {
  "default": {
    label: "Padrão",
    params: { ...defaultParams }
  },
  "high_density": {
    label: "Alta Densidade (Tubos Pequenos)",
    params: { ...defaultParams, blurSize: 3, minDist: 10, param2: 20, minRadius: 5, maxRadius: 25 }
  },
  "large_profiles": {
    label: "Perfis Grandes",
    params: { ...defaultParams, blurSize: 7, minDist: 40, param1: 40, param2: 30, minRadius: 25, maxRadius: 100 }
  },
  "low_contrast": {
    label: "Baixo Contraste / Sombra",
    params: { ...defaultParams, blurSize: 5, cannyThresh1: 30, cannyThresh2: 100, param1: 30, param2: 25 }
  },
  "contours": {
    label: "Foco em Contornos (Formas Irregulares)",
    params: { ...defaultParams, method: "contours", blurSize: 7, cannyThresh1: 40, cannyThresh2: 120 }
  }
};

export function processImage(
  src: any, // cv.Mat
  dst: any, // cv.Mat
  params: ProcessorParams
): number {
  if (!src || !dst) return 0;

  // Convert to grayscale
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // Apply Gaussian Blur
  let blurred = new cv.Mat();
  let ksize = new cv.Size(params.blurSize, params.blurSize);
  cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);

  // Apply morphological operations (close small holes)
  let morph = new cv.Mat();
  let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.morphologyEx(blurred, morph, cv.MORPH_CLOSE, kernel);

  let count = 0;

  if (params.method === "hough") {
    // Hough Circles
    let circles = new cv.Mat();
    cv.HoughCircles(
      morph,
      circles,
      cv.HOUGH_GRADIENT,
      params.dp,
      params.minDist,
      params.param1, // Canny high threshold
      params.param2, // Accumulator threshold
      params.minRadius,
      params.maxRadius
    );

    // Draw circles on dst if it's the original image
    src.copyTo(dst);
    count = circles.cols;
    for (let i = 0; i < circles.cols; ++i) {
      let x = circles.data32F[i * 3];
      let y = circles.data32F[i * 3 + 1];
      let radius = circles.data32F[i * 3 + 2];
      let center = new cv.Point(x, y);
      cv.circle(dst, center, radius, [0, 255, 0, 255], 2);
      // center dot
      cv.circle(dst, center, 2, [0, 0, 255, 255], 3);
    }
    circles.delete();
  } else {
    // Contours Method
    let edges = new cv.Mat();
    cv.Canny(morph, edges, params.cannyThresh1, params.cannyThresh2);

    // Dilation to connect edges
    let dilated = new cv.Mat();
    cv.dilate(edges, dilated, kernel);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(
      dilated,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    src.copyTo(dst);
    for (let i = 0; i < contours.size(); ++i) {
      let contour = contours.get(i);
      let area = cv.contourArea(contour);
      // Filter by area to avoid noise
      if (area > 100 && area < 5000) {
        cv.drawContours(dst, contours, i, [255, 165, 0, 255], 2, cv.LINE_8, hierarchy, 0);
        count++;
      }
      contour.delete();
    }
    contours.delete();
    hierarchy.delete();
    edges.delete();
    dilated.delete();
  }

  // Cleanup
  gray.delete();
  blurred.delete();
  morph.delete();
  kernel.delete();

  return count;
}
