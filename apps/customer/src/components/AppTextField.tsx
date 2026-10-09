/** Text input primitive: Paper outlined field with label + error support. */
import { TextInput as PaperInput } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  lines?: number;
  error?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppTextField({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  lines,
  error,
  disabled = false,
  style,
}: Props) {
  return (
    <PaperInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={secure}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
      numberOfLines={lines}
      error={!!error}
      disabled={disabled}
      mode="outlined"
      style={[{ marginBottom: 12 }, style]}
      accessibilityLabel={label}
    />
  );
}
