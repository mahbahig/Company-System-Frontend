/** One step of an upload: how much was sent (0–1) and, at the end, the API's answer. */
export interface UploadProgress<T> {
  progress: number;
  result?: T;
}
