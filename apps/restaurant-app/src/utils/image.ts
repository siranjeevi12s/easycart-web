/** Gallery picker → data-URL string the API accepts (same as web file upload). */
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB, mirrors web Menu upload guard

export async function pickGalleryImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow gallery access to choose a photo.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const bytes = a.fileSize ?? (a.base64 ? Math.floor(a.base64.length * 0.75) : 0);
  if (bytes > MAX_BYTES) {
    Alert.alert('Too large', 'Please choose an image under 2MB.');
    return null;
  }
  if (!a.base64) {
    Alert.alert('Failed', 'Could not read image data — try another photo.');
    return null;
  }
  return `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}`;
}
