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
  minArea: number;
  maxArea: number;
  method: "hough" | "contours";
  objectShape: "circle" | "rectangle" | "any";
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
  minArea: 500,
  maxArea: 20000,
  method: "hough",
  objectShape: "circle",
};

export const objectTypes: Record<string, { label: string, params: Partial<ProcessorParams> }> = {
  "tubes": {
    label: "Tubos / Perfis Circulares",
    params: { method: "hough", objectShape: "circle" }
  },
  "boxes": {
    label: "Caixas / Perfis Quadrados",
    params: { method: "contours", objectShape: "rectangle", blurSize: 3, cannyThresh1: 40, cannyThresh2: 120 }
  },
  "any": {
    label: "Peças Diversas (Irregulares)",
    params: { method: "contours", objectShape: "any", blurSize: 5 }
  }
};

export const presets: Record<string, { label: string, params: Partial<ProcessorParams> }> = {
  "default": {
    label: "Iluminação Padrão",
    params: { blurSize: 5, cannyThresh1: 50, cannyThresh2: 150, minDist: 20 }
  },
  "high_density": {
    label: "Alta Densidade (Próximos)",
    params: { blurSize: 3, minDist: 10, param2: 20 }
  },
  "large_profiles": {
    label: "Perfis Grandes",
    params: { blurSize: 7, minDist: 40, param1: 40, param2: 30 }
  },
  "low_contrast": {
    label: "Baixo Contraste (Sombra)",
    params: { blurSize: 7, cannyThresh1: 20, cannyThresh2: 80, param1: 30, param2: 25 }
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
      
      // Filter by area
      if (area >= params.minArea && area <= params.maxArea) {
        let isMatch = true;

        if (params.objectShape === "rectangle") {
          let perimeter = cv.arcLength(contour, true);
          let approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, 0.04 * perimeter, true);
          
          // Checks if contour has 4 vertices (approximately a rectangle)
          if (approx.rows !== 4) {
            isMatch = false;
          } else {
             // Optional: calculate angles if strict rectangle is needed, but 4 vertices is a good start.
          }
          approx.delete();
        }

        if (isMatch) {
          cv.drawContours(dst, contours, i, [255, 165, 0, 255], 2, cv.LINE_8, hierarchy, 0);
          count++;
        }
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
