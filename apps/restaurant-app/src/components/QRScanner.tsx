/** Full-screen QR scanner sheet for pickup verification.
 *  Passes the raw scanned string up — the server accepts both the plain
 *  #FD-xxxx order number and the JSON payload the customer app displays. */
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from 'react-native-paper';
import { AppText } from './AppText';
import { AppButton } from './AppButton';

interface Props {
  visible: boolean;
  orderNumber: string;
  onClose: () => void;
  onScan: (data: string) => void;
}

export function QRScanner({ visible, orderNumber, onClose, onScan }: Props) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [asking, setAsking] = useState(false);
  const locked = useRef(false);

  useEffect(() => {
    if (visible) locked.current = false;
  }, [visible]);

  const granted = permission?.granted;

  const ask = async () => {
    setAsking(true);
    try {
      await requestPermission();
    } finally {
      setAsking(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: '#000' }]}>
        {granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (locked.current) return;
              locked.current = true;
              onScan(typeof data === 'string' ? data : String(data));
            }}
          />
        ) : (
          <View style={styles.center}>
            <AppText variant="subheading" style={{ color: '#fff', textAlign: 'center' }}>
              Camera access is needed to scan pickup codes
            </AppText>
            <AppButton title="Grant camera access" onPress={ask} loading={asking} style={{ marginTop: 16 }} />
          </View>
        )}

        {/* Viewfinder overlay */}
        {granted && (
          <View style={styles.overlay} pointerEvents="none">
            <View style={[styles.frame, { borderColor: theme.colors.primary }]} />
            <AppText variant="bodyBold" style={{ color: '#fff', marginTop: 16, textAlign: 'center' }}>
              Scan {orderNumber}'s QR
            </AppText>
            <AppText variant="caption" style={{ color: '#ddd', marginTop: 4, textAlign: 'center' }}>
              Point the camera at the customer's code
            </AppText>
          </View>
        )}

        <View style={styles.footer}>
          <AppButton title="Cancel" variant="outline" onPress={onClose} style={{ minWidth: 160 }} />
        </View>
      </View>
    </Modal>
  );
}

const FRAME = 240;

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  frame: {
    width: FRAME,
    height: FRAME,
    borderWidth: 3,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
