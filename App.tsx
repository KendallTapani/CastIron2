import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import FeedScreen from './components/FeedScreen';
import { colors } from './constants/theme';

export default function App() {
  return (
    <View style={styles.container}>
      <FeedScreen />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
