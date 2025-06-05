// src/types/recorder-js.d.ts
declare module "recorder-js" {
  type RecorderOptions = {
    onAnalysed?: (data: Float32Array) => void;
  };

  export default class Recorder {
    constructor(context: AudioContext, config?: RecorderOptions);
    init(stream: MediaStream): Promise<void>;
    start(): void;
    stop(): Promise<{ blob: Blob; buffer: Float32Array[] }>;
    clear(): void;
  }
}
