/**
 * Browser-side face pipeline. Detection and embedding both run on the client;
 * only the resulting 128-d descriptor ever leaves the device, so raw video
 * never touches the server.
 *
 * face-api pulls in TensorFlow.js (~1.4 MB), so it is imported dynamically --
 * only the classroom and enrolment routes ever pay for it.
 *
 * Model weights must be served from /public/models -- see web/public/models/README.md.
 */
const MODEL_URL = import.meta.env.VITE_FACE_MODELS_URL || '/models';

let faceapi = null;
let loadPromise = null;
let detectorOptions = null;

async function getFaceApi() {
  if (!faceapi) faceapi = await import('@vladmandic/face-api');
  return faceapi;
}

export function loadModels() {
  if (!loadPromise) {
    loadPromise = (async () => {
      const api = await getFaceApi();
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        api.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      detectorOptions = new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
      return true;
    })().catch((err) => {
      loadPromise = null; // let the caller retry
      throw new Error(`Face models could not be loaded from ${MODEL_URL}. ${err.message}`);
    });
  }
  return loadPromise;
}

/** Detect every face in a video/canvas element and return descriptors. */
export async function detectAll(element) {
  await loadModels();
  return faceapi
    .detectAllFaces(element, detectorOptions)
    .withFaceLandmarks(true)
    .withFaceDescriptors();
}

/** Single best face -- what the attendance tick uses. */
export async function detectPrimary(element) {
  await loadModels();
  const result = await faceapi
    .detectSingleFace(element, detectorOptions)
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  return result || null;
}

/**
 * Crude but effective gaze proxy: when a person looks away, the horizontal
 * offset between the eye midpoint and the nose tip grows relative to face
 * width. Runs on landmarks we already computed, so it costs nothing extra.
 */
export function isLookingAtScreen(landmarks, tolerance = 0.14) {
  if (!landmarks) return false;
  const leftEye = centre(landmarks.getLeftEye());
  const rightEye = centre(landmarks.getRightEye());
  const nose = centre(landmarks.getNose());

  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const faceWidth = Math.abs(rightEye.x - leftEye.x) * 2.2 || 1;
  const yaw = Math.abs(nose.x - eyeMidX) / faceWidth;

  return yaw < tolerance;
}

function centre(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** Captures N well-spaced samples for enrolment. */
export async function captureEnrolmentSamples(video, count = 5, onProgress) {
  const samples = [];
  for (let i = 0; i < count * 4 && samples.length < count; i += 1) {
    const face = await detectPrimary(video);
    if (face?.descriptor) {
      samples.push(Array.from(face.descriptor));
      onProgress?.(samples.length, count);
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  if (samples.length < 3) {
    throw new Error('Could not capture enough clear face samples. Check your lighting and try again.');
  }
  return samples;
}
