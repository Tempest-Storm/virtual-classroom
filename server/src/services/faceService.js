import { env } from '../config/env.js';

/**
 * Face matching for automated attendance.
 *
 * Descriptors are 128-dimension float vectors produced on the client by
 * face-api.js (FaceRecognitionNet). The server never receives raw imagery --
 * only these embeddings -- which keeps the pipeline privacy-preserving and
 * cheap enough to run on every proctoring tick.
 */

export const DESCRIPTOR_LENGTH = 128;

export function isValidDescriptor(d) {
  return Array.isArray(d) && d.length === DESCRIPTOR_LENGTH && d.every((n) => Number.isFinite(n));
}

/** L2 distance between two embeddings. Lower == more similar. */
export function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/** Distance to the closest enrolled sample for one person. */
export function distanceToProfile(probe, enrolledDescriptors) {
  let best = Infinity;
  for (const known of enrolledDescriptors) {
    const d = euclideanDistance(probe, known);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Match a probe descriptor against a roster.
 * @param {number[]} probe
 * @param {Array<{ userId: string, descriptors: number[][] }>} roster
 * @returns {{ userId: string|null, distance: number, confidence: number, matched: boolean, runnerUpDistance: number }}
 */
export function matchDescriptor(probe, roster, threshold = env.faceMatchThreshold) {
  let best = { userId: null, distance: Infinity };
  let runnerUp = Infinity;

  for (const person of roster) {
    if (!person.descriptors?.length) continue;
    const d = distanceToProfile(probe, person.descriptors);
    if (d < best.distance) {
      runnerUp = best.distance;
      best = { userId: String(person.userId), distance: d };
    } else if (d < runnerUp) {
      runnerUp = d;
    }
  }

  const matched = best.distance <= threshold;
  return {
    userId: matched ? best.userId : null,
    distance: best.distance,
    runnerUpDistance: runnerUp,
    confidence: matched ? Number(Math.max(0, 1 - best.distance).toFixed(4)) : 0,
    matched,
  };
}

/**
 * Identity is ambiguous when the runner-up is nearly as close as the winner --
 * typically siblings, twins, or a photo held up to the camera.
 */
export function isAmbiguous(result, margin = 0.08) {
  return result.matched && result.runnerUpDistance - result.distance < margin;
}

/** Average enrolment samples so a user converges on one stable centroid. */
export function centroid(descriptors) {
  if (!descriptors.length) return null;
  const out = new Array(DESCRIPTOR_LENGTH).fill(0);
  for (const d of descriptors) {
    for (let i = 0; i < DESCRIPTOR_LENGTH; i += 1) out[i] += d[i];
  }
  return out.map((v) => v / descriptors.length);
}

/**
 * Blends the raw signals a client reports each tick into a 0..100 engagement
 * score. Weighting favours actually looking at the class over merely being
 * logged in.
 */
export function computeEngagement({ faceVisible, lookingAtScreen, micActive, tabFocused, chatMessages = 0 }) {
  const score =
    (faceVisible ? 35 : 0) +
    (lookingAtScreen ? 30 : 0) +
    (tabFocused ? 20 : 0) +
    (micActive ? 5 : 0) +
    Math.min(10, chatMessages * 2);
  return Math.min(100, score);
}
