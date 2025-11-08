import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = React.useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/login');
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. Are you sure you want to delete your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            Alert.alert('Feature Coming Soon', 'Account deletion will be available in a future update.');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSubtitle}>Manage your account settings</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="person" size={32} color="#fff" />
          </View>
        </View>
      </View>

      {/* Scrollable Body */}
      <ScrollView 
        style={styles.scrollableBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.userInfo}>
            <View style={styles.avatarContainer}>
              <MaterialIcons name="account-circle" size={60} color="#4a7eb7" />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{(user?.email || 'Guest').split('@')[0]}</Text>
              <Text style={styles.userEmail}>{user?.email || 'Not logged in'}</Text>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.settingsCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="settings" size={20} color="#4a7eb7" />
            <Text style={styles.sectionTitle}>Settings</Text>
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="notifications" size={24} color="#666" />
              <Text style={styles.settingLabel}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#E5E5E7', true: '#4a7eb7' }}
              thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="dark-mode" size={24} color="#666" />
              <Text style={styles.settingLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
              trackColor={{ false: '#E5E5E7', true: '#4a7eb7' }}
              thumbColor={darkModeEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.accountCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="account-box" size={20} color="#4a7eb7" />
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="edit" size={24} color="#666" />
              <Text style={styles.settingLabel}>Edit Profile</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="lock" size={24} color="#666" />
              <Text style={styles.settingLabel}>Change Password</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.supportCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="help" size={20} color="#4a7eb7" />
            <Text style={styles.sectionTitle}>Support</Text>
          </View>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="policy" size={24} color="#666" />
              <Text style={styles.settingLabel}>Privacy Policy</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="help-center" size={24} color="#666" />
              <Text style={styles.settingLabel}>Help & Support</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="warning" size={20} color="#f44336" />
            <Text style={[styles.sectionTitle, { color: '#f44336' }]}>Danger Zone</Text>
          </View>
          
          <TouchableOpacity style={styles.dangerItem} onPress={handleDeleteAccount}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="delete-forever" size={24} color="#f44336" />
              <Text style={[styles.settingLabel, { color: '#f44336' }]}>Delete Account</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={24} color="#fff" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
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
  // User Card
  userCard: {
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
  },
  // Cards
  settingsCard: {
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
  accountCard: {
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
  supportCard: {
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
  dangerCard: {
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
    borderLeftColor: '#f44336',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#f44336',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
