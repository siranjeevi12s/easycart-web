/** Quantity stepper: − qty + pill used in cart rows. */
import { View } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { AppText } from './AppText';

interface Props {
  quantity: number;
  onChange: (delta: number) => void;
  small?: boolean;
}

export function QtyStepper({ quantity, onChange, small = false }: Props) {
  const theme = useTheme();
  const size = small ? 26 : 32;
  return (
    <View
      accessible
      accessibilityLabel={`Quantity ${quantity}`}
      style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: 999,
      padding: 2,
      }}
    >
      <IconButton
        icon="minus"
        size={small ? 14 : 16}
        onPress={() => onChange(-1)}
        style={{ margin: 0, width: size, height: size }}
        accessibilityLabel="Decrease quantity"
      />
      <AppText variant="bodyBold" style={{ paddingHorizontal: 8, minWidth: 28, textAlign: 'center' }}>
        {quantity}
      </AppText>
      <IconButton
        icon="plus"
        size={small ? 14 : 16}
        onPress={() => onChange(1)}
        style={{ margin: 0, width: size, height: size }}
        accessibilityLabel="Increase quantity"
      />
    </View>
  );
}
