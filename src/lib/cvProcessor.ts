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
  useClahe: boolean;
  useBilateral: boolean;
  useROI: boolean;
  filterReflections: boolean;
  geomValidation: boolean;
  debugView: "normal" | "roi" | "thresh" | "edges" | "discarded";
  exclusionZones?: {x: number, y: number, w: number, h: number}[];
  currentExclusion?: {x: number, y: number, w: number, h: number} | null;
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
  useClahe: true,
  useBilateral: true,
  useROI: true,
  filterReflections: true,
  geomValidation: true,
  debugView: "normal"
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
  "bright_light": {
    label: "Iluminação Clara (Reflexos)",
    params: { blurSize: 7, cannyThresh1: 80, cannyThresh2: 200, param1: 50, param2: 30, useClahe: false, filterReflections: true }
  },
  "dark_light": {
    label: "Iluminação Escura (Sombreado)",
    params: { blurSize: 5, cannyThresh1: 20, cannyThresh2: 80, param1: 30, param2: 25, useClahe: true, filterReflections: false }
  },
  "dense_pallet": {
    label: "Pallets Densos (Tubos Próximos)",
    params: { blurSize: 3, minDist: 8, param2: 20, minArea: 100, maxArea: 5000, geomValidation: true }
  },
  "spaced_pallet": {
    label: "Pallets Espaçados",
    params: { blurSize: 5, minDist: 30, param2: 35, minArea: 500, maxArea: 15000 }
  },
  "small_profiles": {
    label: "Perfis Pequenos",
    params: { blurSize: 3, minDist: 5, minRadius: 4, maxRadius: 15, param2: 15 }
  },
  "large_profiles": {
    label: "Perfis Grandes",
    params: { blurSize: 7, minDist: 50, minRadius: 40, maxRadius: 150, param2: 40 }
  }
};


export function processImage(
  src: any, // cv.Mat
  dst: any, // cv.Mat
  params: ProcessorParams
): number {
  if (!src || !dst) return 0;
  let count = 0;
  
  let gray = new cv.Mat();
  let equalized = new cv.Mat();
  let blurred = new cv.Mat();
  let mask = new cv.Mat();
  let threshOutput = new cv.Mat();
  let edges = new cv.Mat();
  let kernelClose = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 1. Auto ROI Mask Generation Builder
    if (params.useROI) {
      let roiEdges = new cv.Mat();
      cv.Canny(gray, roiEdges, 50, 150, 3, false);
      let kernelROI = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 15));
      cv.morphologyEx(roiEdges, roiEdges, cv.MORPH_CLOSE, kernelROI);
      
      let roiContours = new cv.MatVector();
      let hierarchy = new cv.Mat();
      cv.findContours(roiEdges, roiContours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      mask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
      let maxArea = 0, maxIdx = -1;
      for (let i = 0; i < roiContours.size(); i++) {
        let area = cv.contourArea(roiContours.get(i));
        if (area > maxArea) { maxArea = area; maxIdx = i; }
      }
      if (maxIdx >= 0) {
        cv.drawContours(mask, roiContours, maxIdx, new cv.Scalar(255), cv.FILLED);
        let kernelErode = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
        cv.erode(mask, mask, kernelErode); // Erode outer noise
        kernelErode.delete();
      } else {
        mask.setTo(new cv.Scalar(255));
      }
      
      roiEdges.delete(); kernelROI.delete(); roiContours.delete(); hierarchy.delete();
    } else {
      mask = new cv.Mat(src.rows, src.cols, cv.CV_8UC1, new cv.Scalar(255));
    }

    // 2. CLAHE / Equalization
    if (params.useClahe) {
      try {
        let clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        clahe.apply(gray, equalized);
        clahe.delete();
      } catch (e) {
        cv.equalizeHist(gray, equalized);
      }
    } else {
      gray.copyTo(equalized);
    }

    // 3. Bilateral Filter / Blur
    if (params.useBilateral) {
      try {
         cv.bilateralFilter(equalized, blurred, 9, 75, 75, cv.BORDER_DEFAULT);
      } catch (e) {
         let kSize = params.blurSize % 2 === 0 ? params.blurSize + 1 : params.blurSize;
         cv.GaussianBlur(equalized, blurred, new cv.Size(kSize, kSize), 0, 0, cv.BORDER_DEFAULT);
      }
    } else {
      let kSize = params.blurSize % 2 === 0 ? params.blurSize + 1 : params.blurSize;
      cv.GaussianBlur(equalized, blurred, new cv.Size(kSize, kSize), 0, 0, cv.BORDER_DEFAULT);
    }

    // 4. Debug Views Override
    if (params.debugView === 'roi') { cv.cvtColor(mask, dst, cv.COLOR_GRAY2RGBA); return 0; }
    
    cv.adaptiveThreshold(blurred, threshOutput, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
    if (params.debugView === 'thresh') { cv.cvtColor(threshOutput, dst, cv.COLOR_GRAY2RGBA); return 0; }
    
    cv.Canny(blurred, edges, params.cannyThresh1, params.cannyThresh2, 3, false);
    if (params.debugView === 'edges') { cv.cvtColor(edges, dst, cv.COLOR_GRAY2RGBA); return 0; }

    // Start painting final destination
    src.copyTo(dst);

    // Dim non-ROI area and draw border
    if (params.useROI) {
       for (let y = 0; y < dst.rows; y++) {
         for (let x = 0; x < dst.cols; x++) {
           if (mask.ucharPtr(y, x)[0] === 0) {
             let pixel = dst.ucharPtr(y, x);
             pixel[0] = pixel[0] * 0.3; pixel[1] = pixel[1] * 0.3; pixel[2] = pixel[2] * 0.3;
           }
         }
       }
       let dbgContours = new cv.MatVector();
       let dbgHier = new cv.Mat();
       cv.findContours(mask, dbgContours, dbgHier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
       cv.drawContours(dst, dbgContours, -1, new cv.Scalar(0, 255, 255, 150), 2, cv.LINE_8, dbgHier, 0);
       dbgContours.delete(); dbgHier.delete();
    }

    let detectedCenters: {x: number, y: number, r: number}[] = [];

    // 5. Hough Circles Method
    if (params.method === 'hough') {
      let circles = new cv.Mat();
      cv.HoughCircles(blurred, circles, cv.HOUGH_GRADIENT, params.dp, params.minDist, params.param1, params.param2, params.minRadius, params.maxRadius);

      for (let i = 0; i < circles.cols; ++i) {
        let x = circles.data32F[i * 3]; let y = circles.data32F[i * 3 + 1]; let radius = circles.data32F[i * 3 + 2];
        let isValid = true;
        
        if (params.useROI && mask.ucharPtr(Math.round(y), Math.round(x))[0] === 0) isValid = false;

        if (params.filterReflections && isValid) {
           let centerIntensity = blurred.ucharPtr(Math.round(y), Math.round(x))[0];
           if (centerIntensity > 220) isValid = false; // Too bright, reflection inside hole
        }

        if (params.geomValidation && isValid) {
          for (let c of detectedCenters) {
             let dist = Math.sqrt(Math.pow(c.x - x, 2) + Math.pow(c.y - y, 2));
             if (dist < params.minDist * 0.8 || dist < radius) { isValid = false; break; }
          }
        }

        if (isValid && params.exclusionZones) {
          for (const zone of params.exclusionZones) {
            if (x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) {
              isValid = false; break;
            }
          }
        }

        let center = new cv.Point(x, y);
        if (isValid) {
          detectedCenters.push({x, y, r: radius});
          cv.circle(dst, center, 2, [0, 255, 0, 255], 3);
          cv.circle(dst, center, radius, [0, 255, 0, 255], 2);
          if (params.geomValidation) cv.putText(dst, "+", new cv.Point(x - 5, y + 5), cv.FONT_HERSHEY_SIMPLEX, 0.4, [0, 255, 0, 255], 1);
          count++;
        } else if (params.debugView === 'discarded') {
           cv.circle(dst, center, radius, [255, 0, 0, 255], 1);
        }
      }
      circles.delete();
    } else {
      // 6. Contours Method
      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();
      cv.findContours(threshOutput, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      for (let i = 0; i < contours.size(); ++i) {
        let contour = contours.get(i);
        let area = cv.contourArea(contour);
        
        if (area >= params.minArea && area <= params.maxArea) {
          let isMatch = true;
          let perimeter = cv.arcLength(contour, true);
          let circularity = 4 * Math.PI * (area / (perimeter * perimeter));

          if (params.objectShape === "circle" && circularity < 0.75) isMatch = false;
          
          if (params.objectShape === "rectangle") {
            let approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, 0.04 * perimeter, true);
            if (approx.rows !== 4) isMatch = false;
            approx.delete();
          }

          if (isMatch && params.useROI) {
             let M = cv.moments(contour);
             if (M.m00 > 0) {
               let cX = Math.round(M.m10 / M.m00); let cY = Math.round(M.m01 / M.m00);
               if (mask.ucharPtr(cY, cX)[0] === 0) isMatch = false;
               
               if (isMatch && params.exclusionZones) {
                 for (const zone of params.exclusionZones) {
                   if (cX >= zone.x && cX <= zone.x + zone.w && cY >= zone.y && cY <= zone.y + zone.h) {
                     isMatch = false; break;
                   }
                 }
               }
             }
          }

          if (isMatch) {
            cv.drawContours(dst, contours, i, [0, 215, 255, 255], 2, cv.LINE_8, hierarchy, 0);
            count++;
          } else if (params.debugView === 'discarded') {
            cv.drawContours(dst, contours, i, [255, 0, 0, 150], 1, cv.LINE_8, hierarchy, 0);
          }
        }
        contour.delete();
      }
      contours.delete(); hierarchy.delete();
    }

    if (params.exclusionZones) {
      for (const zone of params.exclusionZones) {
        cv.rectangle(dst, new cv.Point(zone.x, zone.y), new cv.Point(zone.x + zone.w, zone.y + zone.h), [255, 0, 0, 150], 2);
        cv.putText(dst, "EXCLUIDO", new cv.Point(zone.x + 5, zone.y + 15), cv.FONT_HERSHEY_SIMPLEX, 0.4, [255, 0, 0, 255], 1);
      }
    }
    
    if (params.currentExclusion) {
      const zone = params.currentExclusion;
      cv.rectangle(dst, new cv.Point(zone.x, zone.y), new cv.Point(zone.x + zone.w, zone.y + zone.h), [255, 165, 0, 200], 2);
    }

  } catch (err) {
    console.error("OpenCV Industrial Processing Error:", err);
  } finally {
    gray.delete(); equalized.delete(); blurred.delete(); mask.delete(); threshOutput.delete(); edges.delete(); kernelClose.delete();
  }

  return count;
}
