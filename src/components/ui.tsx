import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import {
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatElapsed } from '../lib/format';
import { useConnection, type ConnectionStatus } from '../state/connection';
import { makeStyles, radius, space, text, useTheme } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// --------------------------------------------------------------------------
// Layout
// --------------------------------------------------------------------------

interface ScreenProps {
  children: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  refreshControl?: ReactElement<RefreshControlProps>;
}

export function Screen({ children, scrollRef, refreshControl }: ScreenProps) {
  const s = useStyles();
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      {/* Android too: with edge-to-edge the window no longer shrinks for the
          keyboard, which then covers the crawl URL field on the Library tab. */}
      <KeyboardAvoidingView style={s.flex} behavior="padding">
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  none: 'Not connected',
  checking: 'Checking…',
  online: 'Connected',
  unauthorized: 'Token rejected',
  offline: 'Offline',
};

export function StatusPill() {
  const s = useStyles();
  const c = useTheme();
  const { status } = useConnection();
  const color =
    status === 'online' ? c.online : status === 'checking' ? c.textFaint : c.offline;
  return (
    <Pressable
      onPress={() => router.navigate('/library')}
      style={({ pressed }) => [s.pill, pressed && s.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Server status: ${STATUS_LABEL[status]}. Open connection settings.`}
      hitSlop={8}
    >
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.pillText}>{STATUS_LABEL[status]}</Text>
    </Pressable>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const s = useStyles();
  return (
    <View style={s.header}>
      <View style={s.headerRow}>
        <Text style={s.title} accessibilityRole="header">
          {title}
        </Text>
        <StatusPill />
      </View>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

// --------------------------------------------------------------------------
// Controls
// --------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  accessibilityLabel,
}: ButtonProps) {
  const s = useStyles();
  const c = useTheme();
  const inactive = disabled || loading;
  const fg = {
    primary: c.accentText,
    secondary: c.text,
    ghost: c.accent,
    danger: c.danger,
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        s.button,
        compact && s.buttonCompact,
        s[`button_${variant}`],
        pressed && s.pressed,
        inactive && s.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Ionicons name={icon} size={compact ? 16 : 18} color={fg} />
      ) : null}
      <Text style={[s.buttonText, compact && s.buttonTextCompact, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
}

export function Chip({ label, selected, onPress, disabled = false, icon }: ChipProps) {
  const s = useStyles();
  const c = useTheme();
  const color = selected ? c.accent : c.textMuted;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.chip,
        selected && s.chipSelected,
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={color} /> : null}
      <Text style={[s.chipText, { color }]}>{label}</Text>
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  icon?: IconName;
  label?: string;
  onClear?: () => void;
  secret?: boolean;
}

export function Field({ icon, label, onClear, secret = false, style, ...input }: FieldProps) {
  const s = useStyles();
  const c = useTheme();
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={s.fieldWrap}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <View style={s.field}>
        {icon ? <Ionicons name={icon} size={18} color={c.textFaint} /> : null}
        <TextInput
          placeholderTextColor={c.textFaint}
          selectionColor={c.accent}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secret && !revealed}
          accessibilityLabel={label ?? input.placeholder}
          {...input}
          style={[s.input, style]}
        />
        {secret ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide token' : 'Show token'}
          >
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.textFaint} />
          </Pressable>
        ) : onClear && input.value ? (
          <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear">
            <Ionicons name="close-circle" size={18} color={c.textFaint} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// --------------------------------------------------------------------------
// Feedback
// --------------------------------------------------------------------------

type BannerKind = 'error' | 'notice' | 'info';

interface BannerProps {
  kind?: BannerKind;
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
}

export function Banner({ kind = 'error', title, message, action }: BannerProps) {
  const s = useStyles();
  const c = useTheme();
  const tone = {
    error: { bg: c.dangerSoft, fg: c.danger, icon: 'alert-circle' as IconName },
    notice: { bg: c.warningSoft, fg: c.warning, icon: 'information-circle' as IconName },
    info: { bg: c.accentSoft, fg: c.accent, icon: 'information-circle' as IconName },
  }[kind];
  return (
    <View style={[s.banner, { backgroundColor: tone.bg }]} accessibilityRole="alert">
      <Ionicons name={tone.icon} size={20} color={tone.fg} />
      <View style={s.flex}>
        {title ? <Text style={[s.bannerTitle, { color: tone.fg }]}>{title}</Text> : null}
        <Text style={s.bannerText}>{message}</Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8}>
            <Text style={[s.bannerAction, { color: tone.fg }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const s = useStyles();
  const c = useTheme();
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={28} color={c.accent} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {message ? <Text style={s.emptyText}>{message}</Text> : null}
      {action ? <Button title={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </View>
  );
}

interface WaitingProps {
  label: string;
  elapsedMs: number;
  hint?: string;
  onCancel?: () => void;
}

/** Progress for the slow calls, which can take a minute when a model is involved. */
export function Waiting({ label, elapsedMs, hint, onCancel }: WaitingProps) {
  const s = useStyles();
  const c = useTheme();
  return (
    <Card style={s.waiting}>
      <View style={s.waitingRow}>
        <ActivityIndicator color={c.accent} />
        <Text style={s.waitingLabel} accessibilityLiveRegion="polite">
          {label} <Text style={s.waitingTime}>{formatElapsed(elapsedMs)}</Text>
        </Text>
        {onCancel ? (
          <Button title="Cancel" onPress={onCancel} variant="ghost" compact icon="stop-circle-outline" />
        ) : null}
      </View>
      {hint ? <Text style={s.waitingHint}>{hint}</Text> : null}
    </Card>
  );
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const useStyles = makeStyles((c) => StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },

  header: { gap: space.xs, marginBottom: space.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { fontSize: text.title, fontWeight: '700', color: c.text, letterSpacing: -0.5 },
  subtitle: { fontSize: text.small, color: c.textMuted },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: text.tiny, fontWeight: '600', color: c.textMuted },

  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: space.lg,
    gap: space.md,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: {
    fontSize: text.tiny,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 46,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  buttonCompact: { minHeight: 34, paddingHorizontal: space.md },
  button_primary: { backgroundColor: c.accent },
  button_secondary: { backgroundColor: c.surfaceAlt },
  button_ghost: { backgroundColor: 'transparent' },
  button_danger: { backgroundColor: c.dangerSoft },
  buttonText: { fontSize: text.body, fontWeight: '600' },
  buttonTextCompact: { fontSize: text.small },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipSelected: { borderColor: c.accent, backgroundColor: c.accentSoft },
  chipText: { fontSize: text.small, fontWeight: '600' },

  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: text.small, fontWeight: '600', color: c.textMuted },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: text.body, color: c.text, paddingVertical: space.md },

  banner: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md },
  bannerTitle: { fontSize: text.small, fontWeight: '700', marginBottom: 2 },
  bannerText: { fontSize: text.small, color: c.text, lineHeight: 20 },
  bannerAction: { fontSize: text.small, fontWeight: '700', marginTop: space.sm },

  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentSoft,
  },
  emptyTitle: { fontSize: text.h2, fontWeight: '700', color: c.text, textAlign: 'center' },
  emptyText: { fontSize: text.small, color: c.textMuted, textAlign: 'center', lineHeight: 20 },

  waiting: { gap: space.sm },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  waitingLabel: { flex: 1, fontSize: text.body, fontWeight: '600', color: c.text },
  waitingTime: { fontWeight: '400', color: c.textMuted, fontVariant: ['tabular-nums'] },
  waitingHint: { fontSize: text.small, color: c.textMuted, lineHeight: 20 },
}));
