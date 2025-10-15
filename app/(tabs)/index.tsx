import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRecordings } from '../context/RecordingContext';

// Academic helper functions
const formatAcademicRecommendations = (data: any): string => {
  if (!data.recommendations) {
    return data.analysis || data.summary || 'No recommendations available.';
  }

  const { recommendations } = data;
  // If the server returns a single string for recommendations, return it directly
  if (typeof recommendations === 'string') {
    return recommendations;
  }
  let formattedText = '🎓 **Your Academic Path Recommendations**\n\n';

  // Format majors
  if (recommendations.majors && recommendations.majors.length > 0) {
    formattedText += '**🎯 Recommended Majors:**\n\n';
    recommendations.majors.forEach((major: any, index: number) => {
      formattedText += `${index + 1}. **${major.name}**\n`;
      if (major.description) {
        formattedText += `   ${major.description}\n`;
      }
      if (major.career_paths && major.career_paths.length > 0) {
        formattedText += `   🚀 **Career Paths:** ${major.career_paths.join(', ')}\n`;
      }
      formattedText += '\n';
    });
  }

  // Format minors
  if (recommendations.minors && recommendations.minors.length > 0) {
    formattedText += '\n**📚 Suggested Minors:**\n';
    recommendations.minors.forEach((minor: any, index: number) => {
      formattedText += `${index + 1}. ${minor.name}\n`;
    });
    formattedText += '\n';
  }

  // Format career guidance
  if (recommendations.career_guidance) {
    formattedText += '\n**💡 Career Guidance:**\n';
    formattedText += recommendations.career_guidance + '\n\n';
  }

  return formattedText;
};

const isValidAcademicResponse = (data: any): boolean => {
  return (
    data &&
    (data.recommendations ||
      data.analysis ||
      data.summary ||
      data.transcription ||
      data.text)
  );
};

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
      
      // First, test if server is reachable at all
      try {
        const healthCheck = await fetch('http://10.34.102.133:8000/', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        console.log(`Server health check: ${healthCheck.status}`);
      } catch (error) {
        console.log('Server health check failed:', error);
        Alert.alert(
          'Server Not Reachable',
          `Cannot connect to server at http://10.34.102.133:8000\n\nPlease check:\n1. Server is running\n2. IP address is correct\n3. Network connection`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Try different common endpoints (prioritizing new academic endpoints)
      const endpointsToTry = [
        'http://10.34.102.133:8000/explore_majors',
        'http://10.34.102.133:8000/analyze_sales_call', // Legacy support
        'http://10.34.102.133:8000/analyze',
        'http://10.34.102.133:8000/transcribe',
        'http://10.34.102.133:8000/api/explore_majors',
        'http://10.34.102.133:8000/api/analyze',
        'http://10.34.102.133:8000/v1/explore_majors',
      ];
      
      let response: Response | null = null;
      let workingEndpoint = '';
      
      for (const endpoint of endpointsToTry) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'multipart/form-data',
            },
          });
          
          if (response.ok) {
            console.log(`✅ Success with endpoint: ${endpoint}`);
            workingEndpoint = endpoint;
            // Show success message for academic endpoint
            if (endpoint.includes('explore_majors')) {
              console.log('🎓 Using new academic majors exploration endpoint!');
            }
            break;
          } else if (response.status === 404) {
            console.log(`❌ 404 for endpoint: ${endpoint}`);
            continue;
          } else {
            console.log(`⚠️ ${response.status} for endpoint: ${endpoint}`);
            workingEndpoint = endpoint;
            break; // Try this one even if not 200, might be a different error
          }
        } catch (error) {
          console.log(`❌ Error with endpoint ${endpoint}:`, error);
          continue;
        }
      }
      
      if (!response) {
        Alert.alert(
          'No Working Endpoint Found',
          `Tried multiple endpoints but none worked:\n\n${endpointsToTry.join('\n')}\n\nPlease check:\n1. Server is running\n2. Correct endpoint name\n3. Server accepts POST requests`,
          [{ text: 'OK' }]
        );
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        
        if (errorText.includes('storage3.exceptions.StorageApiError') || errorText.includes('Bucket not found')) {
          Alert.alert(
            'Storage Configuration Error',
            'The server cannot save the recording because the storage bucket is not configured properly.\n\nError: Supabase bucket "academic-audio-files" not found.\n\nPlease check your server configuration.',
            [{ text: 'OK' }]
          );
        } else if (errorText.includes('Error retrieving context')) {
          Alert.alert(
            'AI Context Error',
            'The AI assistant is having trouble accessing its knowledge base.\n\nError: Context retrieval failed\n\nThis might be a temporary issue. Please try again in a few moments.',
            [
              { text: 'OK', style: 'default' },
              { text: 'Retry', style: 'default', onPress: () => sendAudioForTranscription(uri) }
            ]
          );
        } else if (response.status === 500) {
          Alert.alert(
            'Server Processing Error',
            `The server encountered an error while processing your request.\n\nError: ${errorText}\n\nThis might be a temporary issue. Please try again.`,
            [
              { text: 'OK', style: 'default' },
              { text: 'Retry', style: 'default', onPress: () => sendAudioForTranscription(uri) }
            ]
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

      // Handle academic response format
      if (isValidAcademicResponse(data)) {
        const formattedRecommendations = formatAcademicRecommendations(data);
        setAnalysis(formattedRecommendations);
      }

      // Set transcription if available
      if (data.transcription) {
        setTranscription(data.transcription);
      } else if (data.text) {
        setTranscription(data.text);
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
        <Text style={styles.title}>🎓 Majors Exploration Assistant</Text>
        <Text style={styles.subtitle}>
          Share your interests, goals, and aspirations to discover your ideal academic path
        </Text>
        {currentRecordingTitle && (
          <Text style={styles.recordingTitle}>{currentRecordingTitle}</Text>
        )}

        <Pressable
          style={[styles.recordButton, recording ? styles.recording : styles.notRecording]}
          onPress={recording ? stopRecording : startRecording}
        >
          <MaterialIcons name={recording ? 'stop' : 'fiber-manual-record'} size={28} color="#fff" />
          <Text style={styles.buttonText}>{recording ? 'Stop Recording' : 'Start Exploring'}</Text>
        </Pressable>

        <Text style={styles.promptText}>
          {recording 
            ? "🎤 Tell us about your interests, career goals, and what subjects you enjoy..." 
            : "Tap the button above to start exploring your academic path!"
          }
        </Text>

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
                    <Text style={styles.buttonText}>Explore Majors</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Exploring your academic path...</Text>
          </View>
        )}

        {analysis && (
          <View style={styles.transcriptionCard}>
            <Text style={styles.summaryTitle}>🎯 Your Academic Path Recommendations</Text>
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
    backgroundColor: '#2E7D32', // Academic green
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
    backgroundColor: '#f1f8e9', // Light academic green
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#C8E6C9', // Academic green border
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
    color: '#2E7D32', // Academic green
    textAlign: 'center',
  },
  transcriptionText: {
    fontSize: 16,
    color: '#212121',
    lineHeight: 26,
    textAlign: 'left',
    padding: 10,
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
    color: '#2E7D32', // Academic green
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  promptText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
}); 