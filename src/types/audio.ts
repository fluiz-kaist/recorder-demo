export interface AudioRecording {
  id: string;
  userId: string;
  scriptId: string;
  audioUrl: string;
  duration: number;
  recordedAt: Date;
  status: "processing" | "completed" | "failed";
}

export interface AudioUploadData {
  scriptId: string;
  audioBlob: Blob;
  duration: number;
}
