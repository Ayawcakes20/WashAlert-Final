import { FIREBASE_STORAGE_BUCKET } from '../config/env';

const sanitizeSegment = (value) =>
  String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');

const sanitizePath = (value) =>
  String(value || '')
    .split('/')
    .map((segment) => sanitizeSegment(segment))
    .filter(Boolean)
    .join('/');

const inferMimeType = (uri) => {
  const lower = String(uri || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
};

const buildUserFacingUploadError = (status, message) => {
  const normalized = String(message || '').toLowerCase();
  if (status === 401 || status === 403 || normalized.includes('permission')) {
    return 'Storage permission denied. Please log in again and retry.';
  }
  if (normalized.includes('bucket')) {
    return 'Storage bucket configuration is invalid. Please contact support.';
  }
  return 'Image upload failed. Please try again.';
};

/**
 * Upload an image file to Firebase Storage using Firebase ID token auth.
 * Returns storage metadata and a download URL.
 */
export async function uploadImageAsync(
  uri,
  { idToken, folder = 'uploads', fileName = null, bucket = FIREBASE_STORAGE_BUCKET } = {}
) {
  if (!uri) {
    throw new Error('No image file selected.');
  }
  if (!idToken) {
    throw new Error('Missing Firebase auth token. Please log in again before uploading.');
  }
  if (!bucket) {
    throw new Error('Firebase Storage bucket is not configured.');
  }

  const safeFolder = sanitizePath(folder) || 'uploads';
  const safeName = sanitizeSegment(fileName) || `file_${Date.now()}.jpg`;
  const objectPath = `${safeFolder}/${safeName}`;

  const sourceResponse = await fetch(uri);
  if (!sourceResponse.ok) {
    throw new Error(`Unable to read selected file (${sourceResponse.status}).`);
  }

  const blob = await sourceResponse.blob();
  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o` +
    `?uploadType=media&name=${encodeURIComponent(objectPath)}`;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Firebase ${idToken}`,
      'Content-Type': inferMimeType(uri),
    },
    body: blob,
  });

  let payload = null;
  const raw = await uploadResponse.text();
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { error: { message: raw } };
    }
  }

  if (!uploadResponse.ok) {
    const providerMessage = payload?.error?.message || payload?.message || `Upload failed (${uploadResponse.status})`;
    const userMessage = buildUserFacingUploadError(uploadResponse.status, providerMessage);
    const err = new Error(userMessage);
    err.status = uploadResponse.status;
    err.providerMessage = providerMessage;
    throw err;
  }

  const uploadedPath = payload?.name || objectPath;
  const downloadToken = payload?.downloadTokens ? String(payload.downloadTokens).split(',')[0] : '';
  const downloadURL =
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(uploadedPath)}?alt=media` +
    (downloadToken ? `&token=${encodeURIComponent(downloadToken)}` : '');

  return {
    bucket,
    path: uploadedPath,
    downloadURL,
    size: Number(payload?.size || blob.size || 0),
    contentType: payload?.contentType || inferMimeType(uri),
  };
}
