import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, ActivityIndicator, TouchableOpacity } from 'react-native';
import { styles, OVAL_H } from './CameraStyles';
import { type LivenessState } from '../../services/LivenessHeuristics';
import { type FaceBounds } from '../../native/NativeFacePipeline';
import { type BiometricRecord } from '../../services/BiometricStore';

export interface CameraOverlayProps {
  phase: string;
  statusText: string;
  inferenceMs: number | null;
  metricsDisplay: {
    ear: string;
    mar: string;
    yaw: string;
    faceDetected: boolean;
    coordVariance: string;
  };
  livenessState: LivenessState;
  faceBounds: FaceBounds | null;
  useNative: boolean;
  mode: 'register' | 'authenticate';
  userName?: string;
  mockRegisteredUsers: BiometricRecord[];
  mockUserIndex: number;
  onCycleMockUser: () => void;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({
  phase,
  statusText,
  inferenceMs,
  metricsDisplay,
  livenessState,
  faceBounds,
  useNative,
  mode,
  userName,
  mockRegisteredUsers,
  mockUserIndex,
  onCycleMockUser,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanLineY = useRef(new Animated.Value(0)).current;
  const statusOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (phase !== 'liveness' && phase !== 'processing') return;
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(scanLineY, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    sweep.start();
    return () => sweep.stop();
  }, [phase, scanLineY]);

  useEffect(() => {
    Animated.timing(statusOpacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [statusText, statusOpacity]);

  const phaseColor =
    phase === 'success' ? '#06D6A0' :
    phase === 'failed'  ? '#DC2626' :
    phase === 'spoof'   ? '#DC2626' :
    phase === 'processing' ? '#FFD644' :
    livenessState.noFaceDetected ? '#F97316' :
    '#48CAE4';

  const statusBg =
    phase === 'success'    ? 'rgba(6,214,160,0.85)' :
    phase === 'failed'     ? 'rgba(220,38,38,0.85)' :
    phase === 'spoof'      ? 'rgba(220,38,38,0.95)' :
    phase === 'processing' ? 'rgba(255,214,68,0.85)' :
    livenessState.noFaceDetected ? 'rgba(249,115,22,0.85)' :
    'rgba(11,19,43,0.85)';

  const scanTranslate = scanLineY.interpolate({
    inputRange: [0, 1],
    outputRange: [-OVAL_H / 2, OVAL_H / 2],
  });

  const completedSteps = livenessState.steps.filter((s: any) => s.completed).length;
  const totalSteps = livenessState.steps.length;
  const livenessProgress = totalSteps > 0 ? completedSteps / totalSteps : 0;

  return (
    <>
      {/* ── Dark overlays ── */}
      <View style={styles.overlayTop} pointerEvents="none" />
      <View style={styles.overlayBottom} pointerEvents="none" />
      <View style={styles.overlayLeft} pointerEvents="none" />
      <View style={styles.overlayRight} pointerEvents="none" />

      {/* ── Face oval / Dynamic Bounding Box + scan line ── */}
      <View style={styles.ovalWrapper} pointerEvents="none">
        {faceBounds && useNative ? (
          <Animated.View
            style={[
              styles.dynamicBox,
              {
                left: faceBounds.x,
                top: faceBounds.y,
                width: faceBounds.width,
                height: faceBounds.height,
                borderColor: phaseColor,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <View style={[styles.corner, styles.cTL, { borderColor: phaseColor }]} />
            <View style={[styles.corner, styles.cTR, { borderColor: phaseColor }]} />
            <View style={[styles.corner, styles.cBL, { borderColor: phaseColor }]} />
            <View style={[styles.corner, styles.cBR, { borderColor: phaseColor }]} />
          </Animated.View>
        ) : (
          <Animated.View
            style={[
              styles.oval,
              { borderColor: phaseColor, transform: [{ scale: pulseAnim }] },
            ]}
          >
            <View style={[styles.corner, styles.cTL, { borderColor: phaseColor }]} />
            <View style={[styles.corner, styles.cTR, { borderColor: phaseColor }]} />
            <View style={[styles.corner, styles.cBL, { borderColor: phaseColor }]} />
            <View style={[styles.corner, styles.cBR, { borderColor: phaseColor }]} />

            {(phase === 'liveness' || phase === 'processing') && (
              <Animated.View
                style={[
                  styles.scanLine,
                  { backgroundColor: phaseColor, transform: [{ translateY: scanTranslate }] },
                ]}
              />
            )}
          </Animated.View>
        )}

        {/* Liveness progress and step indicators */}
        {phase === 'liveness' && (
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  { width: `${livenessProgress * 100}%`, backgroundColor: phaseColor },
                ]}
              />
            </View>

            <View style={styles.stepIndicators}>
              {livenessState.steps.map((step: any, idx: number) => (
                <View key={step.challenge} style={styles.stepItem}>
                  <View style={[
                    styles.stepDot,
                    step.completed
                      ? styles.stepDotCompleted
                      : idx === livenessState.currentStepIndex
                        ? styles.stepDotActive
                        : styles.stepDotPending,
                  ]}>
                    <Text style={styles.stepDotText}>
                      {step.completed ? '✓' : step.icon}
                    </Text>
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    step.completed && styles.stepLabelCompleted,
                    idx === livenessState.currentStepIndex && styles.stepLabelActive,
                  ]}>
                    {step.challenge === 'blink' ? 'Blink' :
                     step.challenge === 'smile' ? 'Smile' : 'Head Turn'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ── Header bar ── */}
      <View style={styles.header} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onCycleMockUser}
          style={styles.headerPill}
        >
          <Text style={styles.headerIcon}>
            {mode === 'register' ? '🪪' : '🔒'}
          </Text>
          <View>
            <Text style={styles.headerTitle}>
              {mode === 'register' ? 'Face Registration' : 'Face Authentication'}
            </Text>
            <Text style={styles.headerSub}>
              {mode === 'register' ? `Registering: ${userName}` : 'NHAI Field Verification'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Real-time metrics bar ── */}
      {(phase === 'liveness' || phase === 'processing') && (
        <View style={styles.metricsBar} pointerEvents="none">
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>EAR (&lt;0.2)</Text>
            <Text style={[styles.metricValue, metricsDisplay.ear.includes('0.1') ? styles.metricActive : null]}>
              {metricsDisplay.ear}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>MAR (&gt;0.5)</Text>
            <Text style={[styles.metricValue, parseFloat(metricsDisplay.mar) > 0.5 ? styles.metricActive : null]}>
              {metricsDisplay.mar}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>YAW (&gt;10°)</Text>
            <Text style={[styles.metricValue, metricsDisplay.yaw.includes('1') && !metricsDisplay.yaw.startsWith('0') ? styles.metricActive : null]}>
              {metricsDisplay.yaw}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>VAR (&gt;1.0)</Text>
            <Text style={[styles.metricValue, parseFloat(metricsDisplay.coordVariance) < 1 ? styles.metricRed : null]}>
              {metricsDisplay.coordVariance}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>FACE</Text>
            <Text style={[styles.metricValue, metricsDisplay.faceDetected ? styles.metricGreen : styles.metricRed]}>
              {metricsDisplay.faceDetected ? '✓' : '✗'}
            </Text>
          </View>
        </View>
      )}

      {/* ── Spoof detected overlay ── */}
      {phase === 'spoof' && (
        <View style={styles.spoofOverlay} pointerEvents="none">
          <Text style={styles.spoofIcon}>☠️</Text>
          <Text style={styles.spoofTitle}>Spoof Attack Detected</Text>
          <Text style={styles.spoofSub}>Static media detected · Session terminated</Text>
        </View>
      )}

      {/* ── Demo mode banner ── */}
      {/* Banner removed for production presentation */}

      {/* ── Glassmorphic Status bar (bottom) ── */}
      <Animated.View style={[styles.statusBar, { backgroundColor: statusBg, opacity: statusOpacity, borderColor: phaseColor, borderWidth: 1 }]}>
        {(phase === 'liveness' || phase === 'processing') && (
          <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 12 }} />
        )}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.statusText}>{statusText}</Text>
          {inferenceMs !== null && (
            <Text style={styles.inferenceText}>⚡ {inferenceMs}ms inference · {useNative ? 'C++ TFLite' : 'JS Fallback'}</Text>
          )}
        </View>
      </Animated.View>
    </>
  );
};
