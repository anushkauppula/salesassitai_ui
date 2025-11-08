import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
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
  const [isSpeaking, setIsSpeaking] = useState(false);

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
      // Stop any ongoing speech when component unmounts
      if (isSpeaking) {
        Speech.stop();
      }
    };
  }, [sound, isSpeaking]);

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

      const status = await recording.getStatusAsync();
      const duration = status.durationMillis ? status.durationMillis / 1000 : 0;

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

  const speakAnalysis = async () => {
    if (!analysis) return;
    
    try {
      if (isSpeaking) {
        // Stop current speech
        Speech.stop();
        setIsSpeaking(false);
      } else {
        // Start speaking
        setIsSpeaking(true);
        
        // Clean up the text for better speech
        const cleanText = analysis
          .replace(/\*\*/g, '') // Remove markdown bold
          .replace(/\*/g, '') // Remove markdown italic
          .replace(/#/g, '') // Remove markdown headers
          .replace(/\n\n/g, '. ') // Replace double newlines with periods
          .replace(/\n/g, ' ') // Replace single newlines with spaces
          .trim();
        
        // Try multiple approaches to force speaker output
        try {
          // Approach 1: Set audio mode for speaker output
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            interruptionModeAndroid: 1,
            interruptionModeIOS: 1,
          });
          
          // Wait for audio mode to be set
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Approach 2: Try with different audio session settings
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            interruptionModeAndroid: 1,
            interruptionModeIOS: 1,
          });
          
          // Additional wait
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (audioError) {
          console.log('Audio mode setting failed:', audioError);
        }
        
        // Try speech with multiple configurations
        try {
          await Speech.speak(cleanText, {
            language: 'en-US',
            pitch: 1.0,
            rate: 0.8,
            onStart: () => {
              console.log('Speech started - should be through speaker');
            },
            onDone: () => {
              setIsSpeaking(false);
              // Restore audio mode for recording
              Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
              });
            },
            onStopped: () => {
              setIsSpeaking(false);
              // Restore audio mode for recording
              Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
              });
            },
            onError: (error) => {
              console.error('Speech error:', error);
              setIsSpeaking(false);
              // Restore audio mode for recording
              Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
              });
              Alert.alert('Speech Error', 'Unable to read the analysis aloud. Please try again.');
            }
          });
        } catch (speechError) {
          console.error('Speech failed:', speechError);
          setIsSpeaking(false);
          Alert.alert('Speech Error', 'Unable to read the analysis aloud. Please try again.');
        }
      }
    } catch (error) {
      console.error('Speech error:', error);
      setIsSpeaking(false);
      Alert.alert('Speech Error', 'Unable to read the analysis aloud. Please try again.');
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
      
      formData.append('file', {
        uri: uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      
      console.log('Sending request to analyze recording...');
      console.log('User ID being sent:', user?.id);
      console.log('Audio file URI:', uri);
      console.log('Target URL: ' + process.env.BACKEND_URL +':8000/analyze_sales_call');
      
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        console.log('Request timed out after 60 seconds');
        controller.abort();
      }, 60000); // 60 second timeout
      
      console.log('Making fetch request...');
      console.log('FormData contents:');
      console.log('- file: audio/m4a recording');
      console.log('- user_id:', user?.id);
      
      const endpoints = [
        process.env.BACKEND_URL + `:8000/analyze_sales_call?user_id=${user?.id}`,
        `http://localhost:8000/analyze_sales_call?user_id=${user?.id}`,
        `http://127.0.0.1:8000/analyze_sales_call?user_id=${user?.id}`
      ];
      
      let response;
      let lastError;
      
      for (const endpoint of endpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
              // Don't set Content-Type - let fetch handle it for FormData
            },
            signal: controller.signal,
          });
          
          if (response.ok) {
            console.log(`Successfully connected to: ${endpoint}`);
            break;
          } else {
            console.log(`Endpoint ${endpoint} returned status: ${response.status}`);
          }
        } catch (error) {
          console.log(`Failed to connect to ${endpoint}:`, error instanceof Error ? error.message : 'Unknown error');
          lastError = error;
          continue;
        }
      }
      
      if (!response) {
        throw new Error(`Could not connect to any endpoint. Last error: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
      }
      
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
                'Make sure your backend server is running on:\n• IP: ' + process.env.BACKEND_URL + '\n• Port: 8000\n• Endpoint: /analyze_sales_call'
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
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>AI Sales Assistant</Text>
            <Text style={styles.headerSubtitle}>Transform conversations with AI insights</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="psychology" size={32} color="#fff" />
          </View>
        </View>
      </View>

      {/* Scrollable Body */}
      <ScrollView 
        style={styles.scrollableBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeHeader}>
            <MaterialIcons name="mic" size={28} color="#4a7eb7" />
            <Text style={styles.welcomeTitle}>Record Your Sales Call</Text>
          </View>
          <Text style={styles.welcomeDescription}>
            Capture your sales conversations and get instant AI-powered analysis to improve your performance
          </Text>
        </View>

        {/* Recording Status */}
        {currentRecordingTitle && (
          <View style={styles.recordingStatusCard}>
            <MaterialIcons name="fiber-manual-record" size={20} color="#f44336" />
            <Text style={styles.recordingStatusText}>{currentRecordingTitle}</Text>
          </View>
        )}

        {/* Recording Controls */}
        <View style={styles.controlsCard}>
          <Pressable
            style={[styles.recordButton, recording ? styles.recording : styles.notRecording]}
            onPress={recording ? stopRecording : startRecording}
          >
            <MaterialIcons name={recording ? 'stop' : 'fiber-manual-record'} size={28} color="#fff" />
            <Text style={styles.buttonText}>{recording ? 'Stop Recording' : 'Start Recording'}</Text>
          </Pressable>

          {recordedURI && (
            <View style={styles.playbackControls}>
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
              <ActivityIndicator size="large" color="#4a7eb7" />
              <Text style={styles.loadingText}>AI is analyzing your recording...</Text>
            </View>
          )}
        </View>

        {/* Analysis Results */}
        {analysis && (
          <View style={styles.analysisCard}>
            <View style={styles.analysisHeader}>
              <View style={styles.analysisTitleContainer}>
                <MaterialIcons name="insights" size={24} color="#4caf50" />
                <Text style={styles.analysisTitle}>AI Analysis</Text>
              </View>
              <View style={styles.speechControls}>
                <Pressable style={[styles.speechButton, isSpeaking && styles.speakingButton]} onPress={speakAnalysis}>
                  <MaterialIcons 
                    name={isSpeaking ? "stop" : "volume-up"} 
                    size={20} 
                    color={isSpeaking ? "#f44336" : "#4a7eb7"} 
                  />
                  <Text style={[styles.speechButtonText, { color: isSpeaking ? "#f44336" : "#4a7eb7" }]}>
                    {isSpeaking ? "Stop" : "Listen"}
                  </Text>
                </Pressable>
                
                <Pressable style={styles.speakerHintButton} onPress={() => {
                  Alert.alert(
                    'Speaker Output Issue',
                    'If you can only hear through the earpiece:\n\n1. Check device volume is up\n2. Make sure device is not on silent mode\n3. Try using headphones or external speaker\n4. Check device audio settings\n\nThis is a known limitation with some devices.',
                    [{ text: 'OK' }]
                  );
                }}>
                  <MaterialIcons name="help-outline" size={16} color="#666" />
                </Pressable>
              </View>
            </View>
            <ScrollView style={styles.analysisScrollArea}>
              <Text style={styles.analysisText}>{analysis}</Text>
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  // Fixed Header Styles
  fixedHeader: {
    backgroundColor: '#4a7eb7',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E3F2FD',
    lineHeight: 18,
  },
  headerIcon: {
    marginLeft: 16,
  },
  // Scrollable Body Styles
  scrollableBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Extra space for tab bar
  },
  // Welcome Card
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  // Recording Status
  recordingStatusCard: {
    backgroundColor: '#FFEBEE',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  recordingStatusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f44336',
    marginLeft: 12,
  },
  // Controls Card
  controlsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
  playbackControls: {
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
    color: '#4a7eb7',
    fontWeight: '500',
  },
  // Analysis Card
  analysisCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  analysisTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  analysisTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  speechControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speechButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4a7eb7',
  },
  speakingButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#f44336',
  },
  speechButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  speakerHintButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
});
