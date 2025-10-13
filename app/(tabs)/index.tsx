import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRecordings } from '../context/RecordingContext';

export default function App() {
  const params = useLocalSearchParams();
  const { updateRecording, addRecording } = useRecordings();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedURI, setRecordedURI] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [currentRecordingTitle, setCurrentRecordingTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (params.recordingUri) {
      setRecordedURI(params.recordingUri as string);
      setCurrentRecordingTitle(params.recordingTitle as string);
      sendAudioForTranscription(params.recordingUri as string);
    }
  }, [params.recordingUri, params.recordingTitle]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission to access microphone is required!');
        return;
      }

      // Clear previous recording states
      setCurrentRecordingTitle(null);
      setTranscription(null);
      setAnalysis(null);
      setRecordedURI(null);
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      setIsPlaying(false);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedURI(uri ?? null);
      setRecording(null);

      // Get recording duration
      const status = await recording.getStatusAsync();
      const duration = status.durationMillis ? status.durationMillis / 1000 : 0;

      // Save recording to storage
      if (uri) {
        const recordingId = `rec_${Date.now()}`;
        await addRecording({
          id: recordingId,
          uri,
          duration,
          timestamp: Date.now(),
          title: `Recording ${new Date().toLocaleString()}`,
        });
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  const playPauseRecording = async () => {
    if (!sound) {
      if (!recordedURI) return;

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeAndroid: 1,
          interruptionModeIOS: 1,
        });

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: recordedURI },
          { shouldPlay: false }
        );

        setSound(newSound);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          setIsPlaying(status.isPlaying);

          if (status.didJustFinish) {
            newSound.unloadAsync();
            setSound(null);
            setIsPlaying(false);
          }
        });

        await newSound.playAsync();
        setIsPlaying(true);
      } catch (error) {
        console.error('Playback failed:', error);
        setIsPlaying(false);
      }
    } else {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      if (status.isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    }
  };

  const sendAudioForTranscription = async (uri: string) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      setIsSending(true);
      setTranscription(null);
      setAnalysis(null);

      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: 'audio/x-m4a',
        name: 'recording.m4a',
      } as any);

      console.log('Sending request to analyze recording...');
      const response = await fetch('http://192.168.1.157:8000/analyze_sales_call', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        
        if (errorText.includes('storage3.exceptions.StorageApiError')) {
          Alert.alert(
            'Storage Error',
            'Failed to upload recording. Please try again.'
          );
        } else {
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        return;
      }

      const data = await response.json();
      console.log('Received response data:', data);
      
      // Check if we have either transcription or analysis
      if (!data) {
        throw new Error('Empty response from server');
      }

      // Set transcription if available
      if (data.transcription) {
        setTranscription(data.transcription);
      } else if (data.text) {
        // Some APIs return 'text' instead of 'transcription'
        setTranscription(data.text);
      }

      // Set analysis if available
      if (data.analysis) {
        setAnalysis(data.analysis);
      } else if (data.summary) {
        // Some APIs return 'summary' instead of 'analysis'
        setAnalysis(data.summary);
      }

      // Get file URL if available
      const fileUrl = data.file_url || data.fileUrl || data.url || data.audio_url;

      // Update the recording in context with the new data
      if (!params.recordingUri) {
        const recordingId = `rec_${Date.now()}`;
        await updateRecording(recordingId, {
          fileUrl: fileUrl,
          transcription: data.transcription || data.text || '',
          analysis: data.analysis || data.summary || '',
        });
      }
    } catch (error) {
      console.error('Error sending audio:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      Alert.alert(
        'Error',
        'Failed to analyze recording. Please try again.'
      );
    } finally {
      setIsLoading(false);
      setIsSending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>AI Assistant for Sales</Text>
        {currentRecordingTitle && (
          <Text style={styles.recordingTitle}>{currentRecordingTitle}</Text>
        )}

        <Pressable
          style={[styles.recordButton, recording ? styles.recording : styles.notRecording]}
          onPress={recording ? stopRecording : startRecording}
        >
          <MaterialIcons name={recording ? 'stop' : 'fiber-manual-record'} size={28} color="#fff" />
          <Text style={styles.buttonText}>{recording ? 'Stop' : 'Record'}</Text>
        </Pressable>

        {recordedURI && (
          <View style={styles.playback}>
            <Pressable style={styles.playButton} onPress={playPauseRecording}>
              <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={30} color="#fff" />
              <Text style={styles.buttonText}>{isPlaying ? 'Playing...' : 'Play'}</Text>
            </Pressable>

            {!params.recordingUri && (
              <Pressable
                style={[styles.sendButton, isSending ? styles.sending : null]}
                onPress={() => sendAudioForTranscription(recordedURI)}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Send</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0a7ea4" />
            <Text style={styles.loadingText}>Analyzing recording...</Text>
          </View>
        )}

        {analysis && (
          <View style={styles.transcriptionCard}>
            <Text style={styles.summaryTitle}>Summary and Tips</Text>
            <ScrollView style={styles.scrollArea}>
              <Text style={styles.transcriptionText}>{analysis}</Text>
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  recordingTitle: {
    fontSize: 16,
    marginBottom: 10,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 30,
    marginBottom: 20,
  },
  recording: {
    backgroundColor: '#dc3545',
  },
  notRecording: {
    backgroundColor: '#0a7ea4',
  },
  buttonText: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 16,
  },
  playback: {
    marginTop: 30,
    alignItems: 'center',
  },
  transcriptionCard: {
    marginTop: 40,
    backgroundColor: '#f0f4ff',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#c0c7ff',
  },
  transcriptionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#3b4cca',
    textAlign: 'center',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#009688',
    textAlign: 'center',
  },
  transcriptionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'left',
  },
  scrollArea: {
    maxHeight: 200,
  },
  playButton: {
    flexDirection: 'row',
    backgroundColor: '#2196f3',
    padding: 12,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    width: 180,
    alignSelf: 'center',
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: '#673ab7',
    padding: 12,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    width: 180,
    alignSelf: 'center',
  },
  sending: {
    opacity: 0.7,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#0a7ea4',
  },
});
