import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRecordings } from '../context/RecordingContext';

export default function App() {
  const params = useLocalSearchParams();
  const { updateRecording, addRecording } = useRecordings();
  const { user } = useAuth();
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

  const testConnection = async () => {
    try {
      console.log('Testing connection to: http://192.168.1.213:8000/health');
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timed out');
        controller.abort();
      }, 10000); // 10 second timeout
      
      const response = await fetch('http://192.168.1.213:8000/health', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('Response received:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);
        Alert.alert('Connection Test', '✅ Server is reachable!');
      } else {
        Alert.alert('Connection Test', `⚠️ Server responded with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Connection test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Connection Test', `❌ Connection failed: ${errorMessage}`);
    }
  };

  const sendAudioForTranscription = async (uri: string) => {
    if (isLoading) return;
    
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    try {
      setIsLoading(true);
      setIsSending(true);
      setTranscription(null);
      setAnalysis(null);

      const formData = new FormData();
      
      // Add the audio file with proper format for your backend
      formData.append('file', {
        uri: uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);

      console.log('Sending request to analyze recording...');
      console.log('User ID being sent:', user?.id);
      console.log('Audio file URI:', uri);
      console.log('Target URL: http://192.168.1.213:8000/analyze_sales_call');
      
      // Create AbortController for timeout
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        console.log('Request timed out after 60 seconds');
        controller.abort();
      }, 60000); // 60 second timeout
      
      console.log('Making fetch request...');
      
      const response = await fetch('http://192.168.1.213:8000/analyze_sales_call?user_id=' + user?.id, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          // Don't set Content-Type - let fetch handle it for FormData
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Received analysis data:', data);
      console.log('Analysis completed successfully for user:', user?.id);
      console.log('Transcription length:', data.transcription?.length || 0);
      console.log('Analysis length:', data.analysis?.length || 0);
      
      if (!data.transcription || !data.analysis) {
        throw new Error('Invalid response format from server');
      }

      setTranscription(data.transcription);
      setAnalysis(data.analysis);
    } catch (error) {
      console.error('Error sending audio:', error);
      
      // Clear timeout if request failed
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      let errorMessage = 'Failed to analyze recording. Please try again.';
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMsg.includes('Network request failed')) {
        errorMessage = 'Network connection failed. Please check your internet connection and ensure the backend server is running.';
      } else if (errorMsg.includes('Could not connect')) {
        errorMessage = 'Unable to connect to the analysis server. Please check if the backend server is running on the correct IP address.';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('AbortError')) {
        errorMessage = 'Request timed out. The server may be processing a large file. Please try again.';
      }
      
      Alert.alert(
        'Connection Error',
        errorMessage,
        [
          { text: 'OK' },
          { 
            text: 'Check Server', 
            onPress: () => {
              Alert.alert(
                'Server Information',
                'Make sure your backend server is running on:\n• IP: 192.168.1.213\n• Port: 8000\n• Endpoint: /analyze_sales_call'
              );
            }
          }
        ]
      );
    } finally {
      setIsLoading(false);
      setIsSending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>AI Assistant for Sales</Text>
          <Text style={styles.headerSubtitle}>Transform your sales conversations with AI-powered insights</Text>
        </View>

        {/* Main Content Card */}
        <View style={styles.mainCard}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome to Your Sales AI</Text>
            <Text style={styles.welcomeDescription}>
              Record your sales calls and get instant AI analysis to improve your performance
            </Text>
            
            {/* Debug Test Button */}
            <Pressable style={styles.testButton} onPress={testConnection}>
              <MaterialIcons name="wifi" size={20} color="#007AFF" />
              <Text style={styles.testButtonText}>Test Server Connection</Text>
            </Pressable>
          </View>
          
          {currentRecordingTitle && (
            <View style={styles.recordingInfoCard}>
              <MaterialIcons name="mic" size={20} color="#4caf50" />
              <Text style={styles.recordingTitle}>{currentRecordingTitle}</Text>
            </View>
          )}

          {/* Recording Controls */}
          <View style={styles.recordingSection}>
            <Pressable
              style={[styles.recordButton, recording ? styles.recording : styles.notRecording]}
              onPress={recording ? stopRecording : startRecording}
            >
              <MaterialIcons name={recording ? 'stop' : 'fiber-manual-record'} size={28} color="#fff" />
              <Text style={styles.buttonText}>{recording ? 'Stop Recording' : 'Start Recording'}</Text>
            </Pressable>

            {recordedURI && (
              <View style={styles.playbackSection}>
                <Pressable style={styles.playButton} onPress={playPauseRecording}>
                  <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={24} color="#fff" />
                  <Text style={styles.buttonText}>{isPlaying ? 'Playing...' : 'Play Recording'}</Text>
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
                        <MaterialIcons name="send" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Analyze with AI</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            )}

            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>AI is analyzing your recording...</Text>
              </View>
            )}

            {analysis && (
              <View style={styles.analysisCard}>
                <View style={styles.analysisHeader}>
                  <MaterialIcons name="insights" size={24} color="#4caf50" />
                  <Text style={styles.analysisTitle}>AI Analysis</Text>
                </View>
                <ScrollView style={styles.analysisScrollArea}>
                  <Text style={styles.analysisText}>{analysis}</Text>
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerSection: {
    backgroundColor: '#007AFF',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E3F2FD',
    textAlign: 'center',
    lineHeight: 22,
  },
  mainCard: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  recordingInfoCard: {
    backgroundColor: '#E8F5E8',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  recordingSection: {
    alignItems: 'center',
  },
  recordButton: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  notRecording: {
    backgroundColor: '#4caf50',
  },
  recording: {
    backgroundColor: '#f44336',
  },
  playbackSection: {
    width: '100%',
    marginTop: 20,
    gap: 12,
  },
  playButton: {
    flexDirection: 'row',
    backgroundColor: '#2196f3',
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: '#673ab7',
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sending: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  analysisCard: {
    marginTop: 24,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  analysisTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  analysisScrollArea: {
    maxHeight: 300,
  },
  analysisText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'left',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4caf50',
    marginLeft: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
    alignSelf: 'center',
  },
  testButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});
