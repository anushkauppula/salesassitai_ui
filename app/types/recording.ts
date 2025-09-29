export interface Recording {
  id: string;
  uri: string;
  duration: number;
  timestamp: number;
  title: string;
  fileUrl?: string;
  transcription?: string;
  analysis?: string;
}

export interface RecordingContextType {
  recordings: Recording[];
  addRecording: (recording: Recording) => Promise<void>;
  deleteRecording: (id: string) => Promise<void>;
  updateRecording: (id: string, updates: Partial<Recording>) => Promise<void>;
  getRecording: (id: string) => Recording | undefined;
} 