import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useRecordings } from '../context/RecordingContext';
import { Recording } from '../types/recording';

interface RecordingItemProps {
  recording: Recording;
}

export function RecordingItem({ recording }: RecordingItemProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(recording.title);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { deleteRecording, updateRecording } = useRecordings();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const playRecording = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
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
          { uri: recording.uri },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          setIsPlaying(status.isPlaying);

          if (status.didJustFinish) {
            newSound.unloadAsync();
            setSound(null);
            setIsPlaying(false);
          }
        });
      }
    } catch (error) {
      console.error('Error playing recording:', error);
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  const handleDelete = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      await deleteRecording(recording.id);
    } catch (error) {
      console.error('Error deleting recording:', error);
    }
  };

  const handleAnalyze = async () => {
    if (isAnalyzing) return;
    
    try {
      setIsAnalyzing(true);
      // Navigate to index page with recording info
      router.push({
        pathname: '/',
        params: { 
          recordingId: recording.id,
          recordingTitle: recording.title,
          recordingUri: recording.uri
        }
      });
    } catch (error) {
      console.error('Error analyzing recording:', error);
      Alert.alert('Error', 'Failed to analyze recording');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRename = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Title cannot be empty');
      return;
    }
    try {
      await updateRecording(recording.id, { title: newTitle.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error('Error renaming recording:', error);
      Alert.alert('Error', 'Failed to rename recording');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handlePress = () => {
    if (recording.transcription) {
      setIsExpanded(!isExpanded);
    } else {
      router.push({
        pathname: '/(tabs)',
        params: { recordingUri: recording.uri, recordingTitle: recording.title }
      });
    }
  };

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <MaterialIcons name="mic" size={24} color="#666" />
          <View style={styles.textContainer}>
            <ThemedText style={styles.title}>{recording.title}</ThemedText>
            <ThemedText style={styles.metadata}>
              {format(recording.timestamp, 'MMM d, yyyy h:mm a')} • {formatDuration(recording.duration)}
            </ThemedText>
          </View>
        </View>
        {recording.transcription && (
          <MaterialIcons 
            name={isExpanded ? 'expand-less' : 'expand-more'} 
            size={24} 
            color="#666" 
          />
        )}
      </View>

      {isExpanded && recording.transcription && (
        <View style={styles.expandedContent}>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Transcription</ThemedText>
            <ThemedText style={styles.content}>{recording.transcription}</ThemedText>
          </View>
          
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Analysis</ThemedText>
            <ThemedText style={styles.content}>{recording.analysis}</ThemedText>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  metadata: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  expandedContent: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
}); 