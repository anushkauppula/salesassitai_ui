import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0a7ea4" />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#0a7ea4',
  },
}); 