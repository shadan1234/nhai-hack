import { StyleSheet, Dimensions, Platform, StatusBar as RNStatusBar } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const OVAL_W = Math.min(SCREEN_W * 0.68, 280);
export const OVAL_H = OVAL_W * 1.25;

const HEADER_TOP = Platform.OS === 'ios' ? 56 : (RNStatusBar.currentHeight || 24) + 12;
const STATUS_BOTTOM_PAD = Platform.OS === 'ios' ? 40 : 28;

const OVAL_CENTER_Y = SCREEN_H * 0.46;
export const OVAL_TOP = OVAL_CENTER_Y - OVAL_H / 2;

const OVERLAY_TOP_H = OVAL_TOP - 8;
const OVERLAY_BOTTOM_START = OVAL_TOP + OVAL_H + 8;
const SIDE_W = (SCREEN_W - OVAL_W) / 2 - 4;

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: OVERLAY_TOP_H,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  overlayBottom: {
    position: 'absolute',
    top: OVERLAY_BOTTOM_START,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  overlayLeft: {
    position: 'absolute',
    top: OVERLAY_TOP_H,
    left: 0,
    width: SIDE_W,
    height: OVAL_H + 16,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  overlayRight: {
    position: 'absolute',
    top: OVERLAY_TOP_H,
    right: 0,
    width: SIDE_W,
    height: OVAL_H + 16,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },

  ovalWrapper: {
    position: 'absolute',
    top: OVAL_TOP,
    left: (SCREEN_W - OVAL_W) / 2,
    width: OVAL_W,
    alignItems: 'center',
  },
  oval: {
    width: OVAL_W,
    height: OVAL_H,
    borderWidth: 3,
    borderRadius: 24, // Datalake 3.0 squircle
    backgroundColor: 'transparent',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#48CAE4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
  },
  dynamicBox: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 16,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#48CAE4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },

  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderWidth: 4,
  },
  cTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  cTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  cBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  cBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },

  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.7,
  },

  progressBarContainer: {
    marginTop: 16,
    width: OVAL_W,
    alignItems: 'center',
  },
  progressBarBg: {
    width: '90%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  stepDotPending: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  stepDotActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56,189,248,0.15)',
  },
  stepDotCompleted: {
    borderColor: '#00E57A',
    backgroundColor: 'rgba(0,229,122,0.2)',
  },
  stepDotText: {
    fontSize: 14,
    color: '#FFF',
  },
  stepLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stepLabelActive: {
    color: '#38BDF8',
  },
  stepLabelCompleted: {
    color: '#00E57A',
  },

  header: {
    position: 'absolute',
    top: HEADER_TOP,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(11,17,32,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerIcon: { fontSize: 22 },
  headerTitle: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 1,
  },
  pipelineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 6,
  },
  pipelineBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  metricsBar: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(11,17,32,0.85)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  metricValue: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  metricActive: {
    color: '#FFD644',
  },
  metricGreen: {
    color: '#00E57A',
  },
  metricRed: {
    color: '#FF4C4C',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  statusBar: {
    position: 'absolute',
    bottom: STATUS_BOTTOM_PAD,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 24,
    // Glassmorphism effects
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  statusText: {
    color: '#F8F9FA',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  inferenceText: {
    color: 'rgba(248, 249, 250, 0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  guardContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  guardIcon: { fontSize: 52, marginBottom: 16 },
  guardText: {
    color: '#F1F5F9',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  guardSub: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  spoofOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(127,29,29,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  spoofIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  spoofTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  spoofSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  demoBanner: {
    position: 'absolute',
    bottom: 130,
    left: 30,
    right: 30,
    backgroundColor: 'rgba(180,83,9,0.85)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  demoBannerText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
