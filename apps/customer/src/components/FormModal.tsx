/** Bottom-sheet style form modal: title + fields + cancel/save actions. */
import React from 'react';
import { View } from 'react-native';
import { Modal, Portal, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { AppButton } from './AppButton';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  saving?: boolean;
  children: React.ReactNode;
}

export function FormModal({ visible, title, onClose, onSave, saveLabel = 'Save', saving = false, children }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={{
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          padding: 20,
          margin: 20,
          marginBottom: insets.bottom + 20,
        }}
      >
        <AppText variant="heading" style={{ marginBottom: 12 }}>
          {title}
        </AppText>
        {children}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <AppButton title="Cancel" variant="secondary" onPress={onClose} />
          </View>
          <View style={{ flex: 1 }}>
            <AppButton title={saving ? 'Saving…' : saveLabel} onPress={onSave} loading={saving} />
          </View>
        </View>
      </Modal>
    </Portal>
  );
}
