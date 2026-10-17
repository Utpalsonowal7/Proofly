export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body as T;
}

export async function uploadToS3(file: File, url: string, fields: Record<string, string>, onProgress: (value: number) => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.append(key, value);
    data.append("file", file);
    xhr.open("POST", url);
    xhr.timeout = 180000;
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 95)); };
    xhr.onload = () => { cleanup(); if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error("The upload did not complete. Check your S3 bucket CORS configuration and try again.")); };
    xhr.onerror = () => { cleanup(); reject(new Error("Upload interrupted. Check your connection and try again.")); };
    xhr.ontimeout = () => { cleanup(); reject(new Error("Upload timed out. Please retry.")); };
    xhr.onabort = () => { cleanup(); reject(new Error("Upload cancelled.")); };
    if (signal?.aborted) { cleanup(); reject(new Error("Upload cancelled.")); } else xhr.send(data);
  });
}

export async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  const image = await createImageBitmap(file);
  const dimensions = { width: image.width, height: image.height };
  image.close();
  return dimensions;
}
